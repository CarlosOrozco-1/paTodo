import type { Offer } from '@/types/offer.types';
import { OfferCard } from './OfferCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { HandCoins, Radar } from 'lucide-react';

interface OfferListProps {
  offers: Offer[];
  showActions?: boolean;
  onAccept?: (offerId: string) => void;
  onReject?: (offerId: string) => void;
  acceptingId?: string | null;
}

export function OfferList({
  offers,
  showActions = false,
  onAccept,
  onReject,
  acceptingId = null,
}: OfferListProps) {
  if (offers.length === 0) {
    if (showActions) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-emerald-50/40 px-6 py-10 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-200/30 blur-2xl animate-blob" />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl animate-blob" style={{ animationDelay: '-3.5s' }} />

          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-brand-200/60 ring-1 ring-brand-100">
            <Radar className="h-7 w-7 text-brand-600 animate-pulse-soft" />
          </div>
          <h3 className="mt-4 text-sm font-black text-gray-900">Buscando profesionales…</h3>
          <p className="mx-auto mt-1 max-w-xs text-xs text-gray-500 leading-relaxed">
            Publicamos tu solicitud a los especialistas cercanos. En cuanto llegue la primera oferta la verás aquí al instante.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      );
    }
    return (
      <EmptyState
        title="Aún no hay ofertas"
        description="Cuando los profesionales hagan ofertas, las verás aquí."
        icon={<HandCoins className="h-8 w-8" />}
      />
    );
  }

  const sorted = [...offers].sort(
    (a, b) => a.price - b.price || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-3">
      {sorted.map((offer, index) => (
        <div key={offer.id} className="relative">
          {index === 0 && showActions && offer.status === 'pending' && (
            <span className="absolute -top-2 left-4 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Mejor precio
            </span>
          )}
          <OfferCard
            offer={offer}
            showActions={showActions}
            onAccept={onAccept}
            onReject={onReject}
            accepting={acceptingId === offer.id}
          />
        </div>
      ))}
    </div>
  );
}