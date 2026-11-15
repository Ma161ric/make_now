import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/** Installed on the home screen (PWA) instead of running in a browser tab */
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

// In the installed app Google sign-in runs as a redirect. iOS only lets that
// keep its login state when the auth pages come from our own domain, so they
// are proxied there (vercel.json rewrites /__/auth/* to Firebase).
const PROXY_HOST = 'make-now.vercel.app';
const useOwnAuthDomain = isStandalone && typeof window !== 'undefined' && window.location.hostname === PROXY_HOST;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: useOwnAuthDomain ? PROXY_HOST : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Firebase configuration is missing. Please check your .env file and ensure all VITE_FIREBASE_* variables are set.'
  );
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Auth and get a reference to the service
export const auth = getAuth(app);

// Lazy Firestore getter to enable code-splitting
let cachedDb: any | null = null;
export async function getDb() {
  if (cachedDb) return cachedDb;
  const { initializeFirestore } = await import('firebase/firestore');
  // Optional fields (due_at, notes, ...) are often undefined: drop them
  // instead of rejecting the whole write.
  cachedDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
  return cachedDb;
}

export default app;
