import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  AuthError,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { dropPushSubscription, clearDeviceData } from '../utils/deviceData';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  provider: 'email' | 'google' | 'apple';
}

export interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const authError = error as { code: string; message: string };
    switch (authError.code) {
      case 'auth/email-already-in-use':
        return 'Diese E-Mail wird bereits verwendet';
      case 'auth/weak-password':
      case 'auth/password-does-not-meet-requirements':
        return 'Passwort ist zu kurz: mindestens 12 Zeichen';
      case 'auth/invalid-email':
        return 'Ungültige E-Mail-Adresse';
      // same message for all three: nobody can find out which e-mails have an account
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'E-Mail oder Passwort stimmt nicht';
      case 'auth/missing-password':
        return 'Bitte gib dein Passwort ein';
      case 'auth/too-many-requests':
        return 'Zu viele Versuche. Warte kurz und versuch es dann nochmal.';
      case 'auth/network-request-failed':
        return 'Keine Verbindung. Prüf dein Internet und versuch es nochmal.';
      case 'auth/user-disabled':
        return 'Dieses Konto ist gesperrt';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Anmeldung abgebrochen';
      case 'auth/popup-blocked':
        return 'Das Anmeldefenster wurde blockiert. Erlaube Pop-ups für diese Seite und versuch es nochmal.';
      case 'auth/requires-recent-login':
        return 'Bitte melde dich einmal neu an und versuch es dann nochmal.';
      default:
        return 'Anmeldung hat nicht geklappt. Bitte nochmal versuchen.';
    }
  }
  return error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten';
};

const mapFirebaseUser = (fbUser: any): User => {
  let provider: 'email' | 'google' | 'apple' = 'email';
  
  if (fbUser.providerData && fbUser.providerData.length > 0) {
    const providerId = fbUser.providerData[0]?.providerId || '';
    if (providerId.includes('google')) {
      provider = 'google';
    } else if (providerId.includes('apple')) {
      provider = 'apple';
    }
  }
  
  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    avatar: fbUser.photoURL || undefined,
    provider,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        setUser(mapFirebaseUser(fbUser));
        setFirebaseUser(fbUser);
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signup = async (email: string, password: string, displayName: string) => {
    setError(null);
    setLoading(true);
    try {
      // Validation
      if (!email || !password || !displayName) {
        throw new Error('Alle Felder sind erforderlich');
      }
      if (password.length < 12) {
        throw new Error('Passwort muss mindestens 12 Zeichen lang sein');
      }
      if (!email.includes('@')) {
        throw new Error('Ungültige E-Mail-Adresse');
      }

      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName,
      });
      // confirmation mail: until it is confirmed, the AI can only be used a little
      await sendEmailVerification(userCredential.user).catch(() => {});

      // Firebase auth state listener will handle setting user
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      if (!email || !password) {
        throw new Error('E-Mail und Passwort sind erforderlich');
      }

      await signInWithEmailAndPassword(auth, email, password);
      // Firebase auth state listener will handle setting user
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      await signInWithPopup(auth, provider);
      // Firebase auth state listener will handle setting user
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithApple = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');

      await signInWithPopup(auth, provider);
      // Firebase auth state listener will handle setting user
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError(null);
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      // nothing of this account stays on the device: no reminders, no chat, no cached plans
      await dropPushSubscription();
      await signOut(auth);
      clearDeviceData(uid);
      setUser(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Mail with a link to set a new password. Unknown addresses look the same
  // (no hint which e-mails have an account).
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') return;
      if (err?.code === 'auth/invalid-email' || err?.code === 'auth/missing-email') throw new Error('Gib zuerst eine gültige E-Mail-Adresse ein');
      throw new Error(getErrorMessage(err));
    }
  };

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    error,
    signup,
    login,
    loginWithGoogle,
    loginWithApple,
    logout,
    resetPassword,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
