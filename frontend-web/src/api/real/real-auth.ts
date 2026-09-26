import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { User } from '@/types/user.types';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../auth.service';
import { mapUser } from '../mappers';
import { auth } from '../firebase/init';
import { ensureBackendUser } from '../firebase/fs';
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

  async loginWithGoogle(idToken: string, role: 'client' | 'worker' = 'client'): Promise<AuthResponse> {
    let userCredential;
    try {
      userCredential = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(idToken),
      );
    } catch (error) {
      throw new Error(firebaseAuthMessage(error));
    }

    const uid = userCredential.user.uid;
    const email = userCredential.user.email ?? '';
    const displayName = userCredential.user.displayName ?? '';

    try {
      await apiPost('/createUser', {
        uid,
        email,
        role,
        profile: {
          firstName: displayName.split(' ')[0] ?? '',
          lastName: displayName.split(' ').slice(1).join(' ') ?? '',
          avatarUrl: userCredential.user.photoURL ?? null,
          bio: '',
        },
        contact: { phone: '' },
      });
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 409) {
        throw error instanceof Error ? error : new Error('No se pudo crear el perfil');
      }
    }

    // Refrescar el token para que llegue el Custom Claim del rol.
    const freshToken = await userCredential.user.getIdToken(true);
    setToken(freshToken);
    const backend = await ensureBackendUser(uid, email);
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