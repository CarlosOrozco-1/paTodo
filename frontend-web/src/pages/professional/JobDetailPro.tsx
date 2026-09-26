import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  HandCoins,
  MapPin,
  Tag,
  Wrench,
} from 'lucide-react';
import { jobsService } from '@/api/jobs.service';
import { categoriesService } from '@/api/categories.service';
import { offersService } from '@/api/offers.service';
import { useAuthStore } from '@/stores/authStore';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { CreateOfferDto } from '@/types/offer.types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { OfferForm } from '@/components/offers/OfferForm';
import { JobLocationMap } from '@/components/ui/JobLocationMap'; // IMPORTANTE
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { JOB_STATUS_LABELS, JOB_STATUS_STYLES } from '@/utils/constants';
import {
  formatCurrency,
  formatDate,
  timeAgo,
} from '@/utils/formatters';
import { cn } from '@/utils/cn';

export function JobDetailPro() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerOpen, setOfferOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyOffered, setAlreadyOffered] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const [jobData, cats] = await Promise.all([
          jobsService.getById(id),
          categoriesService.getAll(),
        ]);
        setJob(jobData);
        setCategory(cats.find((c) => c.id === jobData.details.categoryId) || null);
      } catch {
        setJob(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const check = async () => {
      if (!id) return;
      try {
        const offers = await offersService.getAllByJob(id);
        const user = useAuthStore.getState();
        const mine = offers.find((o) => o.workerId === user.user?.id);
        setAlreadyOffered(Boolean(mine && mine.status !== 'withdrawn'));
      } catch {
        // ignorar
      }
    };
    check();
  }, [id]);

  useEffect(() => {
    if (!job || alreadyOffered || searchParams.get('oferta') !== '1') return;
    const timer = window.setTimeout(() => setOfferOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, job, alreadyOffered]);

  const handleSubmit = async (data: Omit<CreateOfferDto, 'jobId'>) => {
    setSubmitting(true);
    try {
      await offersService.create({ ...data, jobId: id! });
      setOfferOpen(false);
      setAlreadyOffered(true);
      toast('success', '¡Oferta enviada con éxito!');
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner label="Cargando detalle del trabajo..." />;

  if (!job) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold text-gray-700">Trabajo no encontrado</p>
        <p className="mt-1 text-sm text-gray-500">Es posible que la solicitud haya sido eliminada por el cliente.</p>
        <Link to="/profesional/trabajos-disponibles" className="mt-6 inline-block">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a trabajos disponibles
          </Button>
        </Link>
      </div>
    );
  }

  const canOffer = ['pending', 'published'].includes(job.status) && !alreadyOffered;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Botón de Regreso */}
      <div>
        <Link
          to="/profesional/trabajos-disponibles"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition-colors hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a trabajos disponibles
        </Link>
      </div>

      {/* Layout Flexible Alineado (Misma Altura) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        
        {/* Detalle de la Solicitud (Columna Principal) */}
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
                    Descripción del trabajo
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-2xl border border-gray-100 min-h-[80px]">
                    {job.details.description}
                  </p>
                </div>

                {/* SEGUIMIENTO DE UBICACIÓN Y MAPA */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Ubicación y Desplazamiento
                  </h3>
               <JobLocationMap 
    origin={{ 
      addressText: useAuthStore.getState().user?.contact?.address?.city || 'Ciudad de Guatemala', 
      label: 'Ubicación del Profesional' 
    }} 
    destination={{ 
      addressText: job?.location?.address || 'Ciudad de Guatemala', 
      label: 'Domicilio del Cliente (Destino)' 
    }} 
    className="h-64 w-full"
  />
                </div>
              </CardContent>
            </div>

            {/* Ficha Técnica al Final */}
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
                  <span>Especialidad: {category?.name || 'General'}</span>
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

        {/* Tarjeta de Presupuesto */}
        <div className="w-full lg:w-80 shrink-0">
          <Card className="h-full border border-gray-100 shadow-sm flex flex-col justify-between">
            <CardContent className="p-6 flex flex-col justify-between h-full space-y-6">
              
              <div className="text-center pt-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Presupuesto del cliente
                </p>
                <p className="text-3xl font-black text-gray-900 mt-2 tracking-tight">
                  {formatCurrency(job.pricing.proposedPrice, job.pricing.currency)}
                </p>
                <span className="inline-block mt-2 rounded-full bg-gray-100 px-3.5 py-1 text-xs font-semibold text-gray-600 border border-gray-200/50">
                  {job.pricing.priceType === 'fixed' ? 'Precio fijo' : 'Precio negociable'}
                </span>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-100">
                {alreadyOffered ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <p className="font-bold text-xs uppercase tracking-wide">
                        Oferta enviada
                      </p>
                    </div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Ya has enviado tu propuesta. El cliente te notificará si la acepta.
                    </p>
                  </div>
                ) : canOffer ? (
                  <>
                    <Button 
                      onClick={() => setOfferOpen(true)} 
                      fullWidth 
                      size="lg" 
                      className="shadow-lg shadow-brand-600/20 py-3.5"
                    >
                      <HandCoins className="mr-2 h-5 w-5" />
                      Hacer una oferta
                    </Button>
                    <p className="text-[11px] text-center text-gray-400">
                      Puedes proponer tu propio precio o plazo estimado.
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl bg-gray-50 p-4 text-center border border-gray-200/60">
                    <Wrench className="mx-auto mb-1.5 h-6 w-6 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-600">
                      Esta solicitud ya no acepta más ofertas.
                    </p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Enviar propuesta de servicio"
        description="El cliente evaluará tu precio, tiempo estimado y mensaje antes de contratar."
        size="md"
      >
        <div className="pt-2">
          <OfferForm
            onSubmit={handleSubmit}
            submitting={submitting}
            jobProposedPrice={job.pricing.proposedPrice}
            jobCurrency={job.pricing.currency}
          />
        </div>
      </Modal>
    </div>
  );
}