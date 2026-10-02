import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  onSnapshot,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import type { Conversation, CreateMessageDto, Message } from '@/types/message.types';
import type { BackendConversation, BackendMessage } from '../mappers';
import { mapConversation, mapMessage } from '../mappers';
import { db } from '../firebase/init';
import { conversationFromDoc, messageFromDoc, requireUid } from '../firebase/fs';

async function myConversationDocs(uid: string) {
  const snapshot = await getDocs(
    query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
  );
  return snapshot.docs;
}

export type Unsubscribe = () => void;

export const realConversations = {
  subscribe(
    onData: (conversations: Conversation[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const uid = requireUid();
    return onSnapshot(
      query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
      (snapshot) => {
        const items = snapshot.docs
          .map((item) => conversationFromDoc(item, uid))
          .filter((item): item is BackendConversation => item !== null)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        onData(items.map(mapConversation));
      },
      (error) => onError?.(error),
    );
  },

  async getAll(): Promise<Conversation[]> {
    const uid = requireUid();
    const docs = await myConversationDocs(uid);
    const items = docs
      .map((item) => conversationFromDoc(item, uid))
      .filter((item): item is BackendConversation => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return items.map(mapConversation);
  },

  async getById(id: string): Promise<Conversation> {
    const uid = requireUid();
    const snapshot = await getDoc(doc(db, 'conversations', id));
    if (!snapshot.exists()) throw new Error('Conversación no encontrada');
    return mapConversation(conversationFromDoc(snapshot, uid)!);
  },

  async getByJob(jobId: string): Promise<Conversation[]> {
    const uid = requireUid();
    const docs = await myConversationDocs(uid);
    return docs
      .filter((item) => item.data().jobId === jobId)
      .map((item) => conversationFromDoc(item, uid))
      .filter((item): item is BackendConversation => item !== null)
      .map(mapConversation);
  },
};

async function resolveConversation(
  jobId: string | undefined,
  receiverId: string | undefined,
): Promise<{ exists: boolean; ref: ReturnType<typeof doc> } | null> {
  const uid = requireUid();
  const docs = await myConversationDocs(uid);

  if (jobId) {
    const byJob = docs.find((item) => item.data().jobId === jobId);
    if (byJob) return { exists: true, ref: byJob.ref };
  }
  if (receiverId) {
    const byPeer = docs.find((item) => {
      const participants = (item.data().participants ?? []) as string[];
      return participants.includes(receiverId);
    });
    if (byPeer) return { exists: true, ref: byPeer.ref };
  }
  return null;
}

export const realMessages = {
  subscribeToConversation(
    conversationId: string,
    onData: (messages: Message[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    return onSnapshot(
      query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc'),
      ),
      (snapshot) => {
        const items = snapshot.docs
          .map((item) => messageFromDoc(item, conversationId))
          .filter((item): item is BackendMessage => item !== null);
        onData(items.map(mapMessage));
      },
      (error) => onError?.(error),
    );
  },

  async getByConversation(conversationId: string): Promise<Message[]> {
    requireUid();
    const snapshot = await getDocs(
      query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc'),
      ),
    );
    const items = snapshot.docs
      .map((item) => messageFromDoc(item, conversationId))
      .filter((item): item is BackendMessage => item !== null);
    return items.map(mapMessage);
  },

  async send(data: CreateMessageDto): Promise<Message> {
    const uid = requireUid();
    const resolved = await resolveConversation(data.jobId, data.receiverId);
    if (!resolved) {
      throw new Error('No hay conversación activa para este trabajo');
    }
    const messageRef = await addDoc(collection(db, 'conversations', resolved.ref.id, 'messages'), {
      senderId: uid,
      content: data.content,
      type: data.type ?? 'text',
      replyTo: data.replyTo ?? null,
      readAt: null,
      createdAt: serverTimestamp(),
    });
    await updateDoc(resolved.ref, {
      lastMessage: {
        content: data.content,
        senderId: uid,
        createdAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    });
    const created = await getDoc(messageRef);
    return mapMessage(messageFromDoc(created, resolved.ref.id)!);
  },

  /**
   * Marca la conversación como leída. Solo escribe `lastReadAt` a propósito:
   * tocar `updatedAt` reordería la lista de conversaciones cada vez que el
   * usuario abre un chat, lo que además provocaba un ciclo de escrituras
   * (ver `Messages.tsx`). Las reglas permiten ambos campos; aquí solo hace
   * falta el primero.
   */
  async markAsRead(conversationId: string): Promise<void> {
    const uid = requireUid();
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`lastReadAt.${uid}`]: new Date().toISOString(),
    });
  },
};