// ─────────────────────────────────────────────────────────────────────────
// FROTA — armazenamento econômico no Firestore (mesmo padrão dos outros).
//
//   • CADASTRO de equipes/colaboradores: 1 doc `fleet_config/cadastro`
//     (muda raramente; leitura cacheada).
//   • RELATÓRIO por MÊS: 1 doc `fleet_reports/YYYY-MM` com a matriz inteira.
//     - Dashboard do mês = 1 leitura (cacheada 5 min no localStorage).
//     - Import = 1 escrita que sobrescreve o mês (idempotente; o novo prevalece).
//   • Sem CPF (LGPD).
// ─────────────────────────────────────────────────────────────────────────
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';
import { DEFAULT_TEAMS } from '../../pages/Frota/frotaCore';

const COL = 'fleet_reports';
const CFG = 'fleet_config';
export const monthId = (ano, mesIndex) => `${ano}-${String(mesIndex + 1).padStart(2, '0')}`; // mesIndex 0-11

// Cadastro de equipes (com fallback para o padrão quando ainda não existe).
export const getFrotaCadastro = async ({ force = false } = {}) => {
  const key = `${CFG}:cadastro`;
  if (!force) { const c = readCache(key); if (c) return c; }
  const snap = await getDoc(doc(db, CFG, 'cadastro'));
  const teams = snap.exists() && snap.data().teams ? snap.data().teams : DEFAULT_TEAMS;
  writeCache(key, teams);
  return teams;
};

export const saveFrotaCadastro = async (teams) => {
  await setDoc(doc(db, CFG, 'cadastro'), { teams, updatedAt: new Date().toISOString() });
  clearCache(CFG);
  return { ok: true };
};

// Lê o doc do mês (1 leitura, cacheada). Retorna null se ainda não existe.
export const getFrotaMonth = async (ano, mesIndex, { force = false } = {}) => {
  const id = monthId(ano, mesIndex);
  const key = `${COL}:${id}`;
  if (!force) { const c = readCache(key); if (c) return c; }
  const snap = await getDoc(doc(db, COL, id));
  const data = snap.exists() ? snap.data() : null;
  writeCache(key, data);
  return data;
};

// Sobrescreve o mês inteiro — o novo prevalece. 1 escrita. Invalida cache.
export const saveFrotaMonth = async (ano, mesIndex, payload, by) => {
  const id = monthId(ano, mesIndex);
  await setDoc(doc(db, COL, id), {
    month: id, updatedAt: new Date().toISOString(), by: by || null, ...payload,
  });
  clearCache(COL);
  return { ok: true, id };
};
