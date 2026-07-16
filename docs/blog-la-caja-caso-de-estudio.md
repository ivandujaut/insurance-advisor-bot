# Letizia atiende a los clientes de La Caja. ¿Y a los que todavía no lo son?

*Un caso de estudio sobre decisiones de producto: cómo leer el recorrido de un
cliente, encontrar un hueco y decidir dónde jugar. Lectura: ~12 min.*

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

Y acá está lo más interesante: La Caja ya demostró que WhatsApp le funciona.
Invirtió en Letizia, ofrece telemedicina por WhatsApp. El canal está validado
internamente. Solo que lo usan para la etapa equivocada del embudo.

**Mi apuesta:** no clonar a Letizia, sino ocupar el hueco de la pre-venta.
Asesorar, comparar y cotizar dentro del chat.

## Siete decisiones, y el porqué de cada una

Una vez clara la apuesta, lo que sigue son decisiones. Trato de que cada una
tenga un criterio y un dato atrás, no una corazonada. Y trato de ser honesto
con lo que resigno en cada caso, porque no hay decisión sin trade-off.

**1. Posicionar el bot en venta asesorada, no en autogestión.**
La regla es no competir donde el incumbente ya es fuerte. Si Letizia resuelve
bien la posventa, hacer otro bot igual es esfuerzo sin diferencial. La pre-venta,
en cambio, ataca el momento de mayor intención de compra y menor acompañamiento.
El costo: asesorar exige más lógica de negocio (comparar, recomendar) que
responder preguntas de autogestión.

**2. WhatsApp como canal.**
Encontrarme con el usuario donde ya está, y donde la empresa ya tiene tracción.
La Caja usa WhatsApp con éxito, así que el canal no es una apuesta, es un hecho.
El costo: WhatsApp impone límites de formato y reglas de plataforma que
condicionan el diseño.

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

**6. Una capa de adaptadores para no casarme con un proveedor.**
Para conectar WhatsApp hay varios caminos: la API oficial de Meta, intermediarios
como Twilio, o librerías no oficiales. Cada uno tiene su costo y su riesgo, y
elegir mal temprano se paga caro. Así que separé la lógica del bot del canal por
el que llegan los mensajes. En la práctica eso me deja desarrollar y probar todo
con un adaptador de consola, sin credenciales ni cuentas, y enchufar la API
oficial de Meta cambiando una sola variable, que es justo lo que terminé
haciendo: el bot ya corre en WhatsApp real. El trade-off es una capa de
abstracción más para mantener, que se justifica solo por la incertidumbre sobre
cuál va a ser el proveedor final.

**7. Una base de conocimiento con contenido real, no genérico.**
Un asistente de seguros que inventa una cobertura es un problema, no una demo.
Por eso las respuestas del modelo se anclan a contenido que relevé del sitio: los
planes reales, la franquicia explicada con un ejemplo, los requisitos de una casa
para asegurar hogar, las condiciones del seguro de salud. El modelo no habla de
memoria, habla sobre esa base. Bajan las respuestas inventadas, a cambio de una
obligación: mantener ese contenido al día cuando los productos cambian.

Siete decisiones, siete trade-offs. Ninguna es gratis, y esa es justamente la
idea: mostrar el costo de cada elección, no solo el beneficio.

## Cómo se ve en el chat

La estrategia no sirve si no baja a algo concreto. Así se ve una cotización de
auto, con el bot asesorando en lugar de tirarte un formulario:

> **Yo:** hola
> **Bot:** Hola, soy el asistente de seguros de La Caja. Te ayudo a encontrar y
> cotizar tu cobertura. 1 Auto · 2 Hogar · 3 Accidentes personales · 4 Bici o
> monopatín · 5 Comparar planes · 6 Tengo una duda · 7 Hablar con un asesor.
> **Yo:** 1
> **Bot:** Genial, cotizamos tu seguro de auto. Empecemos por el año del vehículo.
> **Yo:** 2020
> **Bot:** ¿Es 0km o usado? (un modelo de años anteriores también puede ser 0km si
> es stock sin patentar)
> **Yo:** usado
> **Bot:** ¿De qué marca es?
> **Yo:** Toyota
> **Bot:** ¿Y el modelo?
> **Yo:** Corolla
> **Bot:** ¿La versión? (está en la cédula). Si no la tenés a mano, escribí "no sé".
> **Yo:** no sé
> **Bot:** ¿Tiene GNC? Sí o no.
> **Yo:** no
> **Bot:** Último dato: ¿en qué código postal se guarda el auto?
> **Yo:** 3011
> **Bot:** Al ser usado, la inspección se hace online cargando fotos. Estos son
> los planes: Terceros Completo, Terceros Completo con Granizo (suma granizo,
> cristales y auto sustituto) y Todo Riesgo con Franquicia (suma daños por
> accidente). ¿Cuál te interesa: 1, 2 o 3?
> **Yo:** 2
> **Bot:** Listo. Con estos datos armo tu solicitud: Toyota Corolla 2020, usado,
> plan Terceros Completo con Granizo. Estimación orientativa: $146.000 a $186.500 por
> mes. El precio final lo confirma un asesor. ¿Avanzamos? 1 Que me llame un asesor ·
> 2 Contratar online · 3 Comparar otro plan.

Los datos que pide (año, condición, marca, modelo, versión, GNC) son los mismos que el
cotizador web de La Caja, pero de a uno y conversacional, no un formulario de
golpe. El menú hace el trabajo pesado del recorrido, y el momento clave (la
comparación de planes) pasa dentro del chat, que es donde se juega la venta
asesorada. Si en cualquier punto pregunto algo abierto, como "¿qué es la
franquicia?", ahí toma el modelo de lenguaje y responde con la información real,
sin romper el flujo. Ese reparto de tareas es la Decisión 3 funcionando en vivo.

## Que lo repetido no cueste: el router de dudas

Hay un detalle de costo escondido en ese reparto. La mayoría de las preguntas abiertas
son las mismas pocas: qué cubre tal plan, qué es la franquicia, cómo se paga. Contestar
cada repetición con una llamada al modelo de lenguaje es lento y cuesta plata. Así que
antes de generar, el bot revisa si la pregunta se parece a una duda que ya conoce:
convierte el texto en un vector, lo compara por significado con un catálogo de dudas
frecuentes, y si hay match claro responde con la respuesta ya escrita, sin gastar una
llamada al modelo. Si no la reconoce, ahí sí genera.

La decisión fina es dónde poner el corte: demasiado laxo y el bot suelta una respuesta
enlatada equivocada a algo que no era; demasiado estricto y casi nunca ahorra. Eso no lo
dejé a ojo. Es un problema de clasificación (¿esta pregunta tiene respuesta conocida?), y
se mide con una curva ROC:

![Curva ROC del FAQ router, AUC 0.92](img/roc-faq.svg)

El punto elegido resuelve el **65% de las dudas conocidas sin llamar al modelo**, con 96%
de acierto y casi cero respuestas equivocadas a preguntas fuera de catálogo. Podría cubrir
más bajando el corte, pero a costa de empezar a contestar de más, y para un bot de seguros
una respuesta enlatada equivocada es peor que gastar una llamada. El resto cae al modelo,
que es la red de seguridad. (El detalle técnico está en la segunda parte.)

## Cuando el cliente se calienta

Un cliente frustrado que no encuentra respuesta se va. Así que el bot, además de
responder, lee el tono del mensaje: si detecta enojo o frustración, deja de insistir con
texto y ofrece pasar a una persona. No reemplaza al asesor, lo llama en el momento justo,
que es cuando el cliente está por abandonar.

Y eso vale sobre todo **dentro de la cotización**, que es donde más se traba y se calienta
la gente. Si en un paso contesta cualquier cosa ("no sé el modelo, basta de preguntas"),
el bot ya no repite la misma pregunta hasta el infinito: lee el tono y, ante frustración o
si se traba dos veces, ofrece una salida. Donde puede, pone un default seguro para no
frenar el envión ("la mayoría no tiene GNC: pongo que no y el asesor lo confirma"); si no,
deriva a una persona. El peor momento, el usuario trabado y caliente, pasa de ser una
fuga a una recuperación.

## Un precio orientativo, no un número inventado

Ese "$146.000 a $186.500 por mes" no lo saqué scrapeando la web ni lo inventé con un
número fijo. Una aseguradora no mira su propio sitio: corre un tarifador que arma
la prima por factores de riesgo (base por plan, antigüedad, 0km o usado, zona por
código postal, GNC). Modelé eso como una función determinística que devuelve un
rango orientativo, no una cotización en firme. Y lo dejé detrás de un puerto: hoy
lo resuelve ese modelo local, mañana la API del tarifador real de La Caja entra en
el mismo lugar sin tocar el resto. Es la Decisión 10: no adivinar el número, sino
dejar preparada la costura donde enchufa el motor de precios real.

## El siguiente paso: que pueda avanzar

Ese precio es el momento de mayor intención de compra, y hasta hace poco el bot lo
desperdiciaba: mostraba el número y te devolvía al menú. Un callejón sin salida en el
mejor momento. Ahora el cierre empuja hacia adelante: *que me llame un asesor / contratar
online (con descuento por CBU) / comparar otro plan*. Si elegís asesor, captura tu
contacto y le pasa la cotización lista, así te llama una persona con todo a mano en vez de
arrancar de cero.

Hasta ahí llega el bot, y a propósito: no cierra la póliza (el precio en firme y la
emisión salen del tarifador oficial, con requisitos regulatorios), pero deja el lead
calificado y tibio, listo para cerrar. Su métrica no es "vender en el chat", es cuántos
leads así entrega con la menor fricción posible.

## El muro de contacto: el mejor argumento a favor del bot

Para calibrar ese modelo fui al cotizador real de La Caja, y ahí encontré el mejor
argumento a favor del bot. Antes de mostrarte un solo precio, la web te pide
e-mail, teléfono, código postal y resolver un reCAPTCHA. O sea: tenés que entregar
tu contacto para ver un número. El bot no necesita nada de eso, porque el canal ya
es tu WhatsApp: da la orientación de precio sin un segundo formulario. Y hay un
detalle que lo remata: intentando cotizar, la web falló una y otra vez ("Algo salió
mal") y, cuando falla, te deriva a un WhatsApp. La propia La Caja usa WhatsApp como
red de contención cuando su funnel se cae. Este bot vive justo ahí.

## Cuatro productos, cuatro formas de cobrar

El mismo esqueleto ya cubre una segunda línea: seguro de hogar. El flujo cambia
(propietario o inquilino, tipo de vivienda, uso, y metros construidos si sos dueño o
cuánto vale el contenido si alquilás), porque relevé campo por campo el cotizador de
hogar de La Caja: arranca justo así y arma un plan personalizable, no tres niveles
fijos como el auto. Y acá pasó algo que en auto no pude: el cotizador de hogar sí me
devolvió precios. Saqué dos puntos reales del mismo caso (168 y 252 millones de suma
de incendio) y calibré el tarifador para que reproduzca ambos. De ahí salió que La
Caja estima el edificio a unos 2,1 millones por metro cuadrado y cobra una tasa
mínima sobre esa suma más un cargo fijo. No es un modelo inventado: es ingeniería
inversa de dos precios reales. Pero el motor no
cambió: sumar hogar fue agregar un flujo y un tarifador detrás de los mismos
puertos, con el lead distinguiendo auto de hogar por su tipo. Esa es la prueba de
que la arquitectura escala: un producto nuevo toca los bordes, no el corazón.

Y hay más líneas que lo rematan. Accidentes personales: La Caja no lo vende con un
cotizador, sino como un catálogo de planes con precio publicado (elegís modalidad y
plan, y el precio ya está), así que el bot ahí no estima nada, lee el catálogo y te
da el número exacto. Bici y monopatín: el precio es una tasa sobre el valor de tu
rodado (relevé que ronda el 1,85% mensual), así que el bot te pregunta cuánto vale y
estima sobre eso. Son cuatro formas de precio distintas conviviendo en el mismo
motor: auto estima por factores, hogar estima anclado a precios reales, accidentes es
catálogo puro y bici es una tasa sobre el valor declarado. El bot se adapta al modelo
de cada producto en vez de imponer uno. Eso es lo que separa un prototipo de un
diseño que un equipo de producto puede hacer crecer.

## El embudo pago: pagar por clics que rebotan

Seguí el hilo un paso más y miré cómo La Caja recibe el tráfico que paga. Entré por
un aviso de Google Ads a su landing "Elegí el mejor seguro" (con teléfono de
campaña propio, así que es plata invertida en cada clic). Lo que encontré, con lente
de conversión:

- **El aviso paga un clic y lo tira a un menú, no a una intención.** El landing es
  un hub de seis productos más un carrusel de tres ofertas. Buenas prácticas de
  tráfico pago piden coincidencia de mensaje y un solo CTA; acá la persona tiene que
  volver a elegir.
- **La fuga grande: el clic pago cae en el funnel roto.** Todos los CTA de auto van
  al mismo cotizador que, en mis pruebas, falló y que además pide e-mail, teléfono y
  reCAPTCHA antes de dar un precio. Es pagar por adquisición para estrellarla contra
  un backend caído y de alta fricción.
- **Sin captura de baja fricción en el landing pago.** No hay WhatsApp, ni una
  cotización express, ni un formulario corto. La única salida es el cotizador
  pesado. (Curioso: el sitio institucional sí tiene botón de WhatsApp; el landing
  que paga tráfico, no.)

La lectura es directa: hoy se paga por clics que rebotan. Un CTA "Cotizá por
WhatsApp" en ese mismo landing daría una sola acción de baja fricción, capturaría el
lead en el canal sin el muro de contacto, y seguiría en pie cuando el cotizador web
se cae. El bot no es un juguete de chat: es la pieza que le falta al embudo donde la
plata ya se está gastando.

## Cómo sabría si funciona

Un bot no se evalúa por "responde lindo". Se evalúa por su efecto en el embudo.
Y no me quedé en la teoría: el prototipo ya registra estos eventos y arma el
reporte. Las métricas que miro:

- **Activación:** de quienes saludan, cuántos arrancan a cotizar, y cuántos
  terminan el flujo.
- **Drop-off por paso:** en qué pregunta se cae la gente (vehículo, código
  postal, condición, elección de plan). Ahí está la fricción.
- **Conversión:** leads generados, derivaciones a asesor y su resultado.
- **Calidad:** tasa de contención (consultas resueltas sin humano), tasa de "no
  entendí" del bot, y satisfacción al cierre.
- **Mix de producto:** qué plan elige la gente. Cuando hay tres opciones, ¿se
  van al del medio, como suele pasar?

Para que no quede abstracto, un ejemplo con números inventados a modo de
ilustración. Supongamos 1.000 personas que le escriben al bot en un mes:

| Paso | Personas | Tasa |
|---|---|---|
| Saludan | 1.000 | - |
| Arrancan a cotizar | 600 | 60% |
| Completan el flujo | 360 | 60% del que arranca |
| Dejan sus datos (lead) | 360 | - |
| Contratan (vía asesor) | 90 | 25% de los leads |

Con esta foto, la charla deja de ser "el bot anda bien" y pasa a ser algo
accionable: "perdemos 40% entre saludar y arrancar, ¿el menú inicial confunde?",
o "se cae 40% en el medio, ¿qué paso los frena, el código postal o la elección de
plan?". Esas son las preguntas que mueven la aguja. Los números son inventados; lo
que importa es el tipo de lectura que habilitan.

Definir esto antes de construir no es un detalle. Es la diferencia entre un
experimento que aprende y una función que se lanza y nadie sabe si sirvió.

## Lo que este bot no hace (a propósito)

Para que el análisis sea honesto, los límites. El bot da estimaciones
orientativas, no cotizaciones en firme: donde el cotizador de La Caja me devolvió
precios los usé para anclar el modelo, pero el número final depende de reglas de
suscripción que no son públicas y lo confirma un asesor. Un despliegue real
necesitaría revisión legal (en seguros hay requisitos de información
precontractual y canales autorizados). Y la base de conocimiento es una síntesis
de fuentes públicas: hay que mantenerla al día cuando cambian los productos.

Nada de esto invalida el ejercicio. Al contrario: saber qué queda afuera es
parte de tener criterio.

## Probalo vos mismo (es una web app, no un video)

Todo esto no es un mockup ni una captura: el bot está **desplegado y andando**. Y
acá hubo una decisión de producto más. Para que cualquiera pueda probarlo (en
particular, alguien de La Caja) el acceso no podía tener fricción: WhatsApp solo
responde a números habilitados en una lista blanca, y no quería que la demo
dependiera de que yo tuviera la máquina prendida. Así que expuse el **mismo motor**
por un segundo canal: una **web app** de chat con la estética de WhatsApp, en una URL
pública. Es la misma conversación (menús, cotización, respuestas de IA); lo único que
cambia es el canal por el que entra el mensaje.

**Probala acá: [lacaja-whatsapp-bot.onrender.com](https://lacaja-whatsapp-bot.onrender.com)**

Escribí "hola" y arranca el menú, igual que en WhatsApp. Está en un plan gratuito, así
que la primera carga después de un rato de inactividad puede tardar unos segundos en
despertar. Que se pueda probar en un clic, sin instalar nada ni pedir permiso, es la
diferencia entre contar el proyecto y mostrarlo funcionando.

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

*El proyecto, con el código y la base de conocimiento, vive en un repositorio
aparte. Acá conté el razonamiento; ahí está la ejecución, que llevé hasta un
estado listo para crecer (arquitectura desacoplada, persistencia real, tests y
deploy). El detalle de ingeniería de ese "listo para crecer" está en la
[parte 2](blog-la-caja-parte-2-arquitectura.md).*
