import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  AuthError,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

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
        return 'Passwort ist zu schwach (mind. 6 Zeichen)';
      case 'auth/invalid-email':
        return 'Ungültige E-Mail-Adresse';
      case 'auth/user-not-found':
        return 'Benutzer nicht gefunden';
      case 'auth/wrong-password':
        return 'Passwort ist falsch';
      case 'auth/popup-closed-by-user':
        return 'Anmeldung abgebrochen';
      default:
        return authError.message;
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
      if (password.length < 6) {
        throw new Error('Passwort muss mindestens 6 Zeichen lang sein');
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
      await signOut(auth);
      setUser(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
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
