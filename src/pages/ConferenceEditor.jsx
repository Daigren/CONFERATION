import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDb } from '../hooks';
import { emptyConference, getFormSchema, saveConference } from '../api';
import { uid } from '../api/db';
import { typicalConfiguration } from '../api/template';
import { FIELD_TYPES } from '../constants';
import { Field } from '../components/ui';
import NotFound from './NotFound';

const toDraft = (conf) => ({
  ...structuredClone(conf),
  fields: conf.fields.map((f) => ({ ...f, optionsText: (f.options ?? []).join(', ') })),
});

const fromDraft = (draft) => ({
  ...draft,
  fields: draft.fields.map(({ optionsText, ...f }) => ({
    ...f,
    options:
      f.type === 'select'
        ? optionsText
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
  })),
});

// Ячейка матрицы «поле × роль»: не используется / необязательно / обязательно
function RoleCell({ item, roleId, onChange }) {
  const value = !(roleId in item.roles) ? '' : item.roles[roleId] ? 'required' : 'optional';
  return (
    <select
      className={`input input--sm matrix__cell matrix__cell--${value || 'none'}`}
      value={value}
      onChange={(e) => {
        const roles = { ...item.roles };
        if (e.target.value === '') delete roles[roleId];
        else roles[roleId] = e.target.value === 'required';
        onChange({ roles });
      }}
    >
      <option value="">—</option>
      <option value="optional">Необяз.</option>
      <option value="required">Обязат.</option>
    </select>
  );
}

function Matrix({ title, description, items, roles, kind, onAdd, onUpdate, onRemove }) {
  return (
    <section className="card form-section">
      <div className="form-section__head">
        <div>
          <h2 className="form-section__title">{title}</h2>
          <p className="muted">{description}</p>
        </div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onAdd}>
          + Добавить
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted">Пока ничего не добавлено.</p>
      ) : (
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="matrix__name">Наименование</th>
                <th>{kind === 'field' ? 'Тип поля' : 'Подсказка'}</th>
                {roles.map((r) => (
                  <th key={r.id} className="matrix__role" title={r.name}>
                    {r.name || 'Без названия'}
                  </th>
                ))}
                <th aria-label="Удалить" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      className="input input--sm"
                      value={item.label}
                      placeholder={kind === 'field' ? 'Например, «Тема доклада»' : 'Например, «Файл тезисов»'}
                      onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    {kind === 'field' ? (
                      <>
                        <select
                          className="input input--sm"
                          value={item.type}
                          onChange={(e) => onUpdate(item.id, { type: e.target.value })}
                        >
                          {Object.entries(FIELD_TYPES).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {item.type === 'select' && (
                          <input
                            className="input input--sm matrix__options"
                            placeholder="Варианты через запятую"
                            value={item.optionsText}
                            onChange={(e) => onUpdate(item.id, { optionsText: e.target.value })}
                          />
                        )}
                      </>
                    ) : (
                      <input
                        className="input input--sm"
                        value={item.hint}
                        placeholder="Формат, требования"
                        onChange={(e) => onUpdate(item.id, { hint: e.target.value })}
                      />
                    )}
                  </td>
                  {roles.map((r) => (
                    <td key={r.id}>
                      <RoleCell item={item} roleId={r.id} onChange={(patch) => onUpdate(item.id, patch)} />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      aria-label="Удалить"
                      onClick={() => onRemove(item.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Preview({ draft }) {
  const [roleId, setRoleId] = useState('');
  const active = draft.roles.some((r) => r.id === roleId) ? roleId : draft.roles[0]?.id;
  if (!active) return null;
  const schema = getFormSchema(fromDraft(draft), active);
  return (
    <section className="card form-section preview">
      <h2 className="form-section__title">Предпросмотр формы заявки</h2>
      <select className="input" value={active} onChange={(e) => setRoleId(e.target.value)}>
        {draft.roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name || 'Без названия'}
          </option>
        ))}
      </select>
      <div className="preview__cols">
        <div>
          <h3>Поля</h3>
          {schema.fields.length ? (
            <ul>
              {schema.fields.map((f) => (
                <li key={f.id}>
                  {f.label || 'Без названия'}
                  {f.required && <span className="req"> *</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Нет полей</p>
          )}
        </div>
        <div>
          <h3>Документы</h3>
          {schema.fileSlots.length ? (
            <ul>
              {schema.fileSlots.map((s) => (
                <li key={s.id}>
                  {s.label || 'Без названия'}
                  {s.required && <span className="req"> *</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Нет документов</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Editor({ initial, isNew }) {
  const navigate = useNavigate();
  const db = useDb();
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [errors, setErrors] = useState([]);
  const usedRoles = new Set(db.applications.filter((a) => a.conferenceId === draft.id).map((a) => a.roleId));

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const listOps = (key, make) => ({
    onAdd: () => setDraft((d) => ({ ...d, [key]: [...d[key], make()] })),
    onUpdate: (id, patch) =>
      setDraft((d) => ({ ...d, [key]: d[key].map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    onRemove: (id) => setDraft((d) => ({ ...d, [key]: d[key].filter((i) => i.id !== id) })),
  });
  const allRoles = (required) => Object.fromEntries(draft.roles.map((r) => [r.id, required]));

  function applyTemplate() {
    const hasContent = draft.roles.length || draft.fields.length || draft.fileSlots.length;
    if (hasContent && !window.confirm('Текущие роли и поля будут заменены типовой матрицей. Продолжить?')) return;
    setDraft((d) => toDraft({ ...d, ...typicalConfiguration() }));
  }

  function handleSave(e) {
    e.preventDefault();
    try {
      saveConference(fromDraft(draft));
      navigate('/admin?tab=conferences', {
        state: { flash: isNew ? 'Конференция создана.' : 'Изменения конференции сохранены.' },
      });
    } catch (err) {
      setErrors(err.fields?.list ?? [err.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return (
    <form className="page" onSubmit={handleSave} noValidate>
      <div className="page__head">
        <div>
          <Link to="/admin?tab=conferences" className="back">
            ← Конференции
          </Link>
          <h1>{isNew ? 'Новая конференция' : 'Настройка конференции'}</h1>
          <p className="muted">
            Задайте роли участников и укажите для каждой роли, какие сведения и документы обязательны.
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={applyTemplate}>
          Заполнить по типовой матрице
        </button>
      </div>

      {errors.length > 0 && (
        <div className="alert alert--error">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card form-section">
        <h2 className="form-section__title">Основные сведения</h2>
        <Field label="Наименование конференции" required htmlFor="title">
          <input id="title" className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <Field label="Описание" htmlFor="description">
          <textarea
            id="description"
            className="input"
            rows={3}
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </Field>
        <div className="grid-3">
          <Field label="Дата начала" required htmlFor="start">
            <input
              id="start"
              type="date"
              className="input"
              value={draft.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Дата окончания" required htmlFor="end">
            <input
              id="end"
              type="date"
              className="input"
              value={draft.endDate}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </Field>
          <label className="switch">
            <input type="checkbox" checked={draft.active} onChange={(e) => set({ active: e.target.checked })} />
            <span>Приём заявок открыт</span>
          </label>
        </div>
      </section>

      <section className="card form-section">
        <div className="form-section__head">
          <div>
            <h2 className="form-section__title">Роли участников</h2>
            <p className="muted">Например: докладчик, заочный участник, слушатель.</p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => set({ roles: [...draft.roles, { id: uid(), name: '' }] })}
          >
            + Добавить роль
          </button>
        </div>
        {draft.roles.length === 0 && <p className="muted">Добавьте хотя бы одну роль.</p>}
        <div className="stack stack--sm">
          {draft.roles.map((r, i) => (
            <div key={r.id} className="role-row">
              <span className="role-row__num">{i + 1}</span>
              <input
                className="input"
                value={r.name}
                placeholder="Наименование роли"
                onChange={(e) =>
                  set({ roles: draft.roles.map((x) => (x.id === r.id ? { ...x, name: e.target.value } : x)) })
                }
              />
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label="Удалить роль"
                disabled={usedRoles.has(r.id)}
                title={usedRoles.has(r.id) ? 'По этой роли уже поданы заявки' : 'Удалить роль'}
                onClick={() => set({ roles: draft.roles.filter((x) => x.id !== r.id) })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      <Matrix
        title="Поля для заполнения"
        description="Сведения о выступлении: тема доклада, секция, аннотация, соавторы и т. п."
        kind="field"
        items={draft.fields}
        roles={draft.roles}
        {...listOps('fields', () => ({
          id: uid(),
          label: '',
          type: 'text',
          optionsText: '',
          roles: allRoles(true),
        }))}
      />

      <Matrix
        title="Поля для прикрепления файлов"
        description="Документы, которые участник должен приложить к заявке."
        kind="file"
        items={draft.fileSlots}
        roles={draft.roles}
        {...listOps('fileSlots', () => ({ id: uid(), label: '', hint: '', roles: allRoles(true) }))}
      />

      <Preview draft={draft} />

      <div className="form-actions form-actions--sticky">
        <Link to="/admin?tab=conferences" className="btn btn--ghost">
          Отмена
        </Link>
        <button className="btn btn--primary">{isNew ? 'Создать конференцию' : 'Сохранить изменения'}</button>
      </div>
    </form>
  );
}

export default function ConferenceEditor() {
  const { id } = useParams();
  const db = useDb();
  if (!id) return <Editor initial={emptyConference()} isNew />;
  const conf = db.conferences.find((c) => c.id === id);
  return conf ? <Editor key={conf.id} initial={conf} /> : <NotFound />;
}
