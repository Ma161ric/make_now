import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  provider: 'email' | 'google' | 'apple';
}

export interface AuthContextType {
  user: User | null;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  // Persist user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [user]);

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

      // In production: call Firebase Auth
      // For now: mock implementation with localStorage
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        displayName,
        provider: 'email',
      };

      setUser(mockUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrierung fehlgeschlagen';
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

      // In production: call Firebase Auth
      // For now: mock implementation
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        displayName: email.split('@')[0],
        provider: 'email',
      };

      setUser(mockUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen';
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
      // In production: Firebase Google Sign-In
      // For now: mock implementation
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email: `user${Date.now()}@google.mock`,
        displayName: 'Google User',
        avatar: '👤',
        provider: 'google',
      };

      setUser(mockUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google-Anmeldung fehlgeschlagen';
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
      // In production: Firebase Apple Sign-In
      // For now: mock implementation
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email: `user${Date.now()}@apple.mock`,
        displayName: 'Apple User',
        avatar: '🍎',
        provider: 'apple',
      };

      setUser(mockUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Apple-Anmeldung fehlgeschlagen';
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
      // In production: call Firebase Auth logout
      setUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Abmeldung fehlgeschlagen';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
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
