import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './theme/themeContext';
import { useAuth } from './auth/authContext';
import styles from './App.module.css';
import './styles.css';

export default function App() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Hide header on auth pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';
  
  return (
    <div className="app-shell">
      {!isAuthPage && (
        <header className="app-header">
          <div className="brand">Dayflow</div>
          {isAuthenticated && (
            <nav className="nav">
              <Link className={location.pathname === '/' ? 'active' : ''} to="/">Inbox</Link>
              <Link className={location.pathname === '/today' ? 'active' : ''} to="/today">Today</Link>
              <Link className={location.pathname === '/week' ? 'active' : ''} to="/week">Calendar</Link>
              <Link className={location.pathname === '/tasks' ? 'active' : ''} to="/tasks">Tasks</Link>
            </nav>
          )}
          <div className={styles.headerRight}>
            <button 
              className="theme-toggle" 
              onClick={toggleTheme} 
              title="Theme togglen"
              aria-label={theme === 'light' ? 'Zum dunklen Modus wechseln' : 'Zum hellen Modus wechseln'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {isAuthenticated && user && (
              <button
                className={styles.userButton}
                onClick={() => navigate('/settings')}
                title={`Einstellungen für ${user.displayName}`}
                aria-label={`Benutzereinstellungen öffnen (angemeldet als ${user.displayName})`}
              >
                <span className={styles.userAvatar}>
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.displayName}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    '👤'
                  )}
                </span>
                <span className={styles.userName}>{user.displayName}</span>
              </button>
            )}
          </div>
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
