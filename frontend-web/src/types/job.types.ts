import type { ObjectId } from './common.types';

export type JobStatus =
  | 'pending'
  | 'published'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface JobDetails {
  title: string;
  description: string;
  categoryId: ObjectId;
  skillIds: ObjectId[];
}

export interface GeoLocation {
  coordinates: [number, number];
  address: string;
  type?: string;
}

export type PriceType = 'fixed' | 'negotiable';

export interface JobPricing {
  proposedPrice: number;
  currency: string;
  priceType: PriceType;
}

export interface JobPayment {
  paymentId: string;
  status: 'paid';
  amount: number;
  currency: string;
  method: 'demo_card' | 'demo_cash' | 'demo_bank';
  isDemo: boolean;
}

export interface Job {
  id: ObjectId;
  clientId: ObjectId;
  workerId?: string;
  details: JobDetails;
  location: GeoLocation;
  pricing: JobPricing;
  status: JobStatus;
  scheduledFor?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  startedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  payment?: JobPayment | null;
}

export interface CreateJobDto {
  details: JobDetails;
  location: GeoLocation;
  pricing: JobPricing;
  scheduledFor?: string;
}

export interface UpdateJobDto {
  details?: Partial<JobDetails>;
  location?: Partial<GeoLocation>;
  pricing?: Partial<JobPricing>;
  status?: JobStatus;
  scheduledFor?: string | null;
}