import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { usePreferences } from '../context/PreferencesContext';
import styles from './SignupScreen.module.css';

export const SignupScreen: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { signup, loginWithGoogle, loginWithApple, error } = useAuth();
  const { preferences } = usePreferences();
  const navigate = useNavigate();

    const getDefaultPath = () => {
    if (preferences.defaultScreen === 'notes') {
      return '/inbox';
    }
    return `/${preferences.defaultScreen}`;
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password !== confirmPassword) {
      setValidationError('Passwörter stimmen nicht überein');
      return;
    }

    setIsLoading(true);
    try {
      await signup(email, password, displayName);
      navigate(getDefaultPath());
    } catch (err) {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
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

  const handleAppleSignup = async () => {
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
        <h1 className={styles.title}>Neues Konto erstellen</h1>
        <p className={styles.subtitle}>Starten Sie mit Ihrer Planung</p>

        {error && <div className={styles.error}>{error}</div>}
        {validationError && <div className={styles.error}>{validationError}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="displayName">Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Dein Name"
              disabled={isLoading}
              required
            />
          </div>

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
              placeholder="Mindestens 6 Zeichen"
              disabled={isLoading}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Passwort wiederholen</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              disabled={isLoading}
              required
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Wird registriert...' : 'Registrieren'}
          </button>
        </form>

        <div className={styles.divider}>oder</div>

        <div className={styles.oauthButtons}>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isLoading}
            className={styles.oauthButton}
          >
            🔵 Google
          </button>
          <button
            type="button"
            onClick={handleAppleSignup}
            disabled={isLoading}
            className={styles.oauthButton}
          >
            🍎 Apple
          </button>
        </div>

        <p className={styles.footer}>
          Bereits registriert?{' '}
          <a href="/login" className={styles.link}>
            Hier anmelden
          </a>
        </p>
      </div>
    </div>
  );
};
