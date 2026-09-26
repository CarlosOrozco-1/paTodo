import { Star } from 'lucide-react';
import type { Review } from '@/types/review.types';
import { Card, CardContent } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { StarRating } from '@/components/ui/StarRating';
import { timeAgo } from '@/utils/formatters';

interface ReviewCardProps {
  review: Review;
  reviewerName?: string;
  reviewerAvatar?: string;
}

export function ReviewCard({ review, reviewerName, reviewerAvatar }: ReviewCardProps) {
  const name = reviewerName || 'Usuario';
  const hasAspects = Object.values(review.aspects).some((v) => v !== null);

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={name} src={reviewerAvatar} size="sm" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{name}</p>
              <StarRating rating={review.rating} size="sm" />
            </div>
          </div>
          <span className="text-xs text-gray-400">{timeAgo(review.createdAt)}</span>
        </div>

        {review.comment && (
          <p className="mt-3 text-sm text-gray-600">{review.comment}</p>
        )}

        {hasAspects && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['quality', 'punctuality', 'communication', 'value'] as const).map(
              (aspect) => {
                const value = review.aspects[aspect];
                if (value === null) return null;
                const labels: Record<string, string> = {
                  quality: 'Calidad',
                  punctuality: 'Puntualidad',
                  communication: 'Comunicación',
                  value: 'Precio',
                };
                return (
                  <div
                    key={aspect}
                    className="rounded-lg bg-gray-50 px-2 py-1.5 text-center"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">
                      {labels[aspect]}
                    </p>
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {value.toFixed(1)}
                    </p>
                  </div>
                );
              },
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}