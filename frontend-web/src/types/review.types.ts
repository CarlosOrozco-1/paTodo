import type { ObjectId } from './common.types';

export interface ReviewAspects {
  quality: number | null;
  punctuality: number | null;
  communication: number | null;
  value: number | null;
}

export interface Review {
  id: ObjectId;
  jobId: ObjectId;
  reviewerId: ObjectId;
  revieweeId: ObjectId;
  rating: number;
  comment?: string;
  aspects: ReviewAspects;
  isPublic: boolean;
  response?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewDto {
  rating: number;
  comment?: string;
  aspects: Partial<ReviewAspects>;
  isPublic?: boolean;
  revieweeId?: string;
}

export interface UpdateReviewDto {
  response?: string;
}