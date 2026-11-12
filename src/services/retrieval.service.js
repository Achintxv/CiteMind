// The ONLY place that touches pgvector. Prisma cannot read/write vector columns, so these
// functions use parameterized $executeRaw / $queryRaw tagged templates (values are bound
// parameters, never string-concatenated into SQL).
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma.js';
import { getEnv } from '@/lib/env.js';
import { embedQuery } from './embedding.service.js';
import { dedupeChunks, distanceToSimilarity, filterByThreshold } from '@/guardrails/retrieval.guard.js';

/** pgvector text format, e.g. "[0.1,0.2]". Sent as a bound parameter and cast with ::vector in SQL. */
export function toVectorLiteral(vec) {
  if (!Array.isArray(vec) || !vec.every(Number.isFinite)) throw new Error('Invalid embedding vector');
  return `[${vec.join(',')}]`;
}

/** Inserts chunks + embeddings. `db` is the Prisma client or a transaction client. */
export async function insertChunks(db, documentId, chunks, embeddings) {
  if (chunks.length !== embeddings.length) throw new Error('chunks and embeddings length mismatch');
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const vec = toVectorLiteral(embeddings[i]);
    await db.$executeRaw`
      INSERT INTO "DocumentChunk" ("id", "documentId", "chunkIndex", "content", "embedding", "metadata")
      VALUES (${randomUUID()}, ${documentId}, ${c.index}, ${c.content}, ${vec}::vector, ${JSON.stringify(c.metadata ?? {})}::jsonb)
    `;
  }
}

/** Nearest chunks by cosine distance (`<=>`). Similarity = 1 - distance. */
export async function findSimilarChunks(embedding, limit) {
  const vec = toVectorLiteral(embedding);
  const rows = await prisma.$queryRaw`
    SELECT "id", "documentId", "chunkIndex", "content", "metadata",
           ("embedding" <=> ${vec}::vector) AS "distance"
    FROM "DocumentChunk"
    WHERE "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vec}::vector
    LIMIT ${Number(limit)}
  `;
  return rows.map((r) => ({
    chunkId: r.id,
    documentId: r.documentId,
    chunkIndex: r.chunkIndex,
    content: r.content,
    metadata: r.metadata,
    similarity: distanceToSimilarity(r.distance),
  }));
}

/** Reads the declared vector(N) size from Postgres so we can compare it with EMBEDDING_DIMENSIONS. */
export async function getColumnDimensions() {
  const rows = await prisma.$queryRaw`
    SELECT atttypmod AS "dims" FROM pg_attribute
    WHERE attrelid = '"DocumentChunk"'::regclass AND attname = 'embedding'
  `;
  return rows[0] ? Number(rows[0].dims) : null;
}

/**
 * Semantic search across all documents: embed -> nearest chunks -> resolve document names
 * -> apply similarity threshold -> dedupe -> top K.
 */
export async function searchRelevantChunks(query, { topK, threshold } = {}) {
  const env = getEnv();
  const k = topK ?? env.TOP_K;
  const minSimilarity = threshold ?? env.SIMILARITY_THRESHOLD;

  const embedding = await embedQuery(query);
  const candidates = await findSimilarChunks(embedding, k * 4); // over-fetch so dedupe can still fill K
  if (candidates.length === 0) return [];

  const docs = await prisma.document.findMany({
    where: { id: { in: [...new Set(candidates.map((c) => c.documentId))] } },
    select: { id: true, originalFilename: true },
  });
  const names = new Map(docs.map((d) => [d.id, d.originalFilename]));

  const withNames = candidates.map((c) => ({ ...c, documentName: names.get(c.documentId) ?? 'Unknown document' }));
  return dedupeChunks(filterByThreshold(withNames, minSimilarity)).slice(0, k);
}
