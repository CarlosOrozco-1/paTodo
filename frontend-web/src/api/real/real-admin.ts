import type {
  ActivityLog,
  DashboardStats,
  UserAdminView,
} from '@/types/admin.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { Job } from '@/types/job.types';
import type { User } from '@/types/user.types';
import { NotSupportedError } from '.';

const ADMIN_UNAVAILABLE =
  'El panel de administración no está disponible en este backend';

export const realAdmin = {
  async getDashboardStats(): Promise<DashboardStats> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async getUsers(_params?: QueryParams): Promise<PaginatedResponse<UserAdminView>> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async getUserById(_id: string): Promise<UserAdminView> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async suspendUser(_id: string): Promise<void> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async activateUser(_id: string): Promise<void> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async getAllJobs(_params?: QueryParams): Promise<PaginatedResponse<Job>> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async getPendingWorkers(): Promise<User[]> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async verifyWorker(_workerId: string, _approve: boolean, _reason?: string): Promise<void> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },

  async getActivityLog(): Promise<PaginatedResponse<ActivityLog>> {
    throw new NotSupportedError(ADMIN_UNAVAILABLE);
  },
};