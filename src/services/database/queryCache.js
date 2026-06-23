// ─────────────────────────────────────────────────────────────────────────
// Cache leve de leituras do Firestore (localStorage + TTL).
//
// Objetivo: economizar a cota de LEITURAS do plano grátis (50 mil/dia).
// Sem isto, cada abertura/refresh de dashboard relê a coleção inteira.
//
// • Sobrevive a reload (F5) e é compartilhado entre abas do mesmo dispositivo.
// • TTL curto → painéis públicos se atualizam sozinhos sem custo a cada toque.
// • Gravações chamam clearCache(coleção) → próxima leitura vem fresca.
// ─────────────────────────────────────────────────────────────────────────

const TTL = 5 * 60 * 1000; // 5 minutos
const PREFIX = 'rcache:';

export const readCache = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > TTL) { localStorage.removeItem(PREFIX + key); return null; }
    return v;
  } catch { return null; }
};

export const writeCache = (key, v) => {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota cheia / modo privado — segue sem cache */ }
};

// Invalida todas as entradas de uma coleção (após qualquer gravação).
export const clearCache = (collectionName) => {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${PREFIX}${collectionName}:`)) localStorage.removeItem(k);
    }
  } catch { /* ignora */ }
};
