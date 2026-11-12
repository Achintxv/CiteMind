import { describe, expect, it } from 'vitest';
import { cleanText, extractText } from '@/ingestion/extract.js';
import { makePdf } from './helpers.js';

describe('extraction', () => {
  it('extracts TXT', async () => {
    const text = await extractText({ buffer: Buffer.from('Hello text file'), ext: '.txt' });
    expect(text).toBe('Hello text file');
  });

  it('rejects invalid UTF-8 text', async () => {
    await expect(extractText({ buffer: Buffer.from([0xff, 0xfe, 0xfd]), ext: '.txt' })).rejects.toMatchObject({ status: 422 });
  });

  it('extracts PDF text', async () => {
    const text = await extractText({ buffer: makePdf('Hello PDF world'), ext: '.pdf' });
    expect(text).toContain('Hello PDF world');
  });

  it('fails cleanly on a corrupted PDF', async () => {
    await expect(extractText({ buffer: Buffer.from('%PDF-1.4 garbage'), ext: '.pdf' })).rejects.toMatchObject({ code: 'EXTRACTION_FAILED' });
  });

  it('rejects unsupported extensions', async () => {
    await expect(extractText({ buffer: Buffer.from('x'), ext: '.exe' })).rejects.toMatchObject({ status: 415 });
  });

  it('cleans whitespace but keeps paragraphs', () => {
    expect(cleanText('a   b\r\n\r\n\r\n\r\nc \t d')).toBe('a b\n\nc d');
    expect(cleanText('   \n\n  ')).toBe('');
  });
});
