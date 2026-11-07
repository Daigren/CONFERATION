import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="empty empty--page">
      <div className="empty__title">Страница не найдена</div>
      <div className="empty__text">Возможно, ссылка устарела или у вас нет доступа к этому разделу.</div>
      <Link to="/" className="btn btn--primary">
        На главную
      </Link>
    </div>
  );
}
