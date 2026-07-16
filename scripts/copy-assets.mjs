/**
 * Copia los assets que no son TypeScript al build. `tsc` solo emite .js, así que
 * la base de conocimiento (productos/*.md) no llega a dist/ por sí sola y
 * `node dist/main/server.js` no encontraría el conocimiento en runtime.
 */
import { cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src/infrastructure/knowledge/productos");
const to = join(root, "dist/infrastructure/knowledge/productos");

cpSync(from, to, { recursive: true });
console.log(`Assets de conocimiento copiados -> ${to}`);

// El FAQ router lee el benchmark (dudas + respuestas canónicas) en runtime. Es
// la única fuente (dev lo lee de docs/); acá lo dejamos en dist/ para que el
// contenedor lo tenga sin depender de que docs/ esté en la imagen.
const benchFrom = join(root, "docs/benchmark-dudas.json");
const benchTo = join(root, "dist/benchmark-dudas.json");
cpSync(benchFrom, benchTo);
console.log(`Benchmark del FAQ copiado -> ${benchTo}`);
