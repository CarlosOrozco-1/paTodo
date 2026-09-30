import type {
  ActivityLog,
  DashboardStats,
  UserAdminView,
} from '@/types/admin.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { Job } from '@/types/job.types';
import type { User } from '@/types/user.types';
import { isDemoMode } from './demo';
import { demoAdmin } from './demo/demo-admin';
import { realAdmin } from './real';

export const adminService = {
  async getDashboardStats(): Promise<DashboardStats> {
    if (isDemoMode()) return demoAdmin.getDashboardStats();
    return realAdmin.getDashboardStats();
  },

  async getUsers(params?: QueryParams): Promise<PaginatedResponse<UserAdminView>> {
    if (isDemoMode()) return demoAdmin.getUsers(params);
    return realAdmin.getUsers(params);
  },

  async getUserById(id: string): Promise<UserAdminView> {
    if (isDemoMode()) return demoAdmin.getUserById(id);
    return realAdmin.getUserById(id);
  },

  async suspendUser(id: string, _reason?: string): Promise<void> {
    if (isDemoMode()) return demoAdmin.suspendUser(id);
    return realAdmin.suspendUser(id);
  },

  async activateUser(id: string): Promise<void> {
    if (isDemoMode()) return demoAdmin.activateUser(id);
    return realAdmin.activateUser(id);
  },

  async makeAdmin(id: string): Promise<void> {
    if (isDemoMode()) return demoAdmin.makeAdmin(id);
    return realAdmin.makeAdmin(id);
  },

  async removeAdmin(id: string): Promise<void> {
    if (isDemoMode()) return demoAdmin.removeAdmin(id);
    return realAdmin.removeAdmin(id);
  },

  async getAllJobs(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (isDemoMode()) return demoAdmin.getAllJobs(params);
    return realAdmin.getAllJobs(params);
  },

  async getPendingWorkers(): Promise<User[]> {
    if (isDemoMode()) return demoAdmin.getPendingWorkers();
    return realAdmin.getPendingWorkers();
  },

  async verifyWorker(workerId: string, approve: boolean, reason?: string): Promise<void> {
    if (isDemoMode()) return demoAdmin.verifyWorker(workerId, approve, reason);
    return realAdmin.verifyWorker(workerId, approve, reason);
  },

  async getActivityLog(params?: QueryParams): Promise<PaginatedResponse<ActivityLog>> {
    if (isDemoMode()) return demoAdmin.getActivityLog(params);
    return realAdmin.getActivityLog(params);
  },
};