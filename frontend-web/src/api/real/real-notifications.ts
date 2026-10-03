import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import type { Notification } from '@/types/message.types';
import type { BackendNotification } from '../mappers';
import { mapNotification } from '../mappers';
import { db } from '../firebase/init';
import { notificationFromDoc, requireUid } from '../firebase/fs';
import type { Unsubscribe } from './real-messages';

function toSorted(snapshot: { docs: Parameters<typeof notificationFromDoc>[0][] }): Notification[] {
  return snapshot.docs
    .map((item) => notificationFromDoc(item))
    .filter((item): item is BackendNotification => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapNotification);
}

export const realNotifications = {
  subscribe(
    onData: (notifications: Notification[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const uid = requireUid();
    return onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snapshot) => onData(toSorted(snapshot)),
      (error) => onError?.(error),
    );
  },

  async getAll(): Promise<Notification[]> {
    const uid = requireUid();
    const snapshot = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
    );
    return toSorted(snapshot);
  },

  async markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, 'notifications', id), {
      readAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });
  },

  async markAllAsRead(): Promise<void> {
    const uid = requireUid();
    const snapshot = await getDocs(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
    );
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    snapshot.docs.forEach((item) => {
      batch.update(item.ref, {
        readAt: nowIso,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },
};