import type { CreateReviewDto, Review, UpdateReviewDto } from '@/types/review.types';
import { isDemoMode } from './demo';
import { demoReviews } from './demo/demo-reviews';
import { realReviews } from './real';

export const reviewsService = {
  async getAllByJob(jobId: string): Promise<Review[]> {
    if (isDemoMode()) return demoReviews.getAllByJob(jobId);
    return realReviews.getAllByJob(jobId);
  },

  async getAllByUser(userId: string): Promise<Review[]> {
    if (isDemoMode()) return demoReviews.getAllByUser(userId);
    return realReviews.getAllByUser(userId);
  },

  async create(jobId: string, data: CreateReviewDto): Promise<Review> {
    if (isDemoMode()) return demoReviews.create(jobId, data);
    return realReviews.create(jobId, data);
  },

  async respond(id: string, data: UpdateReviewDto): Promise<Review> {
    if (isDemoMode()) return demoReviews.respond(id, data);
    return realReviews.respond(id, data);
  },
};