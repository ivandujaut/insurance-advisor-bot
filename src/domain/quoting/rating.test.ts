import assert from "node:assert/strict";
import { test } from "node:test";
import { estimarPrima, estimarPrimaHogar } from "./rating.js";

const base = {
  anio: "2018",
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

const baseHogar = {
  tipoResidente: "inquilino",
  tipoHogar: "departamento",
  uso: "permanente",
  m2: 0,
  cp: "5000", // interior
  sumaContenido: 2000000,
};

test("hogar: rango positivo y proporcional a la suma del contenido", () => {
  const q = estimarPrimaHogar(baseHogar);
  assert.ok(q.desde > 0 && q.hasta > q.desde);
  assert.equal(q.plan, "Seguro de Hogar");
  const doble = estimarPrimaHogar({ ...baseHogar, sumaContenido: 4000000 });
  assert.ok(doble.hasta > q.hasta);
});

test("hogar: propietario con edificio cuesta más que inquilino", () => {
  const inq = estimarPrimaHogar({ ...baseHogar, tipoResidente: "inquilino", m2: 0 });
  const prop = estimarPrimaHogar({ ...baseHogar, tipoResidente: "propietario", m2: 100 });
  assert.ok(prop.hasta > inq.hasta);
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

test("hogar: uso temporal cuesta más que permanente", () => {
  const perm = estimarPrimaHogar({ ...baseHogar, uso: "permanente" });
  const temp = estimarPrimaHogar({ ...baseHogar, uso: "temporal" });
  assert.ok(temp.hasta > perm.hasta);
});
