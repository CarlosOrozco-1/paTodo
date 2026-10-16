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
  Star,
  Tag, 
  Banknote, 
  CreditCard,
  Building2,
} from 'lucide-react';
import { jobsService } from '@/api/jobs.service';
import { offersService } from '@/api/offers.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { Offer } from '@/types/offer.types';
import type { Review } from '@/types/review.types';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { OfferList } from '@/components/offers/OfferList';
import { CounterpartCard } from '@/components/jobs/CounterpartCard';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { reviewsService } from '@/api/reviews.service';
import { paymentsService } from '@/api/payments.service';
import { WorkerLocationMap } from '@/components/ui/WorkerLocationMap';
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

const NO_REVIEWS: Review[] = [];

async function fetchJobReviews(jobId: string): Promise<Review[]> {
  try {
    return await reviewsService.getAllByJob(jobId);
  } catch (error) {
    console.warn('No se pudieron cargar las reseñas del trabajo:', getErrorMessage(error));
    return NO_REVIEWS;
  }
}

export function JobDetailClient() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewsState, setReviewsState] = useState<{ jobId: string; items: Review[] } | null>(null);

  // --- ESTADOS PARA LA SIMULACIÓN DEL PAGO ---
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'demo_card' | 'demo_cash' | 'demo_bank'>('demo_card');
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Estados para los datos de la tarjeta
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Estado para la transferencia
  const [transferReference, setTransferReference] = useState('');
  // -------------------------------------------

  const refreshProfile = useAuthStore((state) => state.refreshProfile);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) return;
      try {
        const [jobData, offersData, cats] = await Promise.all([
          jobsService.getById(id),
          offersService.getAllByJob(id),
          categoriesService.getAll(),
        ]);
        if (cancelled) return;
        setJob(jobData);
        setOffers(offersData);
        setCategory(cats.find((c) => c.id === jobData.details.categoryId) || null);
      } catch {
        if (!cancelled) setJob(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void fetchJobReviews(id).then((items) => {
      if (!cancelled) setReviewsState({ jobId: id, items });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const jobReviews = reviewsState && reviewsState.jobId === id ? reviewsState.items : NO_REVIEWS;
  const loadingReviews = !id || reviewsState?.jobId !== id;
  const hasReviewed = jobReviews.some(
    (review) => review.reviewerId === useAuthStore.getState().user?.id,
  );

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

  // --- PAGO SIMULADO VÍA API (el servidor valida, calcula comisión y notifica) ---
  const handleProcessPayment = async () => {
    // Validar datos de tarjeta
    if (paymentMethod === 'demo_card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15 || cleanCard.length > 16) {
        toast('error', 'El número de tarjeta debe tener 15 o 16 dígitos.');
        return;
      }
      if (cardExpiry.length < 5) {
        toast('error', 'La fecha de expiración debe ser válida (MM/AA).');
        return;
      }
      if (cardCvv.length < 3 || cardCvv.length > 4) {
        toast('error', 'El código de seguridad (CVV) debe tener 3 o 4 dígitos.');
        return;
      }
    }

    // Validar transferencia
    if (paymentMethod === 'demo_bank') {
      if (transferReference.length < 4) {
         toast('error', 'Por favor, ingresa un número de boleta válido.');
         return;
      }
    }

    setProcessingPayment(true);
    try {
      if (!id) return;
      const receipt = await paymentsService.create(id, paymentMethod);
      // Releer el trabajo: el servidor ya asoció job.payment en la transacción.
      const fresh = await jobsService.getById(id);
      setJob(
        fresh.payment
          ? fresh
          : {
              ...fresh,
              payment: {
                ...receipt,
                amount: job?.pricing.proposedPrice ?? receipt.amount,
              },
            },
      );

      toast('success', '¡Pago procesado con éxito!');
      setPaymentOpen(false);
      setReviewOpen(true);
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleReview = async (data: Parameters<typeof reviewsService.create>[1]) => {
    try {
      await reviewsService.create(id!, { ...data, revieweeId: job?.workerId ?? '' });
      toast('success', 'Gracias por tu reseña');
      setReviewOpen(false);
      if (id) setReviewsState({ jobId: id, items: await fetchJobReviews(id) });
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
  const isPaid = job.payment?.status === 'paid';

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

                {job.workerId && (
                  <CounterpartCard
                    userId={job.workerId}
                    title="Profesional asignado"
                    jobId={job.id}
                  />
                )}
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

                {/* --- MÉTODO DE PAGO  --- */}
                {(job.status === 'completed' || isPaid) && job.payment && (
                  <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-1">
                      Método de pago
                    </p>
                    <p className="text-sm font-bold text-white flex justify-center items-center gap-1.5">
                      {job.payment.method === 'demo_cash' ? (
                        <><Banknote className="h-4 w-4 text-emerald-300" /> Pago en Efectivo</>
                      ) : job.payment.method === 'demo_card' ? (
                        <><CreditCard className="h-4 w-4 text-emerald-300" /> Tarjeta de Crédito</>
                      ) : (
                        <><Building2 className="h-4 w-4 text-emerald-300" /> Transferencia</>
                      )}
                    </p>
                  </div>
                )}
                {/* ------------------------------ */}
              </div>

              {/* Estado / Finalizar / Pagar */}
              <div className="border-t border-white/20 pt-5">
                {job.status === 'in_progress' ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur shadow-inner">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                      </span>
                    </div>
                    <p className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
                      Trabajo en curso
                    </p>
                    <p className="mt-1.5 text-[11px] text-emerald-200/90 leading-tight">
                      El profesional está realizando el servicio. Podrás pagar y calificarlo en cuanto él marque el trabajo como terminado.
                    </p>
                  </div>
                ) : job.status === 'completed' && !isPaid ? (
                  <Button
                    onClick={() => setPaymentOpen(true)}
                    fullWidth
                    size="lg"
                    className="rounded-xl bg-white font-bold text-brand-800 shadow-lg hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Pagar y Calificar
                  </Button>
                ) : job.status === 'completed' && isPaid && !hasReviewed ? (
                  <Button
                    onClick={() => setReviewOpen(true)}
                    fullWidth
                    size="lg"
                    className="rounded-xl bg-white font-bold text-brand-800 shadow-lg hover:bg-emerald-50"
                  >
                    <Star className="mr-2 h-5 w-5 fill-brand-800 text-brand-800" />
                    Calificar al profesional
                  </Button>
                ) : job.status === 'completed' ? (
                  <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5 text-center backdrop-blur">
                    <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Trabajo completado y calificado
                    </p>
                  </div>
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

              <Link to={`/mensajes?jobId=${job.id}`} className="shrink-0">
                <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Chatear con el profesional
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {job.workerId && ['accepted', 'assigned', 'in_progress'].includes(job.status) && (
        <WorkerLocationMap
          jobId={job.id}
          destination={{
            latitude: job.location.coordinates[1],
            longitude: job.location.coordinates[0],
            label: job.location.address || 'Destino del trabajo',
          }}
        />
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

      {/* Reseñas del trabajo */}
      {job.status === 'completed' && job.workerId && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Reseña de este trabajo
              </span>
            }
            subtitle={
              hasReviewed
                ? 'Ya calificaste al profesional en este trabajo'
                : 'Puedes calificar al profesional ahora o más adelante'
            }
            action={
              !hasReviewed ? (
                <Button
                  onClick={() => setReviewOpen(true)}
                  loading={loadingReviews}
                  size="sm"
                >
                  <Star className="mr-1.5 h-3.5 w-3.5" />
                  Calificar ahora
                </Button>
              ) : (
                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Calificado
                </Badge>
              )
            }
          />
          <CardContent>
            {loadingReviews ? (
              <Spinner size="sm" />
            ) : jobReviews.length > 0 ? (
              <div className="space-y-3">
                {jobReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    reviewerName={job.clientId === review.reviewerId ? 'Tú' : 'Profesional'}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Todavía no hay reseñas. Tu calificación ayuda a que otros usuarios confíen en este profesional.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* --- MODAL DE PAGO --- */}
      <Modal
        open={paymentOpen}
        onClose={() => !processingPayment && setPaymentOpen(false)}
        title="Resumen de Pago"
        description="Selecciona cómo deseas abonar este servicio."
        size="md"
      >
        <div className="pt-4 space-y-4 max-h-[80vh] overflow-y-auto overflow-x-hidden p-1">
          <div className="flex flex-col items-center justify-center p-6 bg-brand-50 rounded-2xl border border-brand-100">
            <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mb-1">Total a Pagar</p>
            <p className="text-4xl font-black text-brand-800">
              {job ? formatCurrency(job.pricing.proposedPrice, job.pricing.currency) : 'Q0.00'}
            </p>
          </div>

          <div className="space-y-3">
            {/* OPCIÓN: TARJETA DE CRÉDITO/DÉBITO */}
            <button
              onClick={() => setPaymentMethod('demo_card')}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all",
                paymentMethod === 'demo_card' ? "border-brand-600 bg-brand-50/50" : "border-gray-100 bg-white hover:border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", paymentMethod === 'demo_card' ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500")}>
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Tarjeta de Crédito / Débito</p>
                  <p className="text-xs text-gray-500">Paga seguro con Stripe o VisaNet</p>
                </div>
              </div>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", paymentMethod === 'demo_card' ? "border-brand-600" : "border-gray-300")}>
                {paymentMethod === 'demo_card' && <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </div>
            </button>

            {/* FORMULARIO DE TARJETA */}
            {paymentMethod === 'demo_card' && (
              <div className="px-4 py-3 space-y-4 rounded-xl border border-brand-100 bg-white animate-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Número de Tarjeta</label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={19}
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => {
                        // Solo permite números y formatea cada 4 dígitos
                        const val = e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
                        setCardNumber(val);
                      }}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                    />
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Vencimiento</label>
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => {
                        // Solo números y auto-inserta la barra '/'
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length >= 2) val = `${val.slice(0, 2)}/${val.slice(2, 4)}`;
                        setCardExpiry(val);
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CVV</label>
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => {
                        // Estrictamente solo números
                        setCardCvv(e.target.value.replace(/\D/g, ''));
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* OPCIÓN: TRANSFERENCIA BANCARIA */}
            <button
              onClick={() => setPaymentMethod('demo_bank')}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all",
                paymentMethod === 'demo_bank' ? "border-brand-600 bg-brand-50/50" : "border-gray-100 bg-white hover:border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", paymentMethod === 'demo_bank' ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500")}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Transferencia Bancaria</p>
                  <p className="text-xs text-gray-500">Banca en línea o depósito</p>
                </div>
              </div>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", paymentMethod === 'demo_bank' ? "border-brand-600" : "border-gray-300")}>
                {paymentMethod === 'demo_bank' && <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </div>
            </button>

            {/* INSTRUCCIONES Y FORMULARIO DE TRANSFERENCIA DESPLEGABLE */}
            {paymentMethod === 'demo_bank' && (
              <div className="px-4 py-3 space-y-4 rounded-xl border border-brand-100 bg-white animate-in slide-in-from-top-2">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-2">Transfiere el monto total a la siguiente cuenta:</p>
                  <div className="space-y-1">
                    <p className="text-sm"><span className="font-semibold text-gray-700">Banco:</span> Banco Industrial</p>
                    <p className="text-sm"><span className="font-semibold text-gray-700">Tipo:</span> Monetaria</p>
                    <p className="text-sm"><span className="font-semibold text-gray-700">Cuenta:</span> 123-456789-0</p>
                    <p className="text-sm"><span className="font-semibold text-gray-700">Nombre:</span> PaTodo S.A.</p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    No. de Referencia o Boleta
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="Ej: 987654321"
                    value={transferReference}
                    onChange={(e) => {
                       // Validar que solo se ingresen números en la referencia
                       setTransferReference(e.target.value.replace(/\D/g, ''));
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Ingresa solo los números de tu comprobante.</p>
                </div>
              </div>
            )}

            {/* OPCIÓN: PAGO EN EFECTIVO */}
            <button
              onClick={() => setPaymentMethod('demo_cash')}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all",
                paymentMethod === 'demo_cash' ? "border-brand-600 bg-brand-50/50" : "border-gray-100 bg-white hover:border-gray-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", paymentMethod === 'demo_cash' ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500")}>
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Pago en Efectivo</p>
                  <p className="text-xs text-gray-500">Al profesional en persona</p>
                </div>
              </div>
              <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", paymentMethod === 'demo_cash' ? "border-brand-600" : "border-gray-300")}>
                {paymentMethod === 'demo_cash' && <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </div>
            </button>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <Button
              onClick={handleProcessPayment}
              loading={processingPayment}
              fullWidth
              size="lg"
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md shadow-brand-600/20"
            >
              {processingPayment ? 'Procesando pago...' : 'Confirmar y Pagar'}
            </Button>
          </div>
        </div>
      </Modal>

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