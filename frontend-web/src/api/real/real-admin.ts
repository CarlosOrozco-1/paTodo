import { doc, getDoc } from 'firebase/firestore';
import type {
  ActivityLog,
  DashboardStats,
  UserAdminView,
} from '@/types/admin.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { Job } from '@/types/job.types';
import type { User } from '@/types/user.types';
import { apiGet, apiPost } from '../firebase/rest';
import { db } from '../firebase/init';
import { jobFromData, toIso, userFromData } from '../firebase/fs';
import type { BackendUser } from '../mappers';
import { jobWithWorkerId, mapUser, toPageArray } from '../mappers';
import { parseUserRole } from '@/utils/roles';

type Any = Record<string, unknown>;

interface ApiUserItem {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  verified: boolean;
  phone: string | null;
  rating: number;
  ratingCount: number;
  completedJobs: number;
  createdAt: string | null;
}

interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildQuery(params?: QueryParams): string {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.search) q.set('search', String(params.search));
  if (params?.role) q.set('role', String(params.role));
  if (params?.status) q.set('status', String(params.status));
  const serialized = q.toString();
  return serialized ? `?${serialized}` : '';
}

function userItemToView(item: ApiUserItem): UserAdminView {
  return {
    id: item.id,
    profile: {
      firstName: item.firstName,
      lastName: item.lastName,
      avatarUrl: item.avatarUrl ?? undefined,
    },
    account: {
      email: item.email ?? '',
      verified: item.verified,
      lastLogin: null,
    },
    role: parseUserRole(item.role),
    stats: {
      rating: item.rating,
      ratingCount: item.ratingCount,
      completedJobs: item.completedJobs,
    },
    status: item.status === 'suspended' ? 'suspended' : 'active',
    createdAt: item.createdAt ?? '',
  };
}

function normalizeJobApi(item: Any): Any {
  const loc = (item.location ?? {}) as Any;
  const gp = (loc.geopoint ?? {}) as Any;
  let geopoint = gp;
  if (typeof gp._latitude === 'number' && typeof gp._longitude === 'number') {
    geopoint = { latitude: gp._latitude, longitude: gp._longitude };
  }
  const result: Any = { ...item, id: item.id };
  if (item.location) result.location = { ...loc, geopoint };
  return result;
}

function userBackendToView(uid: string, backend: BackendUser, firedata: Any): UserAdminView {
  return {
    id: uid,
    profile: {
      firstName: backend.firstName,
      lastName: backend.lastName,
      avatarUrl: backend.avatarUrl,
    },
    account: {
      email: backend.email,
      verified: firedata.verified === true,
      lastLogin: null,
    },
    role: parseUserRole(backend.role),
    stats: {
      rating: backend.rating,
      ratingCount: backend.ratingCount,
      completedJobs: backend.completedJobs,
    },
    status: firedata.status === 'suspended' ? 'suspended' : 'active',
    createdAt: backend.createdAt ?? '',
  };
}

export const realAdmin = {
  async getDashboardStats(): Promise<DashboardStats> {
    return apiGet<DashboardStats>('/admin/stats');
  },

  async getUsers(params?: QueryParams): Promise<PaginatedResponse<UserAdminView>> {
    const res = await apiGet<ApiPage<ApiUserItem>>(`/admin/users${buildQuery(params)}`);
    return {
      items: res.items.map(userItemToView),
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    };
  },

  async getUserById(id: string): Promise<UserAdminView> {
    const snapshot = await getDoc(doc(db, 'users', id));
    if (!snapshot.exists()) throw new Error('Usuario no encontrado');
    const data = (snapshot.data() ?? {}) as Any;
    const backend = userFromData({ ...data, id: snapshot.id });
    if (!backend) throw new Error('Usuario no encontrado');
    return userBackendToView(snapshot.id, backend, data);
  },

  async suspendUser(id: string): Promise<void> {
    await apiPost('/admin/suspendUser', { uid: id });
  },

  async activateUser(id: string): Promise<void> {
    await apiPost('/admin/activateUser', { uid: id });
  },

  async makeAdmin(id: string): Promise<void> {
    await apiPost('/admin/makeAdmin', { uid: id });
  },

  async removeAdmin(id: string): Promise<void> {
    await apiPost('/admin/removeAdmin', { uid: id });
  },

  async getAllJobs(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    const res = await apiGet<ApiPage<Any>>(`/admin/jobs${buildQuery(params)}`);
    const state: Job[] = [];
    for (const item of res.items) {
      const backend = jobFromData(normalizeJobApi(item));
      if (backend) state.push(jobWithWorkerId(backend));
    }
    return {
      items: state,
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    };
  },

  async getPendingWorkers(): Promise<User[]> {
    const res = await apiGet<ApiPage<ApiUserItem>>('/admin/users?role=worker&limit=100');
    const pending = res.items.filter((u) => !u.verified);
    return pending.map((u) =>
      mapUser({
        id: u.id,
        email: u.email ?? '',
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: u.avatarUrl ?? undefined,
        phone: u.phone ?? '',
        rating: u.rating,
        ratingCount: u.ratingCount,
        completedJobs: u.completedJobs,
        verified: u.verified,
        createdAt: u.createdAt ?? undefined,
        updatedAt: u.createdAt ?? new Date().toISOString(),
      }),
    );
  },

  async verifyWorker(workerId: string, approve: boolean, _reason?: string): Promise<void> {
    await apiPost('/admin/verifyWorker', { workerId, approve });
  },

  async getActivityLog(params?: QueryParams): Promise<PaginatedResponse<ActivityLog>> {
    const limit = params?.limit ? Number(params.limit) : 20;
    const res = await apiGet<{ items: ActivityLog[] }>(`/admin/activityLog?limit=${limit}`);
    const items = res.items
      .map((log) => ({ ...log, createdAt: toIso(log.createdAt) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return toPageArray(items);
  },
};