import { apiPost } from '../firebase/rest';
import { ensureApiWarm } from '../apiWarmup';
import type { JobPayment } from '@/types/job.types';

export type DemoPaymentMethod = 'demo_card' | 'demo_cash' | 'demo_bank';

const METHODS: readonly string[] = ['demo_card', 'demo_cash', 'demo_bank'];

export const realPayments = {
  /**
   * Registra el pago simulado en el servidor (POST /createPayment).
   * El servidor valida dueño/estado, calcula comisión y notifica al trabajador.
   */
  async create(jobId: string, method: DemoPaymentMethod): Promise<JobPayment> {
    await ensureApiWarm();
    const response = await apiPost<Record<string, unknown>>('/createPayment', {
      jobId,
      method,
    });
    const paymentId = typeof response.id === 'string' ? response.id : '';
    const amount = Number(response.amount);
    const currency = typeof response.currency === 'string' ? response.currency : 'GTQ';
    const returnedMethod =
      typeof response.method === 'string' && METHODS.includes(response.method)
        ? (response.method as DemoPaymentMethod)
        : method;
    if (!paymentId || !Number.isFinite(amount) || amount <= 0) {
      throw new Error('No se pudo registrar el pago en el servidor');
    }
    return {
      paymentId,
      status: 'paid',
      amount,
      currency,
      method: returnedMethod,
      isDemo: response.isDemo !== false,
    };
  },
};
