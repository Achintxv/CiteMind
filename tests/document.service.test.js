import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePdf, unitVector } from './helpers.js';

const tx = { document: { create: vi.fn() } };
vi.mock('@/lib/prisma.js', () => ({
  prisma: { $transaction: vi.fn(async (fn) => fn(tx)), document: { delete: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock('@/services/embedding.service.js', () => ({ embedTexts: vi.fn() }));
vi.mock('@/services/retrieval.service.js', () => ({ insertChunks: vi.fn() }));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn().mockResolvedValue() }));

import { prisma } from '@/lib/prisma.js';
import { embedTexts } from '@/services/embedding.service.js';
import { insertChunks } from '@/services/retrieval.service.js';
import { writeFile } from 'node:fs/promises';
import { ingestDocument } from '@/services/document.service.js';

const file = (content, name, type) => new File([content], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  embedTexts.mockImplementation(async (texts) => texts.map(() => unitVector(768, 0)));
  tx.document.create.mockImplementation(async ({ data }) => ({ id: 'doc1', ...data, createdAt: new Date() }));
});

describe('ingestDocument', () => {
  it('ingests a TXT file end to end', async () => {
    const doc = await ingestDocument(file('First paragraph.\n\nSecond paragraph.', 'notes.txt', 'text/plain'));
    expect(doc).toMatchObject({ id: 'doc1', originalFilename: 'notes.txt', status: 'READY', chunkCount: 1 });
    expect(insertChunks).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it('ingests a PDF file', async () => {
    const doc = await ingestDocument(file(makePdf('Hello PDF world'), 'a.pdf', 'application/pdf'));
    expect(doc.chunkCount).toBeGreaterThan(0);
  });

  it('rejects invalid file types without touching the database', async () => {
    await expect(ingestDocument(file('x', 'virus.exe', 'application/octet-stream'))).rejects.toMatchObject({ status: 415 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects empty and whitespace-only documents', async () => {
    await expect(ingestDocument(file('', 'a.txt', 'text/plain'))).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
    await expect(ingestDocument(file('   \n\n  ', 'b.txt', 'text/plain'))).rejects.toMatchObject({ code: 'EMPTY_DOCUMENT' });
    expect(embedTexts).not.toHaveBeenCalled();
  });

  it('leaves no database records when embedding fails', async () => {
    embedTexts.mockRejectedValue(new Error('gemini down'));
    await expect(ingestDocument(file('some text', 'a.txt', 'text/plain'))).rejects.toThrow('gemini down');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rolls back the record if the file cannot be stored', async () => {
    writeFile.mockRejectedValueOnce(new Error('disk full'));
    prisma.document.delete.mockResolvedValue({});
    await expect(ingestDocument(file('some text', 'a.txt', 'text/plain'))).rejects.toMatchObject({ code: 'STORAGE_FAILED' });
    expect(prisma.document.delete).toHaveBeenCalledWith({ where: { id: 'doc1' } });
  });
});
