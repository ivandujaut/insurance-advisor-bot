/**
 * Base de conocimiento: carga los .md de productos/ y los concatena para
 * usarlos como contexto (grounding) del LLM.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const productosDir = join(here, "productos");

let cached: string | null = null;

/** Devuelve todo el conocimiento concatenado (cacheado tras la primera lectura). */
export function loadKnowledge(): string {
  if (cached !== null) return cached;

  const files = readdirSync(productosDir).filter((f) => f.endsWith(".md"));
  const parts = files.map((f) => readFileSync(join(productosDir, f), "utf8"));
  cached = parts.join("\n\n---\n\n");
  return cached;
}
