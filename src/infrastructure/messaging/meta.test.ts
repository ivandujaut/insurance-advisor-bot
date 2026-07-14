import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { parseMetaWebhook, verifyMetaSignature } from "./meta.js";

test("parseMetaWebhook extrae el mensaje de texto con from y name", () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ profile: { name: "Ana" } }],
              messages: [{ from: "5491100000000", type: "text", text: { body: "hola" } }],
            },
          },
        ],
      },
    ],
  };
  const msgs = parseMetaWebhook(payload);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0]?.from, "5491100000000");
  assert.equal(msgs[0]?.text, "hola");
  assert.equal(msgs[0]?.name, "Ana");
});

test("parseMetaWebhook ignora eventos que no son mensajes de texto", () => {
  const statusPayload = {
    entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }],
  };
  assert.equal(parseMetaWebhook(statusPayload).length, 0);
  assert.equal(parseMetaWebhook(null).length, 0);
  assert.equal(parseMetaWebhook({}).length, 0);
});

test("verifyMetaSignature acepta una firma válida y rechaza las inválidas", () => {
  const secret = "app-secret-de-prueba";
  const body = JSON.stringify({ hello: "world" });
  const valid = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.equal(verifyMetaSignature(body, valid, secret), true, "firma correcta");
  assert.equal(verifyMetaSignature(body, "sha256=deadbeef", secret), false, "firma incorrecta");
  assert.equal(verifyMetaSignature(body, undefined, secret), false, "sin firma");
  assert.equal(verifyMetaSignature("otro body", valid, secret), false, "body alterado");
});
