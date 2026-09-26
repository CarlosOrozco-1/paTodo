import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Briefcase,
  CheckCircle2,
  PlusCircle,
  Wrench,
  FileText,
  Scale,
  ShieldCheck,
  Sparkles,
  MapPin,
  Calendar,
  MessageSquare,
  HandCoins,
  Send,
  Info,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { jobsService } from '@/api/jobs.service';
import { offersService } from '@/api/offers.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { StatsCard } from '@/components/admin/StatsCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { WorkflowEmptyState } from '@/components/ui/WorkflowEmptyState';
import { JOB_STATUS_STYLES } from '@/utils/constants';
import { formatCurrency, fullName, formatDate, timeAgo } from '@/utils/formatters';
import { guessZone } from '@/utils/geo';
import { cn } from '@/utils/cn';

const CLIENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En revisión',
  published: 'Recibiendo ofertas',
  assigned: 'Contratado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelada',
};

export function ClientDashboard() {
  const { user, refreshProfile } = useAuthStore();
  const notifications = useNotificationStore((s) => s.notifications);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsRes, catsRes] = await Promise.all([
          jobsService.getByClient(user!.id, { limit: 8 }),
          categoriesService.getAll(),
        ]);
        setJobs(jobsRes.items);
        const counts = await Promise.all(
          jobsRes.items.map(async (j) => {
            try {
              const offers = await offersService.getAllByJob(j.id);
              return [j.id, offers.length] as const;
            } catch {
              return [j.id, 0] as const;
            }
          }),
        );
        setOfferCounts(Object.fromEntries(counts));
        setCategories(catsRes);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const activeJobs = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'published' || j.status === 'assigned',
  ).length;

  const waitingForPros = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'published',
  ).length;

  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  const totalSpent = jobs
    .filter((j) => j.status === 'completed')
    .reduce((sum, j) => sum + j.pricing.proposedPrice, 0);

  const offersReceived = jobs.reduce(
    (sum, j) => sum + (offerCounts[j.id] ?? 0),
    0,
  );

  if (loading) return <Spinner label="Cargando tu panel de cliente..." />;

  const tipsList = [
    {
      title: 'Describe bien tu trabajo',
      text: 'Especifica detalles, medidas y fotos para recibir presupuestos más precisos.',
      icon: <FileText className="h-4 w-4 text-brand-600" />,
    },
    {
      title: 'Compara precios y tiempos',
      text: 'Analiza los plazos estimados y tarifas propuestas antes de contratar.',
      icon: <Scale className="h-4 w-4 text-brand-600" />,
    },
    {
      title: 'Revisa el perfil del profesional',
      text: 'Verifica estrellas, comentarios y experiencia previa de cada candidato.',
      icon: <ShieldCheck className="h-4 w-4 text-brand-600" />,
    },
    {
      title: 'Conversa dentro de PaTodo',
      text: 'Mantén todos los mensajes en la plataforma para mayor seguridad y respaldo.',
      icon: <MessageSquare className="h-4 w-4 text-brand-600" />,
    },
  ];

  const recentActivity = notifications.slice(0, 4).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    type: n.type,
  }));

  const activityIcon = (type: string) => {
    if (type === 'offer') return <HandCoins className="h-3.5 w-3.5 text-brand-600" />;
    if (type === 'job_status') return <Info className="h-3.5 w-3.5 text-teal-600" />;
    return <Send className="h-3.5 w-3.5 text-emerald-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Banner Superior Limpio */}
      <div className="relative overflow-hidden rounded-3xl border border-brand-100/70 bg-white p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-emerald-100/40 blur-3xl" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-brand-600">
              Panel de Cliente
            </p>
            <h1 className="mt-1.5 text-3xl font-black tracking-tight text-gray-900">
              ¡Hola, {fullName(user?.profile)}!
            </h1>
            <p className="mt-1 max-w-lg text-sm text-gray-500">
              Gestiona tus solicitudes de servicio y revisa los presupuestos recibidos
            </p>
          </div>

          <div className="shrink-0">
            <Link to="/cliente/crear-trabajo">
              <Button size="lg" className="rounded-xl bg-brand-600 font-bold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700">
                <PlusCircle className="mr-2 h-5 w-5" />
                Publicar un trabajo
              </Button>
            </Link>
          </div>
        </div>

        {/* Barra de notificación flotante */}
        {waitingForPros > 0 && (
          <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <p className="text-sm font-semibold text-emerald-800">
              Tienes {waitingForPros}{' '}
              {waitingForPros === 1 ? 'solicitud activa recibiendo propuestas' : 'solicitudes activas recibiendo propuestas'}
            </p>
            <span className="ml-auto hidden text-xs font-bold text-emerald-700 sm:block">
              {offersReceived} {offersReceived === 1 ? 'propuesta' : 'propuestas'} recibidas
            </span>
          </div>
        )}
      </div>

      {/* Tarjetas de Métricas Superiores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Solicitudes activas"
          value={activeJobs}
          icon={<Briefcase className="h-6 w-6" />}
          iconClassName="bg-brand-50 text-brand-700 shadow-inner"
          badge={`${offersReceived} propuestas`}
          progress={jobs.length ? (activeJobs / jobs.length) * 100 : 0}
          progressLabel="en curso"
          className="border border-brand-100"
        />
        <StatsCard
          label="Trabajos completados"
          value={completedJobs}
          icon={<CheckCircle2 className="h-6 w-6" />}
          iconClassName="bg-emerald-50 text-emerald-700 shadow-inner"
          badge="Historial"
          progress={jobs.length ? (completedJobs / jobs.length) * 100 : 0}
          progressLabel="de tus solicitudes"
          className="border border-emerald-100"
        />
        <StatsCard
          label="Total invertido"
          value={formatCurrency(totalSpent, 'GTQ')}
          icon={<span className="text-lg font-black text-amber-700">Q</span>}
          iconClassName="bg-amber-50 text-amber-700 shadow-inner"
          badge="Acumulado"
          className="border border-amber-100"
        />
        <StatsCard
          label="En revisión"
          value={jobs.filter((j) => j.status === 'pending').length}
          icon={<FileText className="h-6 w-6" />}
          iconClassName="bg-teal-50 text-teal-700 shadow-inner"
          badge="Por decidir"
          progress={jobs.length ? (jobs.filter((j) => j.status === 'pending').length / jobs.length) * 100 : 0}
          progressLabel="esperando tu decisión"
          className="border border-teal-100"
        />
      </div>

      {/* Contenido Principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tabla de solicitudes recientes */}
        <Card className="lg:col-span-2 border border-gray-100 shadow-sm">
          <CardHeader
            title="Tus últimas solicitudes"
            subtitle="Revisa el estado de tus proyectos y las ofertas recibidas"
            action={
              <Link to="/cliente/mis-trabajos">
                <Button variant="ghost" size="sm" className="font-semibold text-brand-600">
                  Ver todas
                </Button>
              </Link>
            }
          />
          <CardContent className="pt-1">
            {jobs.length === 0 ? (
              <WorkflowEmptyState
                icon={<Wrench className="h-9 w-9 text-brand-700" />}
                title="Aún no has publicado trabajos"
                description="Publica tu primera solicitud y empieza a recibir propuestas de profesionales calificados."
                primaryAction={
                  <Link to="/cliente/crear-trabajo">
                    <Button className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700">
                      Publicar un trabajo
                    </Button>
                  </Link>
                }
                steps={[
                  { title: 'Describe tu necesidad', description: 'Detalla el servicio, medidas y tu disponibilidad.' },
                  { title: 'Recibe propuestas', description: 'Los profesionales responderán con precio y tiempo.' },
                  { title: 'Contrata al indicado', description: 'Compara perfiles y acepta la mejor oferta.' },
                ]}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[
                        'Solicitud',
                        'Categoría',
                        'Ubicación',
                        'Fecha public.',
                        'Ofertas',
                        'Presupuesto',
                        'Estado',
                        '',
                      ].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-gray-400"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {jobs.map((job) => {
                      const category = categoryMap.get(job.details.categoryId);
                      const offersCount = offerCounts[job.id] ?? 0;

                      return (
                        <tr key={job.id} className="group transition-colors hover:bg-brand-50/30">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                                style={{ backgroundColor: category?.color || '#0d9488' }}
                              >
                                {category?.name?.charAt(0) || 'S'}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-gray-900 group-hover:text-brand-700 transition-colors">
                                  {job.details.title}
                                </p>
                                <p className="truncate text-[11px] text-gray-400">
                                  {job.details.description.slice(0, 48)}
                                  {job.details.description.length > 48 ? '…' : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs font-semibold text-gray-600">
                            {category?.name || 'General'}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-brand-500" />
                              {guessZone(job.location.address)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-gray-500">
                            {formatDate(job.createdAt)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                                offersCount > 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : 'bg-gray-100 text-gray-500',
                              )}
                            >
                              {offersCount} {offersCount === 1 ? 'oferta' : 'ofertas'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-black text-gray-900">
                            {formatCurrency(job.pricing.proposedPrice, job.pricing.currency)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold',
                                JOB_STATUS_STYLES[job.status],
                              )}
                            >
                              {CLIENT_STATUS_LABELS[job.status] || job.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <Link
                              to={`/cliente/trabajo/${job.id}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-brand-600 transition-colors hover:bg-brand-50"
                            >
                              <Send className="h-3 w-3" />
                              Ver propuestas
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel Lateral Derecho */}
        <div className="space-y-6">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" />
                  <span>Consejos de contratación</span>
                </div>
              }
              subtitle="Obtén los mejores resultados al contratar"
            />
            <CardContent className="space-y-3 pt-1">
              {tipsList.map((tip) => (
                <div
                  key={tip.title}
                  className="rounded-2xl bg-gray-50/80 p-4 border border-gray-100 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-50/40 hover:border-brand-100 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs border border-gray-100">
                      {tip.icon}
                    </div>
                    <p className="text-xs font-bold text-gray-900">{tip.title}</p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader
              title={
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-brand-600" />
                  <span>Actividad reciente</span>
                </div>
              }
              subtitle="Alertas y novedades de tus solicitudes"
            />
            <CardContent className="pt-1">
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">
                  Aún no hay actividad reciente
                </p>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-50">
                        {activityIcon(item.type)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800">{item.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">{item.body}</p>
                        <p className="mt-0.5 text-[10px] text-gray-400">{timeAgo(item.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}