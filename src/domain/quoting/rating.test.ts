import assert from "node:assert/strict";
import { test } from "node:test";
import { estimarPrima, estimarPrimaBici, estimarPrimaHogar } from "./rating.js";

const base = {
  anio: "2018",
  marca: "toyota",
  modelo: "corolla",
  condicion: "usado",
  gnc: false,
  cp: "5000", // interior
  plan: "Terceros Completo",
};

test("devuelve un rango positivo con desde < hasta", () => {
  const q = estimarPrima(base);
  assert.ok(q.desde > 0, "el piso es positivo");
  assert.ok(q.hasta > q.desde, "el techo supera al piso");
  assert.equal(q.moneda, "ARS");
});

test("más cobertura, más prima", () => {
  const terceros = estimarPrima({ ...base, plan: "Terceros Completo" });
  const todoRiesgo = estimarPrima({ ...base, plan: "Todo Riesgo con Franquicia" });
  assert.ok(todoRiesgo.hasta > terceros.hasta);
});

test("un 0km cuesta más que el mismo auto usado", () => {
  const usado = estimarPrima({ ...base, condicion: "usado" });
  const cero = estimarPrima({ ...base, condicion: "0km" });
  assert.ok(cero.hasta > usado.hasta);
});

test("el GNC agrega un recargo", () => {
  const sin = estimarPrima({ ...base, gnc: false });
  const con = estimarPrima({ ...base, gnc: true });
  assert.ok(con.hasta > sin.hasta);
});

test("CABA cuesta más que el interior", () => {
  const interior = estimarPrima({ ...base, cp: "5000" });
  const caba = estimarPrima({ ...base, cp: "1425" });
  assert.ok(caba.hasta > interior.hasta);
});

test("es determinístico: mismos datos, mismo rango", () => {
  assert.deepEqual(estimarPrima(base), estimarPrima(base));
});

test("un plan desconocido cae a la base y no rompe", () => {
  const q = estimarPrima({ ...base, plan: "Plan inexistente" });
  assert.ok(q.desde > 0 && q.hasta > q.desde);
});

test("auto: el rango contiene los precios reales de La Caja (Corolla 2020, CABA)", () => {
  // Toyota Corolla 2020, usado, sin GNC, CABA (CP 1425). Reales por mes:
  // Terceros Completo $160.165 ; con Granizo $202.443 ; Todo Riesgo $247.847.
  const caso = {
    anio: "2020",
    marca: "toyota",
    modelo: "corolla",
    condicion: "usado",
    gnc: false,
    cp: "1425",
  };
  const anclajes = [
    { plan: "Terceros Completo", precio: 160165 },
    { plan: "Terceros Completo con Granizo", precio: 202443 },
    { plan: "Todo Riesgo con Franquicia", precio: 247847 },
  ];
  for (const a of anclajes) {
    const q = estimarPrima({ ...caso, plan: a.plan });
    assert.ok(
      q.desde <= a.precio && a.precio <= q.hasta,
      `${a.plan}: ${a.precio} dentro de [${q.desde}, ${q.hasta}]`,
    );
  }
});

test("auto: un modelo más caro cuesta más que uno más barato (mismo año y plan)", () => {
  const gol = estimarPrima({ ...base, modelo: "gol" });
  const hilux = estimarPrima({ ...base, modelo: "hilux" });
  assert.ok(hilux.hasta > gol.hasta);
});

test("auto: un auto más viejo cuesta menos que uno más nuevo (deprecia el valor)", () => {
  const viejo = estimarPrima({ ...base, anio: "2010" });
  const nuevo = estimarPrima({ ...base, anio: "2024" });
  assert.ok(nuevo.hasta > viejo.hasta);
});

const baseHogar = {
  tipoResidente: "inquilino",
  tipoHogar: "departamento",
  uso: "permanente",
  m2: 0,
  cp: "5000", // interior
  sumaContenido: 2000000,
};

test("hogar: rango positivo y creciente con la suma del contenido (inquilino)", () => {
  const q = estimarPrimaHogar(baseHogar);
  assert.ok(q.desde > 0 && q.hasta > q.desde);
  assert.equal(q.plan, "Seguro de Hogar");
  const masContenido = estimarPrimaHogar({ ...baseHogar, sumaContenido: 8000000 });
  assert.ok(masContenido.hasta > q.hasta);
});

test("hogar: propietario con edificio cuesta más que inquilino", () => {
  const inq = estimarPrimaHogar({ ...baseHogar, tipoResidente: "inquilino", m2: 0 });
  const prop = estimarPrimaHogar({ ...baseHogar, tipoResidente: "propietario", m2: 100 });
  assert.ok(prop.hasta > inq.hasta);
});

test("hogar: el rango contiene los precios reales de La Caja (caso relevado)", () => {
  // Propietario, departamento, alquilo, Posadas (interior, CP 3300).
  // Reales: 80 m² (168M de incendio) -> $11.760/mes ; 120 m² (252M) -> $16.683/mes.
  const real = {
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    uso: "alquilo",
    cp: "3300",
    sumaContenido: 0,
  };
  const q80 = estimarPrimaHogar({ ...real, m2: 80 });
  assert.ok(
    q80.desde <= 11760 && 11760 <= q80.hasta,
    `11760 dentro de [${q80.desde}, ${q80.hasta}]`,
  );
  const q120 = estimarPrimaHogar({ ...real, m2: 120 });
  assert.ok(
    q120.desde <= 16683 && 16683 <= q120.hasta,
    `16683 dentro de [${q120.desde}, ${q120.hasta}]`,
  );
  // Mismo caso en CABA (CP 1425), 80 m² -> $11.502/mes (real, un poco más barato).
  const qCaba = estimarPrimaHogar({ ...real, cp: "1425", m2: 80 });
  assert.ok(
    qCaba.desde <= 11502 && 11502 <= qCaba.hasta,
    `11502 dentro de [${qCaba.desde}, ${qCaba.hasta}]`,
  );
  // Mismo caso pero PERMANENTE (habitada) en CABA, 80 m² -> $22.062/mes (real):
  // asegura el contenido (robo, TV), casi el doble que alquilada.
  const qPerm = estimarPrimaHogar({ ...real, cp: "1425", m2: 80, uso: "permanente" });
  assert.ok(
    qPerm.desde <= 22062 && 22062 <= qPerm.hasta,
    `22062 dentro de [${qPerm.desde}, ${qPerm.hasta}]`,
  );
  // Mismo caso pero CASA (en vez de depto) en CABA, 80 m² -> $13.665/mes (real):
  // se reconstruye más cara por m² (estructura propia).
  const qCasa = estimarPrimaHogar({ ...real, cp: "1425", m2: 80, tipoHogar: "casa" });
  assert.ok(
    qCasa.desde <= 13665 && 13665 <= qCasa.hasta,
    `13665 dentro de [${qCasa.desde}, ${qCasa.hasta}]`,
  );
});

test("hogar: habitada (permanente) cuesta más que alquilada (asegura el contenido)", () => {
  const base = {
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    m2: 80,
    cp: "1425",
    sumaContenido: 0,
  };
  const alquilo = estimarPrimaHogar({ ...base, uso: "alquilo" });
  const permanente = estimarPrimaHogar({ ...base, uso: "permanente" });
  assert.ok(permanente.desde > alquilo.hasta, "permanente supera con holgura a alquilo");
});

test("hogar: la zona es casi plana (CABA no es más cara que el interior)", () => {
  const base = {
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    uso: "alquilo",
    m2: 80,
    sumaContenido: 0,
  };
  const caba = estimarPrimaHogar({ ...base, cp: "1425" });
  const interior = estimarPrimaHogar({ ...base, cp: "3300" });
  assert.ok(caba.hasta <= interior.hasta, "en hogar, CABA no supera al interior");
});

test("hogar: más m² construidos, más prima (propietario)", () => {
  const chico = estimarPrimaHogar({ ...baseHogar, tipoResidente: "propietario", m2: 50 });
  const grande = estimarPrimaHogar({ ...baseHogar, tipoResidente: "propietario", m2: 200 });
  assert.ok(grande.hasta > chico.hasta);
});

test("hogar: una casa cuesta más que un departamento", () => {
  const depto = estimarPrimaHogar({ ...baseHogar, tipoHogar: "departamento" });
  const casa = estimarPrimaHogar({ ...baseHogar, tipoHogar: "casa" });
  assert.ok(casa.hasta > depto.hasta);
});

test("bici: el rango contiene las tres tarifas reales del cotizador", () => {
  // Reales: $370.800 -> $6.894 ; $539.400 -> $9.959 ; $1.012.000 -> $18.549.
  const anclajes = [
    { valor: 370800, real: 6894 },
    { valor: 539400, real: 9959 },
    { valor: 1012000, real: 18549 },
  ];
  for (const a of anclajes) {
    const q = estimarPrimaBici({ tipoRodado: "bicicleta", valor: a.valor });
    assert.ok(
      q.desde <= a.real && a.real <= q.hasta,
      `${a.real} dentro de [${q.desde}, ${q.hasta}]`,
    );
  }
});

test("bici: la cuota crece con el valor del rodado", () => {
  const barata = estimarPrimaBici({ tipoRodado: "bicicleta", valor: 200000 });
  const cara = estimarPrimaBici({ tipoRodado: "bicicleta", valor: 800000 });
  assert.ok(cara.hasta > barata.hasta);
});

test("bici: el monopatín usa su propio nombre de plan", () => {
  const q = estimarPrimaBici({ tipoRodado: "monopatin", valor: 400000 });
  assert.match(q.plan, /Monopatín/);
});

test("hogar: uso temporal cuesta más que permanente", () => {
  const base = {
    tipoResidente: "propietario",
    tipoHogar: "departamento",
    m2: 100,
    cp: "3300",
    sumaContenido: 0,
  };
  const perm = estimarPrimaHogar({ ...base, uso: "permanente" });
  const temp = estimarPrimaHogar({ ...base, uso: "temporal" });
  assert.ok(temp.hasta > perm.hasta);
});
