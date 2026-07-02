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

// Salva/atualiza UMA entrada manual (data[name][day]) sem sobrescrever o mês todo.
// Se o doc não existir ainda, cria-o com o mínimo necessário.
export const saveFrotaManualEntry = async (ano, mesIndex, entry, by) => {
  const { name, day, occEntry, calEntry, ...dayData } = entry;
  const id = monthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : { month: id, data: {} };
  if (!base.data) base.data = {};
  if (!base.data[name]) base.data[name] = {};

  // Entrada de checklist diário
  if (dayData.st) base.data[name][day] = dayData;

  // Calibragem semanal
  if (calEntry) {
    if (!base.cal) base.cal = {};
    base.cal[name] = calEntry;
  }

  // Ocorrência manual
  if (occEntry) {
    if (!base.occ) base.occ = [];
    base.occ = base.occ.filter((o) => !(o.name === name && o.day === day));
    base.occ.push({ name, day, ...occEntry });
  }

  await setDoc(ref, { ...base, updatedAt: new Date().toISOString(), by: by || null });
  clearCache(COL);
  return { ok: true };
};

// Marca N colaboradores como ausentes num dia específico (fluxo sábado).
// Faz read-merge-write para não sobrescrever o resto do mês.
export const saveFrotaAbsences = async (ano, mesIndex, day, names, by) => {
  const id = monthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : { month: id, data: {} };
  if (!base.data) base.data = {};
  names.forEach((name) => {
    if (!base.data[name]) base.data[name] = {};
    base.data[name][day] = { st: 'ausente' };
  });
  await setDoc(ref, { ...base, updatedAt: new Date().toISOString(), by: by || null });
  clearCache(COL);
  return { ok: true };
};

// Apaga a entrada de um colaborador num dia específico (edit delete).
export const deleteFrotaDayEntry = async (ano, mesIndex, name, day) => {
  const id = monthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: true };
  const base = snap.data();
  if (!base.data?.[name]?.[day]) return { ok: true };
  delete base.data[name][day];
  await setDoc(ref, { ...base, updatedAt: new Date().toISOString() });
  clearCache(COL);
  return { ok: true };
};

// Merge inteligente: preserva dados existentes e sobrepõe apenas o que veio no novo payload.
// Estratégia por campo:
//   data : merge por pessoa→dia (novo dia vence; dias não presentes no CSV são mantidos)
//   cal  : merge por pessoa (novo vence por pessoa)
//   occ  : union deduplicada por name+day (novo vence em caso de conflito)
//   period: expande o intervalo (min d1, max d2)
export const saveFrotaMonth = async (ano, mesIndex, payload, by) => {
  const id = monthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);

  let merged;
  if (snap.exists()) {
    const ex = snap.data();

    // data: merge dia a dia — null = fora do intervalo do CSV, não sobrescreve dado existente
    const mergedData = {};
    const allNames = new Set([...Object.keys(ex.data || {}), ...Object.keys(payload.data || {})]);
    allNames.forEach((person) => {
      const base = { ...(ex.data?.[person] || {}) };
      const incoming = payload.data?.[person] || {};
      for (const day in incoming) {
        if (incoming[day] !== null) base[day] = incoming[day]; // null = fora do range → ignora
      }
      mergedData[person] = base;
    });

    // cal: merge por pessoa (novo prevalece)
    const mergedCal = { ...(ex.cal || {}), ...(payload.cal || {}) };

    // occ: union; em conflito (mesmo name+day) o novo prevalece
    const occMap = {};
    [...(ex.occ || []), ...(payload.occ || [])].forEach((o) => {
      occMap[`${o.name}:${o.day}`] = o;
    });

    // period: expande o intervalo para cobrir ambos os envios
    const exP = ex.period || {};
    const newP = payload.period || {};
    const mergedPeriod = {
      d1: Math.min(exP.d1 ?? 1,  newP.d1 ?? 1),
      d2: Math.max(exP.d2 ?? 31, newP.d2 ?? 31),
    };

    merged = {
      ...ex,
      data: mergedData,
      cal: mergedCal,
      occ: Object.values(occMap),
      period: mergedPeriod,
      updatedAt: new Date().toISOString(),
      by: by || null,
    };
  } else {
    merged = { month: id, updatedAt: new Date().toISOString(), by: by || null, ...payload };
  }

  await setDoc(ref, merged);
  clearCache(COL);
  return { ok: true, id };
};
