import { getEnv } from '@/lib/env.js';
import { rateLimit } from '@/lib/rate-limit.js';
import { AppError, ok, route } from '@/utils/response.js';
import { ingestDocument } from '@/services/document.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (request) => {
  rateLimit(request, { key: 'upload', limit: 10 });

  // Cheap early rejection before buffering the body (the real size check runs again after parsing).
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > getEnv().MAX_FILE_SIZE + 1024 * 1024) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Upload is too large.');
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new AppError(400, 'INVALID_FORM', 'Expected multipart/form-data with a "file" field.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    throw new AppError(400, 'FILE_REQUIRED', 'A "file" field is required.');
  }
  return ok(await ingestDocument(file), 201);
});
