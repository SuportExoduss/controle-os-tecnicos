/* global __APP_VERSION__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Auto-limpeza de cache por versão ──────────────────────────────────────
// A cada deploy o __APP_VERSION__ (carimbo de build) muda. Na PRIMEIRA vez que
// cada dispositivo abre qualquer rota com a versão nova, ele limpa o Cache
// Storage, desregistra service workers antigos e recarrega 1x — sozinho.
// Depois disso, registra o service worker atual normalmente.
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const VERSION_KEY = 'ibiunet-app-version';

const registerSW = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* ignora se não suportar */ });
    });
  }
};

(async () => {
  let prev = null;
  try { prev = localStorage.getItem(VERSION_KEY); } catch { /* ignore */ }

  // Já está na versão atual → segue normal (só garante o SW registrado)
  if (prev === APP_VERSION) { registerSW(); return; }

  // Versão nova (ou primeira vez): limpa tudo e marca a versão
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch { /* ignore */ }

  try { localStorage.setItem(VERSION_KEY, APP_VERSION); } catch { /* ignore */ }

  // Só recarrega para quem já tinha uma versão antiga guardada (evita reload na
  // primeiríssima visita) e apenas 1x por sessão (trava anti-loop).
  if (prev !== null && !sessionStorage.getItem('ibiunet-reloaded-once')) {
    try { sessionStorage.setItem('ibiunet-reloaded-once', '1'); } catch { /* ignore */ }
    window.location.reload();
    return;
  }

  registerSW();
})();
