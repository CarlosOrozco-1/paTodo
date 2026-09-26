import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useSplashReady } from '@/hooks/useSplashReady';

interface PublicRouteProps {
  children?: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  const splashReady = useSplashReady(isLoading);
  if (!splashReady) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated && user) {
    const redirect = user.role === 'worker' ? '/profesional' : user.role === 'admin' ? '/admin' : '/cliente';
    return <Navigate to={redirect} replace />;
  }

  return children || <Outlet />;
}