import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDQ3VjbMysjcqOV13JxYrtcSQ-9gTESGbA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'make-now-3867c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'make-now-3867c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'make-now-3867c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '880850464950',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:880850464950:web:9e678d5d5eaf6e911af617',
};

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
