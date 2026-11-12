import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE_LENGTH,
  assertFileSignature,
  chatRequestSchema,
  idSchema,
  sanitizeFilename,
  validateUploadMeta,
} from '@/guardrails/input.guard.js';

describe('chat request validation', () => {
  it('rejects empty and whitespace-only messages', () => {
    expect(chatRequestSchema.safeParse({ message: '' }).success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: '   ' }).success).toBe(false);
  });
  it('rejects excessively long messages', () => {
    expect(chatRequestSchema.safeParse({ message: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) }).success).toBe(false);
  });
  it('accepts a normal message and trims it', () => {
    expect(chatRequestSchema.parse({ message: '  hi  ' }).message).toBe('hi');
  });
  it('validates conversation ids', () => {
    expect(idSchema.safeParse('clx123_abc-9').success).toBe(true);
    expect(idSchema.safeParse("1'; DROP TABLE x;--").success).toBe(false);
    expect(chatRequestSchema.safeParse({ message: 'hi', conversationId: '../etc' }).success).toBe(false);
  });
});

describe('upload validation', () => {
  const max = 1024;
  it('accepts pdf and txt', () => {
    expect(validateUploadMeta({ name: 'A.PDF', type: 'application/pdf', size: 10 }, max).ext).toBe('.pdf');
    expect(validateUploadMeta({ name: 'a.txt', type: 'text/plain; charset=utf-8', size: 10 }, max).ext).toBe('.txt');
  });
  it('rejects invalid file types', () => {
    expect(() => validateUploadMeta({ name: 'a.exe', type: 'application/octet-stream', size: 10 }, max)).toThrow(/pdf/i);
  });
  it('rejects mismatched MIME types', () => {
    expect(() => validateUploadMeta({ name: 'a.pdf', type: 'text/plain', size: 10 }, max)).toThrow();
  });
  it('rejects empty and oversized files', () => {
    expect(() => validateUploadMeta({ name: 'a.txt', type: 'text/plain', size: 0 }, max)).toThrow(/empty/i);
    expect(() => validateUploadMeta({ name: 'a.txt', type: 'text/plain', size: 5000 }, max)).toThrow(/limit/i);
  });
  it('sanitizes filenames', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('we<ir>d:name.txt')).toBe('we_ir_d_name.txt');
    expect(sanitizeFilename('')).toBe('document');
  });
  it('sniffs file signatures', () => {
    expect(() => assertFileSignature('.pdf', Buffer.from('not a pdf'))).toThrow();
    expect(() => assertFileSignature('.txt', Buffer.from([65, 0, 66]))).toThrow();
    expect(() => assertFileSignature('.pdf', Buffer.from('%PDF-1.7'))).not.toThrow();
  });
});
