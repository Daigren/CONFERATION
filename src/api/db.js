// Хранилище структурированных данных (аналог реляционной БД).
// Данные лежат в localStorage; изменения из других вкладок приходят через событие
// storage, поэтому панель администратора и кабинет участника обновляются в реальном времени.

const DB_KEY = 'conferation:db:v1';
const SESSION_KEY = 'conferation:session';

const emptyDb = () => ({
  users: [],
  conferences: [],
  applications: [],
  comments: [],
  counters: { application: 0 },
});

let cache = null;
const listeners = new Set();

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(DB_KEY)) || emptyDb();
  } catch {
    cache = emptyDb();
  }
  return cache;
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function getDb() {
  return load();
}

// Транзакция: мутирует копию, затем атомарно сохраняет её
export function updateDb(mutate) {
  const next = structuredClone(load());
  const result = mutate(next);
  localStorage.setItem(DB_KEY, JSON.stringify(next));
  cache = next;
  emit();
  return result;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSessionUserId() {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(id) {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
  emit();
}

window.addEventListener('storage', (e) => {
  if (e.key === DB_KEY || e.key === SESSION_KEY || e.key === null) {
    cache = null;
    emit();
  }
});

export const uid = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export const now = () => new Date().toISOString();
