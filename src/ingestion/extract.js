import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';
import { AppError } from '@/utils/response.js';

/** Normalizes whitespace but keeps paragraph breaks (blank lines). */
export function cleanText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t\f\v\u00A0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fromPdf(buffer) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.error('[extract] pdf failed:', err?.message);
    throw new AppError(422, 'EXTRACTION_FAILED', 'Could not read text from this PDF. It may be corrupted or encrypted.');
  }
}

function fromTxt(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new AppError(422, 'EXTRACTION_FAILED', 'The text file is not valid UTF-8.');
  }
}

/** Returns RAW extracted text (call cleanText on it). */
export async function extractText({ buffer, ext }) {
  if (ext === '.pdf') return fromPdf(buffer);
  if (ext === '.txt') return fromTxt(buffer);
  throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Only .pdf and .txt files are supported.');
}
