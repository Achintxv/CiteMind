import { getEnv } from '@/lib/env.js';
import { AppError } from '@/utils/response.js';
import { embedContents } from './gemini.service.js';

const BATCH_SIZE = 50;

/** L2-normalizes so cosine similarity behaves consistently (needed for truncated dimensions). */
export function normalizeVector(vec) {
  const norm = Math.sqrt(vec.reduce((sum, x) => sum + x * x, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new AppError(502, 'INVALID_EMBEDDING', 'Received an unusable embedding from the AI service.');
  }
  return vec.map((x) => x / norm);
}

export function validateEmbedding(vec, dimensions = getEnv().EMBEDDING_DIMENSIONS) {
  if (!Array.isArray(vec) || vec.length !== dimensions) {
    throw new AppError(
      500,
      'EMBEDDING_DIMENSION_MISMATCH',
      `Embedding has ${Array.isArray(vec) ? vec.length : 'no'} dimensions but ${dimensions} are configured. ` +
        'Check EMBEDDING_DIMENSIONS and the vector(N) column.',
    );
  }
  if (!vec.every(Number.isFinite)) {
    throw new AppError(502, 'INVALID_EMBEDDING', 'Embedding contains non-numeric values.');
  }
  return vec;
}

/** taskType: 'RETRIEVAL_DOCUMENT' for chunks, 'RETRIEVAL_QUERY' for questions (same model for both). */
export async function embedTexts(texts, taskType = 'RETRIEVAL_DOCUMENT') {
  if (texts.some((t) => !String(t).trim())) {
    throw new AppError(400, 'EMPTY_TEXT', 'Cannot embed empty text.');
  }
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vectors = await embedContents({ texts: batch, taskType });
    if (vectors.length !== batch.length) {
      throw new AppError(502, 'INVALID_EMBEDDING', 'The AI service returned an unexpected number of embeddings.');
    }
    for (const v of vectors) out.push(normalizeVector(validateEmbedding(v)));
  }
  return out;
}

export async function embedQuery(question) {
  const [vector] = await embedTexts([question], 'RETRIEVAL_QUERY');
  return vector;
}
