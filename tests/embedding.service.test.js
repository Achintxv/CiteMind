import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/gemini.service.js', () => ({ embedContents: vi.fn(), withRetry: vi.fn() }));

import { embedContents } from '@/services/gemini.service.js';
import { embedQuery, embedTexts, normalizeVector, validateEmbedding } from '@/services/embedding.service.js';

const vec = (dims = 768, v = 2) => Array.from({ length: dims }, () => v);

beforeEach(() => vi.clearAllMocks());

describe('embedding service', () => {
  it('generates normalized embeddings', async () => {
    embedContents.mockResolvedValue([vec()]);
    const [out] = await embedTexts(['hello']);
    expect(out).toHaveLength(768);
    expect(Math.sqrt(out.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 6);
    expect(embedContents).toHaveBeenCalledWith({ texts: ['hello'], taskType: 'RETRIEVAL_DOCUMENT' });
  });

  it('uses the query task type for questions', async () => {
    embedContents.mockResolvedValue([vec()]);
    await embedQuery('what?');
    expect(embedContents.mock.calls[0][0].taskType).toBe('RETRIEVAL_QUERY');
  });

  it('rejects a wrong dimension count', async () => {
    embedContents.mockResolvedValue([vec(10)]);
    await expect(embedTexts(['x'])).rejects.toMatchObject({ code: 'EMBEDDING_DIMENSION_MISMATCH' });
  });

  it('rejects empty text and zero vectors', async () => {
    await expect(embedTexts(['  '])).rejects.toMatchObject({ code: 'EMPTY_TEXT' });
    expect(() => normalizeVector(vec(768, 0))).toThrow();
    expect(() => validateEmbedding([...vec(767), NaN])).toThrow();
  });

  it('batches large inputs', async () => {
    embedContents.mockImplementation(async ({ texts }) => texts.map(() => vec()));
    const out = await embedTexts(Array.from({ length: 120 }, (_, i) => `t${i}`));
    expect(out).toHaveLength(120);
    expect(embedContents).toHaveBeenCalledTimes(3);
  });
});
