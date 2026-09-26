import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/user.types';
import { AuthLoadingScreen } from '@/components/AuthLoadingScreen';
import { useSplashReady } from '@/hooks/useSplashReady';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  const splashReady = useSplashReady(isLoading);
  if (!splashReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'worker' ? '/profesional' : '/cliente'} replace />;
  }

  return children;
}