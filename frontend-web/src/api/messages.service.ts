import type { Conversation, CreateMessageDto, Message, Notification } from '@/types/message.types';
import { isDemoMode } from './demo';
import {
  demoConversations,
  demoMessages,
  demoNotifications,
} from './demo/demo-messages';
import { realConversations, realMessages, realNotifications } from './real';

export const conversationsService = {
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