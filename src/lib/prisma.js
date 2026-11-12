import { PrismaClient } from '@prisma/client';

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
