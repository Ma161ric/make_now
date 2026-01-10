import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import styles from './LoginScreen.module.css';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle, loginWithApple, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/today');
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();
      navigate('/today');
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithApple();
      navigate('/today');
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Willkommen zurück</h1>
        <p className={styles.subtitle}>Melde dich an, um fortzufahren</p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.com"
              disabled={isLoading}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Passwort</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>

        <div className={styles.divider}>oder</div>

        <div className={styles.oauthButtons}>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={styles.oauthButton}
          >
            🔵 Google
          </button>
          <button
            type="button"
            onClick={handleAppleLogin}
            disabled={isLoading}
            className={styles.oauthButton}
          >
            🍎 Apple
          </button>
        </div>

        <p className={styles.footer}>
          Noch kein Konto?{' '}
          <a href="/signup" className={styles.link}>
            Jetzt registrieren
          </a>
        </p>
      </div>
    </div>
  );
};
