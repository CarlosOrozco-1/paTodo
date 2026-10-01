import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const PROJECT_ID = 'demo-pa-todo';

export const FIRESTORE_RULES = readFileSync(join(here, '..', '..', 'firestore.rules'), 'utf8');

export const CLIENT_UID = 'client-1';
export const WORKER_UID = 'worker-1';
export const BOTH_UID = 'both-1';
export const STRANGER_UID = 'stranger-1';

/**
 * Inserta documentos con las reglas desactivadas. Es el unico mecanismo
 * previsto para sembrar estado: escribir por la via autenticada
 * comprobaria las reglas, no las.seedearia.
 */
export function seed(testEnv, writer) {
  return testEnv.withSecurityRulesDisabled(async (context) => {
    await writer(context.firestore());
  });
}

export function userDoc(overrides = {}) {
  return {
    uid: CLIENT_UID,
    email: 'cliente@test.com',
    role: 'client',
    profile: { firstName: 'Carlos', lastName: 'Cliente' },
    contact: { phone: '+502 5555-0001' },
    availability: { isOnline: false },
    fcmTokens: [],
    rating: 4.5,
    ratingCount: 12,
    completedJobs: 9,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function jobDoc(overrides = {}) {
  return {
    clientId: CLIENT_UID,
    details: { title: 'Cambio de llanta', description: 'Llanta ponchada' },
    pricing: { proposedPrice: 35, currency: 'GTQ' },
    location: { address: 'Zona 10, Guatemala' },
    status: 'pending',
    ...overrides,
  };
}

export function conversationDoc(overrides = {}) {
  return {
    jobId: 'job-1',
    participants: [CLIENT_UID, WORKER_UID],
    status: 'active',
    lastMessage: null,
    lastReadAt: {},
    ...overrides,
  };
}

export function reviewDoc(overrides = {}) {
  return {
    jobId: 'job-1',
    reviewerId: WORKER_UID,
    revieweeId: CLIENT_UID,
    rating: 5,
    comment: 'Excelente servicio',
    ...overrides,
  };
}
