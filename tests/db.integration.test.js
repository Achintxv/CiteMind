// Runs ONLY when TEST_DATABASE_URL points at a disposable PostgreSQL database that has
// pgvector and the migrations applied:
//   DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
//   TEST_DATABASE_URL=postgresql://... npm test
// It uses synthetic unit vectors (not Gemini), because it tests SQL behaviour, not embedding quality.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unitVector } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('database integration (Prisma + pgvector)', () => {
  let prisma;
  let retrieval;
  let conversations;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ prisma } = await import('@/lib/prisma.js'));
    retrieval = await import('@/services/retrieval.service.js');
    conversations = await import('@/services/conversation.service.js');
    await prisma.document.deleteMany();
    await prisma.conversation.deleteMany();
  });

  afterAll(async () => {
    await prisma?.document.deleteMany();
    await prisma?.conversation.deleteMany();
    await prisma?.$disconnect();
  });

  it('column dimensions match the configured dimensions', async () => {
    expect(await retrieval.getColumnDimensions()).toBe(768);
  });

  it('inserts vectors and finds the nearest chunk first', async () => {
    const doc = await prisma.document.create({
      data: { filename: 'f.txt', originalFilename: 'f.txt', mimeType: 'text/plain', fileSize: 10, status: 'READY' },
    });
    await retrieval.insertChunks(
      prisma,
      doc.id,
      [
        { index: 0, content: 'alpha', metadata: {} },
        { index: 1, content: 'beta', metadata: {} },
      ],
      [unitVector(768, 0), unitVector(768, 1)],
    );
    const hits = await retrieval.findSimilarChunks(unitVector(768, 1), 2);
    expect(hits[0].content).toBe('beta');
    expect(hits[0].similarity).toBeCloseTo(1, 5);
    expect(hits[1].similarity).toBeCloseTo(0, 5); // orthogonal vectors: distance 1, similarity 0
  });

  it('cascades document deletion to chunks', async () => {
    const doc = await prisma.document.findFirst();
    await prisma.document.delete({ where: { id: doc.id } });
    expect(await prisma.documentChunk.count({ where: { documentId: doc.id } })).toBe(0);
  });

  it('persists conversations and messages and cascades deletion', async () => {
    const c = await conversations.createConversation('Test');
    await conversations.addMessage(c.id, 'USER', 'hello');
    await conversations.addMessage(c.id, 'ASSISTANT', 'hi', [{ chunkId: 'x' }]);
    const loaded = await conversations.getConversationWithMessages(c.id);
    expect(loaded.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
    expect(loaded.messages[1].sources).toEqual([{ chunkId: 'x' }]);
    expect((await conversations.getRecentMessages(c.id, 1))[0].content).toBe('hi');
    await conversations.deleteConversation(c.id);
    expect(await prisma.message.count({ where: { conversationId: c.id } })).toBe(0);
  });
});
