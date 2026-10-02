import type { CreateUserDto, UpdateUserDto, User } from '@/types/user.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import { isDemoMode } from './demo';
import { demoUsers } from './demo/demo-users';
import { realUsers } from './real';

export const usersService = {
  async getById(id: string): Promise<User> {
    if (isDemoMode()) return demoUsers.getById(id);
    return realUsers.getById(id);
  },

  /**
   * Perfil en tiempo real. Se usa donde el dato cambia sin intervención de
   * quien mira, como el estado de disponibilidad de un profesional.
   */
  subscribe(id: string, onData: (user: User) => void, onError?: (error: Error) => void): () => void {
    if (isDemoMode()) return demoUsers.subscribe(id, onData, onError);
    return realUsers.subscribe(id, onData, onError);
  },

  async getMe(): Promise<User> {
    if (isDemoMode()) return demoUsers.getMe();
    return realUsers.getMe();
  },

  async updateMe(data: UpdateUserDto): Promise<User> {
    if (isDemoMode()) return demoUsers.updateMe(data);
    return realUsers.updateMe(data);
  },

  async update(id: string, data: Partial<CreateUserDto> & UpdateUserDto): Promise<User> {
    if (isDemoMode()) return demoUsers.update(id, data);
    return realUsers.update();
  },

  async getAll(params?: QueryParams): Promise<PaginatedResponse<User>> {
    if (isDemoMode()) return demoUsers.getAll(params);
    return realUsers.getAll();
  },

  async getByRole(role: string, params?: QueryParams): Promise<PaginatedResponse<User>> {
    if (isDemoMode()) return demoUsers.getByRole(role, params);
    return realUsers.getByRole(role);
  },
};