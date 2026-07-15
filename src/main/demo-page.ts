/**
 * Página de la demo web: un chat self-contained que habla con POST /chat.
 * Usa el mismo motor que WhatsApp; solo cambia el canal. Sirve para que
 * cualquiera pruebe el bot en el navegador, sin Meta ni allowlist.
 */
export const DEMO_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Asistente de seguros de La Caja (demo)</title>
<style>
  :root { --rojo:#c8102e; --bg:#eae6df; --burbuja-bot:#fff; --burbuja-user:#d9fdd3; --texto:#111b21; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--texto); }
  .app { max-width:640px; margin:0 auto; height:100dvh; display:flex; flex-direction:column; background:var(--bg); }
  header { background:var(--rojo); color:#fff; padding:14px 16px; display:flex; align-items:center; gap:12px; }
  header .avatar { width:40px; height:40px; border-radius:50%; background:#fff2; display:flex; align-items:center; justify-content:center; font-size:20px; }
  header h1 { font-size:16px; margin:0; line-height:1.2; }
  header p { font-size:12px; margin:2px 0 0; opacity:.85; }
  .chat { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
  .msg { max-width:80%; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-wrap:break-word; line-height:1.4; font-size:14.5px; box-shadow:0 1px 1px #0001; }
  .bot { align-self:flex-start; background:var(--burbuja-bot); border-top-left-radius:2px; }
  .user { align-self:flex-end; background:var(--burbuja-user); border-top-right-radius:2px; }
  .typing { align-self:flex-start; color:#667781; font-size:13px; font-style:italic; padding:4px 12px; }
  form { display:flex; gap:8px; padding:12px; background:#f0f2f5; }
  input { flex:1; border:none; border-radius:20px; padding:11px 16px; font-size:15px; outline:none; }
  button { border:none; background:var(--rojo); color:#fff; border-radius:20px; padding:0 18px; font-size:15px; cursor:pointer; }
  button:disabled { opacity:.5; cursor:default; }
  .aviso { text-align:center; font-size:11.5px; color:#667781; padding:6px 16px 0; }
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="avatar">🛡️</div>
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
