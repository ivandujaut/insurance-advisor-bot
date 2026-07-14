/**
 * Chat por consola: prueba todo el motor del bot sin WhatsApp ni credenciales
 * de mensajería. Ideal para desarrollo.
 *
 *   pnpm chat
 */
import { createInterface } from "node:readline";
import { processMessage } from "../application/process-message.js";
import { buildDependencies } from "./container.js";

const USER_ID = "cli-user";
const deps = await buildDependencies();

const rl = createInterface({ input: process.stdin, output: process.stdout });

console.log("💬 Chat de prueba (escribí 'salir' para terminar).\n");

function ask(): void {
  rl.question("🧑 Vos: ", async (text) => {
    const input = text.trim();
    if (input.toLowerCase() === "salir") {
      rl.close();
      return;
    }

    try {
      const reply = await processMessage({ from: USER_ID, text: input, name: "Usuario" }, deps);
      console.log(`\n🤖 Bot:\n${reply}\n`);
    } catch (err) {
      console.error("Error:", err);
    }
    ask();
  });
}

ask();
