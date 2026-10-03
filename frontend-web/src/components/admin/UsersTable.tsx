import { useState, useEffect } from 'react';
import { 
  MoreHorizontal, 
  ShieldCheck, 
  ShieldX, 
  Eye, 
  Copy
} from 'lucide-react';
import type { UserAdminView } from '@/types/admin.types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';
import { toast } from '@/stores/uiStore';
import { isWorker } from '@/utils/roles';

interface UsersTableProps {
  users: UserAdminView[];
  onSuspend: (user: UserAdminView) => void;
  onActivate: (user: UserAdminView) => void;
  onView: (user: UserAdminView) => void;
}

const roleLabels: Record<string, string> = {
  client: 'Cliente',
  worker: 'Profesional',
  both: 'Cliente y Profesional',
  admin: 'Admin',
};

const roleStyles: Record<string, string> = {
  client: 'bg-blue-100 text-blue-800',
  worker: 'bg-purple-100 text-purple-800',
  both: 'bg-brand-100 text-brand-800',
  admin: 'bg-gray-800 text-white',
};

export function UsersTable({ users, onSuspend, onActivate, onView }: UsersTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cierra el menú al hacer clic fuera
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-actions-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  const toggleMenu = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === userId ? null : userId));
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast('success', 'Correo copiado al portapapeles');
    setOpenMenuId(null);
  };

  return (
    <div className="overflow-x-auto min-h-[340px] rounded-2xl border border-gray-100 bg-white shadow-xs">
      <table className="min-w-full divide-y divide-gray-100 text-xs">
        <thead className="bg-gray-50/80 uppercase tracking-wider text-[10px] font-bold text-gray-400">
          <tr>
            <th className="px-5 py-3.5 text-left">Usuario</th>
            <th className="px-5 py-3.5 text-left">Rol</th>
            <th className="px-5 py-3.5 text-left">Calificación</th>
            <th className="px-5 py-3.5 text-left">Verificado</th>
            <th className="px-5 py-3.5 text-left">Estado</th>
            <th className="px-5 py-3.5 text-left">Registro</th>
            <th className="px-5 py-3.5 text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {users.map((user, index) => {
            const isMenuOpen = openMenuId === user.id;
            const isLastRow = index >= users.length - 2 && users.length > 2;

            return (
              <tr key={user.id} className="transition-colors hover:bg-gray-50/60">
                {/* Usuario */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={`${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`}
                      src={user.profile?.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">
                        {user.profile?.firstName} {user.profile?.lastName}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">{user.account?.email}</p>
                    </div>
                  </div>
                </td>

                {/* Rol */}
                <td className="px-5 py-3">
                  <Badge className={roleStyles[user.role] || 'bg-gray-100 text-gray-700'}>
                    {roleLabels[user.role] || user.role}
                  </Badge>
                </td>

                {/* Calificación */}
                <td className="px-5 py-3">
                  {isWorker(user.role) ? (
                    <StarRating rating={user.stats?.rating ?? 0} count={user.stats?.ratingCount ?? 0} size="sm" />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Verificado */}
                <td className="px-5 py-3">
                  {user.account?.verified ? (
                    <Badge variant="success">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      Sí
                    </Badge>
                  ) : (
                    <Badge variant="warning">No</Badge>
                  )}
                </td>

                {/* Estado */}
                <td className="px-5 py-3">
                  <Badge
                    className={cn(
                      'capitalize font-semibold',
                      user.status === 'active' && 'bg-emerald-100 text-emerald-800',
                      user.status === 'suspended' && 'bg-red-100 text-red-800',
                      user.status === 'pending_verification' && 'bg-amber-100 text-amber-800',
                    )}
                  >
                    {user.status === 'active'
                      ? 'Activo'
                      : user.status === 'suspended'
                        ? 'Suspendido'
                        : 'Pendiente'}
                  </Badge>
                </td>

                {/* Registro */}
                <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                  {formatDate(user.createdAt)}
                </td>

                {/* Acciones Centradas y Alineadas */}
                <td className="px-5 py-3 text-center whitespace-nowrap">
                  <div className="relative inline-flex items-center justify-center gap-1.5 user-actions-menu">
                    
                    {/* Botón de Estado con Ancho Fijo (Alineación perfecta) */}
                    <div className="w-28 flex justify-center">
                      {user.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => onSuspend(user)}
                        >
                          <ShieldX className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          Suspender
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-center text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => onActivate(user)}
                        >
                          <ShieldCheck className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          Activar
                        </Button>
                      )}
                    </div>

                    {/* Menú de Tres Puntos */}
                    <div className="relative">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                        onClick={(e) => toggleMenu(e, user.id)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>

                      {isMenuOpen && (
                        <div
                          className={cn(
                            'absolute right-0 w-44 rounded-2xl border border-gray-100 bg-white py-1.5 text-left text-xs shadow-xl ring-1 ring-black/5 z-30 space-y-0.5',
                            isLastRow ? 'bottom-full mb-1' : 'top-full mt-1'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onView(user);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-brand-600" />
                            Ver expediente
                          </button>

                          <button
                            type="button"
                            onClick={() => copyEmail(user.account?.email || '')}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5 text-gray-500" />
                            Copiar correo
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}