import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface StatsCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  iconClassName?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  badge?: string;
  badgeClassName?: string;
  progress?: number;
  progressLabel?: string;
  className?: string;
}

export function StatsCard({
  label,
  value,
  icon,
  iconClassName = 'bg-brand-100 text-brand-700',
  trend,
  trendDirection = 'neutral',
  badge,
  badgeClassName = 'bg-brand-50 text-brand-700 border-brand-100',
  progress,
  progressLabel,
  className,
}: StatsCardProps) {
  const progressClamped = progress === undefined ? undefined : Math.min(100, Math.max(0, progress));

  return (
    <Card className={cn('group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.97]', className)}>
      <CardContent className="relative flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {label}
              </p>
              {badge && (
                <span
                  className={cn(
                    'rounded-full border px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wide',
                    badgeClassName,
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
            <div className="mt-1 text-3xl font-black text-gray-900 tracking-tight">{value}</div>
            {trend && (
              <p
                className={cn(
                  'mt-1.5 text-xs font-semibold',
                  trendDirection === 'up' && 'text-emerald-600',
                  trendDirection === 'down' && 'text-red-600',
                  trendDirection === 'neutral' && 'text-gray-500',
                )}
              >
                {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3',
              iconClassName,
            )}
          >
            {icon}
          </div>
        </div>

        {progressClamped !== undefined && (
          <div className="mt-auto">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400">
              <span>{progressLabel ?? 'Progreso'}</span>
              <span>{Math.round(progressClamped)}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-brand-100/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${progressClamped}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}