import { describe, expect, it } from 'vitest';
import { chunkText, estimateTokens } from '@/ingestion/chunk.js';

const sentences = (n) => Array.from({ length: n }, (_, i) => `Sentence number ${i} talks about topic ${i}.`).join(' ');

describe('chunkText', () => {
  it('returns no chunks for empty text', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('keeps short text with paragraph breaks in a single chunk', () => {
    const chunks = chunkText('First paragraph.\n\nSecond paragraph.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('splits long text and respects the size limit', () => {
    const chunks = chunkText(sentences(200), { chunkSize: 50, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(50 * 4);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it('overlaps consecutive chunks', () => {
    const chunks = chunkText(sentences(200), { chunkSize: 50, overlap: 10 });
    for (let i = 0; i < chunks.length - 1; i++) {
      const start = chunks[i + 1].content.slice(0, 20);
      expect(chunks[i].content).toContain(start);
    }
  });

  it('hard-splits a single huge paragraph with no punctuation', () => {
    const chunks = chunkText('word '.repeat(2000), { chunkSize: 50, overlap: 10 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('rejects invalid overlap settings', () => {
    expect(() => chunkText('x', { chunkSize: 10, overlap: 10 })).toThrow();
  });

  it('estimates tokens at about 4 chars each', () => {
    expect(estimateTokens('abcdefgh')).toBe(2);
  });
});
