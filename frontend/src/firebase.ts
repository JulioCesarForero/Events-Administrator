import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

type ViteEnv = Record<string, string | undefined>;
const env = ((import.meta as unknown as { env?: ViteEnv })?.env || {}) as ViteEnv;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.storageBucket,
);

let appInstance: FirebaseApp | null = null;
let storageInstance: FirebaseStorage | null = null;
let anonymousAuthPromise: Promise<void> | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase no está configurado. Define VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID y VITE_FIREBASE_STORAGE_BUCKET.',
    );
  }
  if (!appInstance) {
    appInstance = initializeApp(firebaseConfig);
  }
  return appInstance;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(ensureApp());
  }
  return storageInstance;
}

export function ensureAnonymousAuth(): Promise<void> {
  if (!anonymousAuthPromise) {
    const auth = getAuth(ensureApp());
    if (auth.currentUser) {
      anonymousAuthPromise = Promise.resolve();
    } else {
      anonymousAuthPromise = signInAnonymously(auth).then(() => undefined);
    }
  }
  return anonymousAuthPromise;
}
