import type { CreateJobDto, Job, UpdateJobDto } from '@/types/job.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import { currentUserId, sleep } from './index';
import { db, nowIso, saveDb, uid } from './demoDb';

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

function searchJob(job: Job, term: string): boolean {
  const q = term.toLowerCase();
  return (
    job.details.title.toLowerCase().includes(q) ||
    job.details.description.toLowerCase().includes(q) ||
    job.location.address.toLowerCase().includes(q)
  );
}

function applyFilters(jobs: Job[], params?: QueryParams): Job[] {
  let items = jobs;
  if (params?.search) items = items.filter((j) => searchJob(j, String(params.search)));
  if (params?.categoryId)
    items = items.filter((j) => j.details.categoryId === params.categoryId);
  if (params?.status) items = items.filter((j) => j.status === params.status);
  if (params?.minPrice)
    items = items.filter((j) => j.pricing.proposedPrice >= Number(params.minPrice));
  if (params?.maxPrice)
    items = items.filter((j) => j.pricing.proposedPrice <= Number(params.maxPrice));
  return items;
}

export const demoJobs = {
  async getAll(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    await sleep();
    return paginate(applyFilters(db().jobs, params), params);
  },

  async getById(id: string): Promise<Job> {
    await sleep(80);
    const job = db().jobs.find((j) => j.id === id);
    if (!job) throw new Error('Trabajo no encontrado');
    return job;
  },

  async getByClient(clientId: string, params?: QueryParams): Promise<PaginatedResponse<Job>> {
    await sleep();
    return paginate(
      db().jobs.filter((j) => j.clientId === clientId),
      params,
    );
  },

  async getAvailable(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    await sleep();
    const open = db().jobs.filter((j) => j.status === 'pending' || j.status === 'published');
    return paginate(applyFilters(open, params), params);
  },

  async getByWorker(workerId: string, params?: QueryParams): Promise<PaginatedResponse<Job>> {
    await sleep();
    const d = db();
    const jobIds = new Set(
      d.offers.filter((o) => o.workerId === workerId).map((o) => o.jobId),
    );
    return paginate(
      d.jobs.filter((j) => jobIds.has(j.id)),
      params,
    );
  },

  async create(data: CreateJobDto): Promise<Job> {
    await sleep(200);
    const clientId = currentUserId();
    if (!clientId) throw new Error('Inicia sesión para publicar un trabajo');
    const job: Job = {
      id: uid('demo-job'),
      clientId,
      details: data.details,
      location: data.location,
      pricing: {
        ...data.pricing,
        currency: data.pricing.currency || 'GTQ',
      },
      status: 'published',
      scheduledFor: data.scheduledFor ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const d = db();
    d.jobs.push(job);
    saveDb(d);
    return job;
  },

  async update(id: string, data: UpdateJobDto): Promise<Job> {
    await sleep(150);
    const d = db();
    const idx = d.jobs.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error('Trabajo no encontrado');
    d.jobs[idx] = {
      ...d.jobs[idx],
      ...data,
      details: { ...d.jobs[idx].details, ...data.details },
      location: { ...d.jobs[idx].location, ...data.location },
      pricing: { ...d.jobs[idx].pricing, ...data.pricing },
      updatedAt: nowIso(),
    };
    saveDb(d);
    return d.jobs[idx];
  },

  async updateStatus(id: string, status: Job['status']): Promise<Job> {
    await sleep(150);
    const d = db();
    const idx = d.jobs.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error('Trabajo no encontrado');
    d.jobs[idx] = { ...d.jobs[idx], status, updatedAt: nowIso() };
    saveDb(d);
    return d.jobs[idx];
  },

  async cancel(id: string, reason: string): Promise<Job> {
    await sleep(150);
    const d = db();
    const idx = d.jobs.findIndex((j) => j.id === id);
    if (idx < 0) throw new Error('Trabajo no encontrado');
    d.jobs[idx] = {
      ...d.jobs[idx],
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveDb(d);
    return d.jobs[idx];
  },

  async assign(id: string, offerId: string): Promise<Job> {
    await sleep(150);
    const d = db();
    const jobIdx = d.jobs.findIndex((j) => j.id === id);
    if (jobIdx < 0) throw new Error('Trabajo no encontrado');
    const offer = d.offers.find((o) => o.id === offerId);
    if (!offer) throw new Error('Oferta no encontrada');
    d.jobs[jobIdx] = {
      ...d.jobs[jobIdx],
      status: 'assigned',
      startedAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveDb(d);
    return d.jobs[jobIdx];
  },

  async complete(id: string): Promise<Job> {
    await sleep(200);
    const d = db();
    const jobIdx = d.jobs.findIndex((j) => j.id === id);
    if (jobIdx < 0) throw new Error('Trabajo no encontrado');
    const job = d.jobs[jobIdx];
    d.jobs[jobIdx] = {
      ...job,
      status: 'completed',
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };
    const accepted = d.offers.find((o) => o.jobId === id && o.status === 'accepted');
    if (accepted) {
      const workerIdx = d.users.findIndex((u) => u.id === accepted.workerId);
      if (workerIdx >= 0) {
        d.users[workerIdx] = {
          ...d.users[workerIdx],
          stats: {
            ...d.users[workerIdx].stats,
            completedJobs: d.users[workerIdx].stats.completedJobs + 1,
          },
          updatedAt: nowIso(),
        };
      }
    }
    saveDb(d);
    return d.jobs[jobIdx];
  },
};