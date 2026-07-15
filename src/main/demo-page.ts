/**
 * Página de la demo web: un chat self-contained que habla con POST /chat.
 * Usa el mismo motor que WhatsApp; solo cambia el canal. Sirve para que
 * cualquiera pruebe el bot en el navegador, sin Meta ni allowlist.
 *
 * La UI replica WhatsApp en modo oscuro: fondo oscuro con el patrón de doodles,
 * burbujas oscuras (entrante gris, saliente verde) y el logo de La Caja como
 * avatar. Todo inline (sin assets externos) para que el HTML sea autocontenido.
 */

import { FONDO_WHATSAPP, LOGO_LACAJA } from "./demo-assets.js";

export const DEMO_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Asistente de seguros de La Caja (demo)</title>
<style>
  :root {
    --rojo:#c8102e; --wa-bg:#0b141a;
    --burbuja-bot:#202c33; --burbuja-user:#005c4b;
    --texto:#e9edef; --texto-sec:#8696a0; --input-bg:#2a3942;
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--wa-bg); color:var(--texto); }
  .app { max-width:640px; margin:0 auto; height:100dvh; display:flex; flex-direction:column; background:var(--wa-bg); position:relative; overflow:hidden; }
  /* Fondo de doodles estilo WhatsApp modo oscuro, detrás de todo. */
  .doodle-bg { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; background:#0b141a center/cover no-repeat; background-image:url("${FONDO_WHATSAPP}"); }
  header { position:relative; z-index:2; background:var(--rojo); color:#fff; padding:12px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 3px #0006; }
  header .avatar { width:44px; height:44px; border-radius:9px; background:#fff; overflow:hidden; flex:0 0 auto; display:flex; align-items:center; justify-content:center; }
  header .avatar img { width:100%; height:100%; object-fit:contain; padding:3px; }
  header h1 { font-size:16px; margin:0; line-height:1.2; }
  header p { font-size:12px; margin:2px 0 0; opacity:.85; }
  .chat { position:relative; z-index:1; flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
  .msg { max-width:80%; padding:7px 11px; border-radius:8px; white-space:pre-wrap; word-wrap:break-word; line-height:1.4; font-size:14.5px; box-shadow:0 1px 1px #0003; }
  .bot { align-self:flex-start; background:var(--burbuja-bot); border-top-left-radius:2px; }
  .user { align-self:flex-end; background:var(--burbuja-user); border-top-right-radius:2px; }
  .typing { align-self:flex-start; color:var(--texto-sec); font-size:13px; font-style:italic; padding:4px 12px; }
  .aviso { position:relative; z-index:1; text-align:center; font-size:11px; color:var(--texto-sec); padding:4px 16px 0; }
  form { position:relative; z-index:2; display:flex; gap:8px; padding:10px 12px; background:#111b21; }
  input { flex:1; border:none; border-radius:20px; padding:11px 16px; font-size:15px; outline:none; background:var(--input-bg); color:var(--texto); }
  input::placeholder { color:var(--texto-sec); }
  button { border:none; background:var(--rojo); color:#fff; border-radius:20px; padding:0 18px; font-size:15px; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
</style>
</head>
<body>
<div class="app">
  <div class="doodle-bg"></div>
  <header>
    <div class="avatar"><img src="${LOGO_LACAJA}" alt="La Caja" /></div>
    <div>
      <h1>Asistente de seguros de La Caja</h1>
      <p>Demo · cotizá auto, hogar, accidentes y bici</p>
    </div>
  </header>
  <div class="chat" id="chat"></div>
  <div class="aviso">Demo con datos públicos. No es un canal oficial de La Caja.</div>
  <form id="form" autocomplete="off">
    <input id="input" placeholder="Escribí un mensaje..." />
    <button id="send" type="submit">Enviar</button>
  </form>
</div>
<script>
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const send = document.getElementById("send");
  // Un id estable por navegador para que la sesión persista entre mensajes.
  let userId = localStorage.getItem("lacaja_demo_uid");
  if (!userId) { userId = "web-" + Math.random().toString(36).slice(2, 12); localStorage.setItem("lacaja_demo_uid", userId); }

  function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c])); }
  function format(text) { return escapeHtml(text).replace(/\\*([^*\\n]+)\\*/g, "<b>$1</b>").replace(/\\n/g, "<br>"); }
  function bubble(text, who) {
    const el = document.createElement("div");
    el.className = "msg " + who;
    el.innerHTML = format(text);
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
