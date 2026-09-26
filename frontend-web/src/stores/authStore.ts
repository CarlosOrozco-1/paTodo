import { create } from 'zustand';
import type { User } from '@/types/user.types';
import { setToken, getToken } from '@/api/axiosClient';
import { authService } from '@/api/auth.service';
import { usersService } from '@/api/users.service';

const USER_KEY = 'paTodo_user';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string, role?: 'client' | 'worker') => Promise<void>;
  register: (
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string;
      role: 'client' | 'worker';
    },
  ) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
  refreshProfile: () => Promise<void>;
}

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: readStoredUser(),
  token: getToken(),
  isLoading: false,
  isAuthenticated: Boolean(getToken()) && Boolean(readStoredUser()),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await authService.login({ email, password });
      setToken(response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async (idToken, role) => {
    set({ isLoading: true });
    try {
      const response = await authService.loginWithGoogle(idToken, role);
      setToken(response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(data);
      setToken(response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } catch {
      // Ignorar errores de red en logout
    } finally {
      setToken(null);
      localStorage.removeItem(USER_KEY);
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const user = await usersService.getMe();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  refreshProfile: async () => {
    const current = get().user;
    if (!current) return;
    try {
      const updated = await usersService.getMe();
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      set({ user: updated });
    } catch {
      // Si falla, mantener el estado actual
    }
  },
}));