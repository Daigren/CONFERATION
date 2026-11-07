// Сервисный слой: вся бизнес-логика системы (регистрация, конференции, заявки, модерация)
import { getDb, updateDb, uid, now, setSessionUserId } from './db';
import { saveFile, deleteFile } from './files';
import { STATUS, REVIEWABLE, ROLE, MAX_FILE_SIZE } from '../constants';

export class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.fields = fields;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasErrors = (errors) => Object.keys(errors).length > 0;

// ---------- Пользователи ----------

export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Запасной вариант для небезопасного контекста (http по IP-адресу)
  let h = 0x811c9dc5;
  for (const ch of input) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193);
  return `fnv-${(h >>> 0).toString(16)}`;
}

export async function createUser({ fio, email, password, phone = '', organization = '', role = ROLE.USER }) {
  const salt = uid();
  const user = {
    id: uid(),
    fio,
    email,
    phone,
    organization,
    role,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: now(),
  };
  updateDb((db) => {
    db.users.push(user);
  });
  return user;
}

export async function register(input) {
  const data = {
    fio: input.fio.trim().replace(/\s+/g, ' '),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    organization: input.organization.trim(),
  };
  const errors = {};
  if (data.fio.split(' ').length < 2) errors.fio = 'Укажите как минимум фамилию и имя';
  if (!EMAIL_RE.test(data.email)) errors.email = 'Некорректный адрес электронной почты';
  else if (getDb().users.some((u) => u.email === data.email))
    errors.email = 'Пользователь с таким адресом уже зарегистрирован';
  if (!/^[+\d][\d\s()-]{5,}$/.test(data.phone)) errors.phone = 'Укажите контактный телефон';
  if (input.password.length < 6) errors.password = 'Пароль должен содержать не менее 6 символов';
  if (input.password !== input.passwordConfirm) errors.passwordConfirm = 'Пароли не совпадают';
  if (hasErrors(errors)) throw new ValidationError('Проверьте правильность заполнения формы', errors);

  return createUser({ ...data, password: input.password });
}

export async function login(email, password) {
  const user = getDb().users.find((u) => u.email === email.trim().toLowerCase());
  if (!user || user.passwordHash !== (await hashPassword(password, user.salt))) {
    throw new ValidationError('Неверный адрес электронной почты или пароль');
  }
  setSessionUserId(user.id);
  return user;
}

export const logout = () => setSessionUserId(null);

export const homePathFor = (user) => (!user ? '/login' : user.role === ROLE.ADMIN ? '/admin' : '/cabinet');

// ---------- Конференции ----------

export function emptyConference() {
  return {
    id: uid(),
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    active: true,
    roles: [],
    fields: [],
    fileSlots: [],
  };
}

export function validateConference(conf) {
  const errors = [];
  if (!conf.title.trim()) errors.push('Укажите наименование конференции');
  if (!conf.startDate || !conf.endDate) errors.push('Укажите сроки проведения конференции');
  else if (conf.endDate < conf.startDate) errors.push('Дата окончания не может быть раньше даты начала');
  if (!conf.roles.length) errors.push('Добавьте хотя бы одну роль участника');
  if (conf.roles.some((r) => !r.name.trim())) errors.push('У каждой роли должно быть наименование');
  if ([...conf.fields, ...conf.fileSlots].some((i) => !i.label.trim()))
    errors.push('У каждого поля должно быть наименование');
  for (const f of conf.fields) {
    if (f.type === 'select' && !f.options.length && f.label.trim())
      errors.push(`Для поля «${f.label}» укажите варианты выбора`);
  }

  const roleIds = new Set(conf.roles.map((r) => r.id));
  const usedRoles = getDb().applications.filter((a) => a.conferenceId === conf.id).map((a) => a.roleId);
  if (usedRoles.some((id) => !roleIds.has(id)))
    errors.push('Нельзя удалить роль, по которой уже поданы заявки');
  return errors;
}

export function saveConference(conf) {
  const errors = validateConference(conf);
  if (errors.length) throw new ValidationError(errors[0], { list: errors });

  const roleIds = new Set(conf.roles.map((r) => r.id));
  const cleanRoles = (roles) => Object.fromEntries(Object.entries(roles).filter(([id]) => roleIds.has(id)));
  const record = {
    ...conf,
    title: conf.title.trim(),
    description: conf.description.trim(),
    roles: conf.roles.map((r) => ({ ...r, name: r.name.trim() })),
    fields: conf.fields.map((f) => ({ ...f, label: f.label.trim(), roles: cleanRoles(f.roles) })),
    fileSlots: conf.fileSlots.map((s) => ({ ...s, label: s.label.trim(), roles: cleanRoles(s.roles) })),
    updatedAt: now(),
  };

  updateDb((db) => {
    const i = db.conferences.findIndex((c) => c.id === conf.id);
    if (i === -1) db.conferences.push({ ...record, createdAt: now() });
    else db.conferences[i] = { ...db.conferences[i], ...record };
  });
  return record;
}

export function setConferenceActive(id, active) {
  updateDb((db) => {
    const conf = db.conferences.find((c) => c.id === id);
    if (conf) conf.active = active;
  });
}

export function deleteConference(id) {
  if (getDb().applications.some((a) => a.conferenceId === id)) {
    throw new ValidationError('По конференции уже поданы заявки — её можно только скрыть');
  }
  updateDb((db) => {
    db.conferences = db.conferences.filter((c) => c.id !== id);
  });
}

// Динамическая форма: поля и файлы для комбинации «конференция + роль»
export function getFormSchema(conference, roleId) {
  const pick = (items) =>
    items.filter((item) => roleId in item.roles).map((item) => ({ ...item, required: item.roles[roleId] }));
  return { fields: pick(conference.fields), fileSlots: pick(conference.fileSlots) };
}

// ---------- Заявки ----------

function validateApplication(schema, values, currentFiles, newFiles) {
  const errors = {};
  for (const f of schema.fields) {
    if (f.required && !String(values[f.id] ?? '').trim()) errors[f.id] = 'Заполните обязательное поле';
  }
  for (const s of schema.fileSlots) {
    const file = newFiles[s.id];
    if (file && file.size === 0) errors[s.id] = 'Файл пуст';
    else if (file && file.size > MAX_FILE_SIZE) errors[s.id] = 'Размер файла превышает 20 МБ';
    else if (s.required && !file && !currentFiles[s.id]) errors[s.id] = 'Прикрепите обязательный документ';
  }
  return errors;
}

const pickValues = (schema, values) =>
  Object.fromEntries(schema.fields.map((f) => [f.id, String(values[f.id] ?? '').trim()]));

export async function submitApplication({ userId, conferenceId, roleId, values, newFiles }) {
  const db = getDb();
  const conference = db.conferences.find((c) => c.id === conferenceId);
  if (!conference || !conference.active) throw new ValidationError('Выберите активную конференцию');
  if (!conference.roles.some((r) => r.id === roleId)) throw new ValidationError('Выберите роль участника');
  if (db.applications.some((a) => a.userId === userId && a.conferenceId === conferenceId)) {
    throw new ValidationError('Вы уже подали заявку на эту конференцию');
  }

  const schema = getFormSchema(conference, roleId);
  const errors = validateApplication(schema, values, {}, newFiles);
  if (hasErrors(errors)) throw new ValidationError('Заполните все обязательные поля и прикрепите документы', errors);

  const files = {};
  for (const s of schema.fileSlots) {
    if (newFiles[s.id]) files[s.id] = { ...(await saveFile(newFiles[s.id])), version: 1 };
  }

  return updateDb((next) => {
    next.counters.application += 1;
    const time = now();
    const application = {
      id: uid(),
      number: next.counters.application,
      userId,
      conferenceId,
      roleId,
      values: pickValues(schema, values),
      files,
      status: STATUS.NEW,
      receivedAt: time,
      statusChangedAt: time,
      updatedAt: time,
      history: [{ status: STATUS.NEW, at: time }],
    };
    next.applications.push(application);
    return application;
  });
}

export async function resubmitApplication({ applicationId, userId, values, newFiles }) {
  const db = getDb();
  const app = db.applications.find((a) => a.id === applicationId && a.userId === userId);
  if (!app) throw new ValidationError('Заявка не найдена');
  if (app.status !== STATUS.REVISION) throw new ValidationError('Заявка недоступна для редактирования');

  const conference = db.conferences.find((c) => c.id === app.conferenceId);
  const schema = getFormSchema(conference, app.roleId);
  const errors = validateApplication(schema, values, app.files, newFiles);
  if (hasErrors(errors)) throw new ValidationError('Заполните все обязательные поля и прикрепите документы', errors);

  const files = { ...app.files };
  const replaced = [];
  for (const s of schema.fileSlots) {
    const file = newFiles[s.id];
    if (!file) continue;
    const prev = app.files[s.id];
    if (prev) replaced.push(prev.id);
    files[s.id] = { ...(await saveFile(file)), version: (prev?.version ?? 0) + 1, replacedAt: now() };
  }

  updateDb((next) => {
    const target = next.applications.find((a) => a.id === applicationId);
    const time = now();
    target.values = pickValues(schema, values);
    target.files = files;
    target.status = STATUS.RESUBMITTED;
    target.statusChangedAt = time;
    target.updatedAt = time;
    target.history.push({ status: STATUS.RESUBMITTED, at: time });
    next.comments.forEach((c) => {
      if (c.applicationId === applicationId) c.read = true;
    });
  });

  await Promise.allSettled(replaced.map(deleteFile));
}

export function reviewApplication({ applicationId, adminId, decision, text }) {
  const app = getDb().applications.find((a) => a.id === applicationId);
  if (!app) throw new ValidationError('Заявка не найдена');
  if (!REVIEWABLE.includes(app.status)) throw new ValidationError('Решение по этой заявке уже принято');
  const comment = text.trim();
  if (decision === STATUS.REVISION && !comment) {
    throw new ValidationError('Укажите комментарий с причинами возврата на доработку', {
      comment: 'Комментарий обязателен при отправке на доработку',
    });
  }

  updateDb((db) => {
    const target = db.applications.find((a) => a.id === applicationId);
    const time = now();
    target.status = decision;
    target.statusChangedAt = time;
    target.updatedAt = time;
    target.history.push({ status: decision, at: time, by: adminId });
    db.comments.push({
      id: uid(),
      applicationId,
      adminId,
      status: decision,
      text: comment,
      createdAt: time,
      read: false,
    });
  });
}

export function markCommentsRead(predicate) {
  const db = getDb();
  if (!db.comments.some((c) => !c.read && predicate(c))) return;
  updateDb((next) => {
    next.comments.forEach((c) => {
      if (!c.read && predicate(c)) c.read = true;
    });
  });
}
