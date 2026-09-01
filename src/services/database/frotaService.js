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
import { DEFAULT_TEAMS, mergeFrotaMonth, reconcileAbsences } from '../../pages/Frota/frotaCore';

const COL = 'fleet_reports';
const CFG = 'fleet_config';
const IDX = 'absence_index'; // 1 doc por mês: { month, data: { nome: { dia: motivo } } }
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

// Agrupa uma lista de datas 'YYYY-MM-DD' por mês → { 'YYYY-MM': { ano, mesIndex, days:[] } }.
const groupDatesByMonth = (dates) => {
  const byMonth = {};
  (dates || []).forEach((ds) => {
    const [y, m, d] = String(ds).split('-').map(Number);
    if (!y || !m || !d) return;
    const id = `${y}-${String(m).padStart(2, '0')}`;
    (byMonth[id] = byMonth[id] || { ano: y, mesIndex: m - 1, days: [] }).days.push(d);
  });
  return byMonth;
};

// Marca 'ausente' SÓ nos dias informados (lista, não range) — dirigido pelos
// relatórios de ausência (dias SEM O.S). NÃO rebaixa checklist real (feito/
// atrasado). É a reconciliação relatório → Frota no momento em que a ausência
// é lançada (funciona mesmo que o checklist tenha subido antes, virando o
// 'naofez' daquele dia em 'ausente').
export const markFrotaAbsentDays = async (name, dates, by, status = 'ausente') => {
  if (!name || !dates?.length) return { ok: true };
  for (const m of Object.values(groupDatesByMonth(dates))) {
    const id = monthId(m.ano, m.mesIndex);
    const ref = doc(db, COL, id);
    const snap = await getDoc(ref);
    const base = snap.exists() ? snap.data() : { month: id, data: {} };
    if (!base.data) base.data = {};
    if (!base.data[name]) base.data[name] = {};
    m.days.forEach((d) => {
      const c = base.data[name][d];
      if (c && (c.st === 'feito' || c.st === 'atrasado')) return; // preserva checklist real
      base.data[name][d] = { st: status };
    });
    await setDoc(ref, { ...base, updatedAt: new Date().toISOString(), by: by || null });
  }
  clearCache(COL);
  return { ok: true };
};

// Índice de ausências (justificativas) — 1 doc por mês, alimentado por TODA
// ausência lançada (Fibra/Câmeras, dia único ou período). É a "memória" que
// permite a reconciliação Frota → relatório na direção inversa: quando um
// checklist com 'naofez' é importado DEPOIS, o import consulta este índice e
// resolve o dia como 'ausente'. dates: array 'YYYY-MM-DD'; motivo: string.
export const recordAbsenceIndex = async (name, dates, motivo) => {
  if (!name || !dates?.length) return { ok: true };
  for (const m of Object.values(groupDatesByMonth(dates))) {
    const id = monthId(m.ano, m.mesIndex);
    const ref = doc(db, IDX, id);
    const snap = await getDoc(ref);
    const base = snap.exists() ? snap.data() : { month: id, data: {} };
    if (!base.data) base.data = {};
    if (!base.data[name]) base.data[name] = {};
    m.days.forEach((d) => { base.data[name][d] = motivo; });
    await setDoc(ref, { ...base, updatedAt: new Date().toISOString() });
  }
  clearCache(IDX);
  return { ok: true };
};

// Lê o índice de ausências do mês (1 leitura, cacheada). null se não existe.
export const getAbsenceIndexMonth = async (ano, mesIndex, { force = false } = {}) => {
  const id = monthId(ano, mesIndex);
  const key = `${IDX}:${id}`;
  if (!force) { const c = readCache(key); if (c) return c; }
  const snap = await getDoc(doc(db, IDX, id));
  const data = snap.exists() ? snap.data() : null;
  writeCache(key, data);
  return data;
};

// Efeitos colaterais de UMA ausência lançada nos relatórios: (1) marca 'ausente'
// nos dias na Frota e (2) grava no índice para reconciliar imports futuros.
// Chamado pelos handlers de Folga/Feriado/Atestado (dia único) e Férias/Atestado
// (período) da Fibra e das Câmeras — as duas informações passam a conversar.
export const syncAbsenceDays = async (name, dates, motivo, by) => {
  if (!name || !dates?.length) return { ok: true };
  // "Passageiro" = presente sem veículo (foi de carona) → status próprio na Frota.
  // As demais justificativas (Folga/Atestado/Feriado/Férias) → 'ausente'.
  const status = /passageiro/i.test(motivo || '') ? 'passageiro' : 'ausente';
  await markFrotaAbsentDays(name, dates, by, status);
  await recordAbsenceIndex(name, dates, motivo);
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

// Merge inteligente (lógica pura em frotaCore.mergeFrotaMonth — testável):
// preserva o existente, sobrepõe só o que veio no payload, e "não fez" NUNCA
// rebaixa um registro real já gravado. Retorna também o doc final (merged)
// para a planilha espelhar exatamente o que ficou no Firebase.
export const saveFrotaMonth = async (ano, mesIndex, payload, by) => {
  const id = monthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);

  const merged = snap.exists()
    ? { ...mergeFrotaMonth(snap.data(), payload), updatedAt: new Date().toISOString(), by: by || null }
    : { month: id, updatedAt: new Date().toISOString(), by: by || null, ...payload };

  // Reconciliação Frota → relatório: se o checklist trouxe 'naofez' num dia que
  // JÁ tem justificativa no índice de ausências, resolve como 'ausente' (cobre o
  // caso "checklist subiu depois da ausência" mesmo se a Frota não foi pré-marcada).
  const idx = await getAbsenceIndexMonth(ano, mesIndex, { force: true });
  if (idx?.data) merged.data = reconcileAbsences(merged.data, idx.data);

  await setDoc(ref, merged);
  clearCache(COL);
  return { ok: true, id, merged };
};
