// Типовая матрица полей и документов по ролям участников (ТЗ, приложение А, таблица А.1)
import { uid } from './db';

const field = (label, type, roles, options = []) => ({ id: uid(), label, type, roles, options });
const slot = (label, hint, roles) => ({ id: uid(), label, hint, roles });

export function typicalConfiguration() {
  const speaker = uid();
  const correspondent = uid();
  const listener = uid();

  return {
    roles: [
      { id: speaker, name: 'Докладчик (очное или дистанционное выступление)' },
      { id: correspondent, name: 'Заочный участник (публикация статьи без доклада)' },
      { id: listener, name: 'Слушатель (участие без публикации и выступления)' },
    ],
    fields: [
      field('Тема выступления', 'text', { [speaker]: true }),
      field('Секция конференции', 'text', { [speaker]: true }),
      field('Аннотация доклада', 'textarea', { [speaker]: true }),
      field('Сведения о соавторах и организации', 'textarea', { [speaker]: true }),
      field('Наименование научной статьи', 'text', { [correspondent]: true }),
      field('Тематическое направление', 'text', { [correspondent]: true }),
      field('Ключевые слова', 'text', { [correspondent]: true }),
      field('Список авторов', 'textarea', { [correspondent]: true }),
      field('Организация (место учёбы или работы)', 'text', { [listener]: true }),
      field('Должность', 'text', { [listener]: true }),
      field('Контактный телефон', 'text', { [listener]: true }),
      field('Формат посещения', 'select', { [listener]: true }, ['Очно', 'Дистанционно']),
    ],
    fileSlots: [
      slot('Файл тезисов доклада', 'DOC, DOCX или PDF', { [speaker]: true }),
      slot('Экспертное заключение о возможности опубликования', 'Скан-копия с подписью, PDF', { [speaker]: true }),
      slot('Презентация выступления', 'PPTX или PDF', { [speaker]: true }),
      slot('Файл текста статьи', 'DOC или DOCX', { [correspondent]: true }),
      slot('Скан-копия лицензионного договора', 'PDF', { [correspondent]: true }),
      slot('Справка о проверке на заимствования', 'PDF', { [correspondent]: true }),
      slot(
        'Скан-копия документа, подтверждающего статус обучающегося или сотрудника',
        'При наличии',
        { [listener]: false },
      ),
    ],
  };
}
