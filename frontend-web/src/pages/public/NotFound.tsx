import { Link } from 'react-router';
import { Home, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <SearchX className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-lg font-medium text-gray-700">Página no encontrada</p>
      <p className="mt-1 text-sm text-gray-500">
        La página que buscas no existe o fue movida
      </p>
      <Link to="/" className="mt-8">
        <Button>
          <Home className="h-4 w-4" />
          Volver al inicio
        </Button>
      </Link>
    </div>
  );
}