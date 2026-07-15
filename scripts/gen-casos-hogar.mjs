/**
 * Genera docs/casos-cotizacion-hogar.md: enumera las combinaciones del flujo de
 * cotización de hogar y calcula la estimación actual del motor para cada una.
 * Sirve de worksheet para relevar precios reales y afinar los factores.
 *
 *   node --import tsx scripts/gen-casos-hogar.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { estimarPrimaHogar } from "../src/domain/quoting/rating.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pesos = (n) => `$${n.toLocaleString("es-AR")}`;
const HOGAR = ["casa", "departamento", "departamento_pb_ph"];
const HOGAR_LABEL = {
  casa: "casa",
  departamento: "departamento",
  departamento_pb_ph: "depto PB/PH",
};
const USO = ["permanente", "temporal", "alquilo"];
const ZONA = [
  { label: "CABA", cp: "1425" },
  { label: "GBA", cp: "1650" },
  { label: "interior", cp: "3300" },
];
const M2 = [50, 80, 120, 200];
const CONTENIDO = [1000000, 3000000, 8000000];
const COSTO_M2 = 2100000;

const rango = (q) => `${pesos(q.desde)} a ${pesos(q.hasta)}`;

let md = "";
md += "# Casos de uso del flujo de cotización de hogar\n\n";
md += "Worksheet para iterar y afinar el motor de cotización de hogar (`estimarPrimaHogar`).\n";
md += "Enumera las combinaciones del flujo y muestra la **estimación actual del bot** para\n";
md += "cada una. La columna **Precio real** se completa relevando el cotizador de La Caja:\n";
md += "cuando un caso queda fuera del rango estimado, se ajusta el factor correspondiente.\n\n";
md += "Generado con `scripts/gen-casos-hogar.mjs` (regenerar tras tocar los factores).\n\n";

md += "## Dimensiones del flujo\n\n";
md += "| Dimensión | Valores | Impacto en el precio |\n|---|---|---|\n";
md +=
  "| Residente | propietario / inquilino | El propietario asegura el edificio (suma de incendio derivada de m²); el inquilino, solo el contenido. |\n";
md +=
  "| Tipo de hogar | casa / departamento / depto PB o PH | Factor de exposición (casa > PB/PH > depto). |\n";
md += "| Uso | permanente / temporal / alquilo | Ocupación (temporal > alquilo > permanente). |\n";
md += "| m² construidos | 25 a 300 | Solo propietario: define la suma de incendio (~$2,1M/m²). |\n";
md += "| Suma de contenido | desde $500.000 | Solo inquilino: su suma asegurada. |\n";
md += "| Zona (por CP) | CABA / GBA / interior | Factor de riesgo por robo/siniestralidad. |\n\n";
md += "Diferidos (no se preguntan hoy): barrio privado/country, atestación de seguridad.\n\n";

md += "## Casos de anclaje (precios reales ya relevados)\n\n";
md += "Propietario · departamento · alquilo · Posadas (interior, CP 3300):\n\n";
md += "| m² | Suma incendio | Estimación bot | Precio real La Caja |\n|---|---|---|---|\n";
for (const m2 of [80, 120]) {
  const q = estimarPrimaHogar({
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    uso: "alquilo",
    m2,
    cp: "3300",
    sumaContenido: 0,
  });
  const real = m2 === 80 ? "$11.760" : "$16.683";
  md += `| ${m2} | ${pesos(m2 * COSTO_M2)} | ${rango(q)} | ${real} ✅ |\n`;
}
md += "\n";

function matriz(residente) {
  const repM2 = 100;
  const repCont = 3000000;
  let t = `## Matriz completa: ${residente}\n\n`;
  t +=
    residente === "propietario"
      ? `Con m² de referencia = 100 (suma incendio ${pesos(repM2 * COSTO_M2)}). El m² es un eje aparte (ver abajo).\n\n`
      : `Con contenido de referencia = ${pesos(repCont)}. El contenido es un eje aparte (ver abajo).\n\n`;
  t +=
    "| # | Tipo de hogar | Uso | Zona | Estimación bot (por mes) | Precio real |\n|---|---|---|---|---|---|\n";
  let i = 1;
  for (const h of HOGAR) {
    for (const u of USO) {
      for (const z of ZONA) {
        const q = estimarPrimaHogar({
          tipoResidente: residente,
          tipoHogar: h,
          uso: u,
          cp: z.cp,
          m2: residente === "propietario" ? repM2 : 0,
          sumaContenido: residente === "inquilino" ? repCont : 0,
        });
        t += `| ${i++} | ${HOGAR_LABEL[h]} | ${u} | ${z.label} | ${rango(q)} | |\n`;
      }
    }
  }
  return `${t}\n`;
}
md += matriz("propietario");
md += matriz("inquilino");

md += "## Eje m² (propietario · departamento · alquilo)\n\n";
md +=
  "| m² | Suma incendio | CABA | interior | Precio real (CABA / int.) |\n|---|---|---|---|---|\n";
for (const m2 of M2) {
  const caba = estimarPrimaHogar({
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    uso: "alquilo",
    m2,
    cp: "1425",
    sumaContenido: 0,
  });
  const inte = estimarPrimaHogar({
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    uso: "alquilo",
    m2,
    cp: "3300",
    sumaContenido: 0,
  });
  md += `| ${m2} | ${pesos(m2 * COSTO_M2)} | ${rango(caba)} | ${rango(inte)} | ${m2 === 80 ? " / $11.760" : ""} |\n`;
}
md += "\n";

md += "## Eje contenido (inquilino · departamento · permanente)\n\n";
md += "| Contenido | CABA | interior | Precio real |\n|---|---|---|---|\n";
for (const c of CONTENIDO) {
  const caba = estimarPrimaHogar({
    tipoResidente: "inquilino",
    tipoHogar: "departamento",
    uso: "permanente",
    m2: 0,
    cp: "1425",
    sumaContenido: c,
  });
  const inte = estimarPrimaHogar({
    tipoResidente: "inquilino",
    tipoHogar: "departamento",
    uso: "permanente",
    m2: 0,
    cp: "3300",
    sumaContenido: c,
  });
  md += `| ${pesos(c)} | ${rango(caba)} | ${rango(inte)} | |\n`;
}
md += "\n";

md += "## Cómo iterar\n\n";
md += "1. Elegí un caso de una fila y cotizalo en el cotizador real de La Caja.\n";
md += "2. Anotá el precio en la columna **Precio real**.\n";
md += "3. Si cae fuera del rango estimado, ajustá el factor que aísla ese caso:\n";
md += "   - Zona → `factorZona` (comparar CABA vs interior, mismo resto).\n";
md += "   - Uso → `factorUso`. Tipo de hogar → `factorTipoHogar`.\n";
md += "   - Nivel general → `TASA_INCENDIO_MENSUAL` / `CARGO_FIJO_MENSUAL`.\n";
md +=
  "4. Regenerá este doc (`node --import tsx scripts/gen-casos-hogar.mjs`) y volvé a comparar.\n";

writeFileSync(join(root, "docs/casos-cotizacion-hogar.md"), md);
console.log("Escrito docs/casos-cotizacion-hogar.md");
