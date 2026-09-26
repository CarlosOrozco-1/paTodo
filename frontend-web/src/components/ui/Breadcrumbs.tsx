import { Link } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  homeTo?: string;
  className?: string;
}

export function Breadcrumbs({ items, homeTo = '/', className }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Ruta de navegación"
      className={cn('flex flex-wrap items-center gap-1 text-xs', className)}
    >
      <Link
        to={homeTo}
        className="inline-flex items-center gap-1.5 font-semibold text-gray-400 transition-colors hover:text-brand-600"
      >
        <Home className="h-3.5 w-3.5" />
        Inicio
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={item.label} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="font-semibold text-gray-400 transition-colors hover:text-brand-600"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'font-bold',
                  isLast ? 'text-brand-700' : 'text-gray-400',
                )}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}