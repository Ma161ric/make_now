import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
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
  const { getFirestore } = await import('firebase/firestore');
  cachedDb = getFirestore(app);
  return cachedDb;
}

export default app;
