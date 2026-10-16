import { isDemoMode } from './demo';
import { realPayments, type DemoPaymentMethod } from './real/real-payments';
import type { JobPayment } from '@/types/job.types';

export type { DemoPaymentMethod };

export const paymentsService = {
  /**
   * Crea el pago simulado. En modo real va al servidor (POST /createPayment,
   * que valida, calcula comisión y notifica). En modo demo explícito devuelve
   * un recibo local que no persiste.
   */
  async create(jobId: string, method: DemoPaymentMethod): Promise<JobPayment> {
    if (isDemoMode()) {
      return {
        paymentId: `demo_${Date.now()}`,
        status: 'paid',
        amount: 0,
        currency: 'GTQ',
        method,
        isDemo: true,
      };
    }
    return realPayments.create(jobId, method);
  },
};
