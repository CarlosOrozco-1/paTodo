import { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  ShieldAlert, 
  ShieldCheck, 
  XCircle, 
  Phone, 
  Calendar, 
  Briefcase, 
  Star,
  Eye,
  UserCheck
} from 'lucide-react';
import { adminService } from '@/api/admin.service';
import type { User } from '@/types/user.types';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/stores/uiStore';
import { getErrorMessage } from '@/api/axiosClient';
import { formatDate, fullName } from '@/utils/formatters';

export function VerifyProfessionals() {
  const [workers, setWorkers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const pending = await adminService.getPendingWorkers();
        setWorkers(pending);
      } catch {
        setWorkers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleVerify = async (worker: User, approve: boolean) => {
    setProcessingId(worker.id);
    try {
      await adminService.verifyWorker(
        worker.id,
        approve,
        approve ? undefined : rejectReason,
      );
      if (approve) {
        toast('success', `Profesional ${fullName(worker.profile)} aprobado correctamente`);
      } else {
        toast('info', `Profesional ${fullName(worker.profile)} rechazado`);
      }
      setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
      setRejectOpen(false);
      setDetailOpen(false);
      setRejectReason('');
      setSelectedWorker(null);
    } catch (error) {
      toast('error', getErrorMessage(error));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <Spinner label="Cargando profesionales pendientes..." />;

  const onlineCount = workers.filter((w) => w.availability?.isOnline).length;

  return (
    <div className="space-y-6">
      {/* Encabezado SaaS con estadísticas integradas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 shadow-xs border border-brand-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Verificación de Profesionales
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Evalúa y autoriza los perfiles de los prestadores de servicio pendientes
            </p>
          </div>
        </div>

        {/* Indicadores / Contadores */}
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-50 text-amber-800 border border-amber-200/80 font-bold px-3 py-1.5 rounded-xl">
            <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
            {workers.length} {workers.length === 1 ? 'pendiente' : 'pendientes'}
          </Badge>
          <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold px-3 py-1.5 rounded-xl">
            <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {onlineCount} en línea
          </Badge>
        </div>
      </div>

      {/* Grid de Solicitudes */}
      {workers.length === 0 ? (
        <EmptyState
          title="No hay solicitudes pendientes"
          description="Todos los perfiles de profesionales han sido procesados. ¡Gran trabajo!"
          icon={<ShieldCheck className="h-10 w-10 text-emerald-600" />}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          {workers.map((worker) => {
            const isProcessing = processingId === worker.id;
            const rating = worker.stats?.rating ?? 0;

            return (
              <Card
                key={worker.id}
                className="border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-3xl overflow-hidden flex flex-col justify-between bg-white"
              >
                {/* Parte Superior / Información del Usuario */}
                <div className="p-5 space-y-4">
                  {/* Avatar y Datos Principales */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar
                        name={fullName(worker.profile)}
                        src={worker.profile?.avatarUrl}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate text-base leading-snug">
                          {fullName(worker.profile)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{worker.account?.email}</p>
                      </div>
                    </div>

                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-extrabold uppercase shrink-0">
                      Pendiente
                    </Badge>
                  </div>

                  {/* Ficha de Métricas con Iconos */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded-2xl bg-gray-50/80 p-2.5 border border-gray-100">
                      <Phone className="h-4 w-4 text-brand-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">Teléfono</p>
                        <p className="font-bold text-gray-800 truncate">
                          {worker.contact?.phone || 'Sin número'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-gray-50/80 p-2.5 border border-gray-100">
                      <Calendar className="h-4 w-4 text-brand-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">Registro</p>
                        <p className="font-bold text-gray-800 truncate">
                          {formatDate(worker.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-gray-50/80 p-2.5 border border-gray-100">
                      <Star className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">Calificación</p>
                        <p className="font-bold text-gray-800">
                          {rating > 0 ? `${rating.toFixed(1)} / 5.0` : 'Nuevo ingreso'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-gray-50/80 p-2.5 border border-gray-100">
                      <Briefcase className="h-4 w-4 text-brand-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">Trabajos</p>
                        <p className="font-bold text-gray-800">
                          {worker.stats?.completedJobs ?? 0} completados
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Biografía de Altura Uniforme */}
                  <div className="min-h-[56px] rounded-2xl bg-gray-50/50 p-3 border border-gray-100/80 text-xs text-gray-600">
                    {worker.profile?.bio ? (
                      <p className="line-clamp-2 italic">"{worker.profile.bio}"</p>
                    ) : (
                      <p className="text-gray-400 italic">Sin descripción o biografía proporcionada.</p>
                    )}
                  </div>
                </div>

                {/* Botones de Acción (Fijos en la Parte Inferior) */}
                <div className="p-5 pt-0 border-t border-gray-100/80 mt-2 space-y-2">
                  <div className="pt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs"
                      onClick={() => handleVerify(worker, true)}
                      loading={isProcessing}
                      disabled={processingId !== null}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Aprobar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl font-bold"
                      onClick={() => {
                        setSelectedWorker(worker);
                        setRejectOpen(true);
                      }}
                      disabled={processingId !== null}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Rechazar
                    </Button>
                  </div>

                  {/* Ver Expediente Completo */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWorker(worker);
                      setDetailOpen(true);
                    }}
                    className="w-full text-center text-xs font-semibold text-gray-500 hover:text-brand-600 transition-colors py-1 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver expediente completo
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal para Ver Expediente Completo */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Expediente del Profesional"
        description={selectedWorker?.account?.email}
        size="md"
      >
        {selectedWorker && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 border border-gray-100">
              <Avatar
                name={fullName(selectedWorker.profile)}
                src={selectedWorker.profile?.avatarUrl}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">
                  {fullName(selectedWorker.profile)}
                </h3>
                <p className="text-xs text-gray-500">{selectedWorker.account?.email}</p>
                <div className="mt-2 flex gap-2">
                  <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                    Pendiente de verificación
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                Información de contacto
              </p>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-gray-400">Teléfono:</span>
                  <p className="font-bold text-gray-800">{selectedWorker.contact?.phone || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Registrado el:</span>
                  <p className="font-bold text-gray-800">{formatDate(selectedWorker.createdAt)}</p>
                </div>
              </div>
            </div>

            {selectedWorker.profile?.bio && (
              <div className="space-y-1.5 text-xs">
                <p className="font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                  Presentación / Biografía
                </p>
                <p className="bg-gray-50 p-3 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed">
                  {selectedWorker.profile.bio}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDetailOpen(false)}
              >
                Cerrar
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                onClick={() => {
                  handleVerify(selectedWorker, true);
                }}
                loading={processingId === selectedWorker.id}
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                Aprobar candidato
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal para Motivo de Rechazo */}
      <Modal
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false);
          setRejectReason('');
        }}
        title="Rechazar solicitud de verificación"
        description={
          selectedWorker ? `Profesional: ${fullName(selectedWorker.profile)}` : undefined
        }
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setRejectOpen(false);
                setRejectReason('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="rounded-xl shadow-xs"
              onClick={() => selectedWorker && handleVerify(selectedWorker, false)}
              loading={processingId === selectedWorker?.id}
              disabled={!rejectReason.trim()}
            >
              Confirmar rechazo
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          <Textarea
            label="Motivo del rechazo *"
            placeholder="Especifica por qué no cumple con los requisitos..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <p className="text-[11px] text-gray-500">
            Esta razón se le enviará automáticamente al correo electrónico del profesional.
          </p>
        </div>
      </Modal>
    </div>
  );
}