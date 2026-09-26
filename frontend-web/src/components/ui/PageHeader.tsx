import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: ReactNode;
  actionAlign?: 'right' | 'below';
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  action,
  actionAlign = 'right',
}: PageHeaderProps) {
  return (
    <div>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} className="mb-3" />
      )}
      <div
        className={
          actionAlign === 'right'
            ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
            : 'flex flex-col gap-4'
        }
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}