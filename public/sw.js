// Service worker mínimo para instalação (PWA) + cache offline do app shell.
// Só cuida de GET do próprio domínio; requisições do Firebase/Firestore passam direto.
const CACHE = 'ibiunet-os-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Deixa passar: métodos != GET e qualquer origem externa (Firebase Auth/Firestore)
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Network-first: sempre tenta a rede (conteúdo fresco), cai no cache se offline.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch {
      const cached = await caches.match(req);
      return cached || caches.match('/index.html');
    }
  })());
});
