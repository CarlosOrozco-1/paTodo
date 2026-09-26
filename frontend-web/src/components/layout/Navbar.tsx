import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Bell,
  LogOut,
  Menu,
  MessageSquare,
  User,
  ChevronDown,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useNotificationStore } from '@/stores/notificationStore';
import type { Notification } from '@/types/message.types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fullName, timeAgo } from '@/utils/formatters';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notifications = useNotificationStore((s) => s.notifications);
  const notificationsLoading = useNotificationStore((s) => s.loading);
  const markNotificationAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllNotificationsAsRead = useNotificationStore((s) => s.markAllAsRead);

  useEffect(() => {
    if (!user) {
      useNotificationStore.getState().reset();
      return;
    }

    void useNotificationStore.getState().load();
    const refreshTimer = window.setInterval(() => {
      void useNotificationStore.getState().load();
    }, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [user]);

  const unreadNotifications = notifications.filter((notification) => !notification.read);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    await markAllNotificationsAsRead();
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const profileRoute = user?.role === 'worker' ? '/profesional/perfil' : user?.role === 'admin' ? '/admin' : '/cliente/perfil';
  const dashboardRoute = user?.role === 'worker' ? '/profesional' : user?.role === 'admin' ? '/admin' : '/cliente';

  return (
    <nav className="sticky top-0 z-40 border-b border-brand-100/60 bg-white/90 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/*Solo botón hamburguesa y Logo exclusivo para pantallas móviles */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="rounded-xl p-1.5 text-gray-500 hover:bg-brand-50 hover:text-brand-600 lg:hidden cursor-pointer"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* El logo en el Navbar solo se mostrará en dispositivos móviles (lg:hidden) cuando la barra lateral se oculta */}
          <Link to={dashboardRoute} className="flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-base font-black text-white shadow-md shadow-brand-600/20">
              P
            </div>
            <span className="text-lg font-extrabold tracking-tight text-gray-900">
              PaTodo
            </span>
          </Link>
        </div>

        {/*Acciones globales y Perfil */}
        {user && (
          <div className="flex items-center gap-1.5">
            <Link to="/mensajes">
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-brand-600 hover:bg-brand-50/50 rounded-xl p-2">
                <MessageSquare className="h-5 w-5" />
              </Button>
            </Link>

            <div className="relative">
              <button
                type="button"
                aria-label="Notificaciones"
                onClick={() => setNotificationsOpen((open) => !open)}
                className="relative rounded-xl p-2 text-gray-500 hover:bg-brand-50/50 hover:text-brand-600 cursor-pointer transition-colors"
              >
              <Bell className="h-5 w-5" />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -right-0.5 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
                    {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-bold text-gray-900">Notificaciones</p>
                    {unreadNotifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsAsRead}
                        className="text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading && notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-gray-400">
                        Cargando notificaciones…
                      </p>
                    ) : notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-gray-400">
                        No tienes notificaciones
                      </p>
                    ) : (
                      notifications.slice(0, 20).map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full border-b border-gray-50 px-4 py-3 text-left hover:bg-brand-50/40 ${notification.read ? 'bg-white' : 'bg-brand-50/30'}`}
                        >
                          <div className="flex items-start gap-2">
                            {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                            <div className={notification.read ? 'pl-4' : ''}>
                              <p className="text-xs font-bold text-gray-900">{notification.title}</p>
                              <p className="mt-0.5 text-xs text-gray-600">{notification.body}</p>
                              <p className="mt-1 text-[10px] text-gray-400">{timeAgo(notification.createdAt)}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative ml-2">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2.5 rounded-2xl bg-brand-50/40 px-3 py-1.5 transition-colors hover:bg-brand-50 border border-brand-100/60 cursor-pointer shadow-2xs"
              >
                <Avatar
                  name={fullName(user.profile)}
                  src={user.profile?.avatarUrl}
                  size="sm"
                />
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold text-gray-900 leading-tight">
                    {fullName(user.profile)}
                  </p>
                  <p className="text-[10px] text-brand-700 font-bold uppercase tracking-wider">
                    {user.role === 'admin' ? 'Administrador' : user.role === 'worker' ? 'Profesional' : 'Cliente'}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl ring-1 ring-black/5 py-1 space-y-0.5">
                    <div className="border-b border-gray-100 px-4 py-3 bg-brand-50/30">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-900 truncate">
                          {fullName(user.profile)}
                        </p>
                        {user.role === 'admin' && (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[9px] font-extrabold">
                            ADMIN
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{user.account?.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to={dashboardRoute}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-brand-50/50 hover:text-brand-700 transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-brand-600" />
                        Mi Dashboard
                      </Link>

                      {user.role === 'admin' && (
                        <Link
                          to="/admin/verificacion"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-brand-50/50 hover:text-brand-700 transition-colors"
                        >
                          <ShieldCheck className="h-4 w-4 text-amber-600" />
                          Verificaciones
                        </Link>
                      )}

                      <Link
                        to={profileRoute}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-brand-50/50 hover:text-brand-700 transition-colors"
                      >
                        <User className="h-4 w-4 text-gray-400" />
                        Mi perfil
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}