import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { RegisterRole, User } from '@/types/user.types';
import type {
  AuthResponse,
  GoogleLoginResult,
  GoogleProfileDraft,
  LoginRequest,
  RegisterRequest,
} from '../auth.service';
import { mapUser } from '../mappers';
import { auth } from '../firebase/init';
import { ensureBackendUser, fallbackBackendUser, readUser } from '../firebase/fs';
import { apiPost } from '../firebase/rest';
import { setToken } from '../axiosClient';

function firebaseAuthMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo';
    case 'auth/invalid-email':
      return 'El correo no es válido';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Correo o contraseña incorrectos';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intenta más tarde';
    case 'auth/network-request-failed':
      return 'Error de red. Verifica tu conexión';
    default:
      return error instanceof Error ? error.message : 'Error de autenticación';
  }
}

export const realAuth = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(auth, data.email.trim(), data.password);
    } catch (error) {
      throw new Error(firebaseAuthMessage(error));
    }
    const uid = credential.user.uid;
    const token = await credential.user.getIdToken();
    setToken(token);
    const backend = await ensureBackendUser(uid, credential.user.email ?? data.email.trim());
    return { token, user: mapUser(backend) };
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, data.email.trim(), data.password);
    } catch (error) {
      throw new Error(firebaseAuthMessage(error));
    }
    const uid = credential.user.uid;
    const email = credential.user.email ?? data.email.trim();
    const token = await credential.user.getIdToken();
    setToken(token);
    try {
      await apiPost('/createUser', {
        uid,
        email,
        role: data.role,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          avatarUrl: null,
          bio: '',
        },
        contact: { phone: data.phone },
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 409) {
        throw error instanceof Error ? error : new Error('No se pudo crear el perfil');
      }
    }
    // El rol se asigna como Custom Claim; refrescar para que llegue al token.
    const freshToken = await credential.user.getIdToken(true);
    setToken(freshToken);
    const backend = await ensureBackendUser(uid, email);
    return { token: freshToken, user: mapUser(backend) };
  },

  /**
   * Inicia sesión con Google y devuelve los datos que la cuenta de Google
   * entrega, para que la pantalla de completado rellene el formulario.
   *
   * No crea el documento del usuario: se hace en `completeGoogleProfile`, una
   * vez el usuario confirma. Así `POST /createUser` recibe siempre un teléfono
   * real (Google no entrega `phoneNumber`), en lugar de fallar con 400.
   */
  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    let userCredential;
    try {
      userCredential = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(idToken),
      );
    } catch (error) {
      throw new Error(firebaseAuthMessage(error));
    }

    const firebaseUser = userCredential.user;
    const uid = firebaseUser.uid;
    const email = firebaseUser.email ?? '';
    const displayName = firebaseUser.displayName ?? '';
    const parts = displayName.trim().split(/\s+/).filter(Boolean);

    // El token viaja a la app para que la pantalla de completado pueda llamar a
    // la API, pero el refresh se hace solo después de confirmar el perfil.
    const token = await firebaseUser.getIdToken();
    setToken(token);

    // Si el documento ya existe no hay nada que completar: se entra directo.
    const existing = await readUser(uid);

    return {
      needsProfile: !existing,
      token,
      user: mapUser(existing ?? fallbackBackendUser(uid, email)),
      draft: {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' '),
        email,
        avatarUrl: firebaseUser.photoURL ?? undefined,
        phone: firebaseUser.phoneNumber ?? '',
      },
    };
  },

  /**
   * Crea el documento del usuario con los datos confirmados en la pantalla de
   * completado. Se llama una sola vez, después del login con Google.
   */
  async completeGoogleProfile(
    draft: GoogleProfileDraft & { role: RegisterRole; phone: string },
  ): Promise<AuthResponse> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');

    const email = draft.email.trim();
    if (email.toLowerCase() !== (firebaseUser.email ?? '').toLowerCase()) {
      throw new Error('El correo no coincide con el de tu cuenta de Google.');
    }

    try {
      await apiPost('/createUser', {
        uid: firebaseUser.uid,
        email,
        role: draft.role,
        profile: {
          firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(),
          avatarUrl: draft.avatarUrl ?? null,
          bio: '',
        },
        contact: { phone: draft.phone.trim() },
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // 409 = el documento ya existe (el usuario ya completó el perfil en una
      // sesión anterior). No es un error: se sigue adelante.
      if (status !== 409) {
        throw error instanceof Error ? error : new Error('No se pudo crear el perfil');
      }
    }

    // El rol viaja como Custom Claim, así que el token debe refrescarse.
    const freshToken = await firebaseUser.getIdToken(true);
    setToken(freshToken);
    const backend = await ensureBackendUser(firebaseUser.uid, email);
    return { token: freshToken, user: mapUser(backend) };
  },

  async getCurrentUser(): Promise<User> {
    const authUser = auth.currentUser;
    if (!authUser) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
    const backend = await ensureBackendUser(authUser.uid, authUser.email ?? '');
    return mapUser(backend);
  },

  async logout(): Promise<void> {
    await signOut(auth);
    localStorage.removeItem('paTodo_refresh_token');
  },
};

export function getRefreshToken(): string | null {
  return null;
}