import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register, ValidationError } from '../api';
import { Field } from '../components/ui';

const INITIAL = { fio: '', email: '', phone: '', organization: '', password: '', passwordConfirm: '' };

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const bind = (name) => ({
    id: name,
    name,
    value: form[name],
    onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })),
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError('');
    try {
      const user = await register(form);
      navigate('/login', {
        state: { email: user.email, flash: 'Личный кабинет создан. Войдите, используя e-mail и пароль.' },
      });
    } catch (err) {
      setFormError(err.message);
      if (err instanceof ValidationError) setErrors(err.fields);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__intro">
        <h1>Регистрация участника</h1>
        <p>
          Создайте личный кабинет, чтобы подавать заявки на конференции, прикреплять документы и получать
          уведомления о результатах проверки.
        </p>
        <ol className="steps">
          <li>Зарегистрируйтесь и войдите в личный кабинет</li>
          <li>Выберите конференцию и роль участия</li>
          <li>Заполните сведения о выступлении и прикрепите документы</li>
          <li>Дождитесь решения оргкомитета</li>
        </ol>
      </div>

      <form className="card auth__card" onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert alert--error">{formError}</div>}
        <Field label="ФИО" required error={errors.fio} htmlFor="fio">
          <input className="input" autoComplete="name" placeholder="Иванов Иван Иванович" {...bind('fio')} />
        </Field>
        <Field label="Адрес электронной почты" required error={errors.email} htmlFor="email">
          <input className="input" type="email" autoComplete="email" placeholder="name@example.com" {...bind('email')} />
        </Field>
        <div className="grid-2">
          <Field label="Контактный телефон" required error={errors.phone} htmlFor="phone">
            <input className="input" type="tel" autoComplete="tel" placeholder="+7 900 000-00-00" {...bind('phone')} />
          </Field>
          <Field label="Организация" htmlFor="organization">
            <input className="input" autoComplete="organization" placeholder="Место учёбы или работы" {...bind('organization')} />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Пароль" required error={errors.password} hint="Не менее 6 символов" htmlFor="password">
            <input className="input" type="password" autoComplete="new-password" {...bind('password')} />
          </Field>
          <Field label="Повторите пароль" required error={errors.passwordConfirm} htmlFor="passwordConfirm">
            <input className="input" type="password" autoComplete="new-password" {...bind('passwordConfirm')} />
          </Field>
        </div>
        <button className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Создаём кабинет…' : 'Зарегистрироваться'}
        </button>
        <p className="auth__switch">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
