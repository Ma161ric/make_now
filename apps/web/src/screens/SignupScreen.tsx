import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { AuthLayout, GoogleMark } from '../components/AuthLayout';
import styles from './Auth.module.css';

export const SignupScreen: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { signup, loginWithGoogle, loginWithApple, error } = useAuth();
  const navigate = useNavigate();

  const run = async (fn: () => Promise<unknown>) => {
    setIsLoading(true);
    try {
      await fn();
      navigate('/today');
    } catch {
      // shown via AuthContext error
    } finally {
      setIsLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (password !== confirmPassword) {
      setValidationError('Die Passwörter stimmen nicht überein.');
      return;
    }
    run(() => signup(email, password, displayName));
  };

  return (
    <AuthLayout title="Konto erstellen" subtitle="In einer Minute startklar. Kostenlos.">
      {(validationError || error) && <div className={styles.error} role="alert">{validationError || error}</div>}

      <button type="button" className={styles.google} onClick={() => run(loginWithGoogle)} disabled={isLoading}>
        <GoogleMark /> Mit Google registrieren
      </button>

      <div className={styles.divider}>oder mit E-Mail</div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.field}>
          <label htmlFor="displayName">Name</label>
          <input id="displayName" type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isLoading} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="email">E-Mail</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" disabled={isLoading} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Passwort</label>
          <input id="password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="confirmPassword">Passwort wiederholen</label>
          <input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} required />
        </div>
        <button type="submit" className={styles.submit} disabled={isLoading}>
          {isLoading ? 'Erstelle Konto …' : 'Konto erstellen'}
        </button>
      </form>

      <button type="button" className={styles.secondary} onClick={() => run(loginWithApple)} disabled={isLoading}>
        Mit Apple registrieren
      </button>

      <p className={styles.legal}>
        Mit der Registrierung stimmst du den <Link to="/terms">Nutzungsbedingungen</Link> und der <Link to="/privacy">Datenschutzerklärung</Link> zu.
      </p>
      <p className={styles.footer}>
        Schon dabei? <Link to="/login" className={styles.switchLink}>Anmelden</Link>
      </p>
    </AuthLayout>
  );
};
