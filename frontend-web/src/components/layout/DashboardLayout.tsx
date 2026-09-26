import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function DashboardLayout({ children }: { children?: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.06),transparent_55%)]">
      <Navbar />
      <Sidebar />
      <main className="ml-0 pt-16 transition-all lg:ml-64 lg:pt-0">
        <div key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-page-in">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}