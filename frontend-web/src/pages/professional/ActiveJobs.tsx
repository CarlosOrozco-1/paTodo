import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Calendar, 
  Briefcase, 
  Sparkles 
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

export function ActiveJobs() {
  const { user, refreshProfile } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reviewJob, setReviewJob] = useState<Job | null>(null);

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

  const handleComplete = async (jobId: string) => {
    setCompletingId(jobId);
    try {
      const updated = await jobsService.complete(jobId);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      setReviewJob(updated);
      toast('success', '¡Excelente trabajo! Marcado como completado.');
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
      setReviewJob(null);
      await refreshProfile();
    } catch (error) {
      toast('error', getErrorMessage(error));
      throw error;
    }
  };

  if (loading) return <Spinner label="Cargando tus trabajos activos..." />;

  // Métricas rápidas calculadas
  const inProgressJobs = jobs.filter((j) => j.status === 'in_progress');
  const completedJobsCount = jobs.filter((j) => j.status === 'completed').length;
  const totalActiveValue = jobs.reduce((sum, job) => {
    const offer = offers.find((o) => o.jobId === job.id && o.status === 'accepted');
    return sum + (offer?.price ?? job.pricing.proposedPrice);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
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

      {/* Tarjetas de Resumen Superior */}
      {jobs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4 shadow-xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Total Proyectos</p>
              <p className="text-xl font-bold text-teal-900">{jobs.length}</p>
            </div>
          </div>

          {/* Tarjeta de Ganancias  */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 shadow-xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 shadow-inner border border-emerald-100">
              <span className="text-lg font-black">Q</span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Ganancias</p>
              <p className="text-xl font-bold text-emerald-900">
                {formatCurrency(totalActiveValue, 'GTQ')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 shadow-xs flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Completados</p>
              <p className="text-xl font-bold text-amber-900">{completedJobsCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Trabajos */}
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
                            <span className="text-xs text-gray-400">• {category?.name || 'General'}</span>
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
                    {/* Descripción */}
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/60 p-3 rounded-2xl border border-gray-100">
                      {job.details.description}
                    </p>

                    {/* Ficha Técnica: Ubicación y Fechas */}
                    <div className="grid gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-2 text-gray-700 font-medium">
                        <MapPin className="h-4 w-4 text-brand-600 shrink-0" />
                        <span className="truncate">{job.location.address || 'Dirección no especificada'}</span>
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

                {/* Pie con Acción de Finalizado */}
                {['accepted', 'assigned', 'in_progress'].includes(job.status) ? (
                  <div className="p-5 pt-0">
                    <div className="flex justify-end border-t border-gray-100 pt-3">
                      <Button
                        onClick={() => handleComplete(job.id)}
                        loading={completingId === job.id}
                        className="shadow-md shadow-emerald-600/20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Marcar completado
                      </Button>
                    </div>
                  </div>
                ) : job.status === 'completed' ? (
                  <div className="p-5 pt-0">
                    <div className="flex justify-end border-t border-gray-100 pt-3">
                      <Button
                        onClick={() => setReviewJob(job)}
                        className="bg-brand-600 text-white hover:bg-brand-700 rounded-xl"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Calificar al cliente
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

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
    </div>
  );
}