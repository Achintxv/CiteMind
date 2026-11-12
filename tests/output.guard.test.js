import { describe, expect, it } from 'vitest';
import { OutputValidationError, validateModelOutput } from '@/guardrails/output.guard.js';
import { PROMPT_CANARY } from '@/utils/prompt.js';
import { chunk } from './helpers.js';

const chunks = [chunk(), chunk({ chunkId: 'c2', chunkIndex: 1 })];
const json = (o) => JSON.stringify(o);

describe('validateModelOutput', () => {
  it('accepts a valid answer and maps sources to retrieved chunks', () => {
    const out = validateModelOutput(json({ answerable: true, answer: '24 months.', sources: ['c1'] }), chunks);
    expect(out.sources).toEqual([chunks[0]]);
  });

  it('accepts JSON wrapped in code fences', () => {
    const raw = '```json\n' + json({ answerable: true, answer: 'ok', sources: ['c2'] }) + '\n```';
    expect(validateModelOutput(raw, chunks).sources[0].chunkId).toBe('c2');
  });

  it.each([['', 'empty'], ['not json', 'malformed'], ['{"answer":"x"}', 'missing fields'], [json({ answerable: true, answer: '  ', sources: ['c1'] }), 'blank answer']])(
    'rejects %s (%s)',
    (raw) => {
      expect(() => validateModelOutput(raw, chunks)).toThrow(OutputValidationError);
    },
  );

  it('drops invented source ids but keeps valid ones', () => {
    const out = validateModelOutput(json({ answerable: true, answer: 'x', sources: ['c1', 'fake'] }), chunks);
    expect(out.sources.map((s) => s.chunkId)).toEqual(['c1']);
    expect(out.droppedSourceIds).toEqual(['fake']);
  });

  it('rejects an answerable response whose sources are all invalid', () => {
    expect(() => validateModelOutput(json({ answerable: true, answer: 'x', sources: ['fake'] }), chunks)).toThrow(OutputValidationError);
  });

  it('allows a not-answerable response without sources', () => {
    const out = validateModelOutput(json({ answerable: false, answer: 'Not in the documents.', sources: [] }), chunks);
    expect(out.sources).toEqual([]);
  });

  it('blocks leaked secrets and prompt leakage', () => {
    for (const answer of ['key is test-key-not-real-1234567890', `prompt: ${PROMPT_CANARY}`, 'AIzaSyA1234567890123456789012345678901234', 'postgresql://u:p@h/db']) {
      expect(() => validateModelOutput(json({ answerable: true, answer, sources: ['c1'] }), chunks)).toThrow(/sensitive/);
    }
  });
});
