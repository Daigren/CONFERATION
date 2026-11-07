// Статусная модель заявки (ТЗ, таблица 3)
export const STATUS = {
  NEW: 'new',
  REVISION: 'revision',
  RESUBMITTED: 'resubmitted',
  ACCEPTED: 'accepted',
};

export const STATUS_LABELS = {
  [STATUS.NEW]: 'Не рассмотрена',
  [STATUS.REVISION]: 'На доработке',
  [STATUS.RESUBMITTED]: 'Прислана на повторную проверку',
  [STATUS.ACCEPTED]: 'Принята',
};

export const STATUS_ORDER = [STATUS.NEW, STATUS.REVISION, STATUS.RESUBMITTED, STATUS.ACCEPTED];

// Статусы, в которых администратор может принять решение по заявке
export const REVIEWABLE = [STATUS.NEW, STATUS.RESUBMITTED];

export const ROLE = { USER: 'user', ADMIN: 'admin' };

export const FIELD_TYPES = {
  text: 'Строка',
  textarea: 'Многострочный текст',
  select: 'Выбор из списка',
};

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
