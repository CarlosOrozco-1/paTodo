import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Briefcase, MessageSquare, Star } from 'lucide-react';
import { usersService } from '@/api/users.service';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { fullName } from '@/utils/formatters';
import { ROLE_LABELS } from '@/utils/roles';
import { cn } from '@/utils/cn';
import type { User } from '@/types/user.types';

interface CounterpartCardProps {
  userId: string;
  /** Etiqueta del rol según quién mira: "Profesional asignado", "Cliente". */
  title: string;
  jobId?: string;
  className?: string;
}

/**
 * Ficha de la contraparte dentro del detalle de un trabajo, con acceso a su
 * perfil público y al chat.
 *
 * La carga del usuario es tolerante a propósito: si el perfil no se puede
 * leer, la tarjeta desaparece en vez de romper el detalle del trabajo, que es
 * la vista que el usuario sí necesita.
 */
export function CounterpartCard({
  userId,
  title,
  jobId,
  className,
}: CounterpartCardProps) {
  // Igual que en PublicProfile: el resultado se etiqueta con el id para no
  // tener que reiniciar el estado dentro del efecto al cambiar la contraparte.
  const [result, setResult] = useState<{ id: string; user: User | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await usersService.getById(userId);
        if (!cancelled) setResult({ id: userId, user: data });
      } catch {
        if (!cancelled) setResult({ id: userId, user: null });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const user = result?.id === userId ? result.user : null;
  const loading = !userId || result?.id !== userId;

  if (loading) {
    return (
      <div className={cn('rounded-2xl border border-gray-100 bg-white p-4', className)}>
        <Spinner size="sm" label="Cargando contacto..." />
      </div>
    );
  }

  if (!user) return null;

  const name = fullName(user.profile);
  const chatLink = jobId
    ? `/mensajes?jobId=${jobId}`
    : `/mensajes?userId=${user.id}`;

  return (
    <div className={cn('rounded-2xl border border-gray-100 bg-white p-4 shadow-sm', className)}>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</p>

      <Link
        to={`/perfil/${user.id}`}
        className="mt-3 flex items-center gap-3 rounded-xl transition-colors hover:bg-gray-50"
      >
        <Avatar name={name} src={user.profile.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900">{name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
            <span className="font-semibold text-gray-600">{ROLE_LABELS[user.role]}</span>
            {user.stats.ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {user.stats.rating.toFixed(1)}
                <span className="text-gray-400">({user.stats.ratingCount})</span>
              </span>
            )}
            <span className="inline-flex items-center gap-0.5">
              <Briefcase className="h-3 w-3" />
              {user.stats.completedJobs || 0}
            </span>
          </div>
        </div>
      </Link>

      <div className="mt-3 flex gap-2">
        <Link
          to={`/perfil/${user.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
        >
          Ver perfil y reseñas
        </Link>
        <Link
          to={chatLink}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chatear
        </Link>
      </div>
    </div>
  );
}
