import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unitVector } from './helpers.js';

vi.mock('@/lib/prisma.js', () => ({ prisma: { $queryRaw: vi.fn(), $executeRaw: vi.fn(), document: { findMany: vi.fn() } } }));
vi.mock('@/services/embedding.service.js', () => ({ embedQuery: vi.fn() }));

import { prisma } from '@/lib/prisma.js';
import { embedQuery } from '@/services/embedding.service.js';
import { insertChunks, searchRelevantChunks, toVectorLiteral } from '@/services/retrieval.service.js';

const row = (id, documentId, distance, content = `content ${id}`) => ({ id, documentId, chunkIndex: 0, content, metadata: {}, distance });

beforeEach(() => {
  vi.clearAllMocks();
  embedQuery.mockResolvedValue(unitVector(768, 0));
});

describe('searchRelevantChunks', () => {
  it('returns relevant chunks with document names and similarity = 1 - distance', async () => {
    prisma.$queryRaw.mockResolvedValue([row('a', 'd1', 0.1)]);
    prisma.document.findMany.mockResolvedValue([{ id: 'd1', originalFilename: 'guide.pdf' }]);
    const [r] = await searchRelevantChunks('question');
    expect(r).toMatchObject({ chunkId: 'a', documentName: 'guide.pdf' });
    expect(r.similarity).toBeCloseTo(0.9);
  });

  it('drops chunks below the similarity threshold', async () => {
    prisma.$queryRaw.mockResolvedValue([row('a', 'd1', 0.7), row('b', 'd1', 0.8)]); // similarity 0.3 / 0.2
    prisma.document.findMany.mockResolvedValue([{ id: 'd1', originalFilename: 'x.txt' }]);
    expect(await searchRelevantChunks('q', { threshold: 0.5 })).toEqual([]);
  });

  it('searches across multiple documents and respects top K', async () => {
    prisma.$queryRaw.mockResolvedValue([row('a', 'd1', 0.1), row('b', 'd2', 0.2), row('c', 'd3', 0.25), row('d', 'd1', 0.3)]);
    prisma.document.findMany.mockResolvedValue([
      { id: 'd1', originalFilename: 'one.txt' },
      { id: 'd2', originalFilename: 'two.txt' },
      { id: 'd3', originalFilename: 'three.txt' },
    ]);
    const out = await searchRelevantChunks('q', { topK: 3, threshold: 0.5 });
    expect(out.map((c) => c.documentName)).toEqual(['one.txt', 'two.txt', 'three.txt']);
  });

  it('returns an empty list when the table has no embeddings', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    expect(await searchRelevantChunks('q')).toEqual([]);
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });
});

describe('vector helpers', () => {
  it('formats the pgvector literal and rejects bad vectors', () => {
    expect(toVectorLiteral([0.5, 1, -2])).toBe('[0.5,1,-2]');
    expect(() => toVectorLiteral([1, NaN])).toThrow();
  });

  it('inserts each chunk through parameterized $executeRaw', async () => {
    const db = { $executeRaw: vi.fn().mockResolvedValue(1) };
    await insertChunks(db, 'doc1', [{ index: 0, content: "it's; DROP TABLE x;--", metadata: {} }], [[0.1, 0.2]]);
    const [strings, ...values] = db.$executeRaw.mock.calls[0];
    expect(strings.join('?')).not.toContain('DROP TABLE'); // user text is a bound value, never part of the SQL
    expect(values).toContain("it's; DROP TABLE x;--");
    expect(values).toContain('[0.1,0.2]');
  });
});
