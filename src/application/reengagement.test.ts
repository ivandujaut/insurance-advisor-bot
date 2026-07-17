import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "../domain/conversation/session.js";
import type {
  EventSink,
  MessagingProvider,
  OutgoingMessage,
  SessionStore,
  TemplateMessage,
} from "./ports.js";
import {
  buildNudge,
  buildTemplateMessage,
  runReengagement,
  runTemplateReengagement,
  shouldNudge,
  shouldSendTemplate,
} from "./reengagement.js";

const MIN = 60 * 1000;
const OPTS = { afterMs: 30 * MIN, windowMs: 24 * 60 * MIN };
const NOW = new Date("2026-07-17T12:00:00.000Z");
const hace = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function session(over: Partial<Session> = {}): Session {
  return {
    userId: "u1",
    stage: "quoting_auto",
    data: {},
    history: [],
    lastActivityAt: hace(45 * MIN), // 45 min: elegible
    ...over,
  };
}

test("shouldNudge: a mitad de flujo, inactivo > umbral y sin nudgear -> true", () => {
  assert.equal(shouldNudge(session(), NOW, OPTS), true);
});

test("shouldNudge: hueco corto -> false", () => {
  assert.equal(shouldNudge(session({ lastActivityAt: hace(10 * MIN) }), NOW, OPTS), false);
});

test("shouldNudge: fuera de la ventana de 24h -> false", () => {
  assert.equal(shouldNudge(session({ lastActivityAt: hace(25 * 60 * MIN) }), NOW, OPTS), false);
});

test("shouldNudge: no está a mitad de flujo -> false", () => {
  assert.equal(shouldNudge(session({ stage: "main_menu" }), NOW, OPTS), false);
});

test("shouldNudge: ya nudgeado en este hueco -> false", () => {
  assert.equal(shouldNudge(session({ data: { nudged: "1" } }), NOW, OPTS), false);
});

test("shouldNudge: sin lastActivityAt -> false", () => {
  assert.equal(shouldNudge(session({ lastActivityAt: undefined }), NOW, OPTS), false);
});

test("buildNudge: incluye el producto y la salida a menú", () => {
  const t = buildNudge(session()) ?? "";
  assert.match(t, /seguís por ahí/i);
  assert.match(t, /auto/);
  assert.match(t, /menú/);
});

test("runReengagement: nudgea solo a los elegibles, marca y loguea", async () => {
  const sesiones = [
    session({ userId: "elegible" }),
    session({ userId: "reciente", lastActivityAt: hace(5 * MIN) }),
    session({ userId: "en-menu", stage: "main_menu" }),
  ];
  const sent: OutgoingMessage[] = [];
  const logged: string[] = [];
  const saved: string[] = [];
  const sessions: SessionStore = {
    get: async () => undefined,
    save: async (s) => {
      saved.push(s.userId);
    },
    listActive: async () => sesiones,
  };
  const messaging: MessagingProvider = {
    name: "fake",
    send: async (m) => {
      sent.push(m);
    },
  };
  const events: EventSink = {
    log: async (_type, userId) => {
      logged.push(userId);
    },
  };

  const n = await runReengagement({ sessions, messaging, events }, NOW, OPTS);
  assert.equal(n, 1);
  assert.deepEqual(
    sent.map((s) => s.to),
    ["elegible"],
  );
  assert.equal(sesiones[0]?.data.nudged, "1", "marca la sesión para no repetir");
  assert.deepEqual(saved, ["elegible"]);
  assert.deepEqual(logged, ["elegible"]);
});

test("runReengagement: un store sin listActive devuelve 0 (no rompe)", async () => {
  const sessions: SessionStore = { get: async () => undefined, save: async () => {} };
  const messaging: MessagingProvider = { name: "fake", send: async () => {} };
  const events: EventSink = { log: async () => {} };
  assert.equal(await runReengagement({ sessions, messaging, events }, NOW, OPTS), 0);
});

// --- C: plantilla fuera de la ventana de 24h ---

const TOPTS = {
  windowMs: 24 * 60 * MIN,
  maxMs: 72 * 60 * MIN,
  templateName: "cotizacion_a_medias",
  templateLanguage: "es_AR",
};
const conOptIn = (over: Partial<Session> = {}): Session =>
  session({ data: { optIn: "1" }, lastActivityAt: hace(36 * 60 * MIN), ...over });

test("shouldSendTemplate: mitad de flujo, con opt-in, fuera de la ventana -> true", () => {
  assert.equal(shouldSendTemplate(conOptIn(), NOW, TOPTS), true);
});

test("shouldSendTemplate: sin opt-in -> false (marketing necesita consentimiento)", () => {
  assert.equal(shouldSendTemplate(conOptIn({ data: {} }), NOW, TOPTS), false);
});

test("shouldSendTemplate: todavía dentro de la ventana de 24h -> false", () => {
  assert.equal(
    shouldSendTemplate(conOptIn({ lastActivityAt: hace(10 * 60 * MIN) }), NOW, TOPTS),
    false,
  );
});

test("shouldSendTemplate: pasado el corte (lead frío) -> false", () => {
  assert.equal(
    shouldSendTemplate(conOptIn({ lastActivityAt: hace(80 * 60 * MIN) }), NOW, TOPTS),
    false,
  );
});

test("shouldSendTemplate: ya se mandó la plantilla -> false", () => {
  assert.equal(
    shouldSendTemplate(conOptIn({ data: { optIn: "1", templateSent: "1" } }), NOW, TOPTS),
    false,
  );
});

test("buildTemplateMessage: arma la plantilla con el producto como variable", () => {
  const m = buildTemplateMessage(conOptIn(), TOPTS);
  assert.equal(m?.template, "cotizacion_a_medias");
  assert.equal(m?.language, "es_AR");
  assert.deepEqual(m?.params, ["auto"]);
});

test("runTemplateReengagement: manda la plantilla a los elegibles y marca", async () => {
  const sesiones = [
    conOptIn({ userId: "elegible" }),
    conOptIn({ userId: "sin-optin", data: {} }),
    conOptIn({ userId: "en-ventana", lastActivityAt: hace(10 * 60 * MIN) }),
  ];
  const sent: TemplateMessage[] = [];
  const sessions: SessionStore = {
    get: async () => undefined,
    save: async () => {},
    listActive: async () => sesiones,
  };
  const messaging: MessagingProvider = {
    name: "fake",
    send: async () => {},
    sendTemplate: async (m) => {
      sent.push(m);
    },
  };
  const events: EventSink = { log: async () => {} };
  const n = await runTemplateReengagement({ sessions, messaging, events }, NOW, TOPTS);
  assert.equal(n, 1);
  assert.deepEqual(
    sent.map((m) => m.to),
    ["elegible"],
  );
  assert.equal(sesiones[0]?.data.templateSent, "1");
});

test("runTemplateReengagement: sin sendTemplate en el proveedor -> 0", async () => {
  const sessions: SessionStore = {
    get: async () => undefined,
    save: async () => {},
    listActive: async () => [conOptIn()],
  };
  const messaging: MessagingProvider = { name: "fake", send: async () => {} }; // sin sendTemplate
  const events: EventSink = { log: async () => {} };
  assert.equal(await runTemplateReengagement({ sessions, messaging, events }, NOW, TOPTS), 0);
});
