import { useEffect, useMemo, useState } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { reviewsService } from '@/api/reviews.service';
import { usersService } from '@/api/users.service';
import { getErrorMessage } from '@/api/axiosClient';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { StarRating } from '@/components/ui/StarRating';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Review } from '@/types/review.types';
import type { User } from '@/types/user.types';

interface ReviewsListProps {
  userId: string;
  /** Reseñas ya cargadas por la página: evita una segunda consulta. */
  initialReviews?: Review[];
  limit?: number;
  showSummary?: boolean;
}

/**
 * Historial de reseñas de un usuario con su resumen de puntuación.
 *
 * Los nombres de quien reseña se resuelven por separado y de forma tolerante:
 * un `getById` fallido no debe dejar la lista en blanco, porque el reseñante
 * puede haber borrado su cuenta o el perfil estar restringido.
 */
const NO_REVIEWS: Review[] = [];

export function ReviewsList({
  userId,
  initialReviews,
  limit,
  showSummary = true,
}: ReviewsListProps) {
  // `fetched` arranca en null (aún no consultado). Si la página ya trae las
  // reseñas, se usan directamente y no se dispara ninguna consulta extra.
  const [fetched, setFetched] = useState<Review[] | null>(
    initialReviews ?? null,
  );
  const [authorMap, setAuthorMap] = useState<Record<string, User>>({});

  const reviews = initialReviews ?? fetched ?? NO_REVIEWS;
  const loading = initialReviews ? false : fetched === null;

  useEffect(() => {
    if (initialReviews) return;
    let cancelled = false;
    const load = async () => {
      try {
        const items = await reviewsService.getAllByUser(userId);
        if (cancelled) return;
        setFetched(items);
      } catch (error) {
        if (cancelled) return;
        setFetched([]);
        console.warn('No se pudieron cargar las reseñas:', getErrorMessage(error));
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, initialReviews]);

  const authorIds = useMemo(
    () => [...new Set(reviews.map((r) => r.reviewerId))],
    [reviews],
  );

  useEffect(() => {
    if (authorIds.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const results = await Promise.allSettled(
        authorIds.map((id) => usersService.getById(id)),
      );
      if (cancelled) return;
      const map: Record<string, User> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') map[result.value.id] = result.value;
      });
      setAuthorMap(map);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [authorIds]);

  const average = useMemo(
    () =>
      reviews.length
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
    [reviews],
  );

  const breakdown = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    reviews.forEach((r) => {
      const idx = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      counts[idx] += 1;
    });
    return counts.reverse();
  }, [reviews]);

  if (loading) return <Spinner label="Cargando reseñas..." />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="Sin reseñas todavía"
        description={
          initialReviews
            ? 'Este trabajo aún no tiene reseñas.'
            : 'Todavía no hay reseñas públicas para este usuario.'
        }
        icon={<MessageSquareOff className="h-8 w-8" />}
      />
    );
  }
  const visible = limit ? reviews.slice(0, limit) : reviews;

  return (
    <div className="space-y-4">
      {showSummary && (
        <div className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-[auto_1fr] sm:gap-6">
          <div className="flex items-center gap-3 sm:flex-col sm:gap-1">
            <p className="text-4xl font-black tracking-tight text-gray-900">
              {average.toFixed(1)}
            </p>
            <StarRating rating={average} showValue={false} />
            <p className="text-xs text-gray-500">
              {reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}
            </p>
          </div>

          <div className="space-y-1">
            {breakdown.map((count, index) => {
              const stars = 5 - index;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={stars} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-xs font-semibold text-gray-500">
                    {stars}★
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs text-gray-400">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((review) => {
          const author = authorMap[review.reviewerId];
          return (
            <ReviewCard
              key={review.id}
              review={review}
              reviewerName={
                author
                  ? `${author.profile.firstName} ${author.profile.lastName}`.trim()
                  : 'Usuario'
              }
              reviewerAvatar={author?.profile.avatarUrl}
            />
          );
        })}
      </div>

      {limit && reviews.length > limit && (
        <p className="text-center text-xs text-gray-400">
          Mostrando {limit} de {reviews.length} reseñas
        </p>
      )}
    </div>
  );
}
