import { Activity, Clock } from 'lucide-react';
import type { ActivityLog } from '@/types/admin.types';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { timeAgo } from '@/utils/formatters';
import { cn } from '@/utils/cn';

interface ActivityFeedProps {
  activities: ActivityLog[];
}

const actionStyles: Record<string, { label: string; style: string }> = {
  create: { label: 'Creación', style: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  update: { label: 'Edición', style: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  delete: { label: 'Eliminación', style: 'bg-red-50 text-red-700 border-red-200/60' },
  login: { label: 'Inicio Sesión', style: 'bg-gray-100 text-gray-700 border-gray-200' },
  verify: { label: 'Verificación', style: 'bg-purple-50 text-purple-700 border-purple-200/60' },
  suspend: { label: 'Suspensión', style: 'bg-red-50 text-red-700 border-red-200/60' },
  REGISTRO_PRO: { label: 'Registro Pro', style: 'bg-emerald-50 text-emerald-700 border-emerald-200/60' },
  REGISTRO_CLIENTE: { label: 'Registro Cliente', style: 'bg-blue-50 text-blue-700 border-blue-200/60' },
  COMPLETAR_TRABAJO: { label: 'Trabajo Finalizado', style: 'bg-purple-50 text-purple-700 border-purple-200/60' },
  RESEÑA: { label: 'Reseña', style: 'bg-amber-50 text-amber-700 border-amber-200/60' },
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <EmptyState
        title="Sin actividad reciente"
        description="Las acciones de los usuarios aparecerán aquí."
        icon={<Activity className="h-8 w-8 text-gray-400" />}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {activities.map((activity) => {
        const actionMeta = actionStyles[activity.action] || {
          label: activity.action?.replace('_', ' ') || 'Actividad',
          style: 'bg-gray-100 text-gray-600 border-gray-200',
        };

        return (
          <div
            key={activity.id}
            className="group flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50/50 p-3.5 transition-all duration-200 hover:bg-white hover:border-gray-200 hover:shadow-sm"
          >
            {/* Avatar del usuario */}
            <div className="shrink-0 mt-0.5">
              <Avatar name={activity.userName || 'Usuario'} size="sm" />
            </div>

            {/* Contenido explicativo con buena jerarquía */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {activity.userName || 'Usuario'}
                </p>

                {/* Badge formateado a la derecha sin empalmarse */}
                <span
                  className={cn(
                    'shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                    actionMeta.style
                  )}
                >
                  {actionMeta.label}
                </span>
              </div>

              {/* Descripción explicativa limpia */}
              <p className="text-xs text-gray-600 leading-snug line-clamp-2">
                {activity.description}
              </p>

              {/* Tiempo transcurrido con icono de reloj */}
              <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-gray-400">
                <Clock className="h-3 w-3 text-gray-300" />
                <span>Hace {timeAgo(activity.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}