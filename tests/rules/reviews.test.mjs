import test, { after, before, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

import {
  BOTH_UID,
  CLIENT_UID,
  FIRESTORE_RULES,
  PROJECT_ID,
  STRANGER_UID,
  WORKER_UID,
  reviewDoc,
  seed,
} from './helpers.mjs';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: FIRESTORE_RULES },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'reviews', 'rev-1'), reviewDoc());
  });
});

const asClient = () => testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
const asWorker = () => testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID, { role: 'client' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// ---------------------------------------------------------------- permitidos

test('cualquier usuario autenticado puede leer las reseñas (perfil y detalle de trabajo)', async () => {
  await assertSucceeds(getDoc(doc(asStranger(), 'reviews', 'rev-1')));
});

// ---------------------------------------------------------------- denegados
// Las reseñas son transaccionales: las stats las recalcula POST /createReview.
// Si el cliente pudiera escribir aqui, se saltaria la validacion de autor,
// trabajo completado y el recalculo de rating del usuario.

test('NADIE puede crear una reseña directamente, ni siquiera su autor', async () => {
  await assertFails(
    setDoc(doc(asWorker(), 'reviews', 'rev-nueva'), reviewDoc({ reviewerId: WORKER_UID })),
  );
});

test('NADIE puede editar una reseña (ni siquiera el autor)', async () => {
  await assertFails(
    updateDoc(doc(asWorker(), 'reviews', 'rev-1'), { rating: 1, comment: 'Cambiado' }),
  );
});

test('NADIE puede borrar una reseña', async () => {
  await assertFails(deleteDoc(doc(asWorker(), 'reviews', 'rev-1')));
});

test('un usuario con rol both tampoco puede escribir reseñas', async () => {
  const bothDb = testEnv.authenticatedContext(BOTH_UID, { role: 'both' }).firestore();
  await assertFails(
    setDoc(doc(bothDb, 'reviews', 'rev-both'), reviewDoc({ reviewerId: BOTH_UID })),
  );
});

test('un anonimo NO puede leer reseñas', async () => {
  await assertFails(getDoc(doc(asAnon(), 'reviews', 'rev-1')));
});
