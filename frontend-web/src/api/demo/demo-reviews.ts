import type { CreateReviewDto, Review, UpdateReviewDto } from '@/types/review.types';
import { currentUserId, sleep } from './index';
import { db, nowIso, saveDb, uid } from './demoDb';

export const demoReviews = {
  async getAllByJob(jobId: string): Promise<Review[]> {
    await sleep();
    return db().reviews.filter((r) => r.jobId === jobId);
  },

  async getAllByUser(userId: string): Promise<Review[]> {
    await sleep();
    return db().reviews.filter(
      (r) => r.reviewerId === userId || r.revieweeId === userId,
    );
  },

  async create(jobId: string, data: CreateReviewDto): Promise<Review> {
    await sleep(200);
    const reviewerId = currentUserId();
    if (!reviewerId) throw new Error('Inicia sesión para dejar una reseña');
    const d = db();
    const job = d.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Trabajo no encontrado');
    const accepted = d.offers.find(
      (o) => o.jobId === jobId && o.status === 'accepted',
    );
    const revieweeId = accepted?.workerId ?? job.clientId;

    const review: Review = {
      id: uid('demo-review'),
      jobId,
      reviewerId,
      revieweeId,
      rating: data.rating,
      comment: data.comment,
      aspects: {
        quality: data.aspects.quality ?? null,
        punctuality: data.aspects.punctuality ?? null,
        communication: data.aspects.communication ?? null,
        value: data.aspects.value ?? null,
      },
      isPublic: data.isPublic ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    d.reviews.push(review);

    if (reviewerId !== revieweeId) {
      const workerIdx = d.users.findIndex((u) => u.id === revieweeId);
      if (workerIdx >= 0) {
        const w = d.users[workerIdx];
        const count = w.stats.ratingCount + 1;
        const rating = (w.stats.rating * w.stats.ratingCount + data.rating) / count;
        d.users[workerIdx] = {
          ...w,
          stats: { ...w.stats, rating: Math.round(rating * 10) / 10, ratingCount: count },
          updatedAt: nowIso(),
        };
      }
    }
    saveDb(d);
    return review;
  },

  async respond(id: string, data: UpdateReviewDto): Promise<Review> {
    await sleep(150);
    const d = db();
    const idx = d.reviews.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Reseña no encontrada');
    d.reviews[idx] = {
      ...d.reviews[idx],
      response: data.response ?? null,
      updatedAt: nowIso(),
    };
    saveDb(d);
    return d.reviews[idx];
  },
};