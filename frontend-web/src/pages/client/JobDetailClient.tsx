import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Crown,
  MapPin,
  MessageSquare,
  Tag,
} from 'lucide-react';
import { jobsService } from '@/api/jobs.service';
import { offersService } from '@/api/offers.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { Offer } from '@/types/offer.types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OfferList } from '@/components/offers/OfferList';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { reviewsService } from '@/api/reviews.service';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_STYLES,
  OFFER_STATUS_LABELS,
} from '@/utils/constants';
import { formatCurrency, formatDate, timeAgo } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export function JobDetailClient() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [completing, setCompleting] = useState(false);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const [jobData, offersData, cats, reviews] = await Promise.all([
          jobsService.getById(id),
          offersService.getAllByJob(id),
          categoriesService.getAll(),
          reviewsService.getAllByJob(id),
        ]);
        setJob(jobData);
        setOffers(offersData);
        setCategory(cats.find((c) => c.id === jobData.details.categoryId) || null);
        setHasReviewed(reviews.some((review) => review.reviewerId === useAuthStore.getState().user?.id));
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAccept = async (offerId: string) => {
    setAcceptingId(offerId);
    try {
      const updatedOffer = await offersService.accept(offerId);
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offerId ? updatedOffer : { ...o, status: 'rejected' },
        ),
      );
      await jobsService.assign(id!, offerId);
      const updatedJob = await jobsService.getById(id!);
      setJob(updatedJob);
      toast('success', 'Oferta aceptada. El profesional ha sido notificado.');
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setAcceptingId(null);
    }
  };

  const handleReject = async (offerId: string) => {
    try {
      const updatedOffer = await offersService.reject(offerId);
      setOffers((prev) => prev.map((o) => (o.id === offerId ? updatedOffer : o)));
      toast('info', 'Oferta rechazada');
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const updated = await jobsService.complete(id!);
      setJob(updated);
      setReviewOpen(true);
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setCompleting(false);
    }
  };

  const handleReview = async (data: Parameters<typeof reviewsService.create>[1]) => {
    try {
      await reviewsService.create(id!, { ...data, revieweeId: job?.workerId ?? '' });
      toast('success', 'Gracias por tu reseña');
      setReviewOpen(false);
      setHasReviewed(true);
      await refreshProfile();
    } catch (error) {
      toast('error', getErrorMessage(error));
      throw error;
    }
  };

  if (loading) return <Spinner label="Cargando detalle del trabajo..." />;

  if (!job) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-gray-700">Trabajo no encontrado</p>
        <p className="mt-1 text-sm text-gray-500">Es posible que este proyecto haya sido eliminado o no exista.</p>
        <Link to="/cliente/mis-trabajos" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mis trabajos
          </Button>
        </Link>
      </div>
    );
  }

  const acceptedOffer = offers.find((o) => o.status === 'accepted');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Botón de Regreso */}
      <div>
        <Link
          to="/cliente/mis-trabajos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis trabajos
        </Link>
      </div>

      {/* Grid Principal Alineado */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        
        {/* Detalle de la Solicitud (Columna Izquierda) */}
        <div className="flex-1">
          <Card className="h-full border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between">
            <div>
              <CardHeader
                title={
                  <div className="flex items-start gap-3.5">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md"
                      style={{ backgroundColor: category?.color || '#0d9488' }}
                    >
                      {category?.name?.charAt(0) || 'S'}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-gray-900 leading-snug">
                        {job.details.title}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge className={cn('text-xs font-semibold', JOB_STATUS_STYLES[job.status])}>
                          {JOB_STATUS_LABELS[job.status]}
                        </Badge>
                        <span className="text-xs font-medium text-gray-500">
                          • {category?.name || 'Sin categoría'}
                        </span>
                      </div>
                    </div>
                  </div>
                }
              />

              <CardContent className="space-y-6 pt-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Descripción de tu solicitud
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-2xl border border-gray-100 min-h-[80px]">
                    {job.details.description}
                  </p>
                </div>
              </CardContent>
            </div>

            {/* Ficha Técnica */}
            <div className="p-6 pt-0">
              <div className="grid gap-3 rounded-2xl bg-gray-50 p-4 border border-gray-100/80 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2.5 text-gray-600">
                  <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="truncate">{job.location.address || 'Sin dirección especificada'}</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-600">
                  <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" />
                  <span>Publicado {timeAgo(job.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2.5 text-gray-600">
                  <Tag className="h-4 w-4 shrink-0 text-brand-600" />
                  <span>Categoría: {category?.name || 'General'}</span>
                </div>
                {job.scheduledFor && (
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <Clock className="h-4 w-4 shrink-0 text-brand-600" />
                    <span>Para: {formatDate(job.scheduledFor)}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Tarjeta de Presupuesto (Columna Derecha) */}
        <div className="w-full lg:w-80 shrink-0">
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-brand-900/20 bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-700 p-6 text-white shadow-xl shadow-brand-900/20">
            <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/25 blur-3xl animate-blob" />
            <div className="pointer-events-none absolute -bottom-12 -left-10 h-44 w-44 rounded-full bg-brand-300/25 blur-3xl animate-blob" style={{ animationDelay: '-3.5s' }} />

            <div className="relative space-y-6">
              {/* Presupuesto propuesto */}
              <div className="text-center pt-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">
                  Tu presupuesto
                </p>
                <p className="mt-1.5 text-3xl font-black tracking-tight">
                  {formatCurrency(job.pricing.proposedPrice, job.pricing.currency)}
                </p>
                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-[11px] font-bold backdrop-blur">
                  <Tag className="h-3 w-3 text-emerald-300" />
                  {job.pricing.priceType === 'fixed' ? 'Precio fijo' : 'Precio negociable'}
                </span>
              </div>

              {/* Estado / Finalizar */}
              <div className="border-t border-white/20 pt-5">
                {job.status === 'in_progress' ? (
                  <Button
                    onClick={handleComplete}
                    loading={completing}
                    fullWidth
                    size="lg"
                    className="rounded-xl bg-white font-bold text-brand-800 shadow-lg hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Marcar como completado
                  </Button>
                ) : job.status === 'completed' && !hasReviewed ? (
                  <Button
                    onClick={() => setReviewOpen(true)}
                    fullWidth
                    size="lg"
                    className="rounded-xl bg-white font-bold text-brand-800 shadow-lg hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Calificar al profesional
                  </Button>
                ) : job.status === 'pending' || job.status === 'published' ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '0ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '150ms' }} />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="mt-2.5 text-xs font-bold text-emerald-100">
                      Esperando respuesta de profesionales
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-200/85">
                      Te avisaremos en cuanto lleguen nuevas ofertas
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5 text-center backdrop-blur">
                    <p className="text-xs font-semibold text-emerald-100">
                      Estado: <strong className="uppercase">{JOB_STATUS_LABELS[job.status]}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Oferta Aceptada (Si Aplica) */}
      {acceptedOffer && (
        <Card className="border border-emerald-200/80 bg-emerald-50/40 shadow-xs">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-base">
                      {acceptedOffer.workerSnapshot.name}
                    </p>
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">
                      {OFFER_STATUS_LABELS[acceptedOffer.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Precio acordado: <strong>{formatCurrency(acceptedOffer.price, acceptedOffer.currency)}</strong>
                  </p>
                </div>
              </div>

              <Link to="/mensajes" className="shrink-0">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chatear con el profesional
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Ofertas Recibidas */}
      <Card className={cn("border border-gray-100 shadow-sm", job.status === 'assigned' && 'pointer-events-none opacity-60')}>
        <CardHeader
          title="Ofertas recibidas"
          subtitle={
            job.status === 'assigned' || job.status === 'in_progress'
              ? 'Ya has aceptado una oferta para este trabajo'
              : 'Evalúa las propuestas de los profesionales disponibles'
          }
          action={
            <Badge className="bg-brand-50 text-brand-700 border border-brand-100 font-bold">
              {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
            </Badge>
          }
        />
        <CardContent className="pt-2">
          <OfferList
            offers={offers}
            showActions={job.status === 'pending' || job.status === 'published'}
            onAccept={handleAccept}
            onReject={handleReject}
            acceptingId={acceptingId}
          />
        </CardContent>
      </Card>

      {/* Modal para Dejar Reseña */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Califica el servicio recibido"
        description="Tu opinión es clave para mantener la calidad de la plataforma."
        size="md"
      >
        <div className="pt-2">
          <ReviewForm onSubmit={handleReview} />
        </div>
      </Modal>
    </div>
  );
}