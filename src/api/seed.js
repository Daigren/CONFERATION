// Демонстрационные данные: создаются один раз при первом запуске
import { getDb, updateDb, uid } from './db';
import { saveFile } from './files';
import { createUser } from './index';
import { typicalConfiguration } from './template';
import { STATUS, ROLE } from '../constants';

export const DEMO_ACCOUNTS = [
  { label: 'Администратор', email: 'admin@conferation.ru', password: 'admin123' },
  { label: 'Участник', email: 'ivanov@example.com', password: 'user123' },
];

const daysAgo = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600_000).toISOString();

const demoFile = (name, text) => saveFile(new File([text], name, { type: 'text/plain' }));

export async function ensureSeed() {
  if (getDb().users.length) return;

  const admin = await createUser({
    fio: 'Смирнова Елена Викторовна',
    email: 'admin@conferation.ru',
    password: 'admin123',
    role: ROLE.ADMIN,
    organization: 'Организационный комитет',
  });
  const ivanov = await createUser({
    fio: 'Иванов Иван Иванович',
    email: 'ivanov@example.com',
    password: 'user123',
    phone: '+7 911 600-12-34',
    organization: 'НовГУ, Политехнический институт',
  });
  const petrova = await createUser({
    fio: 'Петрова Анна Сергеевна',
    email: 'petrova@example.com',
    password: 'user123',
    phone: '+7 921 700-45-67',
    organization: 'СПбГУ',
  });
  const sidorov = await createUser({
    fio: 'Сидоров Пётр Алексеевич',
    email: 'sidorov@example.com',
    password: 'user123',
    phone: '+7 950 300-89-01',
    organization: 'ООО «Технопарк»',
  });

  const year = new Date().getFullYear();
  const main = {
    id: uid(),
    title: 'Цифровые технологии в науке и образовании',
    description:
      'Всероссийская научно-практическая конференция. Секции: информационные системы, ' +
      'искусственный интеллект, цифровая педагогика, кибербезопасность.',
    startDate: `${year + 1}-04-14`,
    endDate: `${year + 1}-04-16`,
    active: true,
    createdAt: daysAgo(30),
    ...typicalConfiguration(),
  };
  const youth = typicalConfiguration();
  const second = {
    id: uid(),
    title: 'Молодёжь и инновации',
    description: 'Студенческая научная конференция с публикацией сборника тезисов.',
    startDate: `${year + 1}-05-20`,
    endDate: `${year + 1}-05-21`,
    active: true,
    createdAt: daysAgo(20),
    roles: [youth.roles[0], youth.roles[2]],
    fields: youth.fields.filter((f) => youth.roles[0].id in f.roles || youth.roles[2].id in f.roles),
    fileSlots: youth.fileSlots.filter((s) => youth.roles[0].id in s.roles || youth.roles[2].id in s.roles),
  };

  const [speaker, correspondent, listener] = main.roles;
  const f = main.fields.map((x) => x.id);
  const s = main.fileSlots.map((x) => x.id);
  const withVersion = async (name, text) => ({ ...(await demoFile(name, text)), version: 1 });

  const applications = [
    {
      userId: ivanov.id,
      roleId: speaker.id,
      receivedAt: daysAgo(6, 3),
      status: STATUS.REVISION,
      values: {
        [f[0]]: 'Нейросетевые методы анализа научных текстов',
        [f[1]]: 'Искусственный интеллект',
        [f[2]]: 'В докладе рассматриваются подходы к автоматической классификации научных публикаций.',
        [f[3]]: 'Иванов И. И., Козлов Д. М. — НовГУ им. Ярослава Мудрого',
      },
      files: {
        [s[0]]: await withVersion('tezisy_ivanov.txt', 'Тезисы доклада (демонстрационный файл)'),
        [s[1]]: await withVersion('ekspertnoe_zaklyuchenie.txt', 'Экспертное заключение (демонстрационный файл)'),
        [s[2]]: await withVersion('prezentaciya.txt', 'Презентация (демонстрационный файл)'),
      },
      comment:
        'Экспертное заключение не подписано руководителем. Тезисы превышают допустимый объём (2 страницы) — сократите текст.',
    },
    {
      userId: petrova.id,
      roleId: correspondent.id,
      receivedAt: daysAgo(2, 5),
      status: STATUS.NEW,
      values: {
        [f[4]]: 'Цифровые двойники образовательных программ',
        [f[5]]: 'Цифровая педагогика',
        [f[6]]: 'цифровой двойник, образовательная программа, моделирование',
        [f[7]]: 'Петрова А. С.',
      },
      files: {
        [s[3]]: await withVersion('statya_petrova.txt', 'Текст статьи (демонстрационный файл)'),
        [s[4]]: await withVersion('licenzionnyj_dogovor.txt', 'Лицензионный договор (демонстрационный файл)'),
        [s[5]]: await withVersion('antiplagiat.txt', 'Справка о проверке на заимствования (демонстрационный файл)'),
      },
    },
    {
      userId: sidorov.id,
      roleId: listener.id,
      receivedAt: daysAgo(9, 1),
      status: STATUS.ACCEPTED,
      values: {
        [f[8]]: 'ООО «Технопарк»',
        [f[9]]: 'Ведущий инженер',
        [f[10]]: '+7 950 300-89-01',
        [f[11]]: 'Очно',
      },
      files: {},
      comment: '',
    },
  ];

  updateDb((db) => {
    db.conferences.push(main, second);
    for (const a of applications) {
      db.counters.application += 1;
      const decidedAt = daysAgo(1, 2);
      const history = [{ status: STATUS.NEW, at: a.receivedAt }];
      if (a.status !== STATUS.NEW) history.push({ status: a.status, at: decidedAt, by: admin.id });
      const application = {
        id: uid(),
        number: db.counters.application,
        userId: a.userId,
        conferenceId: main.id,
        roleId: a.roleId,
        values: a.values,
        files: a.files,
        status: a.status,
        receivedAt: a.receivedAt,
        statusChangedAt: history.at(-1).at,
        updatedAt: history.at(-1).at,
        history,
      };
      db.applications.push(application);
      if (a.comment !== undefined) {
        db.comments.push({
          id: uid(),
          applicationId: application.id,
          adminId: admin.id,
          status: a.status,
          text: a.comment,
          createdAt: decidedAt,
          read: false,
        });
      }
    }
  });
}
