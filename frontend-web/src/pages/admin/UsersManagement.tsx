import { useEffect, useState } from 'react';
import { ShieldCheck, UserCheck, Users, UserX, ChevronLeft, ChevronRight } from 'lucide-react';
import { adminService } from '@/api/admin.service';
import type { UserAdminView } from '@/types/admin.types';
import { UsersTable } from '@/components/admin/UsersTable';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate } from '@/utils/formatters';

const ITEMS_PER_PAGE = 10;

export function UsersManagement() {
  const [users, setUsers] = useState<UserAdminView[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserAdminView | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminService.getUsers({ limit: 100 });
        setUsers(res.items);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!search && roleFilter === 'all') return;
    const load = async () => {
      try {
        const q: Record<string, string> = { limit: '100' };
        if (roleFilter !== 'all') q.role = roleFilter;
        if (search) q.search = search;
        const res = await adminService.getUsers(q);
        setUsers(res.items);
        setCurrentPage(1); // Reiniciar paginación al filtrar
      } catch {
        // ignorar
      }
    };
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
  }, [search, roleFilter]);

  const handleSuspend = async (user: UserAdminView) => {
    try {
      await adminService.suspendUser(user.id, 'Suspendido por administrador');
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: 'suspended' } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, status: 'suspended' });
      }
      toast('success', `Usuario ${user.profile.firstName} suspendido`);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleActivate = async (user: UserAdminView) => {
    try {
      await adminService.activateUser(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: 'active' } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, status: 'active' });
      }
      toast('success', `Usuario ${user.profile.firstName} activado`);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleView = (user: UserAdminView) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleMakeAdmin = async (user: UserAdminView) => {
    try {
      await adminService.makeAdmin(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: 'admin' } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, role: 'admin' });
      }
      toast('success', `${user.profile.firstName} ahora es administrador`);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  const handleRemoveAdmin = async (user: UserAdminView) => {
    try {
      await adminService.removeAdmin(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: 'client' } : u)),
      );
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, role: 'client' });
      }
      toast('success', `Rol de administrador revocado a ${user.profile.firstName}`);
    } catch (error) {
      toast('error', getErrorMessage(error));
    }
  };

  if (loading) return <Spinner label="Cargando listado de usuarios..." />;

  // Cálculo de paginación
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = users.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Cabecera y Filtros */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra, verifica y supervisa la actividad de clientes y profesionales
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
            <SearchBar onSearch={setSearch} placeholder="Buscar por nombre o email..." />
          </div>
          <div className="w-full sm:w-48">
            <Select
              options={[
                { value: 'all', label: 'Todos los roles' },
                { value: 'client', label: 'Clientes' },
                { value: 'worker', label: 'Profesionales' },
                { value: 'admin', label: 'Administradores' },
              ]}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Tarjeta de Tabla y Paginación */}
      <Card className="border border-gray-100 shadow-sm overflow-hidden rounded-3xl">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="No hay usuarios registrados"
                description="Los usuarios que coincidan con la búsqueda aparecerán aquí."
                icon={<Users className="h-8 w-8 text-gray-400" />}
              />
            </div>
          ) : (
            <>
              <UsersTable
                users={paginatedUsers}
                onSuspend={handleSuspend}
                onActivate={handleActivate}
                onView={handleView}
              />

              {/* Pie de Paginación */}
              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50/50 text-xs text-gray-500">
                <p>
                  Mostrando <strong className="text-gray-900">{startIndex + 1}</strong> a{' '}
                  <strong className="text-gray-900">
                    {Math.min(startIndex + ITEMS_PER_PAGE, users.length)}
                  </strong>{' '}
                  de <strong className="text-gray-900">{users.length}</strong> usuarios
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="rounded-xl px-3 py-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <span className="font-bold text-gray-700 px-2">
                    {currentPage} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded-xl px-3 py-1"
                  >
                    Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalle */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalles del Usuario"
        description={selectedUser?.account.email}
        size="md"
      >
        {selectedUser && (
          <div className="space-y-5 pt-2">
            <div className="flex items-start gap-4 rounded-2xl bg-gray-50/80 p-4 border border-gray-100">
              <Avatar
                name={`${selectedUser.profile.firstName} ${selectedUser.profile.lastName}`}
                src={selectedUser.profile.avatarUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-gray-900 leading-tight truncate">
                  {selectedUser.profile.firstName} {selectedUser.profile.lastName}
                </p>
                <p className="text-xs text-gray-500">{selectedUser.account.email}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      selectedUser.role === 'admin'
                        ? 'bg-gray-800 text-white border border-gray-900/20 font-semibold'
                        : selectedUser.role === 'worker'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold'
                          : 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold'
                    }
                  >
                    {selectedUser.role === 'admin'
                      ? 'Administrador'
                      : selectedUser.role === 'worker'
                        ? 'Profesional'
                        : 'Cliente'}
                  </Badge>

                  {selectedUser.account.verified ? (
                    <Badge variant="success" className="font-semibold">
                      <ShieldCheck className="mr-1 h-3 w-3" /> Verificado
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="font-semibold">Sin verificar</Badge>
                  )}

                  <Badge
                    className={
                      selectedUser.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-red-50 text-red-700 border border-red-200/60'
                    }
                  >
                    {selectedUser.status === 'active' ? 'Activo' : 'Suspendido'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100">
                <p className="text-gray-400 font-medium">Calificación</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <StarRating rating={selectedUser.stats.rating} size="sm" />
                  <span className="font-bold text-gray-900">
                    {selectedUser.stats.rating.toFixed(1)} ({selectedUser.stats.ratingCount})
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100">
                <p className="text-gray-400 font-medium">Trabajos completados</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">
                  {selectedUser.stats.completedJobs}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100">
                <p className="text-gray-400 font-medium">Fecha de Registro</p>
                <p className="font-bold text-gray-900 mt-0.5">
                  {formatDate(selectedUser.createdAt)}
                </p>
              </div>

              <div className="rounded-2xl bg-gray-50 p-3.5 border border-gray-100">
                <p className="text-gray-400 font-medium">Último acceso</p>
                <p className="font-bold text-gray-900 mt-0.5">
                  {formatDate(
                    selectedUser.account.lastLogin || selectedUser.createdAt
                  )}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              {selectedUser.role === 'admin' ? (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    handleRemoveAdmin(selectedUser);
                    setDetailOpen(false);
                  }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Quitar rol de admin
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  onClick={() => {
                    handleMakeAdmin(selectedUser);
                    setDetailOpen(false);
                  }}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Hacer administrador
                </Button>
              )}
              {selectedUser.status === 'active' ? (
                <Button
                  variant="danger"
                  className="rounded-xl"
                  onClick={() => {
                    handleSuspend(selectedUser);
                    setDetailOpen(false);
                  }}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Suspender usuario
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  onClick={() => {
                    handleActivate(selectedUser);
                    setDetailOpen(false);
                  }}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activar usuario
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}