import { NavLink, useLocation } from 'react-router';
import {
  LayoutDashboard,
  Briefcase,
  PlusCircle,
  Hand,
  CheckCircle,
  Users,
  Shield,
  ClipboardList,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { cn } from '@/utils/cn';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badgeTypes?: string[];
}

const clientNav: NavItem[] = [
  { to: '/cliente', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cliente/mis-trabajos', icon: Briefcase, label: 'Mis Trabajos', badgeTypes: ['offer', 'job_status'] },
  { to: '/cliente/crear-trabajo', icon: PlusCircle, label: 'Publicar Trabajo' },
];

const workerNav: NavItem[] = [
  { to: '/profesional', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profesional/trabajos-disponibles', icon: ClipboardList, label: 'Trabajos Disponibles' },
  { to: '/profesional/mis-ofertas', icon: Hand, label: 'Mis Ofertas', badgeTypes: ['offer'] },
  { to: '/profesional/trabajos-activos', icon: CheckCircle, label: 'Trabajos Activos', badgeTypes: ['job_status'] },
];

const adminNav: NavItem[] = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/usuarios', icon: Users, label: 'Usuarios' },
  { to: '/admin/verificacion', icon: Shield, label: 'Verificación' },
  { to: '/admin/trabajos', icon: ClipboardList, label: 'Todos los Trabajos' },
];

/**
 * Un usuario `both` ve los dos paneles, separados y rotulados. Se renombran
 * los "Dashboard" porque en un menú unificado dos entradas con la misma
 * etiqueta serían ambiguas.
 */
const bothNav: NavItem[] = [
  { to: '/cliente', icon: LayoutDashboard, label: 'Como cliente' },
  { to: '/cliente/mis-trabajos', icon: Briefcase, label: 'Mis Trabajos', badgeTypes: ['job_status'] },
  { to: '/cliente/crear-trabajo', icon: PlusCircle, label: 'Publicar Trabajo' },
  { to: '/profesional', icon: Hand, label: 'Como profesional' },
  { to: '/profesional/trabajos-disponibles', icon: ClipboardList, label: 'Trabajos Disponibles' },
  { to: '/profesional/mis-ofertas', icon: Hand, label: 'Mis Ofertas', badgeTypes: ['offer'] },
  { to: '/profesional/trabajos-activos', icon: CheckCircle, label: 'Trabajos Activos' },
];

const navMap: Record<string, NavItem[]> = {
  client: clientNav,
  worker: workerNav,
  both: bothNav,
  admin: adminNav,
};

export function Sidebar() {
  const { user } = useAuthStore();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const location = useLocation();
  const notifications = useNotificationStore((s) => s.notifications);

  const nav = (user && navMap[user.role]) || clientNav;

  const badgeCount = (item: NavItem) => {
    if (!item.badgeTypes?.length) return 0;
    return notifications.filter(
      (n) => !n.read && item.badgeTypes!.includes(n.type),
    ).length;
  };

  return (
    <>
      {/* Backdrop móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar con tonalidad sutil de marca y borde diferenciador */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-brand-100/60 bg-gradient-to-b from-brand-50/50 via-white to-brand-50/20 backdrop-blur-md shadow-xs transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Cabecera */}
        <div className="flex h-24 items-center justify-between px-5 border-b border-brand-100/50 py-3">
  <div className="flex items-center gap-3.5 transition-transform duration-300 hover:scale-[1.03] cursor-default select-none">
    <img
      src="/logos1.png"
      alt="PaTodo"
      className="h-20 w-auto max-w-[160px] object-contain mix-blend-multiply"
    />
    <div className="flex flex-col border-l border-brand-200/60 pl-3 justify-center">
      <span className="text-xs font-bold text-brand-700 tracking-wider uppercase leading-none">
        Servicios
      </span>
      <span className="text-[10px] font-medium text-gray-400 tracking-tight leading-none mt-1">
        a domicilio
      </span>
    </div>
  </div>

          <button
            type="button"
            className="rounded-xl p-1.5 text-gray-400 hover:bg-white hover:text-gray-700 lg:hidden cursor-pointer transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Menú de Navegación */}
        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3.5 py-5">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-brand-800/60 mb-1">
            Menú Principal
          </p>

          {nav.map((item) => {
            const isExactMatch = location.pathname === item.to;
            const isRootRole = item.to === '/cliente' || item.to === '/profesional' || item.to === '/admin';
            const isActive = isExactMatch || (isRootRole && location.pathname === item.to);
            const count = badgeCount(item);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={isRootRole}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                    : 'text-gray-600 hover:bg-white hover:text-brand-700 hover:translate-x-0.5 shadow-2xs border border-transparent hover:border-brand-100/60'
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-brand-600'
                  )}
                />
                <span className="truncate">{item.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold tabular-nums',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-600 text-white shadow-sm shadow-brand-600/25',
                    )}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </aside>
    </>
  );
}