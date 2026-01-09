import { Link, Outlet, useLocation } from 'react-router-dom';
import './styles.css';

export default function App() {
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">Make Now</div>
        <nav className="nav">
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">Inbox</Link>
          <Link className={location.pathname.startsWith('/review') ? 'active' : ''} to="/">Review</Link>
          <Link className={location.pathname === '/today' ? 'active' : ''} to="/today">Today</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
