import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useCurrentUser, useDb } from '../hooks';
import { markCommentsRead } from '../api';
import { STATUS, STATUS_LABELS } from '../constants';
import { EmptyState, StatusBadge } from '../components/ui';
import { formatDateTime, formatPeriod } from '../utils/format';

const STATUS_HINTS = {
  [STATUS.NEW]: 'Заявка ожидает проверки оргкомитетом.',
  [STATUS.REVISION]: 'Оргкомитет вернул заявку с замечаниями. Внесите исправления и отправьте повторно.',
  [STATUS.RESUBMITTED]: 'Исправленная заявка ожидает повторной проверки.',
  [STATUS.ACCEPTED]: 'Заявка принята. Ждём вас на конференции!',
};

export default function Cabinet() {
  const db = useDb();
  const user = useCurrentUser();

  const applications = db.applications
    .filter((a) => a.userId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const myIds = new Set(applications.map((a) => a.id));
  const notifications = db.comments
    .filter((c) => myIds.has(c.applicationId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = notifications.filter((n) => !n.read);
  const appliedConfs = new Set(applications.map((a) => a.conferenceId));
  const available = db.conferences.filter((c) => c.active && !appliedConfs.has(c.id));

  const conferenceById = Object.fromEntries(db.conferences.map((c) => [c.id, c]));
  const appById = Object.fromEntries(applications.map((a) => [a.id, a]));
  const roleName = (a) => conferenceById[a.conferenceId]?.roles.find((r) => r.id === a.roleId)?.name ?? '—';

  useEffect(() => {
    if (window.location.hash === '#notifications') {
      document.getElementById('notifications')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Личный кабинет</h1>
          <p className="muted">
            {user.fio} · {user.email}
            {user.organization && ` · ${user.organization}`}
          </p>
        </div>
        <Link to="/apply" className="btn btn--primary">
          Подать заявку
        </Link>
      </div>

      <div className="layout-2">
        <section>
          <h2 className="section-title">Мои заявки</h2>
          {applications.length === 0 ? (
            <EmptyState title="Вы ещё не подали ни одной заявки">
              Выберите конференцию и роль участия — система покажет, какие сведения и документы нужны.
              <div>
                <Link to="/apply" className="btn btn--primary btn--sm">
                  Подать первую заявку
                </Link>
              </div>
            </EmptyState>
          ) : (
            <div className="stack">
              {applications.map((a) => {
                const conf = conferenceById[a.conferenceId];
                return (
                  <article key={a.id} className={`card app-card app-card--${a.status}`}>
                    <div className="app-card__top">
                      <span className="muted">Заявка №{a.number}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <h3 className="app-card__title">{conf?.title ?? 'Конференция удалена'}</h3>
                    <div className="app-card__meta">
                      <span>{roleName(a)}</span>
                      <span>Подана {formatDateTime(a.receivedAt)}</span>
                      <span>Статус изменён {formatDateTime(a.statusChangedAt)}</span>
                    </div>
                    <p className="app-card__hint">{STATUS_HINTS[a.status]}</p>
                    <div className="app-card__actions">
                      {a.status === STATUS.REVISION ? (
                        <Link to={`/apply/${a.id}`} className="btn btn--warning btn--sm">
                          Доработать заявку
                        </Link>
                      ) : (
                        <Link to={`/apply/${a.id}`} className="btn btn--ghost btn--sm">
                          Просмотреть
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {available.length > 0 && (
            <>
              <h2 className="section-title">Открыт приём заявок</h2>
              <div className="stack">
                {available.map((c) => (
                  <div key={c.id} className="card conf-row">
                    <div>
                      <div className="conf-row__title">{c.title}</div>
                      <div className="muted">{formatPeriod(c.startDate, c.endDate)}</div>
                    </div>
                    <Link to={`/apply?conference=${c.id}`} className="btn btn--secondary btn--sm">
                      Подать заявку
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <aside id="notifications" className="card notifications">
          <div className="notifications__head">
            <h2 className="section-title">
              Уведомления {unread.length > 0 && <span className="counter">{unread.length}</span>}
            </h2>
            {unread.length > 0 && (
              <button
                type="button"
                className="link-btn"
                onClick={() => markCommentsRead((c) => myIds.has(c.applicationId))}
              >
                Отметить прочитанными
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="muted">Здесь появятся сообщения о результатах проверки ваших заявок.</p>
          ) : (
            <ul className="notice-list">
              {notifications.map((n) => {
                const app = appById[n.applicationId];
                return (
                  <li key={n.id} className={`notice${n.read ? '' : ' notice--unread'}`}>
                    <Link to={`/apply/${n.applicationId}`}>
                      <div className="notice__title">
                        Заявка №{app.number}: {STATUS_LABELS[n.status].toLowerCase()}
                      </div>
                      <div className="notice__conf">{conferenceById[app.conferenceId]?.title}</div>
                      {n.text && <div className="notice__text">{n.text}</div>}
                      <div className="notice__date">{formatDateTime(n.createdAt)}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
