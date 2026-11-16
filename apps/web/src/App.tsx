import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from './theme/themeContext';
import { useAuth } from './auth/authContext';
import styles from './App.module.css';
import './styles.css';
import { IconToday, IconChat, IconWeek, IconTasks, IconSun, IconMoon, IconSettings } from './components/Icons';
import { useVisualViewport } from './hooks/useVisualViewport';
import { useEffect } from 'react';

export default function App() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  useVisualViewport();

  // Every tab starts at the top (the week scrolls down to today and used to drag the others along)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Hide header on auth pages
  const isAuthPage = ['/login', '/signup', '/onboarding'].includes(location.pathname);
  
  const navItems = [
    { to: '/today', label: 'Heute', icon: <IconToday /> },
    { to: '/', label: 'Assistent', icon: <IconChat /> },
    { to: '/week', label: 'Woche', icon: <IconWeek /> },
    { to: '/tasks', label: 'Aufgaben', icon: <IconTasks /> },
  ];
  const isActive = (to: string) => location.pathname === to;

  return (
    <div className="app-shell">
      {!isAuthPage && (
        <header className="app-header">
          <Link to="/today" className="brand" aria-label="DayFlow, zu Heute">
            dayflow<span className="brand-dot">.</span>
          </Link>
          {isAuthenticated && (
            <nav className="nav" aria-label="Hauptnavigation">
              {navItems.map((item) => (
                <Link key={item.to} className={isActive(item.to) ? 'active' : ''} to={item.to} aria-current={isActive(item.to) ? 'page' : undefined}>
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="header-right">
            <button
              className="icon-button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Zum dunklen Modus wechseln' : 'Zum hellen Modus wechseln'}
            >
              {theme === 'light' ? <IconMoon /> : <IconSun />}
            </button>
            {isAuthenticated && user && (
              <button
                className={styles.userButton}
                onClick={() => navigate('/settings')}
                aria-label={`Einstellungen öffnen (angemeldet als ${user.displayName})`}
              >
                <span className={styles.userAvatar}>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <IconSettings size={16} />
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
      {!isAuthPage && isAuthenticated && (
        <nav className="bottom-nav" aria-label="Hauptnavigation">
          {navItems.map((item) => (
            <Link key={item.to} className={isActive(item.to) ? 'active' : ''} to={item.to} aria-current={isActive(item.to) ? 'page' : undefined}>
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
