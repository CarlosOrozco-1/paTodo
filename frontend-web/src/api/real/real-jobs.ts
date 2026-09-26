import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  addDoc,
  updateDoc,
  where,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import type { CreateJobDto, Job, UpdateJobDto } from '@/types/job.types';
import type { PaginatedResponse, QueryParams } from '@/types/common.types';
import type { BackendJob } from '../mappers';
import { jobWithWorkerId, toPageArray } from '../mappers';
import { NotSupportedError } from '.';
import { db } from '../firebase/init';
import { jobFromDoc, readJob, requireUid } from '../firebase/fs';
import { encodeGeohash } from '../firebase/geohash';
import { apiPost } from '../firebase/rest';

const pageLimit = 20;

function createPage(items: BackendJob[], total: number, page: number, limitNumber: number): PaginatedResponse<Job> {
  return {
    items: items.map(jobWithWorkerId),
    total,
    page,
    limit: limitNumber,
    totalPages: Math.max(1, Math.ceil(total / limitNumber)),
  };
}

async function queryJobs(
  constraints: QueryConstraint[],
  params?: QueryParams,
): Promise<PaginatedResponse<Job>> {
  const base = query(collection(db, 'jobs'), ...constraints);
  const snapshot = await getDocs(base);
  let all = snapshot.docs
    .map((item) => jobFromDoc(item))
    .filter((item): item is BackendJob => item !== null);

  if (params?.categoryId) {
    all = all.filter((job) => job.details.categoryId === params.categoryId);
  }
  if (params?.status && params.status !== 'all') {
    all = all.filter((job) => job.status === params.status);
  }
  if (params?.search) {
    const needle = params.search.toLowerCase();
    all = all.filter(
      (job) =>
        job.details.title.toLowerCase().includes(needle) ||
        job.details.description.toLowerCase().includes(needle),
    );
  }
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const page = Math.max(1, params?.page ?? 1);
  const limitNumber = Math.max(1, params?.limit ?? pageLimit);
  const start = (page - 1) * limitNumber;
  return createPage(all.slice(start, start + limitNumber), all.length, page, limitNumber);
}

export const realJobs = {
  async getAll(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    return queryJobs([], params);
  },

  async getById(id: string): Promise<Job> {
    const backend = await readJob(id);
    if (!backend) throw new Error('Trabajo no encontrado');
    return jobWithWorkerId(backend);
  },

  async getByClient(_clientId: string, _params?: QueryParams): Promise<PaginatedResponse<Job>> {
    if (!requireUid()) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
    const snapshot = await getDocs(query(collection(db, 'jobs'), where('clientId', '==', requireUid())));
    const all = snapshot.docs
      .map((item) => jobFromDoc(item))
      .filter((item): item is BackendJob => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return toPageArray(all.map(jobWithWorkerId));
  },

  async getAvailable(params?: QueryParams): Promise<PaginatedResponse<Job>> {
    const snapshot = await getDocs(query(collection(db, 'jobs'), where('status', '==', 'pending')));
    const uid = requireUid();
    const all = snapshot.docs
      .map((item) => jobFromDoc(item))
      .filter((item): item is BackendJob => item !== null)
      .filter((job) => job.clientId !== uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    let list = all;
    if (params?.categoryId) list = list.filter((job) => job.details.categoryId === params.categoryId);
    if (params?.search) {
      const needle = params.search.toLowerCase();
      list = list.filter(
        (job) =>
          job.details.title.toLowerCase().includes(needle) ||
          job.details.description.toLowerCase().includes(needle),
      );
    }

    const page = Math.max(1, params?.page ?? 1);
    const limitNumber = Math.max(1, params?.limit ?? pageLimit);
    const start = (page - 1) * limitNumber;
    return createPage(list.slice(start, start + limitNumber), list.length, page, limitNumber);
  },

  async getByWorker(_workerId: string, _params?: QueryParams): Promise<PaginatedResponse<Job>> {
    const uid = requireUid();
    const snapshot = await getDocs(query(collection(db, 'jobs'), where('workerId', '==', uid)));
    const all = snapshot.docs
      .map((item) => jobFromDoc(item))
      .filter((item): item is BackendJob => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return toPageArray(all.map(jobWithWorkerId));
  },

  async create(data: CreateJobDto): Promise<Job> {
    const uid = requireUid();
    const [longitude, latitude] = data.location.coordinates;
    const ref = await addDoc(collection(db, 'jobs'), {
      clientId: uid,
      details: {
        title: data.details.title,
        description: data.details.description,
        categoryId: data.details.categoryId,
        skillIds: data.details.skillIds ?? [],
      },
      location: {
        geopoint: { latitude, longitude },
        geohash: encodeGeohash(latitude, longitude, 9),
        address: data.location.address ?? '',
        placeId: null,
      },
      pricing: {
        proposedPrice: data.pricing.proposedPrice,
        currency: data.pricing.currency ?? 'GTQ',
        priceType: data.pricing.priceType ?? 'fixed',
      },
      status: 'pending',
      scheduledFor: data.scheduledFor ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const created = await getDoc(ref);
    return jobWithWorkerId(jobFromDoc(created)!);
  },

  async update(id: string, data: UpdateJobDto): Promise<Job> {
    const patch: Record<string, unknown> = {};
    if (data.details) {
      patch.details = {
        title: data.details.title ?? '',
        description: data.details.description ?? '',
        categoryId: data.details.categoryId ?? '',
        skillIds: data.details.skillIds ?? [],
      };
    }
    if (data.pricing) {
      patch.pricing = {
        proposedPrice: data.pricing.proposedPrice ?? 0,
        currency: data.pricing.currency ?? 'GTQ',
        priceType: data.pricing.priceType ?? 'fixed',
      };
    }
    if (data.location && data.location.coordinates?.length === 2) {
      const [longitude, latitude] = data.location.coordinates;
      patch.location = {
        geopoint: { latitude, longitude },
        geohash: encodeGeohash(latitude, longitude, 9),
        address: data.location.address ?? '',
      };
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await updateDoc(doc(db, 'jobs', id), patch);
    }
    const backend = await readJob(id);
    if (!backend) throw new Error('Trabajo no encontrado');
    return jobWithWorkerId(backend);
  },

  async updateStatus(id: string, status: Job['status']): Promise<Job> {
    if (status === 'completed') return realJobs.complete(id);
    if (status === 'cancelled') return realJobs.cancel(id, '');
    throw new NotSupportedError('Este cambio de estado se gestiona desde la app');
  },

  async cancel(id: string, reason: string): Promise<Job> {
    const response = await apiPost<unknown>('/cancelJob', { jobId: id, reason: reason || undefined });
    const backend = (Array.isArray(response) ? response[0] : response) as Record<string, unknown>;
    if (!backend || typeof backend.id !== 'string') {
      const fresh = await readJob(id);
      if (!fresh) throw new Error('Trabajo no encontrado');
      return jobWithWorkerId(fresh);
    }
    return jobWithWorkerId(jobFromApi(backend));
  },

  async assign(id: string, _offerId: string): Promise<Job> {
    const backend = await readJob(id);
    if (!backend) throw new Error('Trabajo no encontrado');
    return jobWithWorkerId(backend);
  },

  async complete(id: string): Promise<Job> {
    const response = await apiPost<unknown>('/completeJob', { jobId: id });
    const backend = (Array.isArray(response) ? response[0] : response) as Record<string, unknown>;
    if (!backend || typeof backend.id !== 'string') {
      const fresh = await readJob(id);
      if (!fresh) throw new Error('Trabajo no encontrado');
      return jobWithWorkerId(fresh);
    }
    return jobWithWorkerId(jobFromApi(backend));
  },
};

function jobFromApi(data: Record<string, unknown>): BackendJob {
  const coords = (() => {
    const loc = (data.location ?? {}) as Record<string, unknown>;
    const geopoint = (loc.geopoint ?? {}) as Record<string, number>;
    if (typeof geopoint.longitude === 'number' && typeof geopoint.latitude === 'number') {
      return [geopoint.longitude, geopoint.latitude] as [number, number];
    }
    return [0, 0] as [number, number];
  })();
  const details = (data.details ?? {}) as Record<string, unknown>;
  const loc = (data.location ?? {}) as Record<string, unknown>;
  const pricing = (data.pricing ?? {}) as Record<string, unknown>;
  return {
    id: data.id as string,
    clientId: (data.clientId as string) ?? '',
    workerId: typeof data.workerId === 'string' ? data.workerId : undefined,
    status: (data.status as string) ?? 'pending',
    acceptedOfferId: typeof data.acceptedOfferId === 'string' ? data.acceptedOfferId : undefined,
    scheduledFor: (data.scheduledFor as string | null | undefined) ?? null,
    startedAt: null,
    completedAt: (data.completedAt as string | null | undefined) ?? null,
    cancelledAt: null,
    cancellationReason: (data.cancelReason as string | null | undefined) ?? null,
    createdAt: (data.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (data.updatedAt as string) ?? new Date().toISOString(),
    details: {
      title: (details.title as string) ?? '',
      description: (details.description as string) ?? '',
      categoryId: (details.categoryId as string) ?? '',
      skillIds: Array.isArray(details.skillIds) ? (details.skillIds as string[]) : [],
    },
    location: {
      type: 'Point',
      coordinates: coords,
      address: (loc.address as string) ?? '',
      placeId: typeof loc.placeId === 'string' ? loc.placeId : undefined,
    },
    pricing: {
      proposedPrice: (pricing.proposedPrice as number) ?? 0,
      currency: (pricing.currency as string) ?? 'GTQ',
      priceType: (pricing.priceType as string) ?? 'fixed',
    },
  };
}