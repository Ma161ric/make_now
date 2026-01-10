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
          <div className="brand">Make Now</div>
          {isAuthenticated && (
            <nav className="nav">
              <Link className={location.pathname === '/' ? 'active' : ''} to="/">Inbox</Link>
              <Link className={location.pathname.startsWith('/review') ? 'active' : ''} to="/">Review</Link>
              <Link className={location.pathname === '/today' ? 'active' : ''} to="/today">Today</Link>
            </nav>
          )}
          <div className={styles.headerRight}>
            <button className="theme-toggle" onClick={toggleTheme} title="Theme togglen">
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {isAuthenticated && user && (
              <button
                className={styles.userButton}
                onClick={() => navigate('/settings')}
                title={`Einstellungen für ${user.displayName}`}
              >
                <span className={styles.userAvatar}>{user.avatar || '👤'}</span>
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
