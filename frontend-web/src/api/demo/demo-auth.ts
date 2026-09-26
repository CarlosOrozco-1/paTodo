import type { User } from '@/types/user.types';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/api/auth.service';
import { currentUserId, sleep } from './index';
import { db, nowIso, saveDb, uid } from './demoDb';

export const demoAuth = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    await sleep();
    const user = db().users.find(
      (u) => u.account.email.toLowerCase() === data.email.trim().toLowerCase(),
    );
    if (!user) throw new Error('Credenciales inválidas');
    if (!data.password) throw new Error('Ingresa tu contraseña');
    user.account.lastLogin = nowIso();
    saveDb(db());
    return { token: `demo-token-${user.id}`, user };
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    await sleep(400);
    const email = data.email.trim().toLowerCase();
    if (db().users.some((u) => u.account.email.toLowerCase() === email)) {
      throw new Error('Ya existe una cuenta con este correo');
    }
    const user: User = {
      id: uid('demo-u'),
      role: data.role,
      account: { email, passwordHash: data.password, verified: data.role === 'client' },
      profile: { firstName: data.firstName, lastName: data.lastName },
      contact: { phone: data.phone, address: { city: 'Ciudad de Guatemala', country: 'GT' } },
      location: { type: 'Point', coordinates: [-90.5069, 14.6349] },
      stats: { rating: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0, responseTimeMin: 0 },
      availability: {
        isOnline: data.role === 'worker',
        serviceArea: { radiusKm: 10, center: { type: 'Point', coordinates: [-90.5069, 14.6349] } },
      },
      vehicleIds: [],
      skillIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const d = db();
    d.users.push(user);
    saveDb(d);
    return { token: `demo-token-${user.id}`, user };
  },

  async loginWithGoogle(
    _idToken: string,
    role: 'client' | 'worker' = 'client',
  ): Promise<AuthResponse> {
    await sleep(400);
    const email = 'google.demo@example.com';
    const existing = db().users.find(
      (u) => u.account.email.toLowerCase() === email,
    );
    if (existing) {
      existing.account.lastLogin = nowIso();
      saveDb(db());
      return { token: `demo-token-${existing.id}`, user: existing };
    }
    const user: User = {
      id: uid('demo-g'),
      role,
      account: { email, passwordHash: '', verified: role === 'client' },
      profile: { firstName: 'Google', lastName: 'Demo' },
      contact: { phone: '', address: { city: 'Ciudad de Guatemala', country: 'GT' } },
      location: { type: 'Point', coordinates: [-90.5069, 14.6349] },
      stats: { rating: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0, responseTimeMin: 0 },
      availability: {
        isOnline: role === 'worker',
        serviceArea: { radiusKm: 10, center: { type: 'Point', coordinates: [-90.5069, 14.6349] } },
      },
      vehicleIds: [],
      skillIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const d = db();
    d.users.push(user);
    saveDb(d);
    return { token: `demo-token-${user.id}`, user };
  },

  async getCurrentUser(): Promise<User> {
    await sleep();
    const id = currentUserId();
    const user = id
      ? db().users.find((u) => u.id === id)
      : undefined;
    if (!user)
      throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
    return user;
  },

  async logout(): Promise<void> {
    await sleep(50);
  },
};