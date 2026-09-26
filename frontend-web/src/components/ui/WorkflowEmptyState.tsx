import type { ReactNode } from 'react';
import { Lightbulb, ArrowRight } from 'lucide-react';

interface WorkflowStep {
  title: string;
  description: string;
}

interface WorkflowEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  steps: WorkflowStep[];
  stepLabel?: string;
  className?: string;
}

export function WorkflowEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  steps,
  stepLabel = 'Guía rápida',
  className,
}: WorkflowEmptyStateProps) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-dashed border-brand-200/80 bg-white/80 backdrop-blur-sm shadow-sm animate-page-in ${className ?? ''}`}
    >
      <div className="grid lg:grid-cols-5">
        {/* Panel principal */}
        <div className="relative flex flex-col items-center justify-center gap-5 overflow-hidden p-8 text-center lg:col-span-3 lg:p-10">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-brand-100/50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-12 h-60 w-60 rounded-full bg-emerald-100/50 blur-3xl" />

          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-100 to-emerald-100 text-brand-700 shadow-inner ring-1 ring-brand-200/60 animate-float">
            {icon}
            <span className="absolute inset-0 rounded-3xl border border-brand-200/40" />
          </div>

          <div className="relative space-y-2">
            <h2 className="text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              {title}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-500">
              {description}
            </p>
          </div>

          {(primaryAction || secondaryAction) && (
            <div className="relative flex flex-wrap items-center justify-center gap-3 pt-1">
              {secondaryAction}
              {primaryAction}
            </div>
          )}
        </div>

        {/* Guía de pasos lateral */}
        <div className="border-t border-brand-100/70 bg-gradient-to-b from-brand-50/40 to-white p-6 lg:col-span-2 lg:border-l lg:border-t-0 lg:p-7">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Lightbulb className="h-3.5 w-3.5" />
            </div>
            <p className="text-xs font-black uppercase tracking-wider text-brand-800">
              {stepLabel}
            </p>
          </div>

          <ol className="mt-5 space-y-0">
            {steps.map((step, index) => (
              <li key={index} className="relative flex gap-3.5 pb-6 last:pb-0">
                {index < steps.length - 1 && (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-gradient-to-b from-brand-200 to-transparent" />
                )}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-brand-200 bg-white text-xs font-black text-brand-700">
                  {index + 1}
                </span>
                <div className="pt-0.5">
                  <p className="text-sm font-bold text-gray-800">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex items-center gap-1.5 text-[11px] font-semibold text-brand-600/80">
            <ArrowRight className="h-3.5 w-3.5" />
            Empieza paso a paso
          </div>
        </div>
      </div>
    </div>
  );
}