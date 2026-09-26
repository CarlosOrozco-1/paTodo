export const JOB_STATUS = {
  PENDING: 'pending',
  PUBLISHED: 'published',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const OFFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  COUNTERED: 'countered',
} as const;

export const USER_ROLE = {
  CLIENT: 'client',
  WORKER: 'worker',
  ADMIN: 'admin',
} as const;

export const PRICE_TYPE = {
  FIXED: 'fixed',
  NEGOTIABLE: 'negotiable',
} as const;

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  published: 'Nueva solicitud',
  assigned: 'Aceptada',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelada',
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
  countered: 'Contraoferta',
};

export const JOB_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  published: 'bg-teal-100 text-teal-800',
  assigned: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-teal-100 text-teal-800',
  completed: 'bg-brand-100 text-brand-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const OFFER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-700',
  countered: 'bg-purple-100 text-purple-800',
};

export const WEEK_DAYS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

export const DEFAULT_CURRENCY = 'GTQ';