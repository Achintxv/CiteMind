import { ok, route } from '@/utils/response.js';
import { listDocuments } from '@/services/document.service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => ok(await listDocuments()));
