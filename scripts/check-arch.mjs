/**
 * Chequeo de la regla de dependencias del ADR 0001.
 * El núcleo (domain/ y application/) no debe importar de infrastructure/ ni de
 * main/. Las dependencias apuntan hacia adentro; solo el composition root (main/)
 * conoce los adapters concretos.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const INNER = ["src/domain", "src/application"];
const FORBIDDEN = /from\s+["'][^"']*\/(infrastructure|main)\//;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const violations = [];
for (const base of INNER) {
  for (const file of walk(base)) {
    const content = readFileSync(file, "utf8");
    for (const [i, line] of content.split("\n").entries()) {
      if (FORBIDDEN.test(line)) violations.push(`${file}:${i + 1}  ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("❌ Violación de la regla de dependencias (domain/application no deben importar infrastructure/main):");
  for (const v of violations) console.error(`   ${v}`);
  process.exit(1);
}

console.log("✅ Arquitectura OK: domain/ y application/ no importan de infrastructure/ ni main/.");
