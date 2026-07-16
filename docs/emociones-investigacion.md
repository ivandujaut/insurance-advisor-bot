# Detección de emociones: investigación y plan

Base de estudio para robustecer la Fase 1 (detección de emociones en respuestas
abiertas). Resume cómo modela la academia la emoción, los datasets de referencia,
el debate LLM vs clasificador dedicado, la crítica a nuestra v1 y el plan.

## 1. Cómo se modela la emoción (dos familias + una bisagra)

**Discretos (categorías).**
- **Ekman (1992)**: 6 básicas universales (ira, asco, miedo, alegría, tristeza,
  sorpresa). Le faltan estados clave para servicio/ventas (confusión, interés).
- **Plutchik (1980)**: rueda de 8 primarias en pares opuestos, con intensidades y
  combinaciones. Útil para pensar en gradientes.

**Dimensionales (continuos).**
- **Russell (1980), circumplejo** + **VAD/PAD (Mehrabian & Russell, 1974)**: toda
  emoción se ubica en Valencia (positivo/negativo), Arousal (activación) y
  Dominancia. Frustrado = valencia negativa + arousal alto. Da un disparador de
  escalación por "distress" más robusto que categorías sueltas.

**Bisagra: appraisal (OCC, Ortony-Clore-Collins, 1988).** Las emociones surgen de
evaluar eventos respecto de las metas. Encaja con seguros: frustración = meta
bloqueada (no puedo cotizar); ansiedad = incertidumbre/amenaza (¿me cubren?);
satisfacción = meta lograda. Le da un porqué principiado a las reglas de acción.

> **Nuestra postura:** el set actual (neutral, interés, confusión, frustración,
> enojo, ansiedad, satisfacción) es "discreto + accionable", bien elegido para el
> dominio. Conviene sumarle una **capa dimensional** (valencia + arousal, o una
> intensidad 1-5) para escalar por distress y no por categoría binaria.

## 2. Datasets de referencia (evaluar y calibrar)

- **GoEmotions** (Demszky et al., ACL 2020): 58k comentarios, 27 emociones +
  neutral. Taxonomía fine-grained de referencia.
- **EmpatheticDialogues** (Rashkin et al., ACL 2019): 25k conversaciones, 32
  emociones. Lo más cercano a nuestro caso (emoción en diálogo).
- **SemEval-2018 Task 1, Affect in Tweets** (Mohammad et al.): intensidad de
  emoción + regresión VAD. Para el ángulo de intensidad.
- **ERC (Emotion Recognition in Conversation)**: MELD (Poria et al., 2019),
  DailyDialog (Li et al., 2017), EmoContext / SemEval-2019 Task 3.
- **ISEAR** (Scherer & Wallbott): 7 emociones, clásico.

Uso: taxonomía de referencia, ejemplos few-shot, y sobre todo la **metodología de
evaluación**.

## 3. ERC: el contexto importa

Lección central del subcampo (DialogueRNN, Majumder et al. 2019; DialogueGCN,
Ghosal et al. 2019; COSMIC): la misma frase cambia de emoción según el historial.
Ya pasamos el `history` al LLM, así que puede usar contexto; hay que hacerlo
explícito en el prompt ("la emoción del ÚLTIMO turno, dado el contexto").

## 4. LLM vs clasificador dedicado

| | LLM (actual) | Clasificador dedicado (BERT fine-tuned / embeddings + LogReg) |
|---|---|---|
| Datos | Cero (zero-shot) | Necesita datos etiquetados |
| Costo | Gratis (piggyback en la llamada que ya hacemos) | Barato en inferencia, caro en armado |
| Consistencia/latencia | Variable | Alta / baja latencia |
| Matiz (fine-grained) | Fuerte con buenas definiciones | Depende del dataset |

Evidencia (evals de LLMs en sentiment/emoción): muy buenos en coarse, más flojos en
fine-grained sin definiciones ni ejemplos; la brecha se cierra con calibración
(definiciones de etiquetas + few-shot + pedir confianza).

> **Recomendación:** LLM primario (ya es gratis), evaluar con el benchmark, y tener
> un embeddings-kNN como validador/fallback barato (y para los mensajes de menú,
> donde no hay llamada al LLM).

## 5. Crítica a nuestra v1

1. Sin **definiciones** de las etiquetas en el prompt (ambigüedad enojo vs
   frustración vs ansiedad).
2. Sin **few-shot** (ejemplos rioplatenses).
3. Escalación **binaria** por categoría, sin intensidad/confianza.
4. **No medimos**: no sabemos el F1 real.
5. "neutral" domina: medir con **macro-F1 y matriz de confusión**, no accuracy. La
   concordancia humana en emoción es moderada (~0.4-0.6 kappa): ese es el techo
   realista, no el 95%.

## 6. Plan (evaluation-first)

1. **Definiciones** ancladas en appraisal (qué es cada emoción en nuestro dominio).
2. **Ampliar el set de eval** (14 → ~60-100) con casos borde, ironía y variantes
   rioplatenses.
3. **Eval harness**: macro-F1, per-clase y matriz de confusión, contra un baseline
   (embeddings-kNN) y con kappa humano como techo. *(En marcha: `pnpm eval:emotions`.)*
4. **Mejorar el prompt** (definiciones + few-shot + confianza/intensidad) y
   re-medir (A/B contra la v1).
5. **Decidir LLM vs clasificador con datos**, no por intuición.
6. **Escalación por intensidad/valencia**, no binaria.

## Referencias

- Ekman, P. (1992). *An argument for basic emotions.* Cognition & Emotion.
- Plutchik, R. (1980). *A general psychoevolutionary theory of emotion.*
- Russell, J. A. (1980). *A circumplex model of affect.* JPSP.
- Mehrabian, A. & Russell, J. A. (1974). *An approach to environmental psychology* (PAD).
- Ortony, Clore & Collins (1988). *The Cognitive Structure of Emotions* (OCC).
- Demszky et al. (2020). *GoEmotions.* ACL.
- Rashkin et al. (2019). *Towards Empathetic Open-domain Conversation (EmpatheticDialogues).* ACL.
- Mohammad et al. (2018). *SemEval-2018 Task 1: Affect in Tweets.*
- Poria et al. (2019). *MELD.* ACL.
- Li et al. (2017). *DailyDialog.* IJCNLP.
- Majumder et al. (2019). *DialogueRNN.* AAAI.
- Ghosal et al. (2019). *DialogueGCN.* EMNLP.
- Scherer & Wallbott (1994). *ISEAR.*
