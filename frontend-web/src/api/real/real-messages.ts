import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
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

export const realConversations = {
  async getAll(): Promise<Conversation[]> {
    const uid = requireUid();
    const snapshot = await getDocs(
      query(collection(db, 'conversations'), where('participants', 'array-contains', uid)),
    );
    const items = snapshot.docs
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
    const snapshot = await getDocs(
      query(collection(db, 'conversations'), where('jobId', '==', jobId)),
    );
    return snapshot.docs
      .map((item) => conversationFromDoc(item, uid))
      .filter((item): item is BackendConversation => item !== null)
      .map(mapConversation);
  },
};

async function resolveConversation(
  jobId: string | undefined,
  receiverId: string | undefined,
): Promise<{ exists: boolean; ref: ReturnType<typeof doc> } | null> {
  if (jobId) {
    const snapshot = await getDocs(
      query(collection(db, 'conversations'), where('jobId', '==', jobId)),
    );
    if (snapshot.size > 0) {
      return { exists: true, ref: snapshot.docs[0].ref };
    }
  }
  if (receiverId) {
    const uid = requireUid();
    const snapshot = await getDocs(
      query(collection(db, 'conversations'), where('participants', 'array-contains', receiverId)),
    );
    const match = snapshot.docs.find((item) => {
      const participants = (item.data().participants ?? []) as string[];
      return participants.includes(uid);
    });
    if (match) return { exists: true, ref: match.ref };
  }
  return null;
}

export const realMessages = {
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

  async markAsRead(conversationId: string): Promise<void> {
    const uid = requireUid();
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`lastReadAt.${uid}`]: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  },
};