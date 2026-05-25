import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Registro del Service Worker para soporte PWA y compatibilidad en dispositivos Android
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker registrado con éxito:', reg.scope);
      })
      .catch((err) => {
        console.error('Error al registrar el PWA Service Worker:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // En desarrollo también registramos para pruebas locales, o simplemente lo dejamos listo
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('PWA Service Worker listo (Modo Desarrollo):', reg.scope);
      })
      .catch((err) => {
        console.warn('Registro del Service Worker fallido (esperado en dev en algunos navegadores):', err);
      });
  });
}

