import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import type { RegisterRole, User } from '@/types/user.types';
import { setToken, getToken } from '@/api/axiosClient';
import { auth } from '@/api/firebase/init';
import type { AuthResponse, GoogleLoginResult, GoogleProfileDraft } from '@/api/auth.service';
import { authService } from '@/api/auth.service';
import { usersService } from '@/api/users.service';
import { getApiMode } from '@/api/mode';

const USER_KEY = 'paTodo_user';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Firebase ya resolvió si hay sesión o no.
   *
   * El perfil se rehidrata de localStorage de forma síncrona, pero
   * `auth.currentUser` se restaura desde IndexedDB de forma asíncrona. Montar
   * el dashboard antes de eso hacía que `requireUid()` fallara y tirara toda
   * la aplicación al recargar la página.
   */
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<GoogleLoginResult>;

  /**
   * Crea el documento del usuario con los datos confirmados en la pantalla de
   * completado tras un alta con Google.
   */
  completeGoogleProfile: (
    draft: GoogleProfileDraft & { role: RegisterRole; phone: string },
  ) => Promise<AuthResponse>;
  register: (
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone: string;
      role: RegisterRole;
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
  authReady: false,

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

  loginWithGoogle: async (idToken) => {
    set({ isLoading: true });
    try {
      const response = await authService.loginWithGoogle(idToken);
      setToken(response.token);
      if (response.needsProfile) {
        // Cuenta nueva: se marca la sesión, pero NO se publica un usuario en el
        // store. Así los guards.redirigen a /completar-perfil en vez de dejar
        // entrar un perfil vacío. El documento se crea al confirmar el formulario.
        set({ isLoading: false });
        return response;
      }
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return response;
    } finally {
      set({ isLoading: false });
    }
  },

  completeGoogleProfile: async (draft) => {
    set({ isLoading: true });
    try {
      const response = await authService.completeGoogleProfile(draft);
      setToken(response.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
      return response;
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

/**
 * Firebase Auth es la fuente de verdad de la sesión en modo real: el token que
 * usa la API es su ID token. El primer callback de `onAuthStateChanged` llega
 * después de que Firebase haya intentado restaurar la sesión, así que en ese
 * punto ya se puede decidir si el estado local es válido.
 *
 * - Con usuario: la sesión se restauró, se marca `authReady` y se refresca el
 *   token guardado, que puede haber caducado desde la última visita.
 * - Sin usuario: en modo real la sesión no existe, así que se limpia el estado
 *   local para no dejar una pantalla autenticada que fallará en la primera
 *   llamada a Firestore. En modo demo el usuario nunca pasó por Firebase, así
 *   que no se toca nada; y en modo `auto` la decisión real todavía no está
 *   tomada al arrancar, por lo que se deja que el flujo normal resuelva.
 */
onAuthStateChanged(auth, (firebaseUser) => {
  if (firebaseUser) {
    void firebaseUser
      .getIdToken()
      .then((token) => {
        setToken(token);
        useAuthStore.setState({ authReady: true });
      })
      .catch(() => {
        // Si el token no se puede emitir, la sesión sigue siendo válida para
        // Firestore; solo se marca como lista.
        useAuthStore.setState({ authReady: true });
      });
    return;
  }

  const state = useAuthStore.getState();
  if (getApiMode() === 'real' && (state.isAuthenticated || state.user)) {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  }
  useAuthStore.setState({ authReady: true });
});