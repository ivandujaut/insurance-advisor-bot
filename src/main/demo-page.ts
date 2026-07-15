/**
 * Página de la demo web: un chat self-contained que habla con POST /chat.
 * Usa el mismo motor que WhatsApp; solo cambia el canal. Sirve para que
 * cualquiera pruebe el bot en el navegador, sin Meta ni allowlist.
 *
 * La UI replica WhatsApp en modo oscuro: fondo oscuro con el patrón de doodles,
 * burbujas oscuras (entrante gris, saliente verde) y el logo de La Caja como
 * avatar. Todo inline (sin assets externos) para que el HTML sea autocontenido.
 */

// Logo de La Caja (PNG 300x300 embebido) usado como avatar.
const LOGO_LACAJA =
  "data:image/png;base64,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";

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
  .doodle-bg { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; }
  header { position:relative; z-index:2; background:var(--rojo); color:#fff; padding:12px 16px; display:flex; align-items:center; gap:12px; box-shadow:0 1px 3px #0006; }
  header .avatar { width:42px; height:42px; border-radius:50%; background:#fff; overflow:hidden; flex:0 0 auto; display:flex; align-items:center; justify-content:center; }
  header .avatar img { width:100%; height:100%; object-fit:cover; }
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
  <svg class="doodle-bg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <pattern id="wa" patternUnits="userSpaceOnUse" width="220" height="220">
        <g fill="none" stroke="#c3d0d6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.07">
          <path d="M20 26 h34 a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h-18 l-10 8 v-8 h-6 a6 6 0 0 1 -6 -6 v-16 a6 6 0 0 1 6 -6 z"/>
          <path d="M150 30 c-6 -10 -22 -6 -22 6 c0 10 22 22 22 22 c0 0 22 -12 22 -22 c0 -12 -16 -16 -22 -6 z"/>
          <path d="M95 92 l6 14 l15 1 l-11 10 l4 15 l-14 -8 l-14 8 l4 -15 l-11 -10 l15 -1 z"/>
          <rect x="150" y="132" width="46" height="34" rx="5"/>
          <circle cx="173" cy="149" r="9"/>
          <path d="M160 132 l4 -6 h18 l4 6"/>
          <circle cx="35" cy="150" r="20"/>
          <circle cx="29" cy="145" r="1.6" fill="#c3d0d6"/>
          <circle cx="41" cy="145" r="1.6" fill="#c3d0d6"/>
          <path d="M27 156 q8 8 16 0"/>
          <path d="M120 178 v-28 l20 -5 v28"/>
          <circle cx="116" cy="180" r="5"/>
          <circle cx="136" cy="175" r="5"/>
          <path d="M197 58 l-11 17 h9 l-9 17 l19 -21 h-9 z"/>
          <circle cx="72" cy="42" r="2" fill="#c3d0d6"/>
          <circle cx="182" cy="100" r="2" fill="#c3d0d6"/>
          <circle cx="60" cy="200" r="2" fill="#c3d0d6"/>
          <circle cx="105" cy="200" r="14"/>
          <path d="M100 200 h10 M105 195 v10"/>
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wa)"/>
  </svg>
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
