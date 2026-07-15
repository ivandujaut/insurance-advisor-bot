/**
 * Genera docs/casos-cotizacion-auto.md: enumera casos del flujo de cotización de
 * auto y calcula la estimación del motor para cada uno. Worksheet para relevar
 * precios reales y afinar la tabla de valores y las tasas por plan.
 *
 *   node --import tsx scripts/gen-casos-auto.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { estimarPrima } from "../src/domain/quoting/rating.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pesos = (n) => `$${n.toLocaleString("es-AR")}`;
const rango = (q) => `${pesos(q.desde)} a ${pesos(q.hasta)}`;

const MODELOS = [
  { modelo: "gol", label: "VW Gol (económico)" },
  { modelo: "corolla", label: "Toyota Corolla (media)" },
  { modelo: "hilux", label: "Toyota Hilux (alta)" },
];
const ANIOS = [2024, 2020, 2015, 2010];
const ZONA = [
  { label: "CABA", cp: "1425" },
  { label: "GBA", cp: "1650" },
  { label: "interior", cp: "5000" },
];
const PLANES = ["Terceros Completo", "Terceros Completo con Granizo", "Todo Riesgo con Franquicia"];

const q = (over) =>
  estimarPrima({
    anio: "2020",
    marca: "",
    modelo: "corolla",
    condicion: "usado",
    gnc: false,
    cp: "5000",
    plan: "Terceros Completo",
    ...over,
  });

let md = "";
md += "# Casos de uso del flujo de cotización de auto\n\n";
md += "Worksheet para iterar y afinar el motor de auto (`estimarPrima`). El precio es\n";
md += "una tasa por plan sobre el **valor asegurado**, que se deriva de modelo/año (no\n";
md += "se pregunta). La columna **Precio real** se completa relevando el cotizador de La\n";
md += "Caja; si un caso cae fuera del rango, se ajusta el valor 0km del modelo o la tasa.\n\n";
md += "Generado con `scripts/gen-casos-auto.mjs` (regenerar tras tocar el modelo).\n\n";

md += "## Dimensiones del flujo\n\n";
md += "| Dimensión | Valores | Impacto en el precio |\n|---|---|---|\n";
md +=
  "| Modelo | de una tabla de valores | Define el valor asegurado (base 0km). El gran driver. |\n";
md +=
  "| Año / condición | 2006 a hoy · 0km/usado | Deprecia el valor (~7% por año); un 0km vale como nuevo. |\n";
md +=
  "| Zona (por CP) | CABA / GBA / interior | Riesgo de robo: CABA 1,25 · GBA 1,15 · interior 1,0. |\n";
md += "| GNC | sí/no | Recargo del 8% por mayor riesgo de incendio. |\n";
md +=
  "| Plan | Terceros Completo / con Granizo / Todo Riesgo | Tasa sobre el valor: 0,47% / 0,59% / 0,73%. |\n\n";

md += "## Caso de anclaje (precios reales relevados)\n\n";
md += "Toyota Corolla 2020, usado, sin GNC, CABA (valor asegurado ~$27.285.000):\n\n";
md += "| Plan | Estimación bot | Precio real |\n|---|---|---|\n";
const reales = {
  "Terceros Completo": "$160.165",
  "Terceros Completo con Granizo": "$202.443",
  "Todo Riesgo con Franquicia": "$247.847",
};
for (const plan of PLANES) {
  md += `| ${plan} | ${rango(q({ modelo: "corolla", anio: "2020", cp: "1425", plan }))} | ${reales[plan]} ✅ |\n`;
}
md += "\n";

md += "## Matriz valor: modelo x año (Terceros Completo, interior, usado)\n\n";
md += "Muestra cómo el valor del vehículo mueve el precio (lo que antes no capturábamos).\n\n";
md += `| Modelo | ${ANIOS.join(" | ")} |\n|---|${ANIOS.map(() => "---").join("|")}|\n`;
for (const m of MODELOS) {
  const celdas = ANIOS.map((anio) => rango(q({ modelo: m.modelo, anio: String(anio) })));
  md += `| ${m.label} | ${celdas.join(" | ")} |\n`;
}
md += "\n";

md += "## Eje zona (Corolla 2020 usado, Todo Riesgo)\n\n";
md += "| Zona | Estimación bot | Precio real |\n|---|---|---|\n";
for (const z of ZONA) {
  md += `| ${z.label} | ${rango(q({ modelo: "corolla", anio: "2020", cp: z.cp, plan: "Todo Riesgo con Franquicia" }))} | |\n`;
}
md += "\n";

md += "## Eje GNC (Corolla 2020 usado, CABA, Terceros Completo)\n\n";
md += "| GNC | Estimación bot |\n|---|---|\n";
for (const gnc of [false, true]) {
  md += `| ${gnc ? "sí" : "no"} | ${rango(q({ modelo: "corolla", anio: "2020", cp: "1425", gnc }))} |\n`;
}
md += "\n";

md += "## Cómo iterar\n\n";
md += "1. Elegí un caso y cotizalo en el cotizador real de La Caja.\n";
md += "2. Anotá el precio en **Precio real**.\n";
md += "3. Si cae fuera del rango, ajustá lo que aísla ese caso:\n";
md += "   - Modelo/valor → `VALORES_0KM` (o la curva `RETENCION_ANUAL`).\n";
md += "   - Plan → `TASA_POR_PLAN`. Zona → `factorZona`. GNC → `factorGnc`.\n";
md += "4. Regenerá este doc (`node --import tsx scripts/gen-casos-auto.mjs`) y comparar.\n";

writeFileSync(join(root, "docs/casos-cotizacion-auto.md"), md);
console.log("Escrito docs/casos-cotizacion-auto.md");
