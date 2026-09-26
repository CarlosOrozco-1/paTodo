import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

const TOKEN_KEY = 'paTodo_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://patodo.onrender.com',
  // DEV: Render (plan gratuito) tarda 20-50s en despertar en la primera
  // petición; por eso el timeout es de 60s y no el default de axios.
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function currentToken(forceRefresh = false): Promise<string | null> {
  const authUser = getAuth().currentUser;
  if (authUser) {
    try {
      const token = await authUser.getIdToken(forceRefresh);
      localStorage.setItem(TOKEN_KEY, token);
      return token;
    } catch {
      // Token inválido o revocado; se intenta con el guardado.
    }
  }
  return localStorage.getItem(TOKEN_KEY);
}

apiClient.interceptors.request.use(
  async (config) => {
    const token = await currentToken(false);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let refreshing: Promise<string | null> | null = null;

function tryRefresh(): Promise<string | null> {
  if (!refreshing) {
    refreshing = Promise.resolve()
      .then(() => currentToken(true))
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if ((error.response?.status === 401 || error.response?.status === 403) && original && !original._retried) {
      original._retried = true;
      const newToken = await tryRefresh();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(original);
      }
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        if (import.meta.env.VITE_HASH_ROUTER === 'true') {
          window.location.hash = '#/login';
        } else {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || error.message || 'Error de red';
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}