import type { RegisterRole, User } from '@/types/user.types';
import type {
  AuthResponse,
  GoogleLoginResult,
  GoogleProfileDraft,
  LoginRequest,
  RegisterRequest,
} from '@/api/auth.service';
import { isWorker } from '@/utils/roles';
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
      // `both` arranca sin verificar: necesita pasar la revisión de
      // profesional igual que un `worker`, aunque también pueda contratar.
      account: { email, passwordHash: data.password, verified: !isWorker(data.role) },
      profile: { firstName: data.firstName, lastName: data.lastName },
      contact: { phone: data.phone, address: { city: 'Ciudad de Guatemala', country: 'GT' } },
      location: { type: 'Point', coordinates: [-90.5069, 14.6349] },
      stats: { rating: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0, responseTimeMin: 0 },
      availability: {
        isOnline: isWorker(data.role),
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

  /**
   * En demo no hay Google real, así que se simula una cuenta nueva siempre:
   * devuelve `needsProfile: true` para ejercitar la pantalla de completado.
   */
  async loginWithGoogle(_idToken: string): Promise<GoogleLoginResult> {
    await sleep(400);
    return {
      needsProfile: true,
      token: `demo-google-token-${uid('demo-g')}`,
      user: {} as User,
      draft: {
        firstName: 'Ana',
        lastName: 'Google',
        email: 'ana.google@example.com',
        phone: '',
      },
    };
  },

  /** Crea el usuario en la base local de demo, ya con los datos confirmados. */
  async completeGoogleProfile(
    draft: GoogleProfileDraft & { role: RegisterRole; phone: string },
  ): Promise<AuthResponse> {
    await sleep(400);
    const email = draft.email.trim().toLowerCase();
    const existing = db().users.find((u) => u.account.email.toLowerCase() === email);
    if (existing) {
      existing.profile.firstName = draft.firstName.trim();
      existing.profile.lastName = draft.lastName.trim();
      existing.role = draft.role;
      existing.contact.phone = draft.phone.trim();
      saveDb(db());
      return { token: `demo-token-${existing.id}`, user: existing };
    }

    const user: User = {
      id: uid('demo-g'),
      role: draft.role,
      // `both` arranca sin verificar: necesita pasar la revisión de
      // profesional igual que un `worker`, aunque también pueda contratar.
      account: { email, passwordHash: '', verified: !isWorker(draft.role) },
      profile: { firstName: draft.firstName.trim(), lastName: draft.lastName.trim() },
      contact: { phone: draft.phone.trim(), address: { city: 'Ciudad de Guatemala', country: 'GT' } },
      location: { type: 'Point', coordinates: [-90.5069, 14.6349] },
      stats: { rating: 0, ratingCount: 0, completedJobs: 0, cancelledJobs: 0, responseTimeMin: 0 },
      availability: {
        isOnline: isWorker(draft.role),
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