import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const ok = (data, status = 200) => Response.json({ success: true, data }, { status });

export const fail = (status, code, message, details) =>
  Response.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });

/** Central error mapping. Internal errors are logged server-side and never leaked. */
export function handleError(err) {
  if (err instanceof ZodError) {
    return fail(
      400,
      'VALIDATION_ERROR',
      'Invalid request',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  if (err instanceof AppError) return fail(err.status, err.code, err.message, err.details);
  console.error('[unhandled]', err);
  return fail(500, 'INTERNAL_ERROR', 'Something went wrong on the server.');
}

/** Wraps a Route Handler so every thrown error becomes a consistent JSON response. */
export function route(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      return handleError(err);
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}
