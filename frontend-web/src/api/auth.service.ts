import type { RegisterRole, User } from '@/types/user.types';
import { isDemoMode } from './demo';
import { demoAuth } from './demo/demo-auth';
import { realAuth } from './real';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: RegisterRole;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Datos que aporta Google al completar el alta, ya partidos en los campos que
 * pide el perfil. Vienen todos rellenos salvo el teléfono, que Google solo
 * entrega si el usuario lo tiene filled en su cuenta.
 */
export interface GoogleProfileDraft {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  phone: string;
}

/**
 * Resultado de `loginWithGoogle`. `needsProfile` distingue "entró una cuenta
 * nueva" de "ya tenía documento": solo el primer caso redirige a la pantalla
 * de completado.
 */
export interface GoogleLoginResult {
  needsProfile: boolean;
  token: string;
  user: User;
  draft: GoogleProfileDraft;
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    if (isDemoMode()) return demoAuth.login(data);
    return realAuth.login(data);
  },

  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    if (isDemoMode()) return demoAuth.loginWithGoogle(idToken);
    return realAuth.loginWithGoogle(idToken);
  },

  /**
   * Crea el documento del usuario con los datos que confirmó en la pantalla de
   * completado. Se invoca una sola vez, tras el login con Google.
   */
  async completeGoogleProfile(
    draft: GoogleProfileDraft & { role: RegisterRole; phone: string },
  ): Promise<AuthResponse> {
    if (isDemoMode()) return demoAuth.completeGoogleProfile(draft);
    return realAuth.completeGoogleProfile(draft);
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    if (isDemoMode()) return demoAuth.register(data);
    return realAuth.register(data);
  },

  async getCurrentUser(): Promise<User> {
    if (isDemoMode()) return demoAuth.getCurrentUser();
    return realAuth.getCurrentUser();
  },

  async logout(): Promise<void> {
    if (isDemoMode()) return demoAuth.logout();
    return realAuth.logout();
  },
};