import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getAuth } from 'firebase/auth';

const TOKEN_KEY = 'paTodo_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://patodo.onrender.com',
  // Render (plan gratuito) tarda 20-50s en despertar y se apaga tras ~15 min
  // sin tráfico. 60s quedaba corto para una ruta transaccional con arranque
  // en frío, así que el margen sube a 120s. Las rutas que dependen de la API
  // llaman antes a `ensureApiWarm` para no gastar este presupuesto.
  timeout: 120000,
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
    // El mensaje de axios para un timeout no dice nada útil ("timeout of
    // 120000ms exceeded"), y con Render eso casi siempre significa arranque
    // en frío, no un fallo real.
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'El servidor tardó demasiado en responder. Espera un momento e inténtalo de nuevo.';
    }
    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    return data?.error || data?.message || error.message || 'Error de red';
  }
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}