import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useSplashReady } from '@/hooks/useSplashReady';
import { homeRouteFor } from '@/utils/roles';

interface PublicRouteProps {
  children?: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading, user, authReady } = useAuthStore();

  // Igual que en ProtectedRoute: no se decide la redirección hasta que Firebase
  // ha confirmado la sesión, para no expulsar a un usuario con sesión válida.
  const splashReady = useSplashReady(isLoading || !authReady);
  if (!splashReady) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }

  return children || <Outlet />;
}