// Genera src/main/demo-assets.ts embebiendo los assets de la demo (fondo)
// como data URIs base64, para que la página siga siendo autocontenida (sin
// requests a hosts externos). Re-correr si cambian los archivos de assets/:
//   node scripts/gen-demo-assets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "src/main/assets");

// Tile seamless de doodles (SVG): repite sin juntas por background-repeat.
const fondoSvg = readFileSync(resolve(assets, "fondo-tile.svg")).toString("base64");

const out = `/**
 * Assets de la demo web embebidos como data URIs (autocontenido, sin hosts
 * externos). NO editar a mano: generado por scripts/gen-demo-assets.mjs a
 * partir de src/main/assets/. Re-correr ese script si cambian los archivos.
 */
export const FONDO_WHATSAPP = "data:image/svg+xml;base64,${fondoSvg}";
`;

writeFileSync(resolve(root, "src/main/demo-assets.ts"), out);
console.log("demo-assets.ts generado: fondo %d B (base64)", fondoSvg.length);
