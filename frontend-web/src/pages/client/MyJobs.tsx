import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  HandCoins,
  Search,
  MapPin,
  Calendar,
  MoreVertical,
  Send,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { jobsService } from '@/api/jobs.service';
import { offersService } from '@/api/offers.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { WorkflowEmptyState } from '@/components/ui/WorkflowEmptyState';
import { StatsCard } from '@/components/admin/StatsCard';
import { JOB_STATUS_STYLES } from '@/utils/constants';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { guessZone } from '@/utils/geo';
import { cn } from '@/utils/cn';

const tabs = ['all', 'published', 'offers', 'contracted', 'completed'] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  all: 'Todos',
  published: 'En revisión', // Cambié el texto para que coincida con CLIENT_STATUS_LABELS
  offers: 'Recibiendo ofertas',
  contracted: 'Contratados',
  completed: 'Completados',
};

const CLIENT_STATUS_LABELS: Record<string, string> = {
  pending: 'En revisión',
  published: 'Recibiendo ofertas',
  assigned: 'Contratado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelada',
};

const PAGE_SIZE = 6;

export function MyJobs() {
  const { user } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc'>('recent');
  const [page, setPage] = useState(1);
  const [offerCounts, setOfferCounts] = useState<Record<string, number>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsRes, catsRes] = await Promise.all([
          jobsService.getByClient(user!.id, { limit: 100 }),
          categoriesService.getAll(),
        ]);
        setJobs(jobsRes.items);
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

  const filtered = useMemo(() => {
    const result = jobs.filter((job) => {
      if (tab === 'published' && job.status !== 'pending') return false; // Nota: 'published' aquí significa "En revisión" según tus pestañas
      if (tab === 'offers' && job.status !== 'published') return false;
      if (tab === 'contracted' && !['assigned', 'in_progress'].includes(job.status)) return false;
      if (tab === 'completed' && job.status !== 'completed') return false;

      if (search) {
        const q = search.toLowerCase();
        const haystack = `${job.details.title} ${job.details.description} ${job.location.address}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.pricing.proposedPrice - b.pricing.proposedPrice;
      if (sortBy === 'price_desc') return b.pricing.proposedPrice - a.pricing.proposedPrice;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs, tab, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };

  const changeSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const changeSort = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as typeof sortBy);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        pageItems.map(async (j) => {
          try {
            const offers = await offersService.getAllByJob(j.id);
            counts[j.id] = offers.length;
          } catch {
            counts[j.id] = 0;
          }
        }),
      );
      if (!cancelled) setOfferCounts(counts);
    };
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [pageItems]);

  const activeJobs = jobs.filter(
    (j) => ['pending', 'published', 'assigned', 'in_progress'].includes(j.status),
  ).length;
  const pendingJobs = jobs.filter((j) => j.status === 'pending').length;
  // Con ofertas: Calculamos basándonos en si el trabajo está en estado 'published' (recibiendo ofertas)
  const withOffersJobs = jobs.filter((j) => j.status === 'published').length;
  const completedJobs = jobs.filter((j) => j.status === 'completed').length;

  if (loading) return <Spinner label="Cargando tus solicitudes..." />;

  const tabCounts: Record<Tab, number> = {
    all: jobs.length,
    published: jobs.filter((j) => j.status === 'pending').length,
    offers: jobs.filter((j) => j.status === 'published').length,
    contracted: jobs.filter((j) => ['assigned', 'in_progress'].includes(j.status)).length,
    completed: jobs.filter((j) => j.status === 'completed').length,
  };

  const consejos = [
    'Describe claramente el trabajo: alcance, medidas y fotos.',
    'Indica la zona y un presupuesto en Q para filtrar ofertas realistas.',
    'Compara perfiles, reputación y tiempos antes de contratar.',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis trabajos"
        subtitle="Gestiona y da seguimiento a todas tus solicitudes de servicio"
      />

      {/* Métricas Superiores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Solicitudes activas"
          value={activeJobs}
          icon={<Briefcase className="h-6 w-6" />}
          iconClassName="bg-brand-50 text-brand-700 shadow-inner"
          badge="Vigentes"
          className="border border-brand-100"
        />
        <StatsCard
          label="En revisión"
          value={pendingJobs}
          icon={<Clock className="h-6 w-6" />}
          iconClassName="bg-teal-50 text-teal-700 shadow-inner"
          badge="Pendientes"
          className="border border-teal-100"
        />
        <StatsCard
          label="Con ofertas"
          value={withOffersJobs}
          icon={<HandCoins className="h-6 w-6" />}
          iconClassName="bg-emerald-50 text-emerald-700 shadow-inner"
          badge="Recibiendo propuestas"
          className="border border-emerald-100"
        />
        <StatsCard
          label="Completados"
          value={completedJobs}
          icon={<CheckCircle2 className="h-6 w-6" />}
          iconClassName="bg-amber-50 text-amber-700 shadow-inner"
          badge="Historial"
          className="border border-amber-100"
        />
      </div>

      {/* Contenido */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          
          {/* 
            SOLUCIÓN 2: Diseño de los filtros corregido. 
            Usamos flex-wrap para que si no caben, salten a la siguiente línea. 
            Y separamos claramente la zona de pestañas de la zona de búsqueda.
          */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm flex flex-col gap-4">
            
            {/* Fila superior: Pestañas */}
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => changeTab(t)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 cursor-pointer',
                    tab === t
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  )}
                >
                  {tabLabels[t]}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                      tab === t ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700',
                    )}
                  >
                    {tabCounts[t]}
                  </span>
                </button>
              ))}
            </div>

            {/* Fila inferior: Select de ordenamiento y Buscador */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <select
                value={sortBy}
                onChange={changeSort}
                className="w-full sm:w-auto rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 text-xs font-bold text-gray-600 outline-none focus:border-brand-300 cursor-pointer"
              >
                <option value="recent">Más recientes</option>
                <option value="price_asc">Menor presupuesto</option>
                <option value="price_desc">Mayor presupuesto</option>
              </select>
              <div className="relative w-full flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={changeSearch}
                  placeholder="Buscar solicitudes..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2.5 pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Solicitudes */}
          {filtered.length === 0 ? (
            <WorkflowEmptyState
              icon={<Briefcase className="h-9 w-9 text-brand-700" />}
              title={jobs.length === 0 ? 'Aún no has publicado trabajos' : 'No hay solicitudes en esta sección'}
              description={
                jobs.length === 0
                  ? 'Publica tu primer trabajo y empieza a recibir propuestas de profesionales de tu zona.'
                  : 'Prueba cambiando de pestaña o ajustando la búsqueda y el orden.'
              }
              primaryAction={
                <Link to="/cliente/crear-trabajo">
                  <Button className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700">
                    Publicar un trabajo
                  </Button>
                </Link>
              }
              steps={[
                { title: 'Describe lo que necesitas', description: 'Detalla el servicio, medidas, fotos y tu disponibilidad.' },
                { title: 'Recibe propuestas', description: 'Cada oferta incluye precio, tiempo estimado y reputación.' },
                { title: 'Elige y contrata', description: 'Compara y acepta la mejor propuesta para ti.' },
              ]}
            />
          ) : (
            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      {[
                        'Trabajo',
                        'Categoría',
                        'Zona / Municipio',
                        'Fecha publicación',
                        'Presupuesto',
                        'Propuestas',
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
                    {pageItems.map((job) => {
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
                              <p className="truncate font-bold text-gray-900 group-hover:text-brand-700 transition-colors">
                                {job.details.title}
                              </p>
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
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {formatDate(job.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-sm font-black text-gray-900">
                            {formatCurrency(job.pricing.proposedPrice, job.pricing.currency)}
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
                            <div className="relative flex items-center justify-end gap-1">
                              <Link
                                to={`/cliente/trabajo/${job.id}`}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-brand-600 transition-colors hover:bg-brand-50"
                              >
                                <Send className="h-3 w-3" />
                                Ver propuestas
                              </Link>
                              <button
                                type="button"
                                onClick={() => setMenuFor(menuFor === job.id ? null : job.id)}
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                                aria-label="Más acciones"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {menuFor === job.id && (
                                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white p-1.5 shadow-xl">
                                  <Link
                                    to={`/cliente/trabajo/${job.id}`}
                                    onClick={() => setMenuFor(null)}
                                    className="block rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                                  >
                                    Ver detalle
                                  </Link>
                                  <Link
                                    to="/cliente/crear-trabajo"
                                    onClick={() => setMenuFor(null)}
                                    className="block rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
                                  >
                                    Publicar otro
                                  </Link>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginador */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-xs text-gray-400">
                    Mostrando {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={safePage === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-brand-200 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors cursor-pointer',
                          safePage === n
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                            : 'border border-gray-200 text-gray-600 hover:border-brand-200',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={safePage === totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-brand-200 hover:text-brand-700 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-500 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral: consejos */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-3xl border border-brand-100/70 bg-gradient-to-br from-brand-50/60 to-white p-5 shadow-sm">
            <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald-100/60 blur-2xl" />
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900">Consejos para mejores resultados</h3>
                <p className="text-[11px] text-gray-500">Saca el máximo provecho a tus solicitudes</p>
              </div>
            </div>
            <ol className="mt-4 space-y-3">
              {consejos.map((consejo, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-black text-brand-700">
                    {index + 1}
                  </span>
                  <p className="text-xs leading-relaxed text-gray-600">{consejo}</p>
                </li>
              ))}
            </ol>
            <Link to="/cliente/crear-trabajo" className="mt-4 block">
              <Button size="sm" fullWidth variant="outline" className="rounded-xl border-brand-200 text-brand-700 hover:bg-brand-50">
                Publicar una nueva solicitud
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}