import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentUser, useDb } from '../hooks';
import { getFormSchema, markCommentsRead, resubmitApplication, submitApplication, ValidationError } from '../api';
import { STATUS } from '../constants';
import ApplicationFields from '../components/ApplicationFields';
import { CommentList, EmptyState, StatusBadge, StatusTimeline } from '../components/ui';
import { formatDateTime, formatPeriod } from '../utils/format';
import NotFound from './NotFound';

function useFormState(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [newFiles, setNewFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const clearError = (key) =>
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _, ...rest } = e;
      return rest;
    });

  return {
    values,
    newFiles,
    errors,
    formError,
    busy,
    onValue: (id, value) => {
      setValues((v) => ({ ...v, [id]: value }));
      clearError(id);
    },
    onFile: (id, file) => {
      setNewFiles((f) => ({ ...f, [id]: file }));
      clearError(id);
    },
    async submit(action) {
      setBusy(true);
      setErrors({});
      setFormError('');
      try {
        await action();
      } catch (err) {
        setFormError(err.message || 'Не удалось сохранить заявку');
        if (err instanceof ValidationError) setErrors(err.fields);
        setBusy(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
  };
}

function NewApplication() {
  const db = useDb();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useFormState();

  const applied = new Set(db.applications.filter((a) => a.userId === user.id).map((a) => a.conferenceId));
  const available = db.conferences.filter((c) => c.active && !applied.has(c.id));

  const [conferenceId, setConferenceId] = useState(() => {
    const requested = params.get('conference');
    return available.some((c) => c.id === requested) ? requested : (available[0]?.id ?? '');
  });
  const [roleId, setRoleId] = useState('');

  const conference = db.conferences.find((c) => c.id === conferenceId);
  const schema = conference && roleId ? getFormSchema(conference, roleId) : null;

  if (!available.length && !form.busy) {
    return (
      <div className="page">
        <h1>Подача заявки</h1>
        <EmptyState title="Нет конференций с открытым приёмом заявок">
          Вы уже подали заявки на все активные конференции либо приём ещё не открыт.
          <div>
            <Link to="/cabinet" className="btn btn--secondary btn--sm">
              В личный кабинет
            </Link>
          </div>
        </EmptyState>
      </div>
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    form.submit(async () => {
      const app = await submitApplication({
        userId: user.id,
        conferenceId,
        roleId,
        values: form.values,
        newFiles: Object.fromEntries(Object.entries(form.newFiles).filter(([, f]) => f)),
      });
      navigate('/cabinet', {
        state: { flash: `Заявка №${app.number} отправлена и получила статус «Не рассмотрена».` },
      });
    });
  }

  return (
    <form className="page form-page" onSubmit={handleSubmit} noValidate>
      <div className="page__head">
        <div>
          <h1>Подача заявки</h1>
          <p className="muted">Состав сведений и документов зависит от конференции и выбранной роли участия.</p>
        </div>
      </div>

      {form.formError && <div className="alert alert--error">{form.formError}</div>}

      <fieldset className="card form-section">
        <legend className="form-section__title">1. Конференция</legend>
        <div className="choice-list">
          {available.map((c) => (
            <label key={c.id} className={`choice${c.id === conferenceId ? ' choice--active' : ''}`}>
              <input
                type="radio"
                name="conference"
                checked={c.id === conferenceId}
                onChange={() => {
                  setConferenceId(c.id);
                  setRoleId('');
                }}
              />
              <span>
                <strong>{c.title}</strong>
                <span className="muted">{formatPeriod(c.startDate, c.endDate)}</span>
                {c.description && <span className="choice__desc">{c.description}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {conference && (
        <fieldset className="card form-section">
          <legend className="form-section__title">2. Роль участника</legend>
          <div className="role-grid">
            {conference.roles.map((r) => {
              const s = getFormSchema(conference, r.id);
              return (
                <label key={r.id} className={`choice${r.id === roleId ? ' choice--active' : ''}`}>
                  <input type="radio" name="role" checked={r.id === roleId} onChange={() => setRoleId(r.id)} />
                  <span>
                    <strong>{r.name}</strong>
                    <span className="muted">
                      Полей: {s.fields.length} · документов: {s.fileSlots.length}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {schema ? (
        <>
          <ApplicationFields schema={schema} {...form} />
          <div className="form-actions">
            <Link to="/cabinet" className="btn btn--ghost">
              Отмена
            </Link>
            <button className="btn btn--primary" disabled={form.busy}>
              {form.busy ? 'Отправляем…' : 'Отправить заявку'}
            </button>
          </div>
        </>
      ) : (
        conference && <p className="muted center">Выберите роль, чтобы увидеть поля заявки.</p>
      )}
    </form>
  );
}

function ExistingApplication({ app }) {
  const db = useDb();
  const navigate = useNavigate();
  const form = useFormState(app.values);
  const editable = app.status === STATUS.REVISION;

  useEffect(() => {
    markCommentsRead((c) => c.applicationId === app.id);
  }, [app.id, app.status]);

  const conference = db.conferences.find((c) => c.id === app.conferenceId);
  if (!conference) return <NotFound />;
  const role = conference.roles.find((r) => r.id === app.roleId);
  const schema = getFormSchema(conference, app.roleId);
  const comments = db.comments
    .filter((c) => c.applicationId === app.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const admins = Object.fromEntries(db.users.map((u) => [u.id, u]));

  function handleSubmit(e) {
    e.preventDefault();
    form.submit(async () => {
      await resubmitApplication({
        applicationId: app.id,
        userId: app.userId,
        values: form.values,
        newFiles: Object.fromEntries(Object.entries(form.newFiles).filter(([, f]) => f)),
      });
      navigate('/cabinet', {
        state: { flash: `Заявка №${app.number} отправлена на повторную проверку.` },
      });
    });
  }

  return (
    <form className="page form-page" onSubmit={handleSubmit} noValidate>
      <div className="page__head">
        <div>
          <Link to="/cabinet" className="back">
            ← Личный кабинет
          </Link>
          <h1>
            Заявка №{app.number} <StatusBadge status={app.status} />
          </h1>
          <p className="muted">
            {conference.title} · {role?.name} · подана {formatDateTime(app.receivedAt)}
          </p>
        </div>
      </div>

      {form.formError && <div className="alert alert--error">{form.formError}</div>}
      {editable ? (
        <div className="alert alert--warning">
          Заявка возвращена на доработку. Ознакомьтесь с комментариями организатора, исправьте сведения и
          замените документы, затем отправьте заявку повторно.
        </div>
      ) : (
        <div className="alert alert--info">
          {app.status === STATUS.ACCEPTED
            ? 'Заявка принята оргкомитетом. Данные хранятся в архиве без возможности редактирования.'
            : 'Заявка находится на проверке. Редактирование будет доступно, если организатор вернёт её на доработку.'}
        </div>
      )}

      <div className="layout-2 layout-2--wide">
        <div>
          <ApplicationFields
            schema={schema}
            {...form}
            currentFiles={app.files}
            readOnly={!editable}
          />
          {editable && (
            <div className="form-actions">
              <Link to="/cabinet" className="btn btn--ghost">
                Отмена
              </Link>
              <button className="btn btn--primary" disabled={form.busy}>
                {form.busy ? 'Отправляем…' : 'Отправить на повторную проверку'}
              </button>
            </div>
          )}
        </div>
        <aside className="stack">
          <div className="card">
            <h2 className="section-title">Комментарии организатора</h2>
            <CommentList comments={comments} adminsById={admins} />
          </div>
          <div className="card">
            <h2 className="section-title">История статусов</h2>
            <StatusTimeline history={app.history} />
          </div>
        </aside>
      </div>
    </form>
  );
}

export default function ApplyForm() {
  const { id } = useParams();
  const db = useDb();
  const user = useCurrentUser();
  if (!id) return <NewApplication />;
  const app = db.applications.find((a) => a.id === id && a.userId === user.id);
  return app ? <ExistingApplication key={app.id} app={app} /> : <NotFound />;
}
