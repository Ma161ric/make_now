import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { useTheme } from '../theme/themeContext';
import { usePreferences } from '../context/PreferencesContext';
import styles from './SettingsScreen.module.css';

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { preferences, updateDefaultScreen, updateMaxHoursPerDay } = usePreferences();
  const navigate = useNavigate();
  const [tempHours, setTempHours] = useState(preferences.maxHoursPerDay);

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
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.displayName}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  '👤'
                )}
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

        {/* App Preferences Section */}
        <div className={styles.section}>
          <h2>App-Einstellungen</h2>
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>Startseite</p>
              <p className={styles.settingDescription}>
                Aktuell: <strong>{preferences.defaultScreen === 'notes' ? 'Inbox' : preferences.defaultScreen === 'today' ? 'Heute' : 'Kalender'}</strong>
              </p>
            </div>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.toggleButton} ${preferences.defaultScreen === 'notes' ? styles.active : ''}`}
                onClick={() => updateDefaultScreen('notes')}
              >
                📥 Inbox
              </button>
              <button
                className={`${styles.toggleButton} ${preferences.defaultScreen === 'today' ? styles.active : ''}`}
                onClick={() => updateDefaultScreen('today')}
              >
                📅 Heute
              </button>
              <button
                className={`${styles.toggleButton} ${preferences.defaultScreen === 'week' ? styles.active : ''}`}
                onClick={() => updateDefaultScreen('week')}
              >
                🗓️ Woche
              </button>
            </div>
          </div>
        </div>

        {/* Scheduling Limits Section */}
        <div className={styles.section}>
          <h2>⏰ Tagesplanung</h2>
          <div className={styles.setting}>
            <div className={styles.settingInfo}>
              <p className={styles.settingLabel}>Maximale Stunden pro Tag</p>
              <p className={styles.settingDescription}>
                {tempHours}h/Tag (max 12h)
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="1"
                max="12"
                step="0.5"
                value={tempHours}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setTempHours(value);
                  updateMaxHoursPerDay(value);
                }}
                style={{
                  flex: 1,
                  minWidth: '120px',
                  cursor: 'pointer',
                }}
                title="Tägliche verfügbare Stunden für die Planung"
              />
              <span style={{ minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>
                {tempHours}h
              </span>
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
            <p className={styles.settingLabel} style={{ marginBottom: '12px' }}>
              Automatische Task-Limits basierend auf {tempHours}h/Tag:
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Lange
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                  {preferences.schedulingLimits.max_long_tasks}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  60-120 min
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Mittel
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                  {preferences.schedulingLimits.max_middle_tasks}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  20-60 min
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                  Kurz
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                  {preferences.schedulingLimits.max_short_tasks}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                  5-20 min
                </div>
              </div>
            </div>
            <p style={{
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '12px',
              fontStyle: 'italic',
            }}>
              Die Limits passen sich automatisch an die verfügbaren Stunden an. Beim Review können Sie die gewünschten Tasks auswählen.
            </p>
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
