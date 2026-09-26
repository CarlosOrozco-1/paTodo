import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  Briefcase,
  HandCoins,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { adminService } from '@/api/admin.service';
import type {
  ActivityLog,
  DashboardStats,
} from '@/types/admin.types';
import { StatsCard } from '@/components/admin/StatsCard';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/utils/formatters';

const emptyStats: DashboardStats = {
  totalUsers: 0,
  totalClients: 0,
  totalWorkers: 0,
  totalJobs: 0,
  activeJobs: 0,
  pendingJobs: 0,
  completedJobs: 0,
  cancelledJobs: 0,
  totalOffers: 0,
  pendingOffers: 0,
  acceptedOffers: 0,
  averageRating: 0,
  totalRevenue: 0,
  currency: 'GTQ',
  activeUsersToday: 0,
  newUsersThisWeek: 0,
  newJobsThisWeek: 0,
};

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsData, activityRes] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getActivityLog({ limit: 8 }),
        ]);
        setStats(statsData);
        setActivities(activityRes.items);
      } catch {
        setStats(emptyStats);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Spinner label="Cargando panel de administración..." />;

  // Base de cálculo para que los porcentajes sumen correctamente
  const calculatedTotal = (stats.activeJobs + stats.pendingJobs + stats.completedJobs + stats.cancelledJobs) || stats.totalJobs || 1;

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Panel de Administración
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Resumen analítico y monitoreo en tiempo real de la plataforma PaTodo
          </p>
        </div>
        <Link to="/admin/verificacion">
          <Button size="lg" className="shadow-md shadow-brand-600/20">
            <ShieldCheck className="mr-2 h-5 w-5" />
            Verificar profesionales
          </Button>
        </Link>
      </div>

      {/* Fila 1: Métricas Principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total de usuarios"
          value={<span className="text-2xl font-bold">{stats.totalUsers}</span>}
          icon={<Users className="h-6 w-6" />}
          iconClassName="bg-brand-50 text-brand-700 shadow-inner"
          trend={`+${stats.newUsersThisWeek} esta semana`}
          trendDirection="up"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-100"
        />
        <StatsCard
          label="Trabajos totales"
          value={<span className="text-2xl font-bold">{stats.totalJobs}</span>}
          icon={<Briefcase className="h-6 w-6" />}
          iconClassName="bg-emerald-50 text-emerald-700 shadow-inner"
          trend={`+${stats.newJobsThisWeek} esta semana`}
          trendDirection="up"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-100"
        />
        <StatsCard
          label="Ofertas enviadas"
          value={<span className="text-2xl font-bold">{stats.totalOffers}</span>}
          icon={<HandCoins className="h-6 w-6" />}
          iconClassName="bg-amber-50 text-amber-700 shadow-inner"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-100"
        />
        <StatsCard
          label="Ingresos plataforma"
          value={<span className="text-2xl font-bold">{formatCurrency(stats.totalRevenue, stats.currency)}</span>}
          icon={<span className="text-lg font-black text-purple-700">Q</span>}
          iconClassName="bg-purple-50 text-purple-700 shadow-inner"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg border border-gray-100"
        />
      </div>

      {/* Fila 2: Métricas Secundarias (Con Transición) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Clientes registrados"
          value={<span className="text-xl font-bold">{stats.totalClients}</span>}
          icon={<UserRound className="h-5 w-5" />}
          iconClassName="bg-blue-50 text-blue-700"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-gray-100 shadow-xs"
        />
        <StatsCard
          label="Profesionales activos"
          value={<span className="text-xl font-bold">{stats.totalWorkers}</span>}
          icon={<Wrench className="h-5 w-5" />}
          iconClassName="bg-cyan-50 text-cyan-700"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-gray-100 shadow-xs"
        />
        <StatsCard
          label="Trabajos completados"
          value={<span className="text-xl font-bold">{stats.completedJobs}</span>}
          icon={<Briefcase className="h-5 w-5" />}
          iconClassName="bg-emerald-50 text-emerald-700"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-gray-100 shadow-xs"
        />
        <StatsCard
          label="Calificación promedio"
          value={<span className="text-xl font-bold">{stats.averageRating.toFixed(2)} / 5.0</span>}
          icon={<Star className="h-5 w-5" />}
          iconClassName="bg-amber-50 text-amber-700"
          className="transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-gray-100 shadow-xs"
        />
      </div>

      {/* Secciones Inferiores */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Distribución de Trabajos por Estado */}
        <Card className="lg:col-span-2 border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader
            title="Trabajos por estado"
            subtitle="Distribución actual de las solicitudes en el sistema"
          />
          <CardContent className="pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Activos', value: stats.activeJobs, color: 'bg-emerald-500' },
                { label: 'Pendientes', value: stats.pendingJobs, color: 'bg-amber-500' },
                { label: 'Completados', value: stats.completedJobs, color: 'bg-brand-600' },
                { label: 'Cancelados', value: stats.cancelledJobs, color: 'bg-red-500' },
              ].map((item) => {
                const percentage = Math.round((item.value / calculatedTotal) * 100);
                return (
                  <div 
                    key={item.label} 
                    className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-2.5 transition-all duration-200 hover:bg-white hover:border-gray-200 hover:shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">{item.label}</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-gray-900">{item.value}</span>
                        <span className="text-[11px] font-semibold text-gray-400">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200/80">
                      <div
                        className={`h-full ${item.color} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Feed de Actividad Reciente */}
        <Card className="border border-gray-100 shadow-sm transition-all duration-200 hover:shadow-md">
          <CardHeader
            title="Actividad reciente"
            subtitle="Últimas acciones en la plataforma"
          />
          <CardContent className="pt-2">
            {activities.length === 0 ? (
              <EmptyState
                title="Sin actividad reciente"
                description="No hay nuevos registros en el sistema."
                icon={<Activity className="h-8 w-8 text-gray-400" />}
              />
            ) : (
              <ActivityFeed activities={activities} />
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}