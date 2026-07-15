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
| Tipo de hogar | casa / departamento / depto PB o PH | Una casa se reconstruye más cara por m² (~$2,4M vs ~$2,1M): estructura propia, no compartida. Dato real: casa ~1,19x depto. |
| Uso | permanente / temporal / alquilo | No es un multiplicador de riesgo: es el bundle de cobertura. Habitada (permanente/temporal) asegura el contenido (~2x); alquilada, solo el edificio. Dato real. |
| m² construidos | 25 a 300 | Solo propietario: define la suma de incendio (~$2,1M/m²). |
| Suma de contenido | desde $500.000 | Solo inquilino: su suma asegurada. |
| Zona (por CP) | CABA / GBA / interior | Casi plana en hogar (a diferencia de auto): dato real, CABA ~2% más barato que el interior. |

Diferidos (no se preguntan hoy): barrio privado/country, atestación de seguridad.

## Casos de anclaje (precios reales ya relevados)

Todos: propietario, 80-120 m². El modelo se calibró para reproducirlos.

| Zona | Tipo | Uso | m² (suma incendio) | Estimación bot | Precio real |
|---|---|---|---|---|---|
| interior | depto | alquilo | 80 ($168.000.000) | $10.500 a $13.500 | $11.760 ✅ |
| interior | depto | alquilo | 120 ($252.000.000) | $15.000 a $19.000 | $16.683 ✅ |
| CABA | depto | alquilo | 80 ($168.000.000) | $10.500 a $13.500 | $11.502 ✅ |
| CABA | depto | permanente | 80 ($168.000.000) | $20.000 a $25.500 | $22.062 ✅ |
| CABA | casa | alquilo | 80 ($168.000.000) | $12.500 a $16.000 | $13.665 ✅ |

## Matriz completa: propietario

Con m² de referencia = 100 (suma incendio $210.000.000). El m² es un eje aparte (ver abajo).

| # | Tipo de hogar | Uso | Zona | Estimación bot (por mes) | Precio real |
|---|---|---|---|---|---|
| 1 | casa | permanente | CABA | $28.500 a $36.500 | |
| 2 | casa | permanente | GBA | $29.000 a $37.000 | |
| 3 | casa | permanente | interior | $29.000 a $37.000 | |
| 4 | casa | temporal | CABA | $30.000 a $38.000 | |
| 5 | casa | temporal | GBA | $30.500 a $39.000 | |
| 6 | casa | temporal | interior | $30.500 a $39.000 | |
| 7 | casa | alquilo | CABA | $15.000 a $19.000 | |
| 8 | casa | alquilo | GBA | $15.000 a $19.500 | |
| 9 | casa | alquilo | interior | $15.000 a $19.500 | |
| 10 | departamento | permanente | CABA | $24.000 a $30.500 | |
| 11 | departamento | permanente | GBA | $24.500 a $31.000 | |
| 12 | departamento | permanente | interior | $24.500 a $31.000 | |
| 13 | departamento | temporal | CABA | $25.000 a $32.000 | |
| 14 | departamento | temporal | GBA | $25.500 a $32.500 | |
| 15 | departamento | temporal | interior | $25.500 a $32.500 | |
| 16 | departamento | alquilo | CABA | $12.500 a $16.000 | |
| 17 | departamento | alquilo | GBA | $13.000 a $16.500 | |
| 18 | departamento | alquilo | interior | $13.000 a $16.500 | |
| 19 | depto PB/PH | permanente | CABA | $26.500 a $33.500 | |
| 20 | depto PB/PH | permanente | GBA | $27.000 a $34.500 | |
| 21 | depto PB/PH | permanente | interior | $27.000 a $34.500 | |
| 22 | depto PB/PH | temporal | CABA | $27.500 a $35.500 | |
| 23 | depto PB/PH | temporal | GBA | $28.000 a $36.000 | |
| 24 | depto PB/PH | temporal | interior | $28.000 a $36.000 | |
| 25 | depto PB/PH | alquilo | CABA | $14.000 a $17.500 | |
| 26 | depto PB/PH | alquilo | GBA | $14.000 a $18.000 | |
| 27 | depto PB/PH | alquilo | interior | $14.000 a $18.000 | |

## Matriz completa: inquilino

Con contenido de referencia = $3.000.000. El contenido es un eje aparte (ver abajo).

| # | Tipo de hogar | Uso | Zona | Estimación bot (por mes) | Precio real |
|---|---|---|---|---|---|
| 1 | casa | permanente | CABA | $4.000 a $5.500 | |
| 2 | casa | permanente | GBA | $4.500 a $5.500 | |
| 3 | casa | permanente | interior | $4.500 a $5.500 | |
| 4 | casa | temporal | CABA | $4.500 a $5.500 | |
| 5 | casa | temporal | GBA | $4.500 a $5.500 | |
| 6 | casa | temporal | interior | $4.500 a $5.500 | |
| 7 | casa | alquilo | CABA | $2.000 a $3.000 | |
| 8 | casa | alquilo | GBA | $2.000 a $3.000 | |
| 9 | casa | alquilo | interior | $2.000 a $3.000 | |
| 10 | departamento | permanente | CABA | $3.500 a $4.500 | |
| 11 | departamento | permanente | GBA | $3.500 a $4.500 | |
| 12 | departamento | permanente | interior | $3.500 a $4.500 | |
| 13 | departamento | temporal | CABA | $3.500 a $4.500 | |
| 14 | departamento | temporal | GBA | $4.000 a $5.000 | |
| 15 | departamento | temporal | interior | $4.000 a $5.000 | |
| 16 | departamento | alquilo | CABA | $2.000 a $2.500 | |
| 17 | departamento | alquilo | GBA | $2.000 a $2.500 | |
| 18 | departamento | alquilo | interior | $2.000 a $2.500 | |
| 19 | depto PB/PH | permanente | CABA | $4.000 a $5.000 | |
| 20 | depto PB/PH | permanente | GBA | $4.000 a $5.000 | |
| 21 | depto PB/PH | permanente | interior | $4.000 a $5.000 | |
| 22 | depto PB/PH | temporal | CABA | $4.000 a $5.000 | |
| 23 | depto PB/PH | temporal | GBA | $4.000 a $5.500 | |
| 24 | depto PB/PH | temporal | interior | $4.000 a $5.500 | |
| 25 | depto PB/PH | alquilo | CABA | $2.000 a $2.500 | |
| 26 | depto PB/PH | alquilo | GBA | $2.000 a $2.500 | |
| 27 | depto PB/PH | alquilo | interior | $2.000 a $2.500 | |

## Eje m² (propietario · departamento · alquilo)

| m² | Suma incendio | CABA | interior | Precio real (CABA / int.) |
|---|---|---|---|---|
| 50 | $105.000.000 | $7.000 a $9.000 | $7.500 a $9.500 |  |
| 80 | $168.000.000 | $10.500 a $13.500 | $10.500 a $13.500 |  / $11.760 |
| 120 | $252.000.000 | $14.500 a $19.000 | $15.000 a $19.000 |  |
| 200 | $420.000.000 | $23.500 a $30.000 | $24.000 a $30.500 |  |

## Eje contenido (inquilino · departamento · permanente)

| Contenido | CABA | interior | Precio real |
|---|---|---|---|
| $1.000.000 | $3.500 a $4.000 | $3.500 a $4.500 | |
| $3.000.000 | $3.500 a $4.500 | $3.500 a $4.500 | |
| $8.000.000 | $4.000 a $5.000 | $4.000 a $5.000 | |

## Cómo iterar

1. Elegí un caso de una fila y cotizalo en el cotizador real de La Caja.
2. Anotá el precio en la columna **Precio real**.
3. Si cae fuera del rango estimado, ajustá el factor que aísla ese caso:
   - Zona → `factorZonaHogar` (comparar CABA vs interior, mismo resto).
   - Uso → `factorUso`. Tipo de hogar → `factorTipoHogar`.
   - Nivel general → `TASA_INCENDIO_MENSUAL` / `CARGO_FIJO_MENSUAL`.
4. Regenerá este doc (`node --import tsx scripts/gen-casos-hogar.mjs`) y volvé a comparar.
