import type { ObjectId } from './common.types';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'countered';

export interface WorkerSnapshot {
  name: string;
  rating: number;
  completedJobs: number;
  avatarUrl?: string;
}

export interface Offer {
  id: ObjectId;
  jobId: ObjectId;
  workerId: ObjectId;
  workerSnapshot: WorkerSnapshot;
  price: number;
  estimatedTime: number;
  message?: string;
  status: OfferStatus;
  currency: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfferDto {
  jobId: ObjectId;
  price: number;
  estimatedTime: number;
  message?: string;
  expiresAt?: string;
}

export interface UpdateOfferDto {
  price?: number;
  estimatedTime?: number;
  message?: string;
  status?: OfferStatus;
  expiresAt?: string | null;
}