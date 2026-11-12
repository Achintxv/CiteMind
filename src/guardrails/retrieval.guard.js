// pgvector's `<=>` operator returns cosine DISTANCE (0 = identical direction, 1 = orthogonal,
// 2 = opposite). The threshold in this app is on cosine SIMILARITY = 1 - distance.
// A high similarity means "textually related", not "factually correct".

export const distanceToSimilarity = (distance) => 1 - Number(distance);

export function filterByThreshold(chunks, threshold) {
  return chunks.filter((c) => Number.isFinite(c.similarity) && c.similarity >= threshold);
}

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/**
 * Removes duplicate evidence. Expects chunks sorted by similarity (best first).
 * - identical text (e.g. the same file uploaded twice)
 * - adjacent chunks of one document that share their overlap region (keeps the better-ranked one)
 */
export function dedupeChunks(chunks) {
  const kept = [];
  for (const c of chunks) {
    const text = norm(c.content);
    const duplicate = kept.some((k) => {
      const other = norm(k.content);
      if (other === text) return true;
      if (k.documentId !== c.documentId || Math.abs(k.chunkIndex - c.chunkIndex) !== 1) return false;
      const [earlier, later] = k.chunkIndex < c.chunkIndex ? [other, text] : [text, other];
      const probe = later.slice(0, 80);
      return probe.length >= 40 && earlier.includes(probe);
    });
    if (!duplicate) kept.push(c);
  }
  return kept;
}

export const hasUsableContext = (chunks) => chunks.length > 0;

export const INSUFFICIENT_CONTEXT_MESSAGE =
  "I couldn't find information about that in your uploaded documents, so I can't answer it reliably. Try rephrasing, or upload a document that covers this topic.";
