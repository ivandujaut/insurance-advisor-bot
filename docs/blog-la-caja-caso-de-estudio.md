# La Caja ya tenía un bot de WhatsApp. Me puse a diseñar el que le falta.

*Un caso de estudio sobre decisiones de producto: cómo leer el recorrido de un
cliente, encontrar un hueco y decidir dónde jugar. Lectura: ~8 min.*

> Análisis independiente hecho con información pública del sitio de La Caja
> (julio de 2026). No estoy afiliado a la empresa ni tuve acceso a datos
> internos. Lo que sigue separa lo que observé de lo que supongo.

---

Empecé como empieza cualquier persona que quiere un seguro: entré al sitio de
La Caja a mirar. No buscaba una idea de producto, buscaba entender cómo te
venden un seguro hoy. Y a los pocos minutos me encontré con un detalle que me
hizo frenar.

En la home, entre los botones de siempre, había uno que decía "Chateá por
WhatsApp con Letizia". La Caja ya tiene un asistente de WhatsApp. Mi primera
reacción fue la obvia: "listo, ya está hecho". Pero cuando miré para qué usan a
Letizia, la historia cambió.

## Letizia atiende, pero no vende

Recorrí las páginas de producto y el centro de ayuda. En todos lados, Letizia
aparecía como el primer canal recomendado para lo mismo: modificar una póliza,
darse de baja, descargar documentación, hacer una consulta. Es decir, Letizia
es un excelente bot de **posventa**. Está para el cliente que ya compró.

¿Y la venta? La cotización vive en la web, en cotizadores separados por línea
(uno para auto, otro para hogar, otro para moto), con un formulario de cuatro
pasos. Funciona, pero es frío, y sobre todo está lejos de donde la gente
pregunta.

Ahí apareció el insight. Dibujé el recorrido del cliente y quedó así:

| Etapa | Quién la atiende hoy | Cómo se siente |
|---|---|---|
| Entender qué me conviene | Nadie con claridad | El cliente compara solo |
| Cotizar | Cotizador web | Formulario, hay que salir a la web |
| Contratar | Web / asesor | |
| Usar y gestionar (posventa) | Letizia + app | Bien resuelto |

Los dos extremos están cubiertos. El medio, no. La etapa de **venta asesorada**,
ese momento en que alguien todavía no sabe si le conviene Terceros Completo o
Todo Riesgo y necesita que le expliquen, no tiene un dueño conversacional.

Y acá va la parte que me parece más interesante como decisión: La Caja ya
demostró que WhatsApp le funciona. Invirtió en Letizia, ofrece telemedicina por
WhatsApp. El canal está validado internamente. Solo que lo usan para la etapa
equivocada del embudo.

**Mi apuesta:** no clonar a Letizia, sino ocupar el hueco de la pre-venta.
Asesorar, comparar y cotizar dentro del chat.

## Cinco decisiones, y el porqué de cada una

Una vez clara la apuesta, lo que sigue son decisiones. Trato de que cada una
tenga un criterio y un dato atrás, no una corazonada. Y trato de ser honesto
con lo que resigno en cada caso, porque no hay decisión sin trade-off.

**1. Posicionar el bot en venta asesorada, no en autogestión.**
El criterio: no competir donde el incumbente ya es fuerte. Si Letizia resuelve
bien la posventa, hacer otro bot igual es esfuerzo sin diferencial. La pre-venta
ataca el momento de mayor intención de compra y menor acompañamiento. Lo que
resigno: la venta asesorada exige más lógica de negocio (comparar, recomendar)
que responder preguntas de autogestión.

**2. WhatsApp como canal.**
El criterio: encontrarme con el usuario donde ya está, y donde la empresa ya
tiene tracción. El dato: La Caja ya usa WhatsApp con éxito. Lo que resigno:
WhatsApp impone límites de formato y reglas de plataforma que condicionan el
diseño.

**3. Un motor híbrido: menús más un modelo de lenguaje.**
Esta es la que más me gusta. La cotización es un proceso estructurado y
repetible (los cotizadores web ya lo modelan en cuatro pasos), pero las dudas
son abiertas ("¿qué es la franquicia?", "¿cubre granizo?"). Usar solo menús
sería rígido; usar solo IA sería impredecible y caro. Entonces: menús para lo
estructurado, que dan control y previsibilidad, y el modelo de lenguaje para las
consultas abiertas, anclado a contenido real para no inventar. El trade-off son
dos caminos que mantener y una frontera que afinar.

**4. Empezar por Auto.**
El criterio: priorizar por volumen y claridad. Auto es la línea más destacada
del sitio y tiene una escalera de tres planes muy explicable. Empezar por ahí
maximiza el aprendizaje por unidad de esfuerzo. Lo que resigno: al principio
quedan afuera líneas con otra lógica (Salud, por ejemplo, no es un seguro de
daños sino de enfermedades graves).

**5. Comparar los planes dentro del chat.**
La estructura de La Caja es "bueno / mejor / óptimo": Terceros Completo,
Terceros Completo con Granizo, Todo Riesgo con Franquicia. Tres opciones es un
número manejable en una conversación. Ayudar a elegir es, justamente, el valor
que falta en la pre-venta. El cuidado está en simplificar sin traicionar: la
síntesis tiene que ser fiel a la cobertura real.

Hay más decisiones detrás (una capa de adaptadores para no atarme a un proveedor
de WhatsApp desde el día uno, una base de conocimiento con contenido real en vez
de genérico), pero las cinco de arriba son las que definen el producto.

## Cómo sabría si funciona

Un bot no se evalúa por "responde lindo". Se evalúa por su efecto en el embudo.
Si esto fuera un producto real, instrumentaría:

- **Activación:** de quienes saludan, cuántos arrancan a cotizar, y cuántos
  terminan el flujo.
- **Drop-off por paso:** en qué pregunta se cae la gente (vehículo, código
  postal, condición, elección de plan). Ahí está la fricción.
- **Conversión:** leads generados, derivaciones a asesor y su resultado.
- **Calidad:** tasa de contención (consultas resueltas sin humano), tasa de "no
  entendí" del bot, y satisfacción al cierre.
- **Mix de producto:** qué plan elige la gente. Cuando hay tres opciones, ¿se
  van al del medio, como suele pasar?

Definir esto antes de construir no es un detalle. Es la diferencia entre un
experimento que aprende y una función que se lanza y nadie sabe si sirvió.

## Lo que este bot no hace (a propósito)

Para que el análisis sea honesto, los límites. El bot no cotiza precios reales:
arma la solicitud y deriva, porque los precios dependen de reglas de suscripción
que no son públicas. Un despliegue real necesitaría revisión legal (en seguros
hay requisitos de información precontractual y canales autorizados). Y la base de
conocimiento es una síntesis de fuentes públicas: hay que mantenerla al día
cuando cambian los productos.

Nada de esto invalida el ejercicio. Al contrario: saber qué queda afuera es
parte de tener criterio.

## Qué me llevo

Lo que más me interesa de este caso no es el bot. Es el método: mirar el
recorrido real de un cliente, encontrar la etapa que nadie atiende bien, y
decidir dónde jugar con un argumento, no con una moda. El bot es la excusa para
mostrar cómo pienso un problema de producto.

La Caja hizo algo muy bien: llevó WhatsApp a la posventa. La oportunidad que veo
es estirar ese mismo canal una etapa antes, a la venta asesorada, que hoy queda
en tierra de nadie.

Si trabajás en producto y te interesa discutir este análisis (o marcarme dónde
me equivoco, que para eso lo publico), me encantaría charlarlo.

---

*Este caso está documentado en detalle, decisión por decisión, en el repositorio
del proyecto. Acá conté la versión corta.*
