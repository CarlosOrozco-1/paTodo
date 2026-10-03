import type { UserRole } from '@/types/user.types';

/**
 * El rol `both` es un一等 citizen: el backend, las reglas de Firestore y el
 * móvil ya lo admiten. Estos helpers evitan que la UI vuelva a decidir el rol
 * con ternarios dispersos, que es lo que hace que `both` caiga en un panel.
 */

export const CLIENT_ROLES: readonly UserRole[] = ['client', 'both'];
export const WORKER_ROLES: readonly UserRole[] = ['worker', 'both'];
export const ADMIN_ROLES: readonly UserRole[] = ['admin'];

export function isClient(role: UserRole | undefined | null): boolean {
  return role === 'client' || role === 'both';
}

export function isWorker(role: UserRole | undefined | null): boolean {
  return role === 'worker' || role === 'both';
}

export function isAdmin(role: UserRole | undefined | null): boolean {
  return role === 'admin';
}

export function isBoth(role: UserRole | undefined | null): boolean {
  return role === 'both';
}

export function canPublishJobs(role: UserRole | undefined | null): boolean {
  return isClient(role);
}

export function canSendOffers(role: UserRole | undefined | null): boolean {
  return isWorker(role);
}

export function canAccessRoles(
  role: UserRole | undefined | null,
  allowed: readonly UserRole[],
): boolean {
  if (!role) return false;
  if (allowed.includes(role)) return true;
  // `both` satisface una ruta de cliente o de profesional. Sin esto, cada
  // guard de App.tsx rechazaría a estos usuarios en los dos paneles.
  if (role === 'both') {
    return allowed.some((r) => r === 'client' || r === 'worker');
  }
  return false;
}

/**
 * Estrecha un rol que llega como `string` (respuesta de la API REST, claim de
 * Firebase, dato crudo de Firestore) a `UserRole`. Un valor desconocido cae en
 * `client` a propósito: es el rol de menor privilegio, así que un rol corrupto
 * nunca abre un panel que no corresponde.
 */
export function parseUserRole(value: unknown): UserRole {
  return value === 'admin' || value === 'both' || value === 'worker' || value === 'client'
    ? value
    : 'client';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  client: 'Cliente',
  worker: 'Profesional',
  both: 'Cliente y Profesional',
  admin: 'Administrador',
};

/** Ruta de inicio por rol. `both` entra por su panel de cliente. */
export function homeRouteFor(role: UserRole | undefined | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'worker') return '/profesional';
  return '/cliente';
}

export function dashboardRouteFor(role: UserRole | undefined | null): string {
  return homeRouteFor(role);
}

export function profileRouteFor(role: UserRole | undefined | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'worker') return '/profesional/perfil';
  return '/cliente/perfil';
}
