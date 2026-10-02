import test, { after, before, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs } from 'firebase/firestore';

import {
  BOTH_UID,
  CLIENT_UID,
  FIRESTORE_RULES,
  PROJECT_ID,
  STRANGER_UID,
  WORKER_UID,
  conversationDoc,
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
    await setDoc(doc(db, 'conversations', 'conv-1'), conversationDoc());
    await setDoc(
      doc(db, 'conversations', 'conv-1', 'messages', 'msg-1'),
      { senderId: WORKER_UID, text: 'Hola, ya voy en camino', createdAt: '2024-06-01T00:00:00.000Z' },
    );
  });
});

const asClient = () => testEnv.authenticatedContext(CLIENT_UID, { role: 'client' }).firestore();
const asWorker = () => testEnv.authenticatedContext(WORKER_UID, { role: 'worker' }).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER_UID, { role: 'client' }).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

// ---------------------------------------------------------------- permitidos

test('un participante puede leer la conversacion', async () => {
  await assertSucceeds(getDoc(doc(asClient(), 'conversations', 'conv-1')));
});

test('un participante puede enviar un mensaje con senderId propio', async () => {
  await assertSucceeds(
    addDoc(collection(asWorker(), 'conversations', 'conv-1', 'messages'), {
      senderId: WORKER_UID,
      text: 'Ya llego',
      createdAt: '2024-06-01T10:00:00.000Z',
    }),
  );
});

test('un participante puede marcar lastReadAt', async () => {
  await assertSucceeds(
    updateDoc(doc(asClient(), 'conversations', 'conv-1'), {
      'lastReadAt': { [CLIENT_UID]: '2024-06-01T10:00:00.000Z' },
    }),
  );
});

// ---------------------------------------------------------------- denegados

test('un NO participante no puede leer la conversacion', async () => {
  await assertFails(getDoc(doc(asStranger(), 'conversations', 'conv-1')));
});

test('un NO participante no puede leer los mensajes', async () => {
  await assertFails(getDoc(doc(asStranger(), 'conversations', 'conv-1', 'messages', 'msg-1')));
});

test('un NO participante no puede enviar mensajes', async () => {
  await assertFails(
    addDoc(collection(asStranger(), 'conversations', 'conv-1', 'messages'), {
      senderId: STRANGER_UID,
      text: 'Me colé',
      createdAt: '2024-06-01T10:00:00.000Z',
    }),
  );
});

test('un participante NO puede suplantar el senderId de otro (suplantacion)', async () => {
  await assertFails(
    addDoc(collection(asStranger(), 'conversations', 'conv-1', 'messages'), {
      senderId: WORKER_UID,
      text: 'Mensaje firmado por otro',
      createdAt: '2024-06-01T10:00:00.000Z',
    }),
  );
});

test('los mensajes NO se pueden editar ni borrar, ni por su autor', async () => {
  await assertFails(
    updateDoc(doc(asWorker(), 'conversations', 'conv-1', 'messages', 'msg-1'), { text: 'Reescrito' }),
  );
  await assertFails(deleteDoc(doc(asWorker(), 'conversations', 'conv-1', 'messages', 'msg-1')));
});

test('NADIE puede crear una conversacion desde el cliente (solo al aceptar oferta)', async () => {
  await assertFails(
    setDoc(doc(asClient(), 'conversations', 'conv-falsa'), conversationDoc()),
  );
});

test('un participante NO puede reabrir una conversacion cerrada cambiando status', async () => {
  await seed(testEnv, async (db) => {
    await setDoc(
      doc(db, 'conversations', 'conv-cerrada'),
      conversationDoc({ status: 'closed' }),
    );
  });
  await assertFails(
    updateDoc(doc(asClient(), 'conversations', 'conv-cerrada'), { status: 'active' }),
  );
});

test('un participante NO puede colarse en una conversacion ajena modificando participants', async () => {
  await assertFails(
    updateDoc(doc(asStranger(), 'conversations', 'conv-1'), {
      participants: [CLIENT_UID, WORKER_UID, STRANGER_UID],
    }),
  );
});

test('un participante NO puede cambiar el jobId ni el snapshot de la conversacion', async () => {
  await assertFails(updateDoc(doc(asClient(), 'conversations', 'conv-1'), { jobId: 'job-otro' }));
  await assertFails(
    updateDoc(doc(asClient(), 'conversations', 'conv-1'), {
      participantsSnapshot: { [CLIENT_UID]: { name: 'Falso', avatarUrl: null } },
    }),
  );
});

test('un anonimo no puede leer ni enviar mensajes', async () => {
  await assertFails(getDoc(doc(asAnon(), 'conversations', 'conv-1')));
  await assertFails(
    addDoc(collection(asAnon(), 'conversations', 'conv-1', 'messages'), {
      senderId: 'anon',
      text: 'hola',
    }),
  );
});

test('un usuario con rol both que no es participante no accede a la conversacion', async () => {
  const bothDb = testEnv.authenticatedContext(BOTH_UID, { role: 'both' }).firestore();
  await assertFails(getDoc(doc(bothDb, 'conversations', 'conv-1')));
  await assertFails(getDocs(collection(bothDb, 'conversations')));
});
