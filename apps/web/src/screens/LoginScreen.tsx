import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { AuthLayout, GoogleMark } from '../components/AuthLayout';
import styles from './Auth.module.css';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle, error } = useAuth();
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

  return (
    <AuthLayout title="Willkommen zurück" subtitle="Melde dich an und schau, was heute ansteht.">
      {error && <div className={styles.error} role="alert">{error}</div>}

      <button type="button" className={styles.google} onClick={() => run(loginWithGoogle)} disabled={isLoading}>
        <GoogleMark /> Mit Google anmelden
      </button>

      <div className={styles.divider}>oder mit E-Mail</div>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => login(email, password));
        }}
      >
        <div className={styles.field}>
          <label htmlFor="email">E-Mail</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" disabled={isLoading} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="password">Passwort</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />
        </div>
        <button type="submit" className={styles.submit} disabled={isLoading}>
          {isLoading ? 'Melde an …' : 'Anmelden'}
        </button>
      </form>


      <p className={styles.footer}>
        Neu hier? <Link to="/signup" className={styles.switchLink}>Konto erstellen</Link>
      </p>
    </AuthLayout>
  );
};
