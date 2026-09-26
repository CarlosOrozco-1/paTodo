import type { CreateOfferDto, Offer, UpdateOfferDto } from '@/types/offer.types';
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

export function refreshSnapshot(offer: Offer): Offer {
  const worker = db().users.find((u) => u.id === offer.workerId);
  if (!worker) return offer;
  return {
    ...offer,
    workerSnapshot: {
      name: `${worker.profile.firstName} ${worker.profile.lastName}`.trim(),
      rating: worker.stats.rating,
      completedJobs: worker.stats.completedJobs,
      avatarUrl: worker.profile.avatarUrl,
    },
  };
}

const expiresInDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const demoOffers = {
  async getAllByJob(jobId: string): Promise<Offer[]> {
    await sleep();
    return db()
      .offers.filter((o) => o.jobId === jobId)
      .map(refreshSnapshot);
  },

  async getAllByWorker(workerId: string, params?: QueryParams): Promise<PaginatedResponse<Offer>> {
    await sleep();
    return paginate(
      db().offers.filter((o) => o.workerId === workerId),
      params,
    );
  },

  async getById(id: string): Promise<Offer> {
    await sleep(80);
    const offer = db().offers.find((o) => o.id === id);
    if (!offer) throw new Error('Oferta no encontrada');
    return refreshSnapshot(offer);
  },

  async create(data: CreateOfferDto): Promise<Offer> {
    await sleep(200);
    const workerId = currentUserId();
    if (!workerId) throw new Error('Inicia sesión para enviar una oferta');
    const worker = db().users.find((u) => u.id === workerId);
    if (!worker) throw new Error('Profesional no encontrado');
    if (worker.role !== 'worker') throw new Error('Solo los profesionales pueden ofertar');

    const d = db();
    const duplicate = d.offers.find(
      (o) =>
        o.jobId === data.jobId &&
        o.workerId === workerId &&
        o.status !== 'withdrawn',
    );
    if (duplicate) return refreshSnapshot(duplicate);

    const offer: Offer = {
      id: uid('demo-offer'),
      jobId: data.jobId,
      workerId,
      workerSnapshot: {
        name: `${worker.profile.firstName} ${worker.profile.lastName}`.trim(),
        rating: worker.stats.rating,
        completedJobs: worker.stats.completedJobs,
        avatarUrl: worker.profile.avatarUrl,
      },
      price: data.price,
      estimatedTime: data.estimatedTime,
      message: data.message,
      status: 'pending',
      currency: 'GTQ',
      expiresAt: data.expiresAt ?? expiresInDays(3),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.offers.push(offer);
    const job = d.jobs.find((j) => j.id === offer.jobId);
    if (job) {
      d.notifications.push({
        id: uid('demo-notif'),
        userId: job.clientId,
        type: 'offer',
        title: 'Nueva oferta recibida',
        body: `${worker.profile.firstName} ${worker.profile.lastName} envió una oferta por "${job.details.title}"`,
        read: false,
        data: { jobId: job.id },
        createdAt: nowIso(),
      });
    }
    saveDb(d);
    return offer;
  },

  async update(id: string, data: UpdateOfferDto): Promise<Offer> {
    await sleep(150);
    const d = db();
    const idx = d.offers.findIndex((o) => o.id === id);
    if (idx < 0) throw new Error('Oferta no encontrada');
    d.offers[idx] = { ...d.offers[idx], ...data, updatedAt: nowIso() };
    saveDb(d);
    return refreshSnapshot(d.offers[idx]);
  },

  async accept(id: string): Promise<Offer> {
    await sleep(150);
    const d = db();
    const idx = d.offers.findIndex((o) => o.id === id);
    if (idx < 0) throw new Error('Oferta no encontrada');
    const offer = d.offers[idx];
    d.offers = d.offers.map((o) =>
      o.id === id ? { ...o, status: 'accepted', updatedAt: nowIso() } :
      o.jobId === offer.jobId && o.status === 'pending'
        ? { ...o, status: 'rejected' }
        : o,
    );
    const jobIdx = d.jobs.findIndex((j) => j.id === offer.jobId);
    if (jobIdx >= 0) {
      d.jobs[jobIdx] = {
        ...d.jobs[jobIdx],
        status: 'assigned',
        startedAt: nowIso(),
        updatedAt: nowIso(),
      };
    }
    d.notifications.push({
      id: uid('demo-notif'),
      userId: offer.workerId,
      type: 'offer',
      title: 'Oferta aceptada',
      body: `¡Felicitaciones! El cliente aceptó tu oferta por Q${offer.price.toFixed(2)}`,
      read: false,
      data: { jobId: offer.jobId },
      createdAt: nowIso(),
    });
    saveDb(d);
    return refreshSnapshot(d.offers.find((o) => o.id === id)!);
  },

  async reject(id: string): Promise<Offer> {
    await sleep(150);
    const d = db();
    const idx = d.offers.findIndex((o) => o.id === id);
    if (idx < 0) throw new Error('Oferta no encontrada');
    d.offers[idx] = { ...d.offers[idx], status: 'rejected', updatedAt: nowIso() };
    saveDb(d);
    return refreshSnapshot(d.offers[idx]);
  },

  async withdraw(id: string): Promise<Offer> {
    await sleep(150);
    const d = db();
    const idx = d.offers.findIndex((o) => o.id === id);
    if (idx < 0) throw new Error('Oferta no encontrada');
    d.offers[idx] = { ...d.offers[idx], status: 'withdrawn', updatedAt: nowIso() };
    saveDb(d);
    return refreshSnapshot(d.offers[idx]);
  },
};