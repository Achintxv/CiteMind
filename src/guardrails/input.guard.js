import path from 'node:path';
import { z } from 'zod';
import { AppError } from '@/utils/response.js';

export const MAX_MESSAGE_LENGTH = 2000;

export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid id');

export const chatRequestSchema = z.object({
  message: z
    .string({ required_error: 'message is required' })
    .trim()
    .min(1, 'message must not be empty')
    .max(MAX_MESSAGE_LENGTH, `message must be at most ${MAX_MESSAGE_LENGTH} characters`),
  conversationId: idSchema.optional(),
});

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
});

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
};

/** Validates upload metadata (extension, MIME type, size). Returns the normalized values. */
export function validateUploadMeta({ name, type, size }, maxBytes) {
  const ext = path.extname(String(name ?? '')).toLowerCase();
  const allowedMimes = ALLOWED[ext];
  if (!allowedMimes) {
    throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Only .pdf and .txt files are supported.');
  }
  const mime = String(type ?? '').split(';')[0].trim().toLowerCase();
  if (!allowedMimes.includes(mime)) {
    throw new AppError(415, 'UNSUPPORTED_MIME_TYPE', `File type "${mime || 'unknown'}" does not match ${ext}.`);
  }
  if (!size) throw new AppError(422, 'EMPTY_DOCUMENT', 'The uploaded file is empty.');
  if (size > maxBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', `File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
  }
  return { ext, mime };
}

/** Strips directory parts and unsafe characters. The result is for display only; disk names are random UUIDs. */
export function sanitizeFilename(name) {
  const base = path.basename(String(name ?? '').replace(/\\/g, '/'));
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').trim().slice(0, 200);
  return cleaned || 'document';
}

/** Content sniffing so a renamed binary cannot pass as PDF/TXT. */
export function assertFileSignature(ext, buffer) {
  if (ext === '.pdf' && buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new AppError(415, 'INVALID_PDF', 'The file is not a valid PDF.');
  }
  if (ext === '.txt' && buffer.includes(0)) {
    throw new AppError(415, 'INVALID_TEXT', 'The file looks like binary data, not plain text.');
  }
}
