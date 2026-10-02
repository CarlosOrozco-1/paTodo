import type { CreateUserDto, UpdateUserDto, User } from '@/types/user.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import { currentUserId, sleep } from './index';
import { db, nowIso, saveDb } from './demoDb';

function paginate<T>(items: T[], params?: QueryParams): PaginatedResponse<T> {
  const page = params?.page ? Number(params.page) : 1;
  const limit = params?.limit ? Number(params.limit) : 20;
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

function searchMatch(user: User, term: string): boolean {
  const q = term.toLowerCase();
  const name = `${user.profile.firstName} ${user.profile.lastName}`.toLowerCase();
  return name.includes(q) || user.account.email.toLowerCase().includes(q);
}

export const demoUsers = {
  async getById(id: string): Promise<User> {
    await sleep(80);
    const user = db().users.find((u) => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    return user;
  },

  /**
   * El demo no tiene servidor ni tiempo real real, así que entrega el estado
   * actual y se mantiene suscrito a los cambios de la base local para que el
   * comportamiento de la UI sea equivalente.
   */
  subscribe(id: string, onData: (user: User) => void, onError?: (error: Error) => void): () => void {
    const emit = () => {
      const user = db().users.find((u) => u.id === id);
      if (!user) {
        onError?.(new Error('Usuario no encontrado'));
        return;
      }
      onData(user);
    };
    emit();
    const handler = setInterval(emit, 2000);
    return () => clearInterval(handler);
  },

  async getMe(): Promise<User> {
    await sleep(80);
    const id = currentUserId();
    const user = id ? db().users.find((u) => u.id === id) : undefined;
    if (!user) throw new Error('Usuario no encontrado');
    return user;
  },

  async updateMe(data: UpdateUserDto): Promise<User> {
    await sleep(150);
    const id = currentUserId();
    const d = db();
    const idx = d.users.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error('Usuario no encontrado');
    const updated: User = {
      ...d.users[idx],
      ...data,
      profile: { ...d.users[idx].profile, ...data.profile },
      contact: { ...d.users[idx].contact, ...data.contact },
      availability: { ...d.users[idx].availability, ...data.availability },
      updatedAt: nowIso(),
    };
    d.users[idx] = updated;
    saveDb(d);
    return updated;
  },

  async update(id: string, data: Partial<CreateUserDto> & UpdateUserDto): Promise<User> {
    await sleep(150);
    const d = db();
    const idx = d.users.findIndex((u) => u.id === id);
    if (idx < 0) throw new Error('Usuario no encontrado');
    const current = d.users[idx];
    const { account: nextAccount, ...rest } = data ?? {};
    const updated: User = {
      ...current,
      ...rest,
      account: {
        ...current.account,
        ...(nextAccount ? { email: nextAccount.email } : {}),
        ...(nextAccount && 'password' in nextAccount && nextAccount.password
          ? { passwordHash: nextAccount.password }
          : {}),
      },
      profile: { ...current.profile, ...rest.profile },
      contact: { ...current.contact, ...rest.contact },
      availability: { ...current.availability, ...rest.availability },
      updatedAt: nowIso(),
    };
    d.users[idx] = updated;
    saveDb(d);
    return updated;
  },

  async getAll(params?: QueryParams): Promise<PaginatedResponse<User>> {
    await sleep();
    let items = db().users;
    if (params?.search) items = items.filter((u) => searchMatch(u, String(params.search)));
    if (params?.role) items = items.filter((u) => u.role === params.role);
    return paginate(items, params);
  },

  async getByRole(role: string, params?: QueryParams): Promise<PaginatedResponse<User>> {
    await sleep();
    return paginate(
      db().users.filter((u) => u.role === role),
      params,
    );
  },
};