import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Hand,
  Clock,
  CheckCircle2,
  FileText,
  Send,
  Eye,
  Search,
  Compass,
  Filter,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { offersService } from '@/api/offers.service';
import { jobsService } from '@/api/jobs.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { Offer } from '@/types/offer.types';
import { PageHeader } from '@/components/ui/PageHeader';
import { WorkflowEmptyState } from '@/components/ui/WorkflowEmptyState';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { OFFER_STATUS_LABELS, OFFER_STATUS_STYLES } from '@/utils/constants';
import { formatCurrency, timeAgo, formatDate, formatEstimatedTime } from '@/utils/formatters';
import { guessZone } from '@/utils/geo';
import { cn } from '@/utils/cn';

type OfferTab = 'all' | 'pending' | 'accepted' | 'finalized';
type SortBy = 'recent' | 'price_asc' | 'price_desc';

const OFFER_TAB_LABELS: Record<OfferTab, string> = {
  all: 'Todos',
  pending: 'Pendientes',
  accepted: 'Aceptados',
  finalized: 'Completados',
};

export function MyOffers() {
  const { user } = useAuthStore();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OfferTab>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [offersRes, cats] = await Promise.all([
          offersService.getAllByWorker(user!.id, { limit: 100 }),
          categoriesService.getAll(),
        ]);
        setOffers(offersRes.items);

        const jobIds = offersRes.items.map((o) => o.jobId);
        const uniqueIds = [...new Set(jobIds)];
        const jobsData = await Promise.all(
          uniqueIds.map((jid) => jobsService.getById(jid)),
        );
        setJobs(jobsData);
        setCategories(cats);
      } catch {
        setOffers([]);
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
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // --- CÁLCULO CORREGIDO DE TARJETAS Y PESTAÑAS ---
  const pendingCount = offers.filter(
    (o) => o.status === 'pending' || o.status === 'countered'
  ).length;
  
  const acceptedCount = offers.filter(
    (o) => o.status === 'accepted' && jobMap.get(o.jobId)?.status !== 'completed'
  ).length;
  
  const finalizedCount = offers.filter(
    (o) => ['rejected', 'withdrawn'].includes(o.status) || 
           (o.status === 'accepted' && jobMap.get(o.jobId)?.status === 'completed')
  ).length;

  const handleWithdraw = async (offerId: string) => {
    try {
      const updated = await offersService.withdraw(offerId);
      setOffers((prev) => prev.map((o) => (o.id === offerId ? updated : o)));
      toast('success', 'Oferta retirada correctamente');
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const filteredOffers = useMemo(() => {
    const result = offers.filter((o) => {
      // Validamos si el trabajo ya fue completado
      const isJobCompleted = jobMap.get(o.jobId)?.status === 'completed';

      // --- FILTROS DE PESTAÑAS CORREGIDOS ---
      if (tab === 'pending' && !['pending', 'countered'].includes(o.status)) return false;
      if (tab === 'accepted' && (o.status !== 'accepted' || isJobCompleted)) return false;
      if (tab === 'finalized' && !(['rejected', 'withdrawn'].includes(o.status) || (o.status === 'accepted' && isJobCompleted))) return false;

      // Filtro de búsqueda por texto
      if (search) {
        const job = jobMap.get(o.jobId);
        const haystack = [
          job?.details.title,
          job?.location.address,
          categoryMap.get(job?.details.categoryId || '')?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [offers, tab, search, sortBy, jobMap, categoryMap]);

  if (loading) return <Spinner label="Cargando tus ofertas..." />;

  const tabs: { id: OfferTab; label: string; count: number }[] = [
    { id: 'all', label: OFFER_TAB_LABELS.all, count: offers.length },
    { id: 'pending', label: OFFER_TAB_LABELS.pending, count: pendingCount },
    { id: 'accepted', label: OFFER_TAB_LABELS.accepted, count: acceptedCount },
    { id: 'finalized', label: OFFER_TAB_LABELS.finalized, count: finalizedCount },
  ];

  const offerStatusLabel = (status: string) =>
    status === 'rejected' ? 'No seleccionada' : OFFER_STATUS_LABELS[status] || status;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis Ofertas"
        subtitle="Sigue en tiempo real el estado de tus propuestas enviadas a clientes"
      />

      {/* Tarjetas de Resumen Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="group rounded-2xl border border-brand-100 bg-gradient-to-br from-white to-brand-50/40 p-4 shadow-sm flex items-center gap-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 transition-transform duration-300 group-hover:scale-110">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-brand-800 uppercase tracking-wider">Enviadas</p>
            <p className="mt-0.5 text-2xl font-black text-brand-900">{offers.length}</p>
          </div>
        </div>

        <div className="group rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/50 p-4 shadow-sm flex items-center gap-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-transform duration-300 group-hover:scale-110">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pendientes</p>
            <p className="mt-0.5 text-2xl font-black text-amber-900">{pendingCount}</p>
            <p className="text-[10px] text-amber-600/80 font-medium">en evaluación por el cliente</p>
          </div>
        </div>

        <div className="group rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-sm flex items-center gap-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 transition-transform duration-300 group-hover:scale-110">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Aceptadas</p>
            <p className="mt-0.5 text-2xl font-black text-emerald-900">{acceptedCount}</p>
            <p className="text-[10px] text-emerald-600/80 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              seleccionadas por el cliente
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Pestañas + Búsqueda + Filtros */}
      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all duration-200 cursor-pointer hover:-translate-y-0.5 active:scale-95',
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                  tab === t.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700',
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0 lg:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ofertas..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50/70 py-2 pl-9 pr-3 text-xs outline-none transition-colors placeholder:text-gray-400 focus:border-brand-300 focus:bg-white"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer',
                filtersOpen
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-brand-200 hover:text-brand-700',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filtros
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
                {(
                  [
                    { id: 'recent', label: 'Más recientes' },
                    { id: 'price_asc', label: 'Menor precio' },
                    { id: 'price_desc', label: 'Mayor precio' },
                  ] as { id: SortBy; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setSortBy(opt.id);
                      setFiltersOpen(false);
                    }}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer',
                      sortBy === opt.id
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección de Estado Vacío */}
      {filteredOffers.length === 0 ? (
        <WorkflowEmptyState
          icon={<Hand className="h-9 w-9 text-brand-700" />}
          title={offers.length === 0 ? 'Aún no has enviado ofertas' : 'No hay ofertas en este filtro'}
          description={
            offers.length === 0
              ? 'Explora los trabajos disponibles cerca de ti y envía tu primera cotización para empezar a ganar.'
              : 'Prueba cambiar de pestaña, buscar otra oferta o ajustar el orden.'
          }
          primaryAction={
            <Link to="/profesional/trabajos-disponibles">
              <Button className="rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700">
                <Compass className="mr-2 h-4 w-4" />
                Explorar trabajos
              </Button>
            </Link>
          }
          secondaryAction={
            offers.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => {
                  setTab('all');
                  setSearch('');
                }}
                className="rounded-xl border-brand-200 text-brand-700 hover:bg-brand-50"
              >
                Ver todas
              </Button>
            ) : undefined
          }
          steps={[
            { title: 'Explora trabajos disponibles', description: 'Filtra por zona, categoría, precio o distancia.' },
            { title: 'Envía una cotización', description: 'Incluye un precio justo y un tiempo estimado claro.' },
            { title: 'Recibe la respuesta del cliente', description: 'Si acepta tu propuesta, el trabajo pasa a tus activos.' },
          ]}
        />
      ) : (
        /* Tabla de Historial de Ofertas */
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {['Servicio', 'Zona', 'Fecha de envío', 'Precio ofertado', 'Estado', 'Tiempo desde envío', 'Acciones'].map((head) => (
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
                {filteredOffers.map((offer) => {
                  const job = jobMap.get(offer.jobId);
                  const category = job ? categoryMap.get(job.details.categoryId) : undefined;
                  
                  // Validación para saber si el trabajo terminó
                  const isJobCompleted = job?.status === 'completed';

                  // Estilos por defecto
                  let statusLabel = offerStatusLabel(offer.status);
                  let badgeClasses = OFFER_STATUS_STYLES[offer.status];

                  // Si fue aceptada pero el trabajo ya se completó, cambiamos el texto y color
                  if (offer.status === 'accepted' && isJobCompleted) {
                    statusLabel = 'Completado';
                    badgeClasses = 'bg-gray-100 text-gray-700 border border-gray-200';
                  }

                  return (
                    <tr key={offer.id} className="group transition-colors hover:bg-brand-50/30">
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
                              {job?.details.title || 'Trabajo no disponible'}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">{category?.name || 'General'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs font-semibold text-gray-600">
                        {guessZone(job?.location.address)}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-500">
                        {formatDate(offer.createdAt)}
                      </td>

                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-sm font-black text-gray-900">
                            {formatCurrency(offer.price, offer.currency)}
                          </p>
                          <p className="text-[10px] text-gray-400">{formatEstimatedTime(offer.estimatedTime)}</p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold',
                            badgeClasses
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-xs text-gray-500">{timeAgo(offer.createdAt)}</td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {job && (
                            <Link
                              to={`/profesional/trabajo/${offer.jobId}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-brand-600 transition-colors hover:bg-brand-50"
                            >
                              <Eye className="h-3 w-3" />
                              Ver detalle
                            </Link>
                          )}
                          
                          {/* Solo se muestra el chat si fue aceptada Y el trabajo NO ha terminado */}
                          {offer.status === 'accepted' && !isJobCompleted && (
                            <Link
                              to={`/mensajes?jobId=${offer.jobId}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
                            >
                              <Send className="h-3 w-3" />
                              Chatear con el cliente
                            </Link>
                          )}

                          {offer.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleWithdraw(offer.id)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            >
                              <XCircle className="h-3 w-3" />
                              Retirar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}