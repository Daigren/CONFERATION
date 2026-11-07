import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCurrentUser, useDb } from '../hooks';
import { getFormSchema, reviewApplication } from '../api';
import { REVIEWABLE, STATUS, STATUS_LABELS } from '../constants';
import { CommentList, Field, FileCard, StatusBadge, StatusTimeline } from '../components/ui';
import { formatDateTime, formatPeriod } from '../utils/format';
import NotFound from './NotFound';

export default function ApplicationReview() {
  const { id } = useParams();
  const db = useDb();
  const admin = useCurrentUser();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const app = db.applications.find((a) => a.id === id);
  const conference = app && db.conferences.find((c) => c.id === app.conferenceId);
  if (!app || !conference) return <NotFound />;

  const participant = db.users.find((u) => u.id === app.userId);
  const role = conference.roles.find((r) => r.id === app.roleId);
  const schema = getFormSchema(conference, app.roleId);
  const users = Object.fromEntries(db.users.map((u) => [u.id, u]));
  const comments = db.comments
    .filter((c) => c.applicationId === app.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const canReview = REVIEWABLE.includes(app.status);

  // Значения и файлы, поля для которых уже удалены из конфигурации конференции
  const knownFields = new Set(schema.fields.map((f) => f.id));
  const orphanValues = Object.entries(app.values).filter(([key, v]) => !knownFields.has(key) && v);
  const knownSlots = new Set(schema.fileSlots.map((s) => s.id));
  const orphanFiles = Object.entries(app.files).filter(([key]) => !knownSlots.has(key));

  // Файлы, заменённые участником после последнего возврата на доработку
  const lastRevision = app.history.findLast((h) => h.status === STATUS.REVISION)?.at;
  const isUpdated = (meta) => app.status === STATUS.RESUBMITTED && lastRevision && meta.uploadedAt > lastRevision;

  function decide(decision) {
    setError('');
    setSuccess('');
    try {
      reviewApplication({ applicationId: app.id, adminId: admin.id, decision, text: comment });
      setComment('');
      setSuccess(
        decision === STATUS.ACCEPTED
          ? 'Заявка принята. Участник получит уведомление в личном кабинете.'
          : 'Заявка возвращена на доработку. Участник получит уведомление с вашим комментарием.',
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <Link to="/admin" className="back">
            ← Список заявок
          </Link>
          <h1>
            Рассмотрение заявки №{app.number} <StatusBadge status={app.status} />
          </h1>
          <p className="muted">
            Получена {formatDateTime(app.receivedAt)} · статус изменён {formatDateTime(app.statusChangedAt)}
          </p>
        </div>
      </div>

      {success && <div className="alert alert--success">{success}</div>}

      <div className="layout-2 layout-2--wide">
        <div className="stack">
          <section className="card">
            <h2 className="section-title">Участник</h2>
            <dl className="details">
              <dt>ФИО</dt>
              <dd>{participant?.fio}</dd>
              <dt>E-mail</dt>
              <dd>
                <a href={`mailto:${participant?.email}`}>{participant?.email}</a>
              </dd>
              <dt>Телефон</dt>
              <dd>{participant?.phone || '—'}</dd>
              <dt>Организация</dt>
              <dd>{participant?.organization || '—'}</dd>
              <dt>Конференция</dt>
              <dd>
                {conference.title}
                <div className="muted">{formatPeriod(conference.startDate, conference.endDate)}</div>
              </dd>
              <dt>Роль</dt>
              <dd>{role?.name ?? '—'}</dd>
            </dl>
          </section>

          <section className="card">
            <h2 className="section-title">Сведения о выступлении</h2>
            {schema.fields.length === 0 && orphanValues.length === 0 ? (
              <p className="muted">Для этой роли поля не предусмотрены.</p>
            ) : (
              <dl className="details details--stacked">
                {schema.fields.map((f) => (
                  <div key={f.id}>
                    <dt>
                      {f.label}
                      {f.required && <span className="req"> *</span>}
                    </dt>
                    <dd className="prewrap">{app.values[f.id] || <span className="muted">не заполнено</span>}</dd>
                  </div>
                ))}
                {orphanValues.map(([key, value]) => (
                  <div key={key}>
                    <dt className="muted">Поле удалено из конфигурации</dt>
                    <dd className="prewrap">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="card">
            <h2 className="section-title">Прикреплённые документы</h2>
            {schema.fileSlots.length === 0 && orphanFiles.length === 0 ? (
              <p className="muted">Для этой роли документы не требуются.</p>
            ) : (
              <div className="stack stack--sm">
                {schema.fileSlots.map((s) =>
                  app.files[s.id] ? (
                    <FileCard key={s.id} meta={app.files[s.id]} label={s.label} updated={isUpdated(app.files[s.id])} />
                  ) : (
                    <div key={s.id} className="file-missing">
                      <span>{s.label}</span>
                      <span className="muted">{s.required ? 'не прикреплён (обязательный)' : 'не прикреплён'}</span>
                    </div>
                  ),
                )}
                {orphanFiles.map(([key, meta]) => (
                  <FileCard key={key} meta={meta} label="Поле удалено из конфигурации" />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="card decision">
            <h2 className="section-title">Решение по заявке</h2>
            {canReview ? (
              <>
                {error && <div className="alert alert--error">{error}</div>}
                <Field
                  label="Комментарий для участника"
                  hint="Обязателен при отправке на доработку: укажите, что именно нужно исправить."
                  htmlFor="comment"
                >
                  <textarea
                    id="comment"
                    className="input"
                    rows={5}
                    value={comment}
                    placeholder="Замечания к документам или сведениям о выступлении"
                    onChange={(e) => setComment(e.target.value)}
                  />
                </Field>
                <div className="decision__actions">
                  <button type="button" className="btn btn--success" onClick={() => decide(STATUS.ACCEPTED)}>
                    Принять заявку
                  </button>
                  <button type="button" className="btn btn--warning" onClick={() => decide(STATUS.REVISION)}>
                    Отправить на доработку
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">
                {app.status === STATUS.REVISION
                  ? 'Заявка у участника на доработке. После повторной отправки она получит статус «' +
                    STATUS_LABELS[STATUS.RESUBMITTED] +
                    '».'
                  : 'Заявка принята и хранится в архиве.'}
              </p>
            )}
          </section>
          <section className="card">
            <h2 className="section-title">Комментарии</h2>
            <CommentList comments={comments} adminsById={users} />
          </section>
          <section className="card">
            <h2 className="section-title">История статусов</h2>
            <StatusTimeline history={app.history} />
          </section>
        </aside>
      </div>
    </div>
  );
}
