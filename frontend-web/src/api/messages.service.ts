import type { Conversation, CreateMessageDto, Message, Notification } from '@/types/message.types';
import { isDemoMode } from './demo';
import {
  demoConversations,
  demoMessages,
  demoNotifications,
} from './demo/demo-messages';
import { realConversations, realMessages, realNotifications } from './real';
import type { Unsubscribe } from './real/real-messages';
import { getErrorMessage } from './axiosClient';

type SubscribeHandlers<T> = {
  onData: (items: T[]) => void;
  onError?: (error: Error) => void;
};

/**
 * En modo demo no hay stream real: se entrega el estado actual una vez y se
 * reevalúa al mutar la base local, para no romper la UI sin Firestore.
 */
function demoSubscribe<T>(read: () => Promise<T[]>, handlers: SubscribeHandlers<T>): Unsubscribe {
  let alive = true;
  const emit = async () => {
    try {
      const items = await read();
      if (alive) handlers.onData(items);
    } catch (error) {
      if (alive) handlers.onError?.(new Error(getErrorMessage(error)));
    }
  };
  void emit();
  const timer = window.setInterval(() => void emit(), 3000);
  return () => {
    alive = false;
    window.clearInterval(timer);
  };
}

export const conversationsService = {
  subscribe(handlers: SubscribeHandlers<Conversation>): Unsubscribe {
    if (isDemoMode()) return demoSubscribe(() => demoConversations.getAll(), handlers);
    return realConversations.subscribe(handlers.onData, handlers.onError);
  },

  async getAll(): Promise<Conversation[]> {
    if (isDemoMode()) return demoConversations.getAll();
    return realConversations.getAll();
  },

  async getById(id: string): Promise<Conversation> {
    if (isDemoMode()) return demoConversations.getById(id);
    return realConversations.getById(id);
  },

  async getByJob(jobId: string): Promise<Conversation[]> {
    if (isDemoMode()) return demoConversations.getByJob(jobId);
    return realConversations.getByJob(jobId);
  },
};

export const messagesService = {
  subscribeToConversation(
    conversationId: string,
    handlers: SubscribeHandlers<Message>,
  ): Unsubscribe {
    if (isDemoMode()) {
      return demoSubscribe(() => demoMessages.getByConversation(conversationId), handlers);
    }
    return realMessages.subscribeToConversation(
      conversationId,
      handlers.onData,
      handlers.onError,
    );
  },

  async getByConversation(conversationId: string): Promise<Message[]> {
    if (isDemoMode()) return demoMessages.getByConversation(conversationId);
    return realMessages.getByConversation(conversationId);
  },

  async send(data: CreateMessageDto): Promise<Message> {
    if (isDemoMode()) return demoMessages.send(data);
    return realMessages.send(data);
  },

  async markAsRead(conversationId: string): Promise<void> {
    if (isDemoMode()) return demoMessages.markAsRead(conversationId);
    return realMessages.markAsRead(conversationId);
  },
};

export const notificationsService = {
  subscribe(handlers: SubscribeHandlers<Notification>): Unsubscribe {
    if (isDemoMode()) return demoSubscribe(() => demoNotifications.getAll(), handlers);
    return realNotifications.subscribe(handlers.onData, handlers.onError);
  },

  async getAll(): Promise<Notification[]> {
    if (isDemoMode()) return demoNotifications.getAll();
    return realNotifications.getAll();
  },

  async markAsRead(id: string): Promise<void> {
    if (isDemoMode()) return demoNotifications.markAsRead(id);
    return realNotifications.markAsRead(id);
  },

  async markAllAsRead(): Promise<void> {
    if (isDemoMode()) return demoNotifications.markAllAsRead();
    return realNotifications.markAllAsRead();
  },
};