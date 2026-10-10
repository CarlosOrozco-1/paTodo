import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Calendar, 
  MessageSquare,
  Star,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { offersService } from '@/api/offers.service';
import { jobsService } from '@/api/jobs.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { Offer } from '@/types/offer.types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { WorkflowEmptyState } from '@/components/ui/WorkflowEmptyState';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_STYLES,
} from '@/utils/constants';
import { formatCurrency, formatEstimatedTime, formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/ui/Modal';
import { ReviewForm } from '@/components/reviews/ReviewForm';
import { reviewsService } from '@/api/reviews.service';
import { JobLocationMap } from '@/components/ui/JobLocationMap';

export function ActiveJobs() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para finalización con código PIN
  const [jobToComplete, setJobToComplete] = useState<Job | null>(null);
  const [securityCode, setSecurityCode] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);
  
  const [reviewJob, setReviewJob] = useState<Job | null>(null);
  const [reviewedJobIds, setReviewedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const mine = await reviewsService.getAllByUser(user.id);
        if (cancelled) return;
        setReviewedJobIds(new Set(mine.map((review) => review.jobId)));
      } catch {
        if (!cancelled) setReviewedJobIds(new Set());
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const load = async () => {
      try {
        const [offersRes, cats] = await Promise.all([
          offersService.getAllByWorker(user!.id, { limit: 100 }),
          categoriesService.getAll(),
        ]);
        setOffers(offersRes.items);

        const accepted = offersRes.items.filter(
          (o) => o.status === 'accepted' || o.status === 'countered',
        );
        const jobIds = [...new Set(accepted.map((o) => o.jobId))];
        const jobsData = await Promise.all(jobIds.map((jid) => jobsService.getById(jid)));
        setJobs(jobsData.filter((j) => j.status !== 'cancelled'));
        setCategories(cats);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const confirmComplete = async () => {
    if (!jobToComplete) return;
    if (!securityCode.trim() || securityCode.length < 4) {
      toast('error', 'Por favor ingresa un código de seguridad válido de 4 dígitos.');
      return;
    }

    setCompletingId(jobToComplete.id);
    try {
      const updated = await jobsService.complete(jobToComplete.id);
      setJobs((prev) => prev.map((j) => (j.id === jobToComplete.id ? updated : j)));
      setJobToComplete(null);
      setSecurityCode('');
      setReviewJob(updated);
      toast('success', '¡Excelente trabajo! Código verificado y marcado como completado.');
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setCompletingId(null);
    }
  };

  const handleReview = async (data: Parameters<typeof reviewsService.create>[1]) => {
    if (!reviewJob) return;
    try {
      await reviewsService.create(reviewJob.id, { ...data, revieweeId: reviewJob.clientId });
      toast('success', 'Gracias por calificar al cliente');
      setReviewedJobIds((prev) => new Set(prev).add(reviewJob.id));
      setReviewJob(null);
      await refreshProfile();
    } catch (error) {
      toast('error', getErrorMessage(error));
      throw error;
    }
  };

  if (loading) return <Spinner label="Cargando tus trabajos activos..." />;

  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Trabajos Activos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los servicios en curso que han sido contratados por tus clientes
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          {inProgressJobs.length} {inProgressJobs.length === 1 ? 'trabajo en curso' : 'trabajos en curso'}
        </span>
      </div>

      {jobs.length === 0 ? (
        <WorkflowEmptyState
          icon={<CheckCircle2 className="h-9 w-9 text-brand-700" />}
          title="No tienes trabajos activos"
          description="Cuando un cliente acepte una de tus propuestas, el proyecto aparecerá automáticamente aquí para que lo gestiones."
          primaryAction={
            <Link to="/profesional/trabajos-disponibles">
              <Button className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700">
                Explorar trabajos
              </Button>
            </Link>
          }
          steps={[
            { title: 'Explora oportunidades', description: 'Revisa trabajos disponibles en tu zona y categoría.' },
            { title: 'Envía propuestas atractivas', description: 'Precio justo y tiempo claro aumentan tus posibilidades.' },
            { title: 'Gestiona tus servicios', description: 'Aquí verás los proyectos aceptados y podrás marcarlos como completados.' },
          ]}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {jobs.map((job) => {
            const category = categoryMap.get(job.details.categoryId);
            const myOffer = offers.find(
              (o) => o.jobId === job.id && (o.status === 'accepted' || o.status === 'countered'),
            );
            const canNavigate =
              job.workerId === user?.id &&
              ['accepted', 'assigned', 'in_progress'].includes(job.status);
            
            const workerCoordinates =
              user?.location?.coordinates ??
              user?.availability.serviceArea.center?.coordinates;

            const destination = {
              longitude: job.location.coordinates?.[0],
              latitude: job.location.coordinates?.[1],
              addressText: job.location.address,
              label: job.location.address || 'Destino del trabajo',
            };

            return (
              <Card 
                key={job.id} 
                className="overflow-hidden border border-gray-100 shadow-sm transition-all hover:border-gray-200 hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <CardHeader
                    title={
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-xs"
                          style={{ backgroundColor: category?.color || '#0d9488' }}
                        >
                          {category?.name?.charAt(0) || 'S'}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 text-base leading-snug truncate">
                            {job.details.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge className={cn('text-[10px] font-semibold py-0.5 px-2', JOB_STATUS_STYLES[job.status])}>
                              {JOB_STATUS_LABELS[job.status] || job.status}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {category?.name || 'General'}
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                    action={
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-gray-900 tracking-tight">
                          {formatCurrency(
                            myOffer?.price ?? job.pricing.proposedPrice,
                            myOffer?.currency ?? job.pricing.currency,
                          )}
                        </p>
                        {myOffer && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatEstimatedTime(myOffer.estimatedTime)}
                          </span>
                        )}
                      </div>
                    }
                  />

                  <CardContent className="space-y-4 pt-2">
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                      {job.details.description}
                    </p>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <Navigation className="h-4 w-4 text-emerald-700" />
                          Ruta de desplazamiento
                        </span>

                        {canNavigate && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/profesional/navegacion/${job.id}`)}
                            className="h-8 shrink-0 border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
                          >
                            <Navigation className="h-3.5 w-3.5 mr-1.5" />
                            Empezar ruta
                          </Button>
                        )}
                      </div>
                      
                      {/* Vista previa estática del mapa en la tarjeta */}
                      <JobLocationMap
                        origin={{
                          ...(workerCoordinates
                            ? { lng: workerCoordinates[0], lat: workerCoordinates[1] }
                            : { addressText: user?.contact.address?.city || 'Ciudad de Guatemala' }),
                          label: 'Tu ubicación (Origen)',
                        }}
                        destination={destination}
                        className="h-44 w-full rounded-xl border border-gray-100 overflow-hidden"
                      />
                    </div>

                    <div className="grid gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2 text-gray-700 font-medium">
                        <MapPin className="h-4 w-4 text-brand-600 shrink-0" />
                        <span className="truncate">
                          {destination.addressText || 'Dirección no especificada'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-gray-400 text-[11px] pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          Publicado: {formatDate(job.createdAt)}
                        </span>
                        {job.scheduledFor && (
                          <span className="flex items-center gap-1 text-brand-700 font-semibold">
                            <Clock className="h-3.5 w-3.5 text-brand-600" />
                            Programado: {formatDate(job.scheduledFor)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Acciones de Finalización */}
                {['accepted', 'assigned', 'in_progress'].includes(job.status) ? (
                  <div className="p-5 pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                      <Link
                        to={`/mensajes?jobId=${job.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-brand-700"
                      >
                        <MessageSquare className="h-4 w-4 text-brand-600" />
                        Contactar al cliente
                      </Link>
                      <Button
                        onClick={() => {
                          setJobToComplete(job);
                          setSecurityCode('');
                        }}
                        className="shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Marcar completado
                      </Button>
                    </div>
                  </div>
                ) : job.status === 'completed' ? (
                  <div className="p-5 pt-0">
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                      {reviewedJobIds.has(job.id) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Trabajo completado y calificado
                        </span>
                      ) : (
                        <Button
                          onClick={() => setReviewJob(job)}
                          className="bg-brand-600 text-white hover:bg-brand-700 rounded-xl"
                        >
                          <Star className="mr-2 h-4 w-4" />
                          Calificar al cliente
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {/* --- CALIFICAR AL CLIENTE --- */}
      <Modal
        open={Boolean(reviewJob)}
        onClose={() => setReviewJob(null)}
        title="Califica al cliente"
        description="Tu opinión ayuda a construir una comunidad de confianza."
        size="md"
      >
        <div className="pt-2">
          <ReviewForm onSubmit={handleReview} />
        </div>
      </Modal>


      {/* --- CÓDIGO DE SEGURIDAD PARA COMPLETAR --- */}
      <Modal
        open={Boolean(jobToComplete)}
        onClose={() => {
          setJobToComplete(null);
          setSecurityCode('');
        }}
        title="Código de Seguridad"
        description="Por favor, solicita al cliente su PIN de 4 dígitos para confirmar que el trabajo fue finalizado exitosamente."
        size="sm"
      >
        <div className="pt-4 space-y-5">
          <div className="flex items-center justify-center p-6 bg-brand-50 rounded-2xl border border-brand-100">
            <ShieldCheck className="h-14 w-14 text-brand-600 mb-2" />
          </div>
          
          <div>
            <label htmlFor="securityCode" className="block text-sm font-semibold text-gray-700 mb-1">
              PIN del Cliente
            </label>
            <input
              id="securityCode"
              type="text"
              maxLength={6}
              placeholder="Ej: 1234"
              value={securityCode}
              onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-2xl tracking-widest font-bold px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setJobToComplete(null);
                setSecurityCode('');
              }}
              disabled={completingId === jobToComplete?.id}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmComplete}
              loading={completingId === jobToComplete?.id}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verificar y Completar
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}