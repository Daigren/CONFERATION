import { useState } from 'react';
import { STATUS_LABELS } from '../constants';
import { downloadFile, openFile } from '../api/files';
import { formatDateTime, formatSize } from '../utils/format';

export function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Field({ label, error, required, hint, children, htmlFor }) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="req" aria-label="обязательно"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <div className="field__hint">{hint}</div>}
      {error && <div className="field__error">{error}</div>}
    </div>
  );
}

export function FileCard({ meta, label, updated }) {
  const [error, setError] = useState('');

  async function run(action) {
    setError('');
    try {
      await action(meta);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="file-card">
      <div className="file-card__icon" aria-hidden="true">
        {meta.name.split('.').pop().slice(0, 4).toUpperCase()}
      </div>
      <div className="file-card__body">
        {label && <div className="file-card__label">{label}</div>}
        <div className="file-card__name">{meta.name}</div>
        <div className="file-card__meta">
          {formatSize(meta.size)} · загружен {formatDateTime(meta.uploadedAt)}
          {meta.version > 1 && <span className="tag tag--accent">версия {meta.version}</span>}
          {updated && <span className="tag tag--accent">обновлён</span>}
        </div>
        {error && <div className="field__error">{error}</div>}
      </div>
      <div className="file-card__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => run(openFile)}>
          Открыть
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => run(downloadFile)}>
          Скачать
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {children && <div className="empty__text">{children}</div>}
    </div>
  );
}

export function StatusTimeline({ history }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i} className="timeline__item">
          <span className={`timeline__dot timeline__dot--${h.status}`} />
          <div>
            <div className="timeline__title">{STATUS_LABELS[h.status]}</div>
            <div className="timeline__date">{formatDateTime(h.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CommentList({ comments, adminsById }) {
  if (!comments.length) return <p className="muted">Комментариев пока нет.</p>;
  return (
    <ul className="comments">
      {comments.map((c) => (
        <li key={c.id} className={`comment comment--${c.status}`}>
          <div className="comment__head">
            <StatusBadge status={c.status} />
            <span className="muted">
              {adminsById?.[c.adminId]?.fio ?? 'Организатор'} · {formatDateTime(c.createdAt)}
            </span>
          </div>
          <div className="comment__text">{c.text || 'Заявка принята без замечаний.'}</div>
        </li>
      ))}
    </ul>
  );
}
