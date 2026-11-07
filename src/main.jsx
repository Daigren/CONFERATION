import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ensureSeed } from './api/seed';
import './styles.css';

ensureSeed()
  .catch((err) => console.error('Не удалось создать демонстрационные данные', err))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
  });
