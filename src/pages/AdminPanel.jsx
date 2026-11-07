import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useDb } from '../hooks';
import { deleteConference, setConferenceActive } from '../api';
import { REVIEWABLE, STATUS_LABELS, STATUS_ORDER } from '../constants';
import { EmptyState, StatusBadge } from '../components/ui';
import { formatDateTime, formatPeriod } from '../utils/format';

function ApplicationsTab() {
  const db = useDb();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const conferenceId = params.get('conference') ?? '';
  const sort = params.get('sort') === 'asc' ? 'asc' : 'desc';
  const query = params.get('q') ?? '';

  const setParam = (key, value) =>
    setParams(
      (p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );

  const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
  const conferences = Object.fromEntries(db.conferences.map((c) => [c.id, c]));

  const scoped = db.applications.filter((a) => !conferenceId || a.conferenceId === conferenceId);
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, scoped.filter((a) => a.status === s).length]));
  const q = query.trim().toLowerCase();

  const rows = scoped
    .filter((a) => !status || a.status === status)
    .filter((a) => {
      if (!q) return true;
      const u = users[a.userId];
      return [u?.fio, u?.email, String(a.number)].some((v) => v?.toLowerCase().includes(q));
    })
    .sort((a, b) => (sort === 'asc' ? 1 : -1) * a.receivedAt.localeCompare(b.receivedAt));

  return (
    <>
      <div className="status-chips">
        <button
          type="button"
          className={`chip${!status ? ' chip--active' : ''}`}
          onClick={() => setParam('status', '')}
        >
          Все <span>{scoped.length}</span>
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip chip--${s}${status === s ? ' chip--active' : ''}`}
            onClick={() => setParam('status', status === s ? '' : s)}
          >
            {STATUS_LABELS[s]} <span>{counts[s]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar card">
        <input
          className="input"
          type="search"
          placeholder="Поиск по ФИО, e-mail или номеру"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select className="input" value={conferenceId} onChange={(e) => setParam('conference', e.target.value)}>
          <option value="">Все конференции</option>
          {db.conferences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select className="input" value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">Любой статус</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input" value={sort} onChange={(e) => setParam('sort', e.target.value === 'asc' ? 'asc' : '')}>
          <option value="desc">Сначала новые</option>
          <option value="asc">Сначала старые</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Заявки не найдены">Измените условия фильтрации или дождитесь новых заявок.</EmptyState>
      ) : (
        <div className="table-wrap card">
          <table className="table">
            <thead>
              <tr>
                <th>№</th>
                <th>Участник</th>
                <th>Конференция</th>
                <th>Роль</th>
                <th>
                  <button
                    type="button"
                    className="sort-btn"
                    onClick={() => setParam('sort', sort === 'asc' ? '' : 'asc')}
                    aria-label="Сортировать по дате получения"
                  >
                    Дата получения {sort === 'asc' ? '↑' : '↓'}
                  </button>
                </th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const u = users[a.userId];
                const conf = conferences[a.conferenceId];
                return (
                  <tr
                    key={a.id}
                    className={REVIEWABLE.includes(a.status) ? 'row--pending' : ''}
                    onClick={() => navigate(`/admin/applications/${a.id}`)}
                  >
                    <td>
                      <Link to={`/admin/applications/${a.id}`} onClick={(e) => e.stopPropagation()}>
                        {a.number}
                      </Link>
                    </td>
                    <td>
                      <div className="cell-main">{u?.fio}</div>
                      <div className="cell-sub">{u?.email}</div>
                    </td>
                    <td>{conf?.title}</td>
                    <td className="cell-sub">{conf?.roles.find((r) => r.id === a.roleId)?.name}</td>
                    <td className="nowrap">
                      {formatDateTime(a.receivedAt)}
                      {a.updatedAt !== a.receivedAt && (
                        <div className="cell-sub">изм. {formatDateTime(a.updatedAt)}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ConferencesTab() {
  const db = useDb();
  const [error, setError] = useState('');

  function handleDelete(conf) {
    if (!window.confirm(`Удалить конференцию «${conf.title}»?`)) return;
    try {
      deleteConference(conf.id);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="tab-actions">
        <Link to="/admin/conferences/new" className="btn btn--primary">
          + Создать конференцию
        </Link>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
      {db.conferences.length === 0 ? (
        <EmptyState title="Конференций пока нет">Создайте первую конференцию в конструкторе.</EmptyState>
      ) : (
        <div className="conf-grid">
          {db.conferences.map((c) => {
            const apps = db.applications.filter((a) => a.conferenceId === c.id);
            const pending = apps.filter((a) => REVIEWABLE.includes(a.status)).length;
            return (
              <article key={c.id} className={`card conf-card${c.active ? '' : ' conf-card--inactive'}`}>
                <div className="conf-card__head">
                  <span className={`tag ${c.active ? 'tag--success' : ''}`}>
                    {c.active ? 'Приём заявок открыт' : 'Приём закрыт'}
                  </span>
                </div>
                <h3>{c.title}</h3>
                <div className="muted">{formatPeriod(c.startDate, c.endDate)}</div>
                {c.description && <p className="conf-card__desc">{c.description}</p>}
                <dl className="stats">
                  <div>
                    <dt>Ролей</dt>
                    <dd>{c.roles.length}</dd>
                  </div>
                  <div>
                    <dt>Полей</dt>
                    <dd>{c.fields.length}</dd>
                  </div>
                  <div>
                    <dt>Документов</dt>
                    <dd>{c.fileSlots.length}</dd>
                  </div>
                  <div>
                    <dt>Заявок</dt>
                    <dd>
                      {apps.length}
                      {pending > 0 && <small> ({pending} ждут)</small>}
                    </dd>
                  </div>
                </dl>
                <div className="conf-card__actions">
                  <Link to={`/admin/conferences/${c.id}`} className="btn btn--secondary btn--sm">
                    Настроить
                  </Link>
                  <Link to={`/admin?conference=${c.id}`} className="btn btn--ghost btn--sm">
                    Заявки
                  </Link>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setConferenceActive(c.id, !c.active)}
                  >
                    {c.active ? 'Закрыть приём' : 'Открыть приём'}
                  </button>
                  {apps.length === 0 && (
                    <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => handleDelete(c)}>
                      Удалить
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function AdminPanel() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'conferences' ? 'conferences' : 'applications';
  const db = useDb();
  const pending = db.applications.filter((a) => REVIEWABLE.includes(a.status)).length;

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1>Панель администратора</h1>
          <p className="muted">
            {pending > 0 ? `Ожидают рассмотрения: ${pending}` : 'Все поступившие заявки рассмотрены'}
          </p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'applications'}
          className={`tab${tab === 'applications' ? ' tab--active' : ''}`}
          onClick={() => setParams({})}
        >
          Заявки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'conferences'}
          className={`tab${tab === 'conferences' ? ' tab--active' : ''}`}
          onClick={() => setParams({ tab: 'conferences' })}
        >
          Конференции
        </button>
      </div>
      {tab === 'applications' ? <ApplicationsTab /> : <ConferencesTab />}
    </div>
  );
}
