# Casos de uso del flujo de cotización de hogar

Worksheet para iterar y afinar el motor de cotización de hogar (`estimarPrimaHogar`).
Enumera las combinaciones del flujo y muestra la **estimación actual del bot** para
cada una. La columna **Precio real** se completa relevando el cotizador de La Caja:
cuando un caso queda fuera del rango estimado, se ajusta el factor correspondiente.

Generado con `scripts/gen-casos-hogar.mjs` (regenerar tras tocar los factores).

## Dimensiones del flujo

| Dimensión | Valores | Impacto en el precio |
|---|---|---|
| Residente | propietario / inquilino | El propietario asegura el edificio (suma de incendio derivada de m²); el inquilino, solo el contenido. |
| Tipo de hogar | casa / departamento / depto PB o PH | Factor de exposición (casa > PB/PH > depto). |
| Uso | permanente / temporal / alquilo | Ocupación (temporal > alquilo > permanente). |
| m² construidos | 25 a 300 | Solo propietario: define la suma de incendio (~$2,1M/m²). |
| Suma de contenido | desde $500.000 | Solo inquilino: su suma asegurada. |
| Zona (por CP) | CABA / GBA / interior | Factor de riesgo por robo/siniestralidad. |

Diferidos (no se preguntan hoy): barrio privado/country, atestación de seguridad.

## Casos de anclaje (precios reales ya relevados)

Propietario · departamento · alquilo · Posadas (interior, CP 3300):

| m² | Suma incendio | Estimación bot | Precio real La Caja |
|---|---|---|---|
| 80 | $168.000.000 | $10.500 a $13.500 | $11.760 ✅ |
| 120 | $252.000.000 | $15.000 a $19.000 | $16.683 ✅ |

## Matriz completa: propietario

Con m² de referencia = 100 (suma incendio $210.000.000). El m² es un eje aparte (ver abajo).

| # | Tipo de hogar | Uso | Zona | Estimación bot (por mes) | Precio real |
|---|---|---|---|---|---|
| 1 | casa | permanente | CABA | $16.000 a $20.500 | |
| 2 | casa | permanente | GBA | $14.500 a $19.000 | |
| 3 | casa | permanente | interior | $13.000 a $16.500 | |
| 4 | casa | temporal | CABA | $19.000 a $24.500 | |
| 5 | casa | temporal | GBA | $17.500 a $22.500 | |
| 6 | casa | temporal | interior | $15.500 a $19.500 | |
| 7 | casa | alquilo | CABA | $18.500 a $23.500 | |
| 8 | casa | alquilo | GBA | $17.000 a $21.500 | |
| 9 | casa | alquilo | interior | $14.500 a $19.000 | |
| 10 | departamento | permanente | CABA | $14.000 a $18.000 | |
| 11 | departamento | permanente | GBA | $13.000 a $16.500 | |
| 12 | departamento | permanente | interior | $11.000 a $14.000 | |
| 13 | departamento | temporal | CABA | $16.500 a $21.500 | |
| 14 | departamento | temporal | GBA | $15.500 a $19.500 | |
| 15 | departamento | temporal | interior | $13.500 a $17.000 | |
| 16 | departamento | alquilo | CABA | $16.000 a $20.500 | |
| 17 | departamento | alquilo | GBA | $14.500 a $19.000 | |
| 18 | departamento | alquilo | interior | $13.000 a $16.500 | |
| 19 | depto PB/PH | permanente | CABA | $15.500 a $19.500 | |
| 20 | depto PB/PH | permanente | GBA | $14.000 a $18.000 | |
| 21 | depto PB/PH | permanente | interior | $12.500 a $15.500 | |
| 22 | depto PB/PH | temporal | CABA | $18.500 a $23.500 | |
| 23 | depto PB/PH | temporal | GBA | $17.000 a $21.500 | |
| 24 | depto PB/PH | temporal | interior | $14.500 a $19.000 | |
| 25 | depto PB/PH | alquilo | CABA | $17.500 a $22.500 | |
| 26 | depto PB/PH | alquilo | GBA | $16.000 a $20.500 | |
| 27 | depto PB/PH | alquilo | interior | $14.000 a $18.000 | |

## Matriz completa: inquilino

Con contenido de referencia = $3.000.000. El contenido es un eje aparte (ver abajo).

| # | Tipo de hogar | Uso | Zona | Estimación bot (por mes) | Precio real |
|---|---|---|---|---|---|
| 1 | casa | permanente | CABA | $2.500 a $3.000 | |
| 2 | casa | permanente | GBA | $2.000 a $3.000 | |
| 3 | casa | permanente | interior | $2.000 a $2.500 | |
| 4 | casa | temporal | CABA | $3.000 a $3.500 | |
| 5 | casa | temporal | GBA | $2.500 a $3.500 | |
| 6 | casa | temporal | interior | $2.500 a $3.000 | |
| 7 | casa | alquilo | CABA | $2.500 a $3.500 | |
| 8 | casa | alquilo | GBA | $2.500 a $3.000 | |
| 9 | casa | alquilo | interior | $2.000 a $3.000 | |
| 10 | departamento | permanente | CABA | $2.000 a $2.500 | |
| 11 | departamento | permanente | GBA | $2.000 a $2.500 | |
| 12 | departamento | permanente | interior | $1.500 a $2.000 | |
| 13 | departamento | temporal | CABA | $2.500 a $3.000 | |
| 14 | departamento | temporal | GBA | $2.500 a $3.000 | |
| 15 | departamento | temporal | interior | $2.000 a $2.500 | |
| 16 | departamento | alquilo | CABA | $2.500 a $3.000 | |
| 17 | departamento | alquilo | GBA | $2.000 a $3.000 | |
| 18 | departamento | alquilo | interior | $2.000 a $2.500 | |
| 19 | depto PB/PH | permanente | CABA | $2.000 a $3.000 | |
| 20 | depto PB/PH | permanente | GBA | $2.000 a $2.500 | |
| 21 | depto PB/PH | permanente | interior | $2.000 a $2.500 | |
| 22 | depto PB/PH | temporal | CABA | $2.500 a $3.500 | |
| 23 | depto PB/PH | temporal | GBA | $2.500 a $3.000 | |
| 24 | depto PB/PH | temporal | interior | $2.000 a $3.000 | |
| 25 | depto PB/PH | alquilo | CABA | $2.500 a $3.500 | |
| 26 | depto PB/PH | alquilo | GBA | $2.500 a $3.000 | |
| 27 | depto PB/PH | alquilo | interior | $2.000 a $2.500 | |

## Eje m² (propietario · departamento · alquilo)

| m² | Suma incendio | CABA | interior | Precio real (CABA / int.) |
|---|---|---|---|---|
| 50 | $105.000.000 | $9.000 a $11.500 | $7.500 a $9.500 |  |
| 80 | $168.000.000 | $13.000 a $17.000 | $10.500 a $13.500 |  / $11.760 |
| 120 | $252.000.000 | $19.000 a $24.000 | $15.000 a $19.000 |  |
| 200 | $420.000.000 | $30.000 a $38.000 | $24.000 a $30.500 |  |

## Eje contenido (inquilino · departamento · permanente)

| Contenido | CABA | interior | Precio real |
|---|---|---|---|
| $1.000.000 | $2.000 a $2.500 | $1.500 a $2.000 | |
| $3.000.000 | $2.000 a $2.500 | $1.500 a $2.000 | |
| $8.000.000 | $2.500 a $3.000 | $2.000 a $2.500 | |

## Cómo iterar

1. Elegí un caso de una fila y cotizalo en el cotizador real de La Caja.
2. Anotá el precio en la columna **Precio real**.
3. Si cae fuera del rango estimado, ajustá el factor que aísla ese caso:
   - Zona → `factorZona` (comparar CABA vs interior, mismo resto).
   - Uso → `factorUso`. Tipo de hogar → `factorTipoHogar`.
   - Nivel general → `TASA_INCENDIO_MENSUAL` / `CARGO_FIJO_MENSUAL`.
4. Regenerá este doc (`node --import tsx scripts/gen-casos-hogar.mjs`) y volvé a comparar.
