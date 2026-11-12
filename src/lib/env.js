import { z } from 'zod';

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, 'is required'),
    GEMINI_API_KEY: z.string().min(1, 'is required'),
    GEMINI_CHAT_MODEL: z.string().min(1).default('gemini-2.5-flash'),
    GEMINI_EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
    MAX_FILE_SIZE: z.coerce.number().int().positive().default(5 * 1024 * 1024),
    CHUNK_SIZE: z.coerce.number().int().positive().default(800),
    CHUNK_OVERLAP: z.coerce.number().int().min(0).default(150),
    TOP_K: z.coerce.number().int().min(1).max(20).default(3),
    SIMILARITY_THRESHOLD: z.coerce.number().min(-1).max(1).default(0.5),
  })
  .refine((e) => e.CHUNK_OVERLAP < e.CHUNK_SIZE, {
    message: 'CHUNK_OVERLAP must be smaller than CHUNK_SIZE',
    path: ['CHUNK_OVERLAP'],
  });

let cached;

/** Validates and returns configuration. Throws one readable error listing every problem. */
export function getEnv() {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const lines = result.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
    }
    cached = result.data;
  }
  return cached;
}

export function resetEnvCache() {
  cached = undefined;
}
