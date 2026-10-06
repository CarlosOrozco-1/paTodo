import test, { after, before, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
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
  userDoc,
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
    // Los tres perfiles deben existir: notSuspended() lee users/{uid} y un get()
    // sobre un documento inexistente es un error de evaluacion, no un false.
    await setDoc(doc(db, 'users', CLIENT_UID), userDoc({ uid: CLIENT_UID, role: 'client' }));
    await setDoc(doc(db, 'users', WORKER_UID), userDoc({ uid: WORKER_UID, role: 'worker' }));
    await setDoc(
      doc(db, 'users', STRANGER_UID),
      userDoc({ uid: STRANGER_UID, role: 'worker' }),
    );
    // Trabajo vigente: el cliente y el trabajador asignado pueden llamarse.
    await setDoc(
      doc(db, 'jobs', 'job-1'),
      jobDoc({ workerId: WORKER_UID, status: 'in_progress' }),
    );
    // Llamada en curso, creada por la API (reglas desactivadas).
    await setDoc(doc(db, 'calls', 'call-1'), {
      jobId: 'job-1',
      callerId: CLIENT_UID,
      calleeId: WORKER_UID,
      direction: 'outgoing',
      status: 'ringing',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
});

const asClient = () => testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
const asWorker = () => testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID, { role: 'worker' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

const callDoc = (db, callId = 'call-1') => doc(db, 'calls', callId);
const signalsRef = (db, callId = 'call-1') => collection(db, 'calls', callId, 'signals');
const signalDoc = (db, callId = 'call-1', id = 'sig-1') =>
  doc(db, 'calls', callId, 'signals', id);

function validSignal(overrides = {}) {
  return {
    from: CLIENT_UID,
    type: 'offer',
    payload: '{"type":"offer","sdp":"v=0..."}',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

// ---------- calls/{callId}: lectura y escritura exclusiva de la API ----------

test('las dos partes del trabajo pueden leer la llamada', async () => {
  await assertSucceeds(getDoc(callDoc(asClient())));
  await assertSucceeds(getDoc(callDoc(asWorker())));
});

test('un tercero y un anonimo no pueden leer la llamada', async () => {
  await assertFails(getDoc(callDoc(asStranger())));
  await assertFails(getDoc(callDoc(asAnon())));
});

test('el cliente no puede leer una llamada de otro trabajo', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'jobs', 'job-2'), jobDoc({ workerId: WORKER_UID, status: 'in_progress' }));
    await setDoc(doc(db, 'calls', 'call-2'), {
      jobId: 'job-2',
      callerId: WORKER_UID,
      calleeId: STRANGER_UID,
      direction: 'outgoing',
      status: 'ringing',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  await assertFails(getDoc(callDoc(asClient(), 'call-2')));
});

// El registro de la llamada lo escribe solo la API: si un cliente pudiera
// crearlo se fabricaria historial falso, y si pudiera actualizarlo marcaria
// como completada una llamada que nunca ocurrio.
test('ningun cliente puede crear, modificar ni borrar el registro de la llamada', async () => {
  const clientDb = asClient();
  const workerDb = asWorker();

  await assertFails(
    setDoc(callDoc(clientDb, 'call-nuevo'), {
      jobId: 'job-1',
      callerId: CLIENT_UID,
      calleeId: WORKER_UID,
      direction: 'outgoing',
      status: 'ringing',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(setDoc(callDoc(workerDb), { status: 'completed' }));
await assertFails(deleteDoc(callDoc(workerDb)));
await assertFails(deleteDoc(callDoc(clientDb, 'call-nuevo')));
});

// ---------- senalizacion: escriben los dos participantes ----------

test('cada participante puede enviar su senalizacion', async () => {
  await assertSucceeds(setDoc(signalDoc(asClient()), validSignal()));
  await assertSucceeds(
    setDoc(signalDoc(asWorker(), 'call-1', 'sig-2'), validSignal({
      from: WORKER_UID,
      type: 'answer',
      payload: '{"type":"answer","sdp":"v=0..."}',
    })),
  );
});

test('los dos participantes pueden leer la senalizacion de la llamada', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'calls', 'call-1', 'signals', 'sig-1'), validSignal());
  });

  await assertSucceeds(getDoc(signalDoc(asClient())));
  await assertSucceeds(getDoc(signalDoc(asWorker())));
});

test('un tercero y un anonimo no pueden leer ni escribir la senalizacion', async () => {
  const strangerDb = asStranger();
  await assertFails(getDoc(signalDoc(strangerDb)));
  await assertFails(setDoc(signalDoc(strangerDb), validSignal({ from: STRANGER_UID })));
  await assertFails(setDoc(signalDoc(asAnon()), validSignal({ from: CLIENT_UID })));
});

// Un cliente no puede enviar la senalizacion del otro: `from` debe ser el UID
// autenticado, o podria responderse a si mismo y suplantar la respuesta.
test('no se puede suplantar al otro participante en la senalizacion', async () => {
  await assertFails(setDoc(signalDoc(asClient()), validSignal({ from: WORKER_UID })));
});

test('la senalizacion es de solo agregado: no se edita ni se borra', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'calls', 'call-1', 'signals', 'sig-1'), validSignal());
  });

  await assertFails(setDoc(signalDoc(asClient()), validSignal({ type: 'ice' })));
  await assertFails(deleteDoc(signalDoc(asClient())));
});

test('no se senaliza si la llamada ya termino', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'calls', 'call-1'), {
      jobId: 'job-1',
      callerId: CLIENT_UID,
      calleeId: WORKER_UID,
      direction: 'outgoing',
      status: 'completed',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });

  await assertFails(setDoc(signalDoc(asClient()), validSignal()));
});

test('no se senaliza si el trabajo ya no esta vigente', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'jobs', 'job-1'),
      jobDoc({ workerId: WORKER_UID, status: 'completed' }),
    );
  });

  await assertFails(setDoc(signalDoc(asClient()), validSignal()));
});

// ---------- validacion de la forma del mensaje ----------

test('la senalizacion rechaza campos extra, tipo desconocido y payload vacio', async () => {
  await assertFails(setDoc(signalDoc(asClient()), validSignal({ extraData: 'no permitido' })));
  await assertFails(setDoc(signalDoc(asClient()), validSignal({ type: 'hack' })));
  await assertFails(setDoc(signalDoc(asClient()), validSignal({ payload: '' })));
});

test('la senalizacion rechaza un payload desmedido', async () => {
  await assertFails(
    setDoc(signalDoc(asClient()), validSignal({ payload: 'x'.repeat(16385) })),
  );
});

// El timestamp del cliente no sirve: un reloj desincronizado romperia el orden
// de la senalizacion.
test('la senalizacion exige timestamp del servidor', async () => {
  await assertFails(setDoc(signalDoc(asClient()), validSignal({ createdAt: Timestamp.now() })));
});

test('rechazar limpio cuando la llamada no existe, sin error de evaluacion', async () => {
  await assertFails(setDoc(signalDoc(asClient(), 'call-inexistente'), validSignal()));
});

// ---------- callLocks: documento interno de la API ----------

// El bloqueo de exclusion mutua es un detalle de la API. Si un cliente pudiera
// tocarlo, podria desbloquearse a si mismo y saltarse el 409 que evita el doble
// tap, o bloquear a otro usuario para siempre.
test('ningun cliente puede leer ni escribir el bloqueo de un trabajo', async () => {
  const clientDb = asClient();
  const strangerDb = asStranger();
  const lock = (db) => doc(db, 'callLocks', 'job-1');

  await assertFails(getDoc(lock(clientDb)));
  await assertFails(getDoc(lock(strangerDb)));
  await assertFails(getDoc(lock(asAnon())));

  await assertFails(setDoc(lock(clientDb), { jobId: 'job-1', callId: 'call-1' }));
  await assertFails(setDoc(lock(strangerDb), { jobId: 'job-1', callId: 'call-1' }));
  await assertFails(deleteDoc(lock(clientDb)));
  await assertFails(deleteDoc(lock(strangerDb)));
});
