/**
 * Adapter del puerto KnowledgeSource que lee los .md de productos/ y los
 * concatena. Es el único módulo que conoce el layout en disco de la base de
 * conocimiento. Cambiar a un CMS o una API es escribir otro adapter con la
 * misma interfaz.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KnowledgeSource } from "../../application/ports.js";

const here = dirname(fileURLToPath(import.meta.url));
const productosDir = join(here, "productos");

export function createFilesystemKnowledge(): KnowledgeSource {
  let cached: string | null = null;
  return {
    async load() {
      if (cached === null) {
        const files = readdirSync(productosDir).filter((f) => f.endsWith(".md"));
        const parts = files.map((f) => readFileSync(join(productosDir, f), "utf8"));
        cached = parts.join("\n\n---\n\n");
      }
      return cached;
    },
  };
}
