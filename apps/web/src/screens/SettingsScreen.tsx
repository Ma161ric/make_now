import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../theme/themeContext';
import { CalendarSettings, Row } from '../components/CalendarSettings';
import styles from './SettingsScreen.module.css';

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const name = user?.displayName || user?.email || '';
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>Einstellungen</h1>

      <section className={`${styles.section} ${styles.profile}`} aria-label="Konto">
        <div className={styles.avatar} aria-hidden="true">
          {user?.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" /> : initial}
        </div>
        <div className={styles.rowText}>
          <p className={styles.name}>{user?.displayName}</p>
          <p className={styles.hint}>{user?.email}</p>
        </div>
        <button className={styles.ghost} onClick={handleLogout}>Abmelden</button>
      </section>

      <CalendarSettings />

      <section className={styles.section} aria-labelledby="look-h">
        <h2 id="look-h">Darstellung</h2>
        <Row label="Design">
          <div className={styles.segment} role="group" aria-label="Design">
            <button aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggleTheme()}>Hell</button>
            <button aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggleTheme()}>Dunkel</button>
          </div>
        </Row>
      </section>

      <p className={styles.footer}>
        DayFlow · <a href="/privacy">Datenschutz</a> · <a href="/terms">Nutzungsbedingungen</a>
      </p>
    </div>
  );
};
