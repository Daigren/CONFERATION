import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCurrentUser, useDb, useTheme } from '../hooks';
import { logout } from '../api';
import { ROLE } from '../constants';
import { initials } from '../utils/format';

function Flash() {
  const location = useLocation();
  const message = location.state?.flash;
  const [hidden, setHidden] = useState(false);
  useEffect(() => setHidden(false), [location.key]);
  if (!message || hidden) return null;
  return (
    <div className="alert alert--success flash" role="status">
      <span>{message}</span>
      <button type="button" className="icon-btn" aria-label="Закрыть" onClick={() => setHidden(true)}>
        ×
      </button>
    </div>
  );
}

function useUnreadCount(user) {
  const db = useDb();
  if (!user || user.role !== ROLE.USER) return 0;
  const mine = new Set(db.applications.filter((a) => a.userId === user.id).map((a) => a.id));
  return db.comments.filter((c) => !c.read && mine.has(c.applicationId)).length;
}

export default function Layout() {
  const user = useCurrentUser();
  const unread = useUnreadCount(user);
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const conferencesTab = location.pathname.startsWith('/admin/conferences') || location.search.includes('tab=conferences');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app">
      <header className="header">
        <div className="container header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" aria-hidden="true">
              C
            </span>
            <span className="brand__name">Conferation</span>
          </Link>

          <nav className="nav">
            {!user && (
              <>
                <NavLink to="/login">Вход</NavLink>
                <NavLink to="/register">Регистрация</NavLink>
              </>
            )}
            {user?.role === ROLE.USER && (
              <>
                <NavLink to="/cabinet">Личный кабинет</NavLink>
                <NavLink to="/apply" end>
                  Подать заявку
                </NavLink>
              </>
            )}
            {user?.role === ROLE.ADMIN && (
              <>
                <NavLink to="/admin" className={() => (location.pathname.startsWith('/admin') && !conferencesTab ? 'active' : '')}>
                  Заявки
                </NavLink>
                <NavLink to="/admin?tab=conferences" className={() => (conferencesTab ? 'active' : '')}>
                  Конференции
                </NavLink>
              </>
            )}
          </nav>

          <div className="header__actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              title={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
              aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
            >
              {isDark ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {user && (
              <div className="header__user">
                {user.role === ROLE.USER && (
                  <Link to="/cabinet#notifications" className="bell" aria-label={`Уведомления: ${unread}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path
                        d="M12 3a6 6 0 0 0-6 6v3.6L4.3 16a1 1 0 0 0 .9 1.4h13.6a1 1 0 0 0 .9-1.4L18 12.6V9a6 6 0 0 0-6-6Zm-2.5 16a2.5 2.5 0 0 0 5 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    {unread > 0 && <span className="bell__count">{unread}</span>}
                  </Link>
                )}
                <span className="avatar" title={user.fio}>
                  {initials(user.fio)}
                </span>
                <span className="header__name">
                  {user.fio}
                  <small>{user.role === ROLE.ADMIN ? 'Администратор' : 'Участник'}</small>
                </span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <Flash />
          <Outlet />
        </div>
      </main>

      <footer className="footer">
        <div className="container">Conferation — подача и рассмотрение заявок на участие в конференциях</div>
      </footer>
    </div>
  );
}
