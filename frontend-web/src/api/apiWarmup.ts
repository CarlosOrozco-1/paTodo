import { apiGet } from './firebase/rest';

/**
 * Render (plan gratuito) apaga el contenedor tras ~15 min sin tráfico. El
 * siguiente request paga un arranque en frío de 20-50 s.
 *
 * El frontend habla con Firestore por SDK directo, así que Render puede llevar
 * medio día sin recibir una sola petición: cualquier llamada a la API es
 * siempre un arranque en frío. `/completeJob` es de las rutas más pesadas
 * (transacción + notificación + FCM), y con el arranque previo se acerca al
 * timeout de 60 s.
 *
 * Despertarlo al montar la app mueve ese coste al arranque, donde el usuario
 * no está esperando nada.
 */

let warmed = false;
let pending: Promise<void> | null = null;

async function ping(): Promise<void> {
  try {
    await apiGet<{ status?: string }>('/');
  } catch {
    // Es best-effort: si falla, el siguiente request real vuelve a intentar.
  }
}

/** Despierta el backend. No lanza y no bloquea: se llama en segundo plano. */
export function warmUpApi(): void {
  if (warmed) return;
  warmed = true;
  pending = ping();
}

/**
 * Variante para acciones sensibles: si el backend está frío, espera a que
 * termine de despertar antes de enviar la petición real. Acota la espera para
 * no exceder el timeout total del cliente.
 */
export async function ensureApiWarm(maxWaitMs = 45000): Promise<void> {
  if (!pending) {
    warmed = true;
    pending = ping();
  }
  const budget = Math.max(0, maxWaitMs);
  await Promise.race([
    pending,
    new Promise<void>((resolve) => setTimeout(resolve, budget)),
  ]);
}
