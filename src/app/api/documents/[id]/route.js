import { idSchema } from '@/guardrails/input.guard.js';
import { ok, route } from '@/utils/response.js';
import { deleteDocument, getDocument } from '@/services/document.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (_request, { params }) => {
  const id = idSchema.parse((await params).id);
  return ok(await getDocument(id));
});

export const DELETE = route(async (_request, { params }) => {
  const id = idSchema.parse((await params).id);
  await deleteDocument(id);
  return ok({ deleted: true });
});
