import test, { after, before, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

import {
  CLIENT_UID,
  FIRESTORE_RULES,
  PROJECT_ID,
  STRANGER_UID,
  WORKER_UID,
  jobDoc,
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
    await setDoc(
      doc(db, 'jobs', 'job-1'),
      jobDoc({ workerId: WORKER_UID, status: 'in_progress' }),
    );
  });
});

const asClient = () => testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
const asWorker = () => testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID, { role: 'worker' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();
const trackingDoc = (db, jobId = 'job-1') => doc(db, 'jobs', jobId, 'tracking', 'current');

function validPosition(overrides = {}) {
  return {
    workerId: WORKER_UID,
    latitude: 14.6349,
    longitude: -90.5069,
    accuracyMeters: 12,
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

test('el trabajador asignado puede publicar y actualizar su posicion', async () => {
  const workerDb = asWorker();
  await assertSucceeds(setDoc(trackingDoc(workerDb), validPosition()));
  await assertSucceeds(setDoc(trackingDoc(workerDb), validPosition({ accuracyMeters: 8 })));
});

test('el cliente y el trabajador asignado pueden leer la posicion actual', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'jobs', 'job-1', 'tracking', 'current'), {
      workerId: WORKER_UID,
      latitude: 14.6349,
      longitude: -90.5069,
      updatedAt: Timestamp.now(),
    });
  });

  await assertSucceeds(getDoc(trackingDoc(asClient())));
  await assertSucceeds(getDoc(trackingDoc(asWorker())));
});

test('un tercero y un anonimo no pueden leer la posicion', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'jobs', 'job-1', 'tracking', 'current'), {
      workerId: WORKER_UID,
      latitude: 14.6349,
      longitude: -90.5069,
      updatedAt: Timestamp.now(),
    });
  });

  await assertFails(getDoc(trackingDoc(asStranger())));
  await assertFails(getDoc(trackingDoc(asAnon())));
});

test('el cliente no puede publicar una posicion ni suplantar al trabajador', async () => {
  await assertFails(setDoc(trackingDoc(asClient()), validPosition({ workerId: CLIENT_UID })));
});

test('un trabajador no asignado no puede publicar ubicacion', async () => {
  const strangerDb = asStranger();
  await assertFails(
    setDoc(trackingDoc(strangerDb), validPosition({ workerId: STRANGER_UID })),
  );
});

test('la escritura se rechaza para trabajos terminados y para puntos fuera de rango', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'jobs', 'job-done'),
      jobDoc({ workerId: WORKER_UID, status: 'completed' }),
    );
  });

  const workerDb = asWorker();
  await assertFails(setDoc(trackingDoc(workerDb, 'job-done'), validPosition()));
  await assertFails(
    setDoc(
      trackingDoc(workerDb),
      validPosition({ latitude: 91 }),
    ),
  );
});

test('la ubicacion rechaza campos extra y timestamps definidos por el cliente', async () => {
  const workerDb = asWorker();
  await assertFails(setDoc(trackingDoc(workerDb), validPosition({ extraData: 'no permitido' })));
  await assertFails(
    setDoc(trackingDoc(workerDb), validPosition({ updatedAt: Timestamp.now() })),
  );
});