const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '—');

export const formatDate = (isoDate) => (isoDate ? dateOnly.format(new Date(`${isoDate}T00:00:00`)) : '—');

export function formatPeriod(start, end) {
  if (!start) return 'Сроки не указаны';
  return start === end || !end ? formatDate(start) : `${formatDate(start)} — ${formatDate(end)}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export const initials = (fio = '') =>
  fio
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
