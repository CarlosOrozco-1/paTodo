import type {
  ActivityLog,
  DashboardStats,
  UserAdminView,
} from '@/types/admin.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { Job } from '@/types/job.types';
import type { User } from '@/types/user.types';
import { sleep } from './index';
import { db, nowIso, saveDb } from './demoDb';

function paginate<T>(items: T[], params?: QueryParams): PaginatedResponse<T> {
  const page = params?.page ? Number(params.page) : 1;
  const limit = params?.limit ? Number(params.limit) : 20;
  const start = (page - 1) * limit;
  const sorted = [...items].sort((a, b) =>
    (b as { createdAt?: string }).createdAt?.localeCompare(
      (a as { createdAt?: string }).createdAt ?? '',
    ) ?? 0,
  );
  return {
    items: sorted.slice(start, start + limit),
    total: sorted.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(sorted.length / limit)),
  };
}

function toAdminView(user: User): UserAdminView {
  const d = db();
  const suspended = d.flags.suspendedIds.includes(user.id);
  return {
    id: user.id,
    profile: {
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
      avatarUrl: user.profile.avatarUrl,
    },
    account: {
      email: user.account.email,
      verified: user.account.verified,
      lastLogin: user.account.lastLogin ?? null,
    },
    role: user.role,
    stats: {
      rating: user.stats.rating,
      ratingCount: user.stats.ratingCount,
      completedJobs: user.stats.completedJobs,
    },
    status: suspended
      ? 'suspended'
      : user.role === 'worker' && !user.account.verified
        ? 'pending_verification'
        : 'active',
    createdAt: user.createdAt ?? '',
  };
}

export const demoAdmin = {
  async getDashboardStats(): Promise<DashboardStats> {
    await sleep(150);
    const d = db();
    const clients = d.users.filter((u) => u.role === 'client');
    const workers = d.users.filter((u) => u.role === 'worker');
    const offers = d.offers;
    const withRating = d.users.filter((u) => u.stats.ratingCount > 0);
    const averageRating = withRating.length
      ? withRating.reduce((sum, u) => sum + u.stats.rating, 0) / withRating.length
      : 0;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return {
      totalUsers: d.users.length,
      totalClients: clients.length,
      totalWorkers: workers.length,
      totalJobs: d.jobs.length,
      activeJobs: d.jobs.filter((j) =>
        ['pending', 'published', 'assigned', 'in_progress'].includes(j.status),
      ).length,
      pendingJobs: d.jobs.filter((j) => j.status === 'pending' || j.status === 'published')
        .length,
      completedJobs: d.jobs.filter((j) => j.status === 'completed').length,
      cancelledJobs: d.jobs.filter((j) => j.status === 'cancelled').length,
      totalOffers: offers.length,
      pendingOffers: offers.filter((o) => o.status === 'pending').length,
      acceptedOffers: offers.filter((o) => o.status === 'accepted').length,
      averageRating: Math.round(averageRating * 100) / 100,
      totalRevenue: offers
        .filter((o) => o.status === 'accepted')
        .reduce((sum, o) => sum + o.price, 0),
      currency: 'GTQ',
      activeUsersToday: d.users.filter((u) => u.availability.isOnline).length,
      newUsersThisWeek: d.users.filter((u) => new Date(u.createdAt ?? 0) > weekAgo).length,
      newJobsThisWeek: d.jobs.filter((j) => new Date(j.createdAt) > weekAgo).length,
    };
  },

  async getUsers(params?: QueryParams): Promise<PaginatedResponse<UserAdminView>> {
    await sleep(120);
    let items = db().users;
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      items = items.filter(
        (u) =>
          `${u.profile.firstName} ${u.profile.lastName}`.toLowerCase().includes(q) ||
          u.account.email.toLowerCase().includes(q),
      );
    }
    if (params?.role && params.role !== 'all') {
      items = items.filter((u) => u.role === params.role);
    }
    return paginate(items.map(toAdminView), params);
  },

  async getUserById(id: string): Promise<UserAdminView> {
    await sleep(80);
    const user = db().users.find((u) => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    return toAdminView(user);
  },

  async suspendUser(id: string): Promise<void> {
    await sleep(120);
    const d = db();
    if (!d.flags.suspendedIds.includes(id)) d.flags.suspendedIds.push(id);
    saveDb(d);
  },

  async activateUser(id: string): Promise<void> {
    await sleep(120);
    const d = db();
    d.flags.suspendedIds = d.flags.suspendedIds.filter((s) => s !== id);
    saveDb(d);
  },

  async makeAdmin(id: string): Promise<void> {
    await sleep(120);
    const d = db();
    const user = d.users.find((u) => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    user.role = 'admin';
    saveDb(d);
  },

  async removeAdmin(id: string): Promise<void> {
    await sleep(120);
    const d = db();
    const user = d.users.find((u) => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    user.role = 'client';
    saveDb(d);
  },

  async getAllJobs(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    await sleep(120);
    let items = db().jobs;
    if (params?.status && params.status !== 'all') {
      items = items.filter((j) => j.status === params.status);
    }
    if (params?.search) {
      const q = String(params.search).toLowerCase();
      items = items.filter(
        (j) =>
          j.details.title.toLowerCase().includes(q) ||
          j.location.address.toLowerCase().includes(q),
      );
    }
    return paginate(items, params);
  },

  async getPendingWorkers(): Promise<User[]> {
    await sleep(120);
    return db().users.filter(
      (u) => u.role === 'worker' && !u.account.verified,
    );
  },

  async verifyWorker(workerId: string, approve: boolean, reason?: string): Promise<void> {
    await sleep(150);
    const d = db();
    const idx = d.users.findIndex((u) => u.id === workerId);
    if (idx < 0) throw new Error('Profesional no encontrado');
    if (approve) {
      d.users[idx] = {
        ...d.users[idx],
        account: { ...d.users[idx].account, verified: true },
        updatedAt: nowIso(),
      };
    } else if (reason) {
      d.flags.rejectedReasons[workerId] = reason;
    }
    saveDb(d);
  },

  async getActivityLog(params?: QueryParams): Promise<PaginatedResponse<ActivityLog>> {
    await sleep(120);
    const d = db();
    const logs: ActivityLog[] = [];
    const users = new Map(d.users.map((u) => [u.id, u]));
    const log = (
      userId: string,
      action: string,
      entityType: string,
      entityId: string,
      description: string,
      createdAt: string,
    ) => {
      const u = users.get(userId);
      logs.push({
        id: `${action}-${entityId}`,
        userId,
        userName: u ? `${u.profile.firstName} ${u.profile.lastName}`.trim() : 'Usuario',
        action,
        entityType,
        entityId,
        description,
        createdAt,
      });
    };
    d.users.forEach((u) =>
      log(
        u.id,
        u.role === 'worker' ? 'registro_pro' : u.role === 'admin' ? 'registro' : 'registro_cliente',
        'user',
        u.id,
        `Se registró como ${u.role === 'worker' ? 'profesional' : u.role === 'admin' ? 'administrador' : 'cliente'}`,
        u.createdAt ?? nowIso(),
      ),
    );
    d.jobs
      .filter((j) => j.status === 'completed')
      .forEach((j) =>
        log(
          j.clientId,
          'completar_trabajo',
          'job',
          j.id,
          `Completó el trabajo "${j.details.title}"`,
          j.completedAt ?? j.updatedAt,
        ),
      );
    d.reviews.forEach((r) =>
      log(
        r.reviewerId,
        'reseña',
        'review',
        r.id,
        'Dejó una reseña con calificación ' + r.rating + '/5',
        r.createdAt,
      ),
    );
    return paginate(logs, params);
  },
};