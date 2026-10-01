import { create } from 'zustand';
import { notificationsService } from '@/api/messages.service';
import type { Notification } from '@/types/message.types';

interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  lastFetchedAt: number;
  load: () => Promise<void>;
  subscribe: () => () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
}

const DEDUPE_MS = 3000;

let unsubscribe: (() => void) | null = null;

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

  /**
   * Suscripción en tiempo real. Reemplaza al sondeo periódico: Firestore
   * entrega los cambios y el listener se cierra al desmontar o al cambiar
   * de usuario.
   *
   * Se envuelve en try/catch a propósito: si falta la sesión, `requireUid`
   * lanza de forma síncrona y, al ejecutarse dentro de un efecto, el error
   * desmontaría la aplicación entera. Perder la campana no puede costar más
   * que un badge que se actualice al recargar.
   */
  subscribe: () => {
    unsubscribe?.();
    unsubscribe = null;
    try {
      unsubscribe = notificationsService.subscribe({
        onData: (items) => set({ notifications: items, loading: false }),
        onError: () => set({ loading: false }),
      });
    } catch {
      set({ loading: false });
    }
    return () => {
      unsubscribe?.();
      unsubscribe = null;
    };
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

  reset: () => {
    unsubscribe?.();
    unsubscribe = null;
    set({ notifications: [], loading: false, lastFetchedAt: 0 });
  },
}));