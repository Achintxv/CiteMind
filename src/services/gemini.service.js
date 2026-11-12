// All Gemini calls live here (server-side only). The API key never leaves the server.
import { GoogleGenAI } from '@google/genai';
import { getEnv } from '@/lib/env.js';
import { AppError } from '@/utils/response.js';

let client;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: getEnv().GEMINI_API_KEY }));

const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export function isTransient(err) {
  const status = err?.status ?? err?.code ?? err?.response?.status;
  if (TRANSIENT_STATUS.has(Number(status))) return true;
  return /\b(429|500|502|503|504)\b|overloaded|unavailable|timed? ?out|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
    String(err?.message ?? ''),
  );
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Limited exponential backoff (500ms, 1s, 2s ...) for transient errors only. */
export async function withRetry(fn, { retries = 3, baseDelayMs = 500, sleep = defaultSleep } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isTransient(err)) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}

function toAppError(err) {
  console.error('[gemini]', err?.status ?? '', err?.message ?? err);
  if (Number(err?.status) === 429) {
    return new AppError(503, 'AI_SERVICE_BUSY', 'The AI service is rate limited right now. Please retry shortly.');
  }
  return new AppError(502, 'AI_SERVICE_ERROR', 'The AI service failed to respond. Please try again.');
}

/** @returns {Promise<number[][]>} raw (un-normalized) embedding vectors, one per input text */
export async function embedContents({ texts, taskType }) {
  const { GEMINI_EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = getEnv();
  try {
    const res = await withRetry(() =>
      getClient().models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: texts,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    );
    return (res.embeddings ?? []).map((e) => e.values);
  } catch (err) {
    throw toAppError(err);
  }
}

/** Calls the chat model asking for JSON. Returns the raw text; callers must validate it. */
export async function generateJson({ systemInstruction, contents }) {
  try {
    const res = await withRetry(() =>
      getClient().models.generateContent({
        model: getEnv().GEMINI_CHAT_MODEL,
        contents,
        config: {
          systemInstruction,
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    );
    return res.text;
  } catch (err) {
    throw toAppError(err);
  }
}
