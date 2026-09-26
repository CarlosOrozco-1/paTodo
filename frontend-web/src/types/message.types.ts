import type { ObjectId } from './common.types';

export type MessageType = 'text' | 'image' | 'system';

export interface Message {
  id: ObjectId;
  jobId?: ObjectId;
  senderId: ObjectId;
  receiverId?: ObjectId;
  content: string;
  type: MessageType;
  conversationId: ObjectId;
  deliveredAt?: string | null;
  readAt?: string | null;
  replyTo?: ObjectId | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LastMessage {
  content: string;
  senderId: ObjectId;
  type: MessageType;
  createdAt: string;
}

export interface Conversation {
  id: ObjectId;
  jobId?: ObjectId;
  participantIds: ObjectId[];
  lastMessage?: LastMessage;
  unreadCount: Record<string, number>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessageDto {
  jobId?: ObjectId;
  receiverId: ObjectId;
  content: string;
  type?: MessageType;
  replyTo?: ObjectId;
}

export interface Notification {
  id: ObjectId;
  userId: ObjectId;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}