# Año y condición (0km/usado): benchmark

Cómo piden el año y la condición (0km/usado) los cotizadores de auto, y por qué
conviene fusionar ambos en un solo paso en vez de preguntarlos por separado. Base
para la Decisión 21.

## 1. El problema observado

El flujo pedía el año y, en un paso aparte, "¿es 0km o usado?". Para un año pasado
(ej: 2009) esa segunda pregunta tiene una respuesta obvia: un 2009 es usado. Preguntarla
igual hace que el bot parezca no razonar, suma un paso innecesario y erosiona confianza
justo al arranque del flujo, que es donde más gente abandona.

El único caso donde la condición no se deduce del año es el **año en curso**: un modelo
del año puede ser 0km (recién patentado) o un usado reciente.

## 2. Cómo lo resuelve la industria

| Producto | ¿Pregunta 0km/usado por separado? | Cómo captura la condición |
|---|---|---|
| **Cotizador real de La Caja** | No | Pide año (2006–2026), marca, modelo, versión, GNC. La condición va implícita en el año; "0km no requiere inspección" aparece según corresponde, más una declaración de estado al final. |
| **asegurarmiauto.com.ar** | No | El "0km" es una **opción dentro del selector de año** ("Año de Fabricación" con la opción *"Es 0km"*). |
| **Agregadores (comparaencasa, Mercantil Andina)** | No | Piden año + marca + modelo + versión + GNC + CP. Ninguno intercala un paso "nuevo/usado" antes del año. |

**Patrón unánime: la condición se deriva del año o se fusiona con el selector de año.
Nadie la pregunta como paso separado.** Y ningún cotizador modela "año viejo + 0km"
(un 0km de stock de un modelo de años anteriores): el 0km siempre es del año en curso.
Ese caso borde, que antes justificaba nuestra pregunta aparte, no existe en la práctica.

## 3. La decisión

Fusionar la condición en el paso del año:

- Se pregunta el año, ofreciendo *0km* como respuesta válida.
- **Año pasado → usado**, y se avanza sin repreguntar (acá muere el "2009 → ¿0km?").
- **0km** (escrito por el usuario) → condición 0km, año en curso.
- **Año en curso → único caso ambiguo**: ahí sí una repregunta corta "¿0km o usado?",
  presentada como aclaración del año (sin número de paso propio).

El flujo de auto pasa de 8 a **7 pasos** para el caso común (usado), y el indicador de
progreso se ajusta solo (la condición dejó de ser un paso del recorrido). Queda alineado
con el cotizador real de La Caja.

## 4. Trade-off

Se pierde la posibilidad de declarar un "0km de un modelo de año anterior" tipeando un
año viejo y luego 0km. Es un caso que ningún cotizador soporta y que, de existir, se
resuelve escribiendo *0km* (que asume el año en curso) o con el asesor. A cambio, el
99% de los casos (usados) ahorra una pregunta y el bot razona como la persona espera.

## Fuentes

- Cotizador de auto de La Caja: cotizador.lacaja.com.ar/seguro-auto
- asegurarmiauto.com.ar, *Seguro 0km*: asegurarmiauto.com.ar/0km.php
- Mercantil Andina, *Cotizá tu seguro de auto*: mercantilandina.com.ar/auto
- comparaencasa, *Cotizar seguros de un auto 0km*: comparaencasa.com/seguros-de-auto/coberturas-de-seguros/cotizar-seguros-de-un-auto-0km
