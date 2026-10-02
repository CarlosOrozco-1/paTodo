import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router';
import { useEffect, useState } from 'react';
import { warmUpApi } from '@/api/apiWarmup';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/protected/ProtectedRoute';
import { PublicRoute } from '@/components/protected/PublicRoute';
import { ToastContainer } from '@/components/ui/Toast';
import { DemoBanner } from '@/components/demo/DemoBanner';
import { SplashScreen } from '@/components/SplashScreen';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { CompleteGoogleProfile } from '@/pages/auth/CompleteGoogleProfile';
import { LandingPage } from '@/pages/public/LandingPage';
import { NotFound } from '@/pages/public/NotFound';
import { PublicProfile } from '@/pages/public/PublicProfile';
import { ClientDashboard } from '@/pages/client/ClientDashboard';
import { MyJobs } from '@/pages/client/MyJobs';
import { CreateJob } from '@/pages/client/CreateJob';
import { JobDetailClient } from '@/pages/client/JobDetailClient';
import { ClientProfile } from '@/pages/client/ClientProfile';
import { ProDashboard } from '@/pages/professional/ProDashboard';
import { AvailableJobs } from '@/pages/professional/AvailableJobs';
import { MyOffers } from '@/pages/professional/MyOffers';
import { ActiveJobs } from '@/pages/professional/ActiveJobs';
import { JobDetailPro } from '@/pages/professional/JobDetailPro';
import { ProProfile } from '@/pages/professional/ProProfile';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UsersManagement } from '@/pages/admin/UsersManagement';
import { VerifyProfessionals } from '@/pages/admin/VerifyProfessionals';
import { AllJobs } from '@/pages/admin/AllJobs';
import { Messages } from '@/pages/messages/Messages';

// Normalmente se usan rutas limpias (/cliente). Solo el build portable
// (VITE_HASH_ROUTER=true) usa rutas con # para poder abrirse como archivo local.
const router = import.meta.env.VITE_HASH_ROUTER === 'true'
  ? createHashRouter([
      {
        path: '/',
        element: <LandingPage />,
      },
      {
        path: '/',
        element: <PublicRoute />,
        children: [
          {
            path: 'login',
            element: (
              <AuthLayout>
                <LoginPage />
              </AuthLayout>
            ),
          },
          {
            path: 'registro',
            element: (
              <AuthLayout>
                <RegisterPage />
              </AuthLayout>
            ),
          },
        ],
      },
      {
        // Alta con Google: la sesión de Firebase ya existe pero el documento se
        // crea al confirmar el formulario. Va FUERA de PublicRoute a propósito:
        // ese guard expulsa a quien está autenticado, y aquí el usuario lo está.
        // El propio componente se encarga de validar que haya sesión y borrador.
        path: '/completar-perfil',
        element: <CompleteGoogleProfile />,
      },
      {
        path: '/',
        element: (
          <ProtectedRoute roles={['client']}>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'cliente', element: <ClientDashboard /> },
          { path: 'cliente/mis-trabajos', element: <MyJobs /> },
          { path: 'cliente/crear-trabajo', element: <CreateJob /> },
          { path: 'cliente/trabajo/:id', element: <JobDetailClient /> },
          { path: 'cliente/perfil', element: <ClientProfile /> },
        ],
      },
      {
        path: '/',
        element: (
          <ProtectedRoute roles={['worker']}>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'profesional', element: <ProDashboard /> },
          { path: 'profesional/trabajos-disponibles', element: <AvailableJobs /> },
          { path: 'profesional/mis-ofertas', element: <MyOffers /> },
          { path: 'profesional/trabajos-activos', element: <ActiveJobs /> },
          { path: 'profesional/trabajo/:id', element: <JobDetailPro /> },
          { path: 'profesional/perfil', element: <ProProfile /> },
        ],
      },
      {
        path: '/',
        element: (
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: 'admin', element: <AdminDashboard /> },
          { path: 'admin/usuarios', element: <UsersManagement /> },
          { path: 'admin/verificacion', element: <VerifyProfessionals /> },
          { path: 'admin/trabajos', element: <AllJobs /> },
        ],
      },
      {
        path: '/mensajes',
        element: (
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        ),
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [{ path: 'perfil/:id', element: <PublicProfile /> }],
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ])
  : createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/',
    element: <PublicRoute />,
    children: [
      {
        path: 'login',
        element: (
          <AuthLayout>
            <LoginPage />
          </AuthLayout>
        ),
      },
      {
        path: 'registro',
        element: (
          <AuthLayout>
            <RegisterPage />
          </AuthLayout>
        ),
      },
    ],
  },
  {
    // Ver la nota de la ruta equivalente en el router de hash más arriba:
    // fuera de PublicRoute porque el usuario ya está autenticado.
    path: '/completar-perfil',
    element: <CompleteGoogleProfile />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute roles={['client']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'cliente', element: <ClientDashboard /> },
      { path: 'cliente/mis-trabajos', element: <MyJobs /> },
      { path: 'cliente/crear-trabajo', element: <CreateJob /> },
      { path: 'cliente/trabajo/:id', element: <JobDetailClient /> },
      { path: 'cliente/perfil', element: <ClientProfile /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute roles={['worker']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'profesional', element: <ProDashboard /> },
      { path: 'profesional/trabajos-disponibles', element: <AvailableJobs /> },
      { path: 'profesional/mis-ofertas', element: <MyOffers /> },
      { path: 'profesional/trabajos-activos', element: <ActiveJobs /> },
      { path: 'profesional/trabajo/:id', element: <JobDetailPro /> },
      { path: 'profesional/perfil', element: <ProProfile /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute roles={['admin']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: 'admin', element: <AdminDashboard /> },
      { path: 'admin/usuarios', element: <UsersManagement /> },
      { path: 'admin/verificacion', element: <VerifyProfessionals /> },
      { path: 'admin/trabajos', element: <AllJobs /> },
    ],
  },
  {
    path: '/mensajes',
    element: (
      <ProtectedRoute>
        <Messages />
      </ProtectedRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [{ path: 'perfil/:id', element: <PublicProfile /> }],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

export function App() {
  const [showSplash, setShowSplash] = useState(true);

  // Render se apaga tras ~15 min sin tráfico y el siguiente request paga un
  // arranque en frío. Como el resto de la app habla con Firestore por SDK,
  // este ping es la única llamada temprana que garantiza que el backend esté
  // despierto antes de que el usuario intente completar o aceptar un trabajo.
  useEffect(() => {
    warmUpApi();
  }, []);

  return (
    <>
      {showSplash && <SplashScreen onFinished={() => setShowSplash(false)} />}
      <RouterProvider router={router} />
      <ToastContainer />
      <DemoBanner />
    </>
  );
}