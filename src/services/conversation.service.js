import { prisma } from '@/lib/prisma.js';
import { AppError } from '@/utils/response.js';

export const deriveTitle = (message) => {
  const t = message.replace(/\s+/g, ' ').trim();
  return t.length > 60 ? `${t.slice(0, 57)}...` : t || 'New chat';
};

export const createConversation = (title = 'New chat') => prisma.conversation.create({ data: { title } });

export async function listConversations() {
  const rows = await prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, messageCount: _count.messages }));
}

export async function getConversationOrThrow(id) {
  const c = await prisma.conversation.findUnique({ where: { id } });
  if (!c) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  return c;
}

export async function getConversationWithMessages(id) {
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!c) throw new AppError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  return c;
}

export async function deleteConversation(id) {
  await getConversationOrThrow(id);
  await prisma.conversation.delete({ where: { id } }); // messages cascade
}

/** The last `limit` messages, oldest first. */
export async function getRecentMessages(conversationId, limit = 6) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.reverse();
}

export async function addMessage(conversationId, role, content, sources = null) {
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role, content, sources: sources && sources.length ? sources : undefined },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
  ]);
  return message;
}
