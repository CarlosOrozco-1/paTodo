import { Check, X, Clock } from 'lucide-react';
import type { Offer } from '@/types/offer.types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { OFFER_STATUS_LABELS, OFFER_STATUS_STYLES } from '@/utils/constants';
import { formatCurrency, formatEstimatedTime, timeAgo } from '@/utils/formatters';

interface OfferCardProps {
  offer: Offer;
  showActions?: boolean;
  onAccept?: (offerId: string) => void;
  onReject?: (offerId: string) => void;
  accepting?: boolean;
}

export function OfferCard({
  offer,
  showActions = false,
  onAccept,
  onReject,
  accepting = false,
}: OfferCardProps) {
  const isPending = offer.status === 'pending';

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar
              name={offer.workerSnapshot.name}
              src={offer.workerSnapshot.avatarUrl || undefined}
              size="md"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {offer.workerSnapshot.name}
              </p>
              <div className="mt-0.5">
                <StarRating
                  rating={offer.workerSnapshot.rating}
                  count={offer.workerSnapshot.completedJobs}
                />
              </div>
            </div>
          </div>
        }
        action={
          <Badge className={OFFER_STATUS_STYLES[offer.status]}>
            {OFFER_STATUS_LABELS[offer.status] || offer.status}
          </Badge>
        }
      />
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Precio</p>
            <p className="text-lg font-bold text-brand-700">
              {formatCurrency(offer.price, offer.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Tiempo estimado</p>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
              <Clock className="h-3.5 w-3.5" />
              {formatEstimatedTime(offer.estimatedTime)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Enviada</p>
            <p className="text-sm font-medium text-gray-700">
              {timeAgo(offer.createdAt)}
            </p>
          </div>
        </div>

        {offer.message && (
          <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            {offer.message}
          </p>
        )}

        {showActions && isPending && (
          <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
            <Button
              size="sm"
              onClick={() => onAccept?.(offer.id)}
              loading={accepting}
              className="flex-1"
            >
              <Check className="h-4 w-4" />
              Aceptar oferta
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject?.(offer.id)}
              className="flex-1 text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}