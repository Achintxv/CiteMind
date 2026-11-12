import { createConversationSchema } from '@/guardrails/input.guard.js';
import { AppError, ok, route } from '@/utils/response.js';
import { createConversation, listConversations } from '@/services/conversation.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await listConversations()));

export const POST = route(async (request) => {
  const text = await request.text();
  let body = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }
  }
  const { title } = createConversationSchema.parse(body);
  return ok(await createConversation(title), 201);
});
