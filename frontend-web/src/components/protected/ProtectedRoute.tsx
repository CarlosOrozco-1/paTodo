import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/user.types';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useSplashReady } from '@/hooks/useSplashReady';
import { canAccessRoles, homeRouteFor } from '@/utils/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, authReady } = useAuthStore();
  const location = useLocation();

  // Sin esperar a `authReady` se renderizaría el dashboard con el perfil de
  // localStorage mientras `auth.currentUser` todavía es null, y la primera
  // suscripción a Firestore (notificaciones, conversaciones) reventaría la app.
  const splashReady = useSplashReady(isLoading || !authReady);
  if (!splashReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // `canAccessRoles` trata `both` como compatible con cliente y profesional.
  // Con una comparación simple, un `both` sería expulsado de los dos paneles
  // y el guard lo redirigía al panel contrario, provocando un bucle de
  // redirección que dejaba la app en blanco.
  if (roles && user && !canAccessRoles(user.role, roles)) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }

  return children;
}