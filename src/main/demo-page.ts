/**
 * Página de la demo web: un chat self-contained que habla con POST /chat.
 * Usa el mismo motor que WhatsApp; solo cambia el canal. Sirve para que
 * cualquiera pruebe el bot en el navegador, sin Meta ni allowlist.
 *
 * La UI replica el chat de WhatsApp en modo oscuro lo más fiel posible: header
 * oscuro con avatar + nombre, fondo de doodles que se repite (tile infinito),
 * burbujas con hora, e input con botón de envío circular. El fondo se embebe en
 * base64 desde ./demo-assets.
 *
 * La identidad es white-label: el nombre sale de config.brand (BRAND_NAME) con
 * un default neutro. A propósito NO hay logo de terceros ni tilde de "cuenta
 * verificada": esta demo no debe hacerse pasar por el canal de nadie.
 */
import { config } from "../config/index.js";
import { FONDO_WHATSAPP } from "./demo-assets.js";

const NOMBRE_DEMO = config.brand.name || "Asesor de Seguros";

export const DEMO_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${NOMBRE_DEMO} (demo)</title>
<style>
  :root {
    --wa-bg:#0b141a; --wa-header:#111b21;
    --burbuja-bot:#202c33; --burbuja-user:#005c4b;
    --texto:#e9edef; --texto-sec:#8696a0; --input-bg:#2a3942;
    --send:#00a884; --check:#25d366;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--wa-bg); color:var(--texto); }
  .app { max-width:640px; margin:0 auto; height:100dvh; display:flex; flex-direction:column; background:var(--wa-bg); position:relative; overflow:hidden; }
  /* Fondo de doodles que se repite infinitamente (tile), como el chat real. */
  .doodle-bg { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; background-color:var(--wa-bg); background-image:url("${FONDO_WHATSAPP}"); background-repeat:repeat; background-size:300px; }
  header { position:relative; z-index:2; background:var(--wa-header); color:var(--texto); padding:9px 14px; display:flex; align-items:center; gap:10px; box-shadow:0 1px 0 #0006; }
  header .back { color:var(--texto-sec); font-size:26px; line-height:1; margin:-2px 2px 0 -2px; }
  header .avatar { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#00a884,#005c4b); overflow:hidden; flex:0 0 auto; display:flex; align-items:center; justify-content:center; font-size:20px; }
  header .title { display:flex; flex-direction:column; min-width:0; }
  header .name { display:flex; align-items:center; gap:5px; font-size:16px; font-weight:600; line-height:1.25; }
  header .name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  header .status { font-size:12.5px; color:var(--texto-sec); margin-top:1px; }
  .chat { position:relative; z-index:1; flex:1; overflow-y:auto; padding:12px 6% 6px; display:flex; flex-direction:column; gap:3px; }
  .msg { position:relative; max-width:82%; padding:6px 9px 5px; border-radius:8px; white-space:pre-wrap; word-wrap:break-word; line-height:1.4; font-size:14.5px; box-shadow:0 1px .5px #00000040; margin-bottom:2px; }
  .bot { align-self:flex-start; background:var(--burbuja-bot); border-top-left-radius:2px; }
  .user { align-self:flex-end; background:var(--burbuja-user); border-top-right-radius:2px; }
  .time { display:block; text-align:right; font-size:11px; color:#ffffff73; margin:2px -2px -1px 8px; }
  .typing { align-self:flex-start; color:var(--texto-sec); font-size:13px; font-style:italic; padding:4px 10px; }
  .aviso { position:relative; z-index:1; text-align:center; font-size:11px; color:var(--texto-sec); padding:2px 16px 4px; }
  form { position:relative; z-index:2; display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--wa-header); }
  form .plus { color:var(--texto-sec); font-size:26px; line-height:1; flex:0 0 auto; padding:0 2px; }
  input { flex:1; border:none; border-radius:22px; padding:11px 16px; font-size:15px; outline:none; background:var(--input-bg); color:var(--texto); }
  input::placeholder { color:var(--texto-sec); }
  button { border:none; background:var(--send); color:#0b141a; border-radius:50%; width:44px; height:44px; flex:0 0 auto; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  button svg { width:22px; height:22px; }
</style>
</head>
<body>
<div class="app">
  <div class="doodle-bg"></div>
  <header>
    <span class="back">&#8249;</span>
    <div class="avatar" aria-hidden="true">🛡️</div>
    <div class="title">
      <div class="name">
        <span>${NOMBRE_DEMO}</span>
      </div>
      <div class="status">demo · en línea</div>
    </div>
  </header>
  <div class="chat" id="chat"></div>
  <div class="aviso">Demo white-label. Caso de estudio con datos públicos de La Caja; no es un canal oficial.</div>
  <form id="form" autocomplete="off">
    <span class="plus">+</span>
    <input id="input" placeholder="Mensaje" />
    <button id="send" type="submit" aria-label="Enviar">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
    </button>
  </form>
</div>
<script>
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const send = document.getElementById("send");
  // Un id estable por navegador para que la sesión persista entre mensajes.
  let userId = localStorage.getItem("demo_chat_uid");
  if (!userId) { userId = "web-" + Math.random().toString(36).slice(2, 12); localStorage.setItem("demo_chat_uid", userId); }

  function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c])); }
  function format(text) { return escapeHtml(text).replace(/\\*([^*\\n]+)\\*/g, "<b>$1</b>").replace(/\\n/g, "<br>"); }
  function hora() { return new Date().toLocaleTimeString("es-AR", { hour: "numeric", minute: "2-digit", hour12: true }); }
  function bubble(text, who) {
    const el = document.createElement("div");
    el.className = "msg " + who;
    el.innerHTML = format(text) + '<span class="time">' + hora() + "</span>";
    chat.appendChild(el);
    chat.scrollTop = chat.scrollHeight;
  }

  async function ask(text) {
    const typing = document.createElement("div");
    typing.className = "typing"; typing.textContent = "escribiendo...";
    chat.appendChild(typing); chat.scrollTop = chat.scrollHeight;
    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, text }),
      });
      const data = await res.json();
      typing.remove();
      bubble(data.reply || "(sin respuesta)", "bot");
    } catch (e) {
      typing.remove();
      bubble("Ups, no pude responder. Probá de nuevo.", "bot");
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    bubble(text, "user");
    input.value = "";
    ask(text);
  });

  // Saludo automático para mostrar el menú apenas entra.
  ask("hola");
</script>
</body>
</html>`;
