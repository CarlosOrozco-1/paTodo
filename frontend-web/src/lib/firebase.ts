import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Emuladores locales (solo desarrollo). En producción se usa Firebase real.
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL);
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST,
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT),
  );
}