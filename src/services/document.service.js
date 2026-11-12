import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma.js';
import { getEnv } from '@/lib/env.js';
import { AppError } from '@/utils/response.js';
import { assertFileSignature, sanitizeFilename, validateUploadMeta } from '@/guardrails/input.guard.js';
import { cleanText, extractText } from '@/ingestion/extract.js';
import { chunkText } from '@/ingestion/chunk.js';
import { embedTexts } from './embedding.service.js';
import { insertChunks } from './retrieval.service.js';

// Not under /public, so uploaded files are never served over HTTP.
export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * Upload -> validate -> extract -> clean -> chunk -> embed -> store.
 * Embedding happens BEFORE any database write, and the document + chunks are saved in one
 * transaction, so a failure never leaves a half-ingested document behind.
 */
export async function ingestDocument(file) {
  const env = getEnv();
  const { ext, mime } = validateUploadMeta({ name: file.name, type: file.type, size: file.size }, env.MAX_FILE_SIZE);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) throw new AppError(422, 'EMPTY_DOCUMENT', 'The uploaded file is empty.');
  assertFileSignature(ext, buffer);

  const text = cleanText(await extractText({ buffer, ext }));
  if (!text) {
    throw new AppError(422, 'EMPTY_DOCUMENT', 'No text could be extracted. Scanned PDFs need OCR, which is not supported.');
  }

  const chunks = chunkText(text, { chunkSize: env.CHUNK_SIZE, overlap: env.CHUNK_OVERLAP }).filter((c) => c.content.trim());
  if (chunks.length === 0) throw new AppError(422, 'EMPTY_DOCUMENT', 'The document has no usable content.');

  const embeddings = await embedTexts(chunks.map((c) => c.content), 'RETRIEVAL_DOCUMENT');

  const storedName = `${randomUUID()}${ext}`;
  const document = await prisma.$transaction(
    async (tx) => {
      const doc = await tx.document.create({
        data: {
          filename: storedName,
          originalFilename: sanitizeFilename(file.name),
          mimeType: mime,
          fileSize: buffer.length,
          status: 'READY',
        },
      });
      await insertChunks(tx, doc.id, chunks, embeddings);
      return doc;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, storedName), buffer, { flag: 'wx' });
  } catch (err) {
    console.error('[document] storing file failed:', err?.message);
    await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
    throw new AppError(500, 'STORAGE_FAILED', 'Could not store the uploaded file.');
  }

  return { ...document, chunkCount: chunks.length };
}

export async function listDocuments() {
  const docs = await prisma.document.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  });
  return docs.map(({ _count, ...d }) => ({ ...d, chunkCount: _count.chunks }));
}

export async function getDocument(id) {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      chunks: { orderBy: { chunkIndex: 'asc' }, select: { id: true, chunkIndex: true, content: true, metadata: true } },
    },
  });
  if (!doc) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  return doc;
}

export async function deleteDocument(id) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
  await prisma.document.delete({ where: { id } }); // chunks are removed by ON DELETE CASCADE
  await unlink(path.join(UPLOAD_DIR, path.basename(doc.filename))).catch(() => {});
}
