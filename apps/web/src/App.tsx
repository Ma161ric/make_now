import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import './styles.css';

export default function App() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Make Now</div>
        <nav className="nav">
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">Inbox</Link>
          <Link className={location.pathname.startsWith('/review') ? 'active' : ''} to="/">Review</Link>
          <Link className={location.pathname === '/today' ? 'active' : ''} to="/today">Today</Link>
        </nav>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
