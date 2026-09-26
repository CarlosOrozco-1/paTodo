import type {
  Conversation,
  CreateMessageDto,
  Message,
  Notification,
} from '@/types/message.types';
import { currentUserId, sleep } from './index';
import { db, nowIso, saveDb, uid } from './demoDb';

export const demoConversations = {
  async getAll(): Promise<Conversation[]> {
    await sleep();
    const me = currentUserId();
    if (!me) return [];
    return db()
      .conversations.filter((c) => c.participantIds.includes(me))
      .sort((a, b) => (b.lastMessage?.createdAt ?? b.updatedAt).localeCompare(a.lastMessage?.createdAt ?? a.updatedAt));
  },

  async getById(id: string): Promise<Conversation> {
    await sleep(80);
    const conv = db().conversations.find((c) => c.id === id);
    if (!conv) throw new Error('Conversación no encontrada');
    return conv;
  },

  async getByJob(jobId: string): Promise<Conversation[]> {
    await sleep();
    return db().conversations.filter((c) => c.jobId === jobId);
  },
};

export const demoMessages = {
  async getByConversation(conversationId: string): Promise<Message[]> {
    await sleep();
    return db()
      .messages.filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async send(data: CreateMessageDto): Promise<Message> {
    await sleep(150);
    const me = currentUserId();
    if (!me) throw new Error('Inicia sesión para enviar mensajes');
    const d = db();
    let conv = d.conversations.find(
      (c) =>
        (!data.jobId || c.jobId === data.jobId) &&
        c.participantIds.includes(me) &&
        c.participantIds.includes(data.receiverId),
    );
    if (!conv) {
      conv = {
        id: uid('demo-conv'),
        jobId: data.jobId,
        participantIds: [me, data.receiverId],
        unreadCount: { [data.receiverId]: 0, [me]: 0 },
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      d.conversations.push(conv);
    }
    const message: Message = {
      id: uid('demo-msg'),
      jobId: data.jobId,
      conversationId: conv.id,
      senderId: me,
      receiverId: data.receiverId,
      content: data.content,
      type: data.type ?? 'text',
      replyTo: data.replyTo ?? null,
      deliveredAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.messages.push(message);
    const lastMessage = {
      content: data.content,
      senderId: me,
      type: data.type ?? 'text',
      createdAt: nowIso(),
    };
    conv.lastMessage = lastMessage;
    conv.updatedAt = nowIso();
    conv.unreadCount[data.receiverId] = (conv.unreadCount[data.receiverId] ?? 0) + 1;
    saveDb(d);
    return message;
  },

  async markAsRead(conversationId: string): Promise<void> {
    await sleep(80);
    const me = currentUserId();
    if (!me) return;
    const d = db();
    const conv = d.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.unreadCount[me] = 0;
      saveDb(d);
    }
  },
};

export const demoNotifications = {
  async getAll(): Promise<Notification[]> {
    await sleep(80);
    const me = currentUserId();
    if (!me) return [];
    return db()
      .notifications.filter((n) => n.userId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async markAsRead(id: string): Promise<void> {
    await sleep(80);
    const d = db();
    const notif = d.notifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      saveDb(d);
    }
  },

  async markAllAsRead(): Promise<void> {
    await sleep(80);
    const me = currentUserId();
    if (!me) return;
    const d = db();
    d.notifications = d.notifications.map((n) =>
      n.userId === me ? { ...n, read: true } : n,
    );
    saveDb(d);
  },
};