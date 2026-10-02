import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

import {
  BOTH_UID,
  CLIENT_UID,
  FIRESTORE_RULES,
  PROJECT_ID,
  STRANGER_UID,
  WORKER_UID,
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
    await setDoc(doc(db, 'users', CLIENT_UID), userDoc());
  });
});

const asClient = () => testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID, { role: 'client' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// ---------------------------------------------------------------- permitidos

test('el dueno puede actualizar su perfil', async () => {
  await assertSucceeds(
    updateDoc(doc(asClient(), 'users', CLIENT_UID), { 'profile.bio': 'Hola' }),
  );
});

test('el dueno puede actualizar su availability (toggle en linea)', async () => {
  await assertSucceeds(
    updateDoc(doc(asClient(), 'users', CLIENT_UID), {
      availability: { isOnline: true },
      updatedAt: '2024-06-01T00:00:00.000Z',
    }),
  );
});

test('el dueno puede guardar sus fcmTokens', async () => {
  await assertSucceeds(
    updateDoc(doc(asClient(), 'users', CLIENT_UID), { fcmTokens: ['token-abc'] }),
  );
});

test('cualquier usuario autenticado puede leer otro perfil (ruta /perfil/:id)', async () => {
  await assertSucceeds(getDoc(doc(asStranger(), 'users', CLIENT_UID)));
});

// ---------------------------------------------------------------- denegados

test('el dueno NO puede inflarse su propia rating', async () => {
  await assertFails(
    updateDoc(doc(asClient(), 'users', CLIENT_UID), { rating: 5, ratingCount: 999 }),
  );
});

test('el dueno NO puede cambiar su propio role (escalada de privilegios)', async () => {
  await assertFails(
    updateDoc(doc(asClient(), 'users', CLIENT_UID), { role: 'admin' }),
  );
});

test('el dueno NO puede cambiar su uid ni su email', async () => {
  await assertFails(updateDoc(doc(asClient(), 'users', CLIENT_UID), { email: 'otro@test.com' }));
  await assertFails(updateDoc(doc(asClient(), 'users', CLIENT_UID), { uid: 'otro-uid' }));
});

test('un tercero NO puede editar el perfil de otro', async () => {
  await assertFails(
    updateDoc(doc(asStranger(), 'users', CLIENT_UID), { 'profile.bio': 'Inyectado' }),
  );
});

test('NADIE puede crear un documento de usuario (solo la API)', async () => {
  await assertFails(
    setDoc(doc(asClient(), 'users', 'nuevo-uid'), userDoc({ uid: 'nuevo-uid' })),
  );
});

test('NADIE puede borrar un documento de usuario', async () => {
  await assertFails(deleteDoc(doc(asClient(), 'users', CLIENT_UID)));
});

test('un usuario con rol both tampoco puede tocar campos de la API', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'users', BOTH_UID), userDoc({ uid: BOTH_UID, role: 'both' }));
  });
  const bothDb = testEnv.authenticatedContext(BOTH_UID, { role: 'both' }).firestore();
  await assertFails(updateDoc(doc(bothDb, 'users', BOTH_UID), { rating: 5 }));
  await assertSucceeds(updateDoc(doc(bothDb, 'users', BOTH_UID), { 'profile.bio': 'ok' }));
});

// ------------------------------------------- alta con Google (sin teléfono)

// Un ingreso con Google nunca trae phoneNumber, así que la API crea el perfil
// con contact.phone en "". Estas pruebas fijan ese contrato: el documento
// incompleto es legible y editable por su dueño, y rellenarlo es un update
// normal de `contact`, no una excepción en las reglas.

test('un perfil creado con Google (sin telefono) sigue siendo legible por su dueno', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'users', WORKER_UID),
      userDoc({ uid: WORKER_UID, email: 'google@test.com', contact: { phone: '' } }),
    );
  });
  const workerDb = testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
  const snap = await assertSucceeds(getDoc(doc(workerDb, 'users', WORKER_UID)));
  assert.equal(snap.data().contact.phone, '');
});

test('el dueno puede rellenar su telefono faltante en el onboarding', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'users', WORKER_UID),
      userDoc({ uid: WORKER_UID, email: 'google@test.com', contact: { phone: '' } }),
    );
  });
  const workerDb = testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
  await assertSucceeds(
    updateDoc(doc(workerDb, 'users', WORKER_UID), { 'contact.phone': '+502 5555-0009' }),
  );
});

test('un usuario con rol both tambien puede rellenar su telefono faltante', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'users', BOTH_UID),
      userDoc({ uid: BOTH_UID, role: 'both', contact: { phone: '' } }),
    );
  });
  const bothDb = testEnv.authenticatedContext(BOTH_UID, { role: 'both' }).firestore();
  await assertSucceeds(
    updateDoc(doc(bothDb, 'users', BOTH_UID), { 'contact.phone': '55551234' }),
  );
});

test('rellenar el telefono NO habilita tocar campos de la API', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'users', WORKER_UID),
      userDoc({ uid: WORKER_UID, email: 'google@test.com', contact: { phone: '' } }),
    );
  });
  const workerDb = testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
  await assertFails(
    updateDoc(doc(workerDb, 'users', WORKER_UID), {
      'contact.phone': '+502 5555-0009',
      role: 'admin',
    }),
  );
  await assertFails(
    updateDoc(doc(workerDb, 'users', WORKER_UID), {
      'contact.phone': '+502 5555-0009',
      verified: true,
    }),
  );
});

test('un usuario NO puede escribir documentos en la coleccion users de otros', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(doc(db, 'users', WORKER_UID), userDoc({ uid: WORKER_UID, email: 'w@test.com' }));
  });
  await assertFails(
    addDoc(collection(asClient(), 'users'), userDoc({ uid: 'inventado' })),
  );
});

// HALLAZGO (no es un fallo de la prueba): el guardián smallEnough() de
// firestore.rules NO está midiendo bytes. Un update de ~200 KB en profile.bio
// se acepta sin error, así que la condición `request.resource.data.size() <=
// 131072` nunca se cumple en falso. Medir el tamaño así no protege del DoS que
// el comentario dice prevenir. Queda registrado como pendiente, no como verde.
test.todo('smallEnough() debe rechazar un documento propio de mas de 128 KiB');

test('un anonimo NO puede leer perfiles', async () => {
  await assertFails(getDoc(doc(asAnon(), 'users', CLIENT_UID)));
});
