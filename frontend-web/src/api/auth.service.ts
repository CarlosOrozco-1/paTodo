import type { User } from '@/types/user.types';
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
  role: 'client' | 'worker';
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    if (isDemoMode()) return demoAuth.login(data);
    return realAuth.login(data);
  },

  async loginWithGoogle(idToken: string, role: 'client' | 'worker' = 'client'): Promise<AuthResponse> {
    if (isDemoMode()) return demoAuth.loginWithGoogle(idToken, role);
    return realAuth.loginWithGoogle(idToken, role);
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