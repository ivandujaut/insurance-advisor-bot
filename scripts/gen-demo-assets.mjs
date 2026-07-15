// Genera src/main/demo-assets.ts embebiendo los assets de la demo (logo + fondo)
// como data URIs base64, para que la página siga siendo autocontenida (sin
// requests a hosts externos). Re-correr si cambian los archivos de assets/:
//   node scripts/gen-demo-assets.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = resolve(root, "src/main/assets");

const logoSvg = readFileSync(resolve(assets, "la-caja-logo.svg")).toString("base64");
const fondoJpg = readFileSync(resolve(assets, "fondo.jpg")).toString("base64");

const out = `/**
 * Assets de la demo web embebidos como data URIs (autocontenido, sin hosts
 * externos). NO editar a mano: generado por scripts/gen-demo-assets.mjs a
 * partir de src/main/assets/. Re-correr ese script si cambian los archivos.
 */
export const LOGO_LACAJA = "data:image/svg+xml;base64,${logoSvg}";
export const FONDO_WHATSAPP = "data:image/jpeg;base64,${fondoJpg}";
`;

writeFileSync(resolve(root, "src/main/demo-assets.ts"), out);
console.log(
  "demo-assets.ts generado: logo %d B, fondo %d B (base64)",
  logoSvg.length,
  fondoJpg.length,
);
