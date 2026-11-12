import { getEnv } from '@/lib/env.js';
import { assessInputRisk, INJECTION_REFUSAL } from '@/guardrails/injection.guard.js';
import { hasUsableContext, INSUFFICIENT_CONTEXT_MESSAGE } from '@/guardrails/retrieval.guard.js';
import { OUTPUT_FALLBACK_MESSAGE, OutputValidationError, validateModelOutput } from '@/guardrails/output.guard.js';
import { buildSystemPrompt, buildUserContent } from '@/utils/prompt.js';
import { generateJson } from './gemini.service.js';
import { searchRelevantChunks } from './retrieval.service.js';
import {
  addMessage,
  createConversation,
  deriveTitle,
  getConversationOrThrow,
  getRecentMessages,
} from './conversation.service.js';

export const HISTORY_LIMIT = 6;

/** Short follow-ups ("and its price?") embed poorly alone, so prepend the previous user question. */
export function buildRetrievalQuery(message, history) {
  const words = message.trim().split(/\s+/).length;
  const prevUser = [...history].reverse().find((m) => m.role === 'USER');
  return words < 8 && prevUser ? `${prevUser.content}\n${message}` : message;
}

const toSource = (c) => ({
  chunkId: c.chunkId,
  documentId: c.documentId,
  documentName: c.documentName,
  chunkIndex: c.chunkIndex,
  excerpt: c.content.length > 300 ? `${c.content.slice(0, 300)}...` : c.content,
  similarity: Math.round(c.similarity * 1000) / 1000,
});

async function generateAnswer({ message, history }) {
  const env = getEnv();

  // Guardrail: input risk check (heuristic layer)
  if (assessInputRisk(message).level === 'high') {
    return { answer: INJECTION_REFUSAL, sources: [], outcome: 'blocked' };
  }

  // Retrieval + guardrail: similarity threshold
  const chunks = await searchRelevantChunks(buildRetrievalQuery(message, history), {
    topK: env.TOP_K,
    threshold: env.SIMILARITY_THRESHOLD,
  });
  if (!hasUsableContext(chunks)) {
    return { answer: INSUFFICIENT_CONTEXT_MESSAGE, sources: [], outcome: 'no_context' };
  }

  // Generation: trusted system prompt, untrusted data in the user turn
  const raw = await generateJson({
    systemInstruction: buildSystemPrompt(),
    contents: buildUserContent({ chunks, history, question: message }),
  });

  // Guardrail: output validation
  try {
    const out = validateModelOutput(raw, chunks);
    if (!out.answerable) return { answer: out.answer, sources: [], outcome: 'not_answerable' };
    return { answer: out.answer, sources: out.sources.map(toSource), outcome: 'answered' };
  } catch (err) {
    if (err instanceof OutputValidationError) {
      console.warn('[rag] rejected model output:', err.message);
      return { answer: OUTPUT_FALLBACK_MESSAGE, sources: [], outcome: 'invalid_output' };
    }
    throw err;
  }
}

/** Full chat turn: persists the user message, answers, persists the assistant message. */
export async function answerQuestion({ message, conversationId }) {
  const conversation = conversationId
    ? await getConversationOrThrow(conversationId)
    : await createConversation(deriveTitle(message));

  const history = conversationId ? await getRecentMessages(conversation.id, HISTORY_LIMIT) : [];
  await addMessage(conversation.id, 'USER', message);

  const result = await generateAnswer({ message, history });
  const saved = await addMessage(conversation.id, 'ASSISTANT', result.answer, result.sources);

  return {
    conversationId: conversation.id,
    outcome: result.outcome,
    message: {
      id: saved.id,
      role: 'ASSISTANT',
      content: result.answer,
      sources: result.sources,
      createdAt: saved.createdAt,
    },
  };
}
