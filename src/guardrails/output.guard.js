import { z } from 'zod';
import { PROMPT_CANARY } from '@/utils/prompt.js';

export class OutputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

const modelSchema = z.object({
  answerable: z.boolean(),
  answer: z.string().trim().min(1, 'empty answer').max(8000),
  sources: z.array(z.string()).max(50).default([]),
});

const SECRET_PATTERNS = [/AIza[0-9A-Za-z_-]{30,}/, /postgres(?:ql)?:\/\/\S+/i];

export function containsSecret(text) {
  if (text.includes(PROMPT_CANARY)) return true;
  if (SECRET_PATTERNS.some((re) => re.test(text))) return true;
  for (const key of ['GEMINI_API_KEY', 'DATABASE_URL']) {
    const value = process.env[key];
    if (value && value.length >= 8 && text.includes(value)) return true;
  }
  return false;
}

function parseJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw new OutputValidationError('Empty model response');
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    throw new OutputValidationError('Model response is not valid JSON');
  }
}

/**
 * Validates the raw model text against the expected structure and the chunks that were
 * actually retrieved. Unknown source ids are dropped; an "answerable" answer that cites
 * nothing verifiable is rejected rather than shown without evidence.
 */
export function validateModelOutput(raw, retrievedChunks) {
  const parsed = modelSchema.safeParse(parseJson(raw));
  if (!parsed.success) {
    throw new OutputValidationError(`Model response has the wrong structure: ${parsed.error.issues[0]?.message}`);
  }
  const { answerable, answer, sources } = parsed.data;

  if (containsSecret(answer)) throw new OutputValidationError('Model response contained sensitive data');

  const byId = new Map(retrievedChunks.map((c) => [c.chunkId, c]));
  const uniqueIds = [...new Set(sources)];
  const valid = uniqueIds.filter((id) => byId.has(id)).map((id) => byId.get(id));
  const droppedSourceIds = uniqueIds.filter((id) => !byId.has(id));

  if (answerable && valid.length === 0) {
    throw new OutputValidationError('Answer cites no valid retrieved chunk');
  }
  return { answerable, answer, sources: answerable ? valid : [], droppedSourceIds };
}

export const OUTPUT_FALLBACK_MESSAGE =
  "I couldn't produce a reliable, source-backed answer to that. Please try rephrasing your question.";
