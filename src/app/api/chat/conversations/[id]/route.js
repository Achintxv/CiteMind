import { idSchema } from '@/guardrails/input.guard.js';
import { ok, route } from '@/utils/response.js';
import { deleteConversation, getConversationWithMessages } from '@/services/conversation.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (_request, { params }) => {
  const id = idSchema.parse((await params).id);
  return ok(await getConversationWithMessages(id));
});

export const DELETE = route(async (_request, { params }) => {
  const id = idSchema.parse((await params).id);
  await deleteConversation(id);
  return ok({ deleted: true });
});
