import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/utils/cn';

interface StarRatingProps {
  rating: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  interactive?: boolean;
  onChange?: (value: number) => void;
}

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function StarRating({
  rating,
  count,
  size = 'sm',
  showValue = false,
  interactive = false,
  onChange,
}: StarRatingProps) {
  const renderStars = () => {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
    const rounded = rating - full >= 0.75 ? 1 : 0;

    for (let i = 0; i < full + rounded; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className={cn(
            'fill-amber-400 text-amber-400',
            sizeClasses[size],
            interactive && 'cursor-pointer',
          )}
        />,
      );
    }
    if (hasHalf) {
      stars.push(
        <div key="half" className="relative">
          <Star className={cn('text-gray-300', sizeClasses[size])} />
          <StarHalf
            className={cn(
              'absolute inset-0 fill-amber-400 text-amber-400',
              sizeClasses[size],
            )}
          />
        </div>,
      );
    }
    while (stars.length < 5) {
      stars.push(
        <Star
          key={`empty-${stars.length}`}
          className={cn('text-gray-300', sizeClasses[size], interactive && 'cursor-pointer')}
        />,
      );
    }
    return stars;
  };

  if (interactive) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange?.(value)}
            className="p-0.5"
          >
            <Star
              className={cn(
                sizeClasses[size],
                value <= Math.round(rating)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-300',
              )}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">{renderStars()}</div>
      {showValue && (
        <span className="text-sm font-semibold text-gray-700">
          {rating.toFixed(1)}
        </span>
      )}
      {count !== undefined && count > 0 && (
        <span className="text-xs text-gray-400">({count})</span>
      )}
    </div>
  );
}