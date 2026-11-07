import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, login } from '../api';
import { DEMO_ACCOUNTS } from '../api/seed';
import { Field } from '../components/ui';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      const from = location.state?.from;
      const home = homePathFor(user);
      navigate(from?.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__intro">
        <h1>Вход в систему</h1>
        <p>
          Участники попадают в личный кабинет с заявками и уведомлениями, администраторы — в панель управления
          конференциями и модерации заявок.
        </p>
        <div className="demo">
          <div className="demo__title">Демонстрационные учётные записи</div>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className="demo__item"
              onClick={() => {
                setEmail(acc.email);
                setPassword(acc.password);
              }}
            >
              <strong>{acc.label}</strong>
              <span>
                {acc.email} / {acc.password}
              </span>
            </button>
          ))}
        </div>
      </div>

      <form className="card auth__card" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert--error">{error}</div>}
        <Field label="Адрес электронной почты" htmlFor="email">
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Пароль" htmlFor="password">
          <input
            id="password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button className="btn btn--primary btn--block" disabled={busy || !email || !password}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
        <p className="auth__switch">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </form>
    </div>
  );
}
