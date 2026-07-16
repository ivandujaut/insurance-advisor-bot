/**
 * Similitud coseno y búsqueda del mejor match, puras. Base del FAQ router: mide
 * qué tan parecidos son dos vectores (embeddings) en significado. 1 = idénticos,
 * 0 = sin relación. A esta escala (decenas de documentos) alcanza con comparar
 * contra todos en memoria; no hace falta un índice vectorial.
 */

export interface FaqDoc {
  id: string;
  respuesta: string;
  vector: number[];
}

export interface Match {
  id: string;
  respuesta: string;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Documento más parecido al vector de consulta (o null si no hay documentos). */
export function bestMatch(queryVector: number[], docs: FaqDoc[]): Match | null {
  let best: Match | null = null;
  for (const doc of docs) {
    const score = cosineSimilarity(queryVector, doc.vector);
    if (!best || score > best.score) {
      best = { id: doc.id, respuesta: doc.respuesta, score };
    }
  }
  return best;
}
