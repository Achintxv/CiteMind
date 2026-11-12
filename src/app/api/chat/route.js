import { chatRequestSchema } from '@/guardrails/input.guard.js';
import { rateLimit } from '@/lib/rate-limit.js';
import { ok, readJson, route } from '@/utils/response.js';
import { answerQuestion } from '@/services/rag.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  rateLimit(request, { key: 'chat', limit: 20 });
  const input = chatRequestSchema.parse(await readJson(request));
  return ok(await answerQuestion(input));
});
