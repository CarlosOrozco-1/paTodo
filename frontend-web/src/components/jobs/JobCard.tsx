import { MapPin, Clock, Navigation, Send, Eye } from 'lucide-react';
import type { Job } from '@/types/job.types';
import type { Category } from '@/types/category.types';
import { Link } from 'react-router';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { JOB_STATUS_LABELS, JOB_STATUS_STYLES } from '@/utils/constants';
import { formatCurrency, timeAgo, formatDate } from '@/utils/formatters';
import { guessZone } from '@/utils/geo';
import { renderCategoryIcon } from '@/utils/categoryIcons';
import { cn } from '@/utils/cn';

interface JobCardProps {
  job: Job;
  category?: Category;
  workerName?: string;
  workerAvatar?: string;
  offerCount?: number;
  to?: string;
  distanceKm?: number;
  offerCta?: boolean;
  featured?: boolean;
  className?: string;
}

export function JobCard({
  job,
  category,
  workerName,
  workerAvatar,
  offerCount,
  to,
  distanceKm,
  offerCta,
  featured,
  className,
}: JobCardProps) {
  const link = to || `/trabajo/${job.id}`;
  const categoryName = category?.name || 'Servicio';
  const isNegotiable = job.pricing.priceType === 'negotiable';
  const statusLabel =
    job.status === 'published'
      ? 'Publicado'
      : JOB_STATUS_LABELS[job.status] || job.status;

  return (
    <Card
      hoverable
      className={cn(
        'rounded-3xl border border-gray-100 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-brand-200/80',
        featured && 'border-brand-200/90 ring-1 ring-brand-100',
        className,
      )}
    >
      <div className="flex h-full flex-col p-5">
        {/* Línea superior: icono circular + título + etiquetas de estado */}
        <div className="flex items-start gap-3.5">
          <span className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50 text-emerald-600 shadow-sm">
            {renderCategoryIcon(category, 'h-5 w-5')}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold leading-snug text-gray-900">
              {job.details.title}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge
                className={cn('text-[10px] font-bold py-0.5 px-2 shrink-0', JOB_STATUS_STYLES[job.status])}
              >
                {statusLabel}
              </Badge>
              {featured && (
                <Badge className="bg-gradient-to-r from-brand-600 to-emerald-600 text-white text-[9px] font-extrabold py-0.5 px-2">
                  Destacado
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Línea media: descripción legible */}
        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-600">
          {job.details.description}
        </p>

        {/* Ubicación y distancia */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-gray-500">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="truncate font-semibold text-gray-600">
              {guessZone(job.location.address)}
            </span>
          </span>

          {distanceKm !== undefined && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-100/70 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
              <Navigation className="h-3 w-3" />
              {formatDistance(distanceKm)}
            </span>
          )}

          <span className="inline-flex shrink-0 items-center gap-1 text-gray-400">
            <Clock className="h-3 w-3" />
            {timeAgo(job.createdAt)}
          </span>
        </div>

        {/* Precio destacado en Quetzales */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-gray-100 pt-3.5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Presupuesto
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black tracking-tight text-gray-900">
                {formatCurrency(job.pricing.proposedPrice, job.pricing.currency)}
              </p>
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-gray-400">
                {categoryName}
              </span>
            </div>
          </div>
          <span
            className={cn(
              'inline-block shrink-0 rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wide border',
              isNegotiable
                ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                : 'bg-gray-100 text-gray-500 border-gray-200/60',
            )}
          >
            {isNegotiable ? 'NEGOCIABLE' : 'PRECIO FIJO'}
          </span>
        </div>

        {/* Fila de acciones */}
        {offerCta ? (
          <div className="mt-4 flex items-center gap-2.5">
            <Link
              to={link}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 transition-all duration-200 hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700 active:scale-[0.97]"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver detalles
            </Link>
            <Link
              to={`${link}?oferta=1`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-brand-600/25 transition-all duration-200 hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-600/30 active:scale-[0.97]"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar una oferta
            </Link>
          </div>
        ) : (
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3.5">
            {offerCount !== undefined && offerCount > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                {offerCount} {offerCount === 1 ? 'oferta recibida' : 'ofertas recibidas'}
              </span>
            ) : (
              <span className="text-[11px] text-gray-400">
                {timeAgo(job.createdAt)}
              </span>
            )}

            {job.scheduledFor && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700">
                <Clock className="h-3.5 w-3.5" />
                Programado: {formatDate(job.scheduledFor)}
              </span>
            )}
          </div>
        )}

        {/* Información del profesional asignado si aplica */}
        {workerName && (
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-2.5">
            <Avatar name={workerName} src={workerAvatar} size="sm" />
            <p className="text-xs font-semibold text-gray-700">{workerName}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}