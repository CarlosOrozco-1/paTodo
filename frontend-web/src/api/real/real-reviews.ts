import { collection, getDocs, query, where, type QueryConstraint } from 'firebase/firestore';
import type { CreateReviewDto, Review, UpdateReviewDto } from '@/types/review.types';
import type { BackendReview } from '../mappers';
import { mapReview } from '../mappers';
import { NotSupportedError } from '.';
import { db } from '../firebase/init';
import { reviewFromData, reviewFromDoc } from '../firebase/fs';
import { apiPost } from '../firebase/rest';

async function listReviews(jobId: string | null, userId: string | null): Promise<Review[]> {
  const constraints: QueryConstraint[] = [];
  if (jobId) constraints.push(where('jobId', '==', jobId));
  if (userId) constraints.push(where('revieweeId', '==', userId));
  const snapshot = await getDocs(query(collection(db, 'reviews'), ...constraints));
  const items = snapshot.docs
    .map((item) => reviewFromDoc(item))
    .filter((item): item is BackendReview => item !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.map(mapReview);
}

export const realReviews = {
  async getAllByJob(jobId: string): Promise<Review[]> {
    return listReviews(jobId, null);
  },

  async getAllByUser(userId: string): Promise<Review[]> {
    return listReviews(null, userId);
  },

  async create(jobId: string, data: CreateReviewDto): Promise<Review> {
    const rating = Math.round(Number(data.rating));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('La calificación debe ser un número entero entre 1 y 5');
    }
    const response = await apiPost<Record<string, unknown>>('/createReview', {
      jobId,
      rating,
      comment: data.comment ?? '',
    });
    const review = reviewFromData(response as Record<string, unknown> & { id?: string });
    if (!review) throw new Error('No se pudo crear la reseña');
    return mapReview(review);
  },

  async respond(_id: string, _data: UpdateReviewDto): Promise<Review> {
    throw new NotSupportedError('Responder reseñas no está disponible en este backend');
  },
};