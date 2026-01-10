import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../theme/themeContext';
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Einstellungen</h1>
      </div>

      <div className={styles.content}>
        {/* User Profile Section */}
        <div className={styles.section}>
          <h2>Benutzerprofil</h2>
          <div className={styles.profileCard}>
            <div className={styles.profileInfo}>
              <div className={styles.avatar}>
                {user?.avatar || '👤'}
              </div>
              <div>
                <p className={styles.userName}>{user?.displayName}</p>
                <p className={styles.userEmail}>{user?.email}</p>
                <p className={styles.userProvider}>
                  Anmeldung via: <strong>{user?.provider === 'email' ? 'E-Mail' : user?.provider}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className={styles.section}>
          <h2>Erscheinungsbild</h2>
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>Design</p>
              <p className={styles.settingDescription}>
                Aktuell: <strong>{theme === 'dark' ? 'Dunkel' : 'Hell'}</strong>
              </p>
            </div>
            <button
              className={styles.toggleButton}
              onClick={toggleTheme}
              title={`Zu ${theme === 'dark' ? 'hellem' : 'dunklem'} Design wechseln`}
            >
              {theme === 'dark' ? '☀️ Helles Design' : '🌙 Dunkles Design'}
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className={styles.section}>
          <h2>Über die App</h2>
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>Version</p>
              <p className={styles.settingDescription}>1.0.0 (MVP)</p>
            </div>
          </div>
        </div>

        {/* Logout Section */}
        <div className={styles.section}>
          <button
            className={styles.logoutButton}
            onClick={handleLogout}
          >
            🚪 Abmelden
          </button>
        </div>
      </div>
    </div>
  );
};
