import { describe, expect, it } from 'vitest';
import { dedupeChunks, distanceToSimilarity, filterByThreshold } from '@/guardrails/retrieval.guard.js';
import { chunk } from './helpers.js';

describe('retrieval guard', () => {
  it('converts cosine distance to similarity', () => {
    expect(distanceToSimilarity(0)).toBe(1);
    expect(distanceToSimilarity(0.25)).toBe(0.75);
    expect(distanceToSimilarity(1)).toBe(0);
  });

  it('filters by similarity threshold', () => {
    const kept = filterByThreshold([chunk({ similarity: 0.9 }), chunk({ chunkId: 'x', similarity: 0.3 })], 0.5);
    expect(kept).toHaveLength(1);
  });

  it('removes identical chunks', () => {
    expect(dedupeChunks([chunk(), chunk({ chunkId: 'dup', documentId: 'd2' })])).toHaveLength(1);
  });

  it('removes adjacent chunks that share their overlap', () => {
    const shared = 'This overlapping sentence appears at the end of one chunk and start of next one.';
    const a = chunk({ chunkId: 'a', chunkIndex: 0, content: `Intro text here. ${shared}` });
    const b = chunk({ chunkId: 'b', chunkIndex: 1, content: `${shared} And then new content.` });
    expect(dedupeChunks([a, b]).map((c) => c.chunkId)).toEqual(['a']);
  });

  it('keeps unrelated chunks from different documents', () => {
    const out = dedupeChunks([chunk(), chunk({ chunkId: 'z', documentId: 'd2', content: 'Totally different text.' })]);
    expect(out).toHaveLength(2);
  });
});
