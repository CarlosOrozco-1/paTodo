import { create } from 'zustand';
import { notificationsService } from '@/api/messages.service';
import type { Notification } from '@/types/message.types';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  lastFetchedAt: number;
  load: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
}

const DEDUPE_MS = 3000;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: false,
  lastFetchedAt: 0,

  load: async () => {
    if (Date.now() - get().lastFetchedAt < DEDUPE_MS) return;
    set({ loading: true });
    try {
      const items = await notificationsService.getAll();
      set({ notifications: items, loading: false, lastFetchedAt: Date.now() });
    } catch {
      set({ notifications: [], loading: false, lastFetchedAt: Date.now() });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationsService.markAsRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      }));
    } catch {
      // La notificación seguirá visible si falla el marcado remoto.
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsService.markAllAsRead();
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
      }));
    } catch {
      // Mantener el estado actual si el backend no responde.
    }
  },

  reset: () => set({ notifications: [], loading: false, lastFetchedAt: 0 }),
}));