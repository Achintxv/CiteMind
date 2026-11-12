import { ok } from '@/utils/response.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = () => ok({ status: 'ok', time: new Date().toISOString() });
