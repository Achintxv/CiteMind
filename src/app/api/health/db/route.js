import { getEnv } from '@/lib/env.js';
import { prisma } from '@/lib/prisma.js';
import { fail, ok, route } from '@/utils/response.js';
import { getColumnDimensions } from '@/services/retrieval.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  try {
    const ext = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    const columnDimensions = await getColumnDimensions();
    const configuredDimensions = getEnv().EMBEDDING_DIMENSIONS;
    const checks = {
      database: true,
      pgvector: ext.length > 0,
      columnDimensions,
      configuredDimensions,
      dimensionsMatch: columnDimensions === configuredDimensions,
    };
    if (!checks.pgvector || !checks.dimensionsMatch) {
      return fail(503, 'DB_MISCONFIGURED', 'pgvector is missing or the vector column size does not match EMBEDDING_DIMENSIONS.', checks);
    }
    return ok(checks);
  } catch (err) {
    console.error('[health/db]', err?.message);
    return fail(503, 'DB_UNAVAILABLE', 'Cannot reach the database. Check DATABASE_URL and that migrations were applied.');
  }
});
