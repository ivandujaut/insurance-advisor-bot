# Bot de WhatsApp de seguros: decisiones de producto

**Caso de estudio.** Diseño de un asistente de WhatsApp para seguros, tomando como
referencia la oferta pública de La Caja. Este documento explica cada decisión de
producto, el criterio que la sustenta y el dato que la respalda. Sirve de base
para una entrada de blog.

> **Alcance y transparencia.** Es un análisis independiente hecho con información
> pública del sitio de La Caja (relevada en julio de 2026). No estoy afiliado a
> la empresa ni tuve acceso a datos internos. Las conjeturas sobre el funnel están
> marcadas como hipótesis, separadas de los hechos observados. El producto es un
> prototipo funcional, no un sistema en producción.

---

## 1. Objetivo

Construir un asistente de WhatsApp que ayude a una persona a **entender, comparar
y cotizar** un seguro, y evaluar si ese canal cubre una necesidad que hoy no está
bien atendida. El foco del ejercicio no es la proeza técnica, sino el **juicio de
producto**: dónde jugar, por qué, y cómo se mediría el éxito.

## 2. Metodología

1. Relevamiento del sitio público de La Caja (home, páginas de producto, centro
   de preguntas frecuentes).
2. Mapeo del catálogo, las coberturas por línea y los canales de atención.
3. Identificación de qué resuelve hoy cada canal (web, app, WhatsApp, telefónico).
4. Definición del hueco de producto y de las decisiones que se derivan de él.

## 3. Hallazgos del benchmark (hechos observados)

**Catálogo amplio para personas:** Auto, Moto, Hogar, Salud, Bicicleta/Monopatín,
Notebook/Tablet, Cartera, Vida, Accidentes Personales, Cuidados Mayores, Auto
Conectado. Para empresas, Flota y otras soluciones.

**Ya existe un bot de WhatsApp: "Letizia" (11-4857-7777).** En el propio sitio,
Letizia aparece como el primer canal recomendado para: modificar la póliza, darse
de baja, descargar documentación y hacer consultas. Es decir, está posicionado
para **posventa y autogestión de clientes existentes**.

**La cotización vive en la web,** en cotizadores separados por línea
(cotizador.lacaja.com.ar/seguro-auto, hogar.lacaja.com.ar, moto.lacaja.com.ar),
con un flujo de 4 pasos (datos, cotizar, forma de pago, listo).

**Estructura de producto clara y escalonada.** Ejemplo en Auto: Terceros Completo,
Terceros Completo con Granizo, Todo Riesgo con Franquicia. En Moto: Responsabilidad
Civil, Total B, Total A. Es una lógica de "bueno / mejor / óptimo" fácil de
explicar en una conversación.

**Canales digitales maduros:** app, Portal Personas, Centro de Operaciones Online,
telemedicina 24hs por WhatsApp, botón de arrepentimiento (10 días).

## 4. El insight de producto

Los dos extremos del recorrido del cliente están cubiertos, pero hay un hueco en
el medio:

| Etapa del funnel | Canal actual | Experiencia |
|---|---|---|
| Descubrir / entender qué me conviene | (sin dueño claro) | El usuario compara solo |
| Cotizar | Cotizador web | Formulario, requiere salir a la web |
| Contratar | Web / asesor | |
| Usar y gestionar (posventa) | Letizia (WhatsApp) + app | Bien resuelto |

**Hipótesis de producto:** la etapa de **venta asesorada** (ayudar a alguien que
todavía no sabe qué plan le conviene, comparar coberturas y cotizar sin fricción)
no tiene un dueño conversacional. WhatsApp, que la empresa ya usa con éxito para
posventa, es el canal natural para ocuparla.

Esta es la apuesta central: **no duplicar a Letizia, sino cubrir la pre-venta.**

## 5. Decisiones de producto

Cada decisión sigue el mismo formato: qué decidí, con qué criterio, respaldada por
qué dato, y qué resigné.

### Decisión 1: posicionar el bot en venta asesorada, no en autogestión

- **Criterio:** no competir donde el incumbente ya es fuerte; buscar el espacio
  vacío de mayor valor.
- **Dato que la respalda:** Letizia ya resuelve la posventa; la cotización está en
  la web y no en el chat.
- **Por qué:** clonar Letizia sería esfuerzo sin diferencial. La pre-venta
  conversacional ataca el momento de mayor intención de compra y menor
  acompañamiento.
- **Trade-off:** la venta asesorada exige más lógica de negocio (comparar,
  recomendar) que responder preguntas de autogestión.

### Decisión 2: WhatsApp como canal principal

- **Criterio:** encontrarse con el usuario donde ya está y donde la empresa ya
  demostró tracción.
- **Dato que la respalda:** La Caja ya invierte en WhatsApp (Letizia, telemedicina
  por WhatsApp). El canal está validado internamente.
- **Por qué:** menor fricción que un formulario web; permite conversación,
  seguimiento y captura de lead en el mismo lugar.
- **Trade-off:** WhatsApp impone límites de formato (texto, sin tablas ricas) y
  reglas de la plataforma (ventanas de mensajería, plantillas).

### Decisión 3: motor híbrido (menús + IA), no uno u otro

- **Criterio:** usar la herramienta adecuada para cada tipo de tarea.
- **Dato que la respalda:** el proceso de cotización es estructurado y repetible
  (los cotizadores web ya lo modelan en 4 pasos), mientras que las dudas ("¿qué es
  la franquicia?", "¿cubre granizo?") son abiertas.
- **Por qué:** los menús dan control, previsibilidad y bajo costo en el flujo de
  cotización; el modelo de lenguaje da flexibilidad en las consultas abiertas,
  anclado a contenido real para no inventar.
- **Trade-off:** dos caminos que mantener y una frontera (cuándo usar cada uno)
  que hay que afinar.

### Decisión 4: empezar por Auto

- **Criterio:** priorizar por volumen y claridad de la estructura de planes.
- **Dato que la respalda:** Auto es la línea más destacada del sitio (campañas,
  cotizador propio) y tiene una escalera de 3 planes muy explicable.
- **Por qué:** maximiza aprendizaje por unidad de esfuerzo y permite validar el
  flujo completo antes de replicarlo.
- **Trade-off:** deja fuera, al inicio, líneas con lógica distinta (Salud es un
  seguro de enfermedades graves, no de daños).

### Decisión 5: comparar planes dentro del chat

- **Criterio:** reducir la carga cognitiva de la decisión.
- **Dato que la respalda:** la estructura "bueno / mejor / óptimo" de La Caja se
  presta a una comparación de 3 opciones, que es un número manejable en una
  conversación.
- **Por qué:** ayudar a elegir es justamente el valor que falta en la etapa de
  pre-venta.
- **Trade-off:** simplificar coberturas para el chat puede perder matices; hay que
  cuidar que la síntesis sea fiel.

### Decisión 6: capa de adaptadores de mensajería (proveedor intercambiable)

- **Criterio:** separar la lógica de negocio del canal para no quedar atado a una
  decisión de infraestructura temprana.
- **Dato que la respalda:** existen varias vías para WhatsApp (API oficial de Meta,
  Twilio, librerías no oficiales) con distintos costos y riesgos.
- **Por qué:** permite desarrollar y probar el producto con un adaptador de
  consola (sin credenciales), y enchufar la API oficial de Meta cambiando una
  variable. Acelera el time-to-market y reduce el riesgo de re-trabajo.
- **Trade-off:** una capa de abstracción más; se justifica por la incertidumbre
  sobre el proveedor final.

### Decisión 7: base de conocimiento con contenido real, no genérico

- **Criterio:** la credibilidad del asistente depende de la fidelidad de la
  información.
- **Dato que la respalda:** las respuestas del modelo se anclan al contenido
  relevado (planes, franquicia con ejemplo, requisitos de hogar, condiciones de
  Salud), no a conocimiento inventado.
- **Por qué:** en seguros, una respuesta incorrecta sobre una cobertura es un
  riesgo real; anclar a fuente reduce las alucinaciones.
- **Trade-off:** el contenido hay que mantenerlo actualizado cuando cambian los
  productos.

## 6. Cómo mediría el éxito

Un bot no se evalúa por "responde lindo", sino por su efecto en el funnel. Las
métricas que instrumentaría:

**Activación y avance**
- Tasa de inicio de cotización (de quienes saludan, cuántos arrancan a cotizar).
- Tasa de finalización del flujo de cotización.
- Drop-off por paso (vehículo, código postal, condición, elección de plan): dónde
  se cae la gente.
- Tiempo hasta la cotización (mensajes y minutos).

**Conversión**
- Leads generados (cotizaciones con datos de contacto).
- Tasa de derivación a asesor y su resultado.
- Contratación atribuida al canal (si se integra con el sistema de ventas).

**Calidad de la conversación**
- Tasa de contención (consultas resueltas sin humano).
- Proporción de respuestas por IA vs menú, y satisfacción en cada una.
- Tasa de "no entendí" del bot (mala interpretación).
- CSAT al cierre.

**Mix de producto**
- Distribución de interés por plan (¿la gente elige el intermedio, como suele
  pasar cuando hay 3 opciones?).
- Líneas más consultadas para priorizar el roadmap.

## 7. Riesgos y limitaciones

- **Precios:** el bot no cotiza importes reales; arma la solicitud y deriva. Los
  precios dependen de reglas de suscripción que no son públicas.
- **Cumplimiento:** en seguros hay requisitos regulatorios (información
  precontractual, canales autorizados). Un despliegue real necesita revisión legal.
- **Fidelidad del contenido:** la base de conocimiento es una síntesis de fuentes
  públicas y puede desactualizarse.
- **Plataforma:** WhatsApp impone reglas de mensajería que condicionan el diseño.

## 8. Roadmap

1. Completar las líneas restantes en la base de conocimiento (Vida, Accidentes
   Personales, Bicicleta, Cartera, Notebook, Cuidados Mayores).
2. Persistir los leads y notificar a un asesor.
3. Integrar precios reales vía los cotizadores existentes.
4. Instrumentar las métricas de la sección 6.
5. Conectar la API oficial de Meta para pruebas en WhatsApp real.

## 9. Qué demuestra este ejercicio

- **Conocimiento del producto de La Caja:** catálogo, estructura de planes,
  canales y posventa.
- **Criterio de producto:** elegir dónde jugar con base en un hueco del funnel, no
  por moda tecnológica.
- **Mentalidad analítica:** definir cómo se mide el éxito antes de construir.
- **Ejecución:** un prototipo funcional que baja la estrategia a una experiencia
  concreta.
