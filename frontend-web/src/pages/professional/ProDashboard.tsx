import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Briefcase,
  ClipboardList,
  MapPin,
  Power,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { jobsService } from '@/api/jobs.service';
import { offersService } from '@/api/offers.service';
import { categoriesService } from '@/api/categories.service';
import type { Category } from '@/types/category.types';
import type { Job } from '@/types/job.types';
import type { Offer } from '@/types/offer.types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { StatsCard } from '@/components/admin/StatsCard';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobCard } from '@/components/jobs/JobCard';
import { StarRating } from '@/components/ui/StarRating';
import { formatCurrency, fullName } from '@/utils/formatters';

export function ProDashboard() {
  const { user, setUser, refreshProfile } = useAuthStore();
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const load = async () => {
      try {
        const [jobsRes, offersRes, cats] = await Promise.all([
          jobsService.getAvailable({ limit: 3 }),
          offersService.getAllByWorker(user!.id, { limit: 100 }),
          categoriesService.getAll(),
        ]);
        setAvailableJobs(jobsRes.items);
        setMyOffers(offersRes.items);
        setCategories(cats);
      } catch {
        setAvailableJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  if (loading) return <Spinner label="Cargando tu panel..." />;

  const acceptedOffers = myOffers.filter((o) => o.status === 'accepted');
  const totalEarned = acceptedOffers.reduce((sum, o) => sum + o.price, 0);
  const activeJobs = acceptedOffers.length;
  const earningsTarget = 2500;
  const earningsProgress = Math.min((totalEarned / earningsTarget) * 100, 100);

  const toggleOnlineStatus = () => {
    if (!user) return;
    setUser({
      ...user,
      availability: {
        ...user.availability,
        isOnline: !user.availability.isOnline,
      },
    });
  };

  const updateServiceRadius = (newRadius: number) => {
    if (!user) return;
    setUser({
      ...user,
      availability: {
        ...user.availability,
        serviceArea: {
          ...user.availability.serviceArea,
          radiusKm: newRadius,
        },
      },
    });
  };

  const isOnline = user?.availability.isOnline;
  const radius = user?.availability.serviceArea.radiusKm ?? 10;

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Hola, {fullName(user?.profile)} 🛠️
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Encuentra trabajos cerca de ti y envía tus ofertas
          </p>
        </div>
      </div>

      {/* Métrica de Tarjetas Superior */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Trabajos activos"
          value={<span className="text-2xl font-bold">{activeJobs}</span>}
          icon={<Briefcase className="h-6 w-6" />}
          iconClassName="bg-blue-50 text-blue-600 shadow-inner"
          className="transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/5 border border-gray-100"
        />
        {/* Tarjeta de Ganancias Destacada */}
        <div className="relative overflow-hidden rounded-2xl border border-brand-900/20 bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-700 p-6 text-white shadow-xl shadow-brand-900/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-900/25">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-400/25 blur-3xl animate-blob" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-brand-300/25 blur-3xl animate-blob" style={{ animationDelay: '-3.5s' }} />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">
                <TrendingUp className="h-3.5 w-3.5" />
                Ganancias estimadas
              </p>
              <p className="mt-1.5 text-2xl font-black tracking-tight">
                {formatCurrency(totalEarned, 'GTQ')}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Mensual
            </span>
          </div>

          <div className="relative mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-100">
              <span className="flex items-center gap-1.5">
                <Target className="h-3 w-3" />
                Meta {formatCurrency(earningsTarget, 'GTQ')}
              </span>
              <span>{activeJobs > 0 ? 'En progreso' : 'Sin ganancias aún'}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-emerald-300 transition-all duration-700 ease-out"
                style={{ width: `${earningsProgress}%` }}
              />
            </div>
          </div>
        </div>
        <StatsCard
          label="Ofertas enviadas"
          value={<span className="text-2xl font-bold">{myOffers.length}</span>}
          icon={<span className="text-lg font-black text-amber-700">Q</span>}
          iconClassName="bg-amber-50 text-amber-600 shadow-inner"
          className="transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-900/5 border border-gray-100"
        />
        <StatsCard
          label="Mi calificación"
          value={
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {user?.stats.rating?.toFixed(1) ?? '0.0'}
              </span>
              <StarRating rating={user?.stats.rating || 0} size="sm" showValue={false} />
            </div>
          }
          icon={<Star className="h-5 w-5 text-purple-600" />}
          iconClassName="bg-purple-50 shadow-inner shrink-0"
          className="transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-900/5 border border-gray-100"
        />
      </div>

      {/* Grid Principal de 2 Columnas */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trabajos Disponibles */}
        <Card className="lg:col-span-2 border border-gray-100 shadow-sm">
          <CardHeader
            title={
              <div className="flex flex-wrap items-center gap-2.5">
                <span>Trabajos disponibles cerca</span>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  </span>
                  {availableJobs.length} {availableJobs.length === 1 ? 'nuevo' : 'nuevos'}
                </span>
              </div>
            }
            subtitle="Solicitudes recientes de clientes en tu área"
            action={
              <Link to="/profesional/trabajos-disponibles">
                <Button variant="ghost" size="sm" className="font-semibold text-brand-600">
                  Ver todos
                </Button>
              </Link>
            }
          />
          <CardContent>
            {availableJobs.length === 0 ? (
              <EmptyState
                title="No hay trabajos disponibles ahora"
                description="Vuelve pronto, los clientes publican solicitudes constantemente."
                icon={<ClipboardList className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-3">
                {availableJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    category={categoryMap.get(job.details.categoryId)}
                    to={`/profesional/trabajo/${job.id}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel Lateral: Estado de Disponibilidad y Ajustes */}
        <div className="space-y-6">
          <Card className="border border-gray-100 shadow-sm overflow-hidden">
            <CardHeader title="Mi disponibilidad" subtitle="Gestiona tu visibilidad y rango" />
            <CardContent className="space-y-5">
              
              {/* Caja Estado Animado */}
              <div className={`rounded-2xl p-4 transition-all duration-300 active:scale-[0.99] border ${
                isOnline 
                  ? 'bg-emerald-50/60 border-emerald-200/70' 
                  : 'bg-gray-50 border-gray-200/60'
              }`}>
                <div className="flex items-center gap-3">
                  {isOnline ? (
                    <span className="relative flex h-3.5 w-3.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full bg-gray-300"></span>
                  )}
                  <p className={`text-sm font-bold ${isOnline ? 'text-emerald-900' : 'text-gray-700'}`}>
                    {isOnline ? 'En línea y disponible' : 'Desconectado'}
                  </p>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  {isOnline
                    ? 'Los clientes en tu zona pueden ver tu perfil activo y enviarte ofertas directas.'
                    : 'Activa tu estado para empezar a recibir notificaciones de trabajo.'}
                </p>
              </div>

              {/* Botón Acción Toggle */}
              <Button
                type="button"
                variant={isOnline ? 'outline' : 'primary'}
                fullWidth
                onClick={toggleOnlineStatus}
                className="cursor-pointer"
              >
                <Power className="mr-2 h-4 w-4" />
                {isOnline ? 'Ponerme en desconectado' : 'Ponerme en línea'}
              </Button>

              {/* Ajuste de Radio de Cobertura */}
              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-brand-600" />
                    Radio de cobertura
                  </span>
                  <span className="text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-100">
                    {radius} km
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={radius}
                  onChange={(e) => updateServiceRadius(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>5 km</span>
                  <span>25 km</span>
                  <span>50 km</span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Tarjeta de Meta/Progreso Siguiente Nivel (Novedad SaaS) */}
          <Card className="border border-gray-100 shadow-sm bg-gradient-to-br from-brand-900 to-brand-800 text-white">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                <h4 className="text-sm font-bold">Meta de cotizaciones</h4>
              </div>
              <p className="text-xs text-brand-100 leading-relaxed">
                Has enviado <span className="font-bold text-white">{myOffers.length}</span> ofertas este mes.
              </p>
              <div className="w-full bg-brand-950/60 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min((myOffers.length / 10) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-brand-200 text-right">
                {myOffers.length >= 10 ? '¡Meta mensual alcanzada!' : `${10 - myOffers.length} ofertas para completar la meta`}
              </p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}