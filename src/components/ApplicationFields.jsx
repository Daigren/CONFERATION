import { Field, FileCard } from './ui';
import { formatSize } from '../utils/format';

// Динамическая часть формы заявки: поля о выступлении и слоты для файлов,
// построенные по настройкам конференции для выбранной роли
export default function ApplicationFields({ schema, values, onValue, currentFiles = {}, newFiles, onFile, errors, readOnly }) {
  return (
    <>
      <fieldset className="card form-section">
        <legend className="form-section__title">Сведения о выступлении</legend>
        {schema.fields.length === 0 && <p className="muted">Для этой роли дополнительные сведения не требуются.</p>}
        {schema.fields.map((f) => {
          const id = `field-${f.id}`;
          const value = values[f.id] ?? '';
          const common = {
            id,
            value,
            disabled: readOnly,
            onChange: (e) => onValue(f.id, e.target.value),
          };
          return (
            <Field key={f.id} label={f.label} required={f.required} error={errors[f.id]} htmlFor={id}>
              {readOnly ? (
                <div className="readonly-value">{value || '—'}</div>
              ) : f.type === 'textarea' ? (
                <textarea className="input" rows={4} {...common} />
              ) : f.type === 'select' ? (
                <select className="input" {...common}>
                  <option value="">Выберите вариант</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input className="input" {...common} />
              )}
            </Field>
          );
        })}
      </fieldset>

      <fieldset className="card form-section">
        <legend className="form-section__title">Документы</legend>
        {schema.fileSlots.length === 0 && <p className="muted">Для этой роли прикреплять документы не требуется.</p>}
        {schema.fileSlots.map((s) => {
          const id = `file-${s.id}`;
          const current = currentFiles[s.id];
          const chosen = newFiles?.[s.id];
          return (
            <Field key={s.id} label={s.label} required={s.required} error={errors[s.id]} hint={s.hint} htmlFor={id}>
              {current && <FileCard meta={current} />}
              {!readOnly && (
                <div className={`upload${chosen ? ' upload--chosen' : ''}`}>
                  <input
                    key={chosen ? 'chosen' : 'empty'}
                    id={id}
                    type="file"
                    className="upload__input"
                    onChange={(e) => onFile(s.id, e.target.files[0] ?? null)}
                  />
                  <label htmlFor={id} className="upload__label">
                    {chosen ? (
                      <>
                        <strong>{chosen.name}</strong> · {formatSize(chosen.size)}
                        {current && <span className="tag tag--accent">заменит текущий файл</span>}
                      </>
                    ) : current ? (
                      'Выбрать новую версию файла'
                    ) : (
                      'Выберите файл или перетащите его сюда'
                    )}
                  </label>
                  {chosen && (
                    <button type="button" className="link-btn" onClick={() => onFile(s.id, null)}>
                      Отменить
                    </button>
                  )}
                </div>
              )}
              {readOnly && !current && <div className="readonly-value">Файл не прикреплён</div>}
            </Field>
          );
        })}
      </fieldset>
    </>
  );
}
