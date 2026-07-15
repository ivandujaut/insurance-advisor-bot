# Casos de uso del flujo de cotización de auto

Worksheet para iterar y afinar el motor de auto (`estimarPrima`). El precio es
una tasa por plan sobre el **valor asegurado**, que se deriva de modelo/año (no
se pregunta). La columna **Precio real** se completa relevando el cotizador de La
Caja; si un caso cae fuera del rango, se ajusta el valor 0km del modelo o la tasa.

Generado con `scripts/gen-casos-auto.mjs` (regenerar tras tocar el modelo).

## Dimensiones del flujo

| Dimensión | Valores | Impacto en el precio |
|---|---|---|
| Modelo | de una tabla de valores | Define el valor asegurado (base 0km). El gran driver. |
| Año / condición | 2006 a hoy · 0km/usado | Deprecia el valor (~7% por año); un 0km vale como nuevo. |
| Zona (por CP) | CABA / GBA / interior | Riesgo de robo: CABA 1,25 · GBA 1,15 · interior 1,0. |
| GNC | sí/no | Recargo del 8% por mayor riesgo de incendio. |
| Plan | Terceros Completo / con Granizo / Todo Riesgo | Tasa sobre el valor: 0,47% / 0,59% / 0,73%. |

## Caso de anclaje (precios reales relevados)

Toyota Corolla 2020, usado, sin GNC, CABA (valor asegurado ~$27.285.000):

| Plan | Estimación bot | Precio real |
|---|---|---|
| Terceros Completo | $144.500 a $184.500 | $160.165 ✅ |
| Terceros Completo con Granizo | $182.500 a $233.000 | $202.443 ✅ |
| Todo Riesgo con Franquicia | $223.500 a $285.500 | $247.847 ✅ |

## Matriz valor: modelo x año (Terceros Completo, interior, usado)

Muestra cómo el valor del vehículo mueve el precio (lo que antes no capturábamos).

| Modelo | 2024 | 2020 | 2015 | 2010 |
|---|---|---|---|---|
| VW Gol (económico) | $102.500 a $131.000 | $76.500 a $98.000 | $53.500 a $68.000 | $37.000 a $47.500 |
| Toyota Corolla (media) | $154.500 a $197.500 | $115.500 a $147.500 | $80.500 a $102.500 | $56.000 a $71.500 |
| Toyota Hilux (alta) | $238.000 a $304.000 | $178.000 a $227.500 | $124.000 a $158.000 | $86.000 a $110.000 |

## Eje zona (Corolla 2020 usado, Todo Riesgo)

| Zona | Estimación bot | Precio real |
|---|---|---|
| CABA | $223.500 a $285.500 | |
| GBA | $205.500 a $262.500 | |
| interior | $178.500 a $228.500 | |

## Eje GNC (Corolla 2020 usado, CABA, Terceros Completo)

| GNC | Estimación bot |
|---|---|
| no | $144.500 a $184.500 |
| sí | $156.000 a $199.000 |

## Cómo iterar

1. Elegí un caso y cotizalo en el cotizador real de La Caja.
2. Anotá el precio en **Precio real**.
3. Si cae fuera del rango, ajustá lo que aísla ese caso:
   - Modelo/valor → `VALORES_0KM` (o la curva `RETENCION_ANUAL`).
   - Plan → `TASA_POR_PLAN`. Zona → `factorZona`. GNC → `factorGnc`.
4. Regenerá este doc (`node --import tsx scripts/gen-casos-auto.mjs`) y comparar.
