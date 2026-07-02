import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';

const COLLECTION_NAME = 'daily_reports';

// ID determinístico: 1 documento por técnico+dia POR CONSTRUÇÃO — duplicar é
// impossível (auditoria 2026-07-02 achou 185 pares duplicados criados pelo
// padrão antigo de consultar-depois-gravar). '/' é proibido em ID de doc;
// nenhum nome tem hoje (auditado), o replace é cinto de segurança.
export const reportIdFor = (date, technicianName) =>
  `${date}_${String(technicianName || '').trim()}`.replace(/\//g, '-');

// Busca SÓ o período pedido (ex.: mês visível) e SÓ registros com O.S > 0.
// Folgas/faltas (zerados) não são lidos → não contam na cota de leitura.
// O dashboard já descarta zerados na exibição, então o resultado é idêntico.
// `date` é 'YYYY-MM-DD' (ordena certo). Cache de alguns minutos; gravações invalidam.
// Fallback: sem o índice composto (date + totalOrders), lê o período completo.
export const getReportsByDateRange = async (start, end, { force = false } = {}) => {
  const key = `${COLLECTION_NAME}:${start}|${end}`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const base = [where('date', '>=', start), where('date', '<=', end)];
  let snap;
  try {
    snap = await getDocs(query(collection(db, COLLECTION_NAME), ...base, where('totalOrders', '>', 0)));
  } catch (e) {
    console.warn('[getReportsByDateRange] filtro >0 indisponível (índice?), lendo período completo:', e.code || e.message);
    snap = await getDocs(query(collection(db, COLLECTION_NAME), ...base));
  }
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

// Histórico COMPLETO de um técnico (inclui folgas/faltas zeradas) — sob demanda,
// só quando o usuário abre o histórico. Cacheado; gravações invalidam.
export const getReportsByTechnicianAll = async (technicianName, { force = false } = {}) => {
  const key = `${COLLECTION_NAME}:tech:${technicianName}`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), where('technicianName', '==', technicianName)));
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

// Cria OU atualiza o relatório de um técnico+data no ID determinístico.
// A query por campos enxerga tanto docs antigos (ID aleatório) quanto o novo:
// preserva o createdAt original e apaga legados do mesmo par — funciona igual
// ANTES e DEPOIS da migração de IDs. Retorna 'created' | 'updated'.
export const upsertDailyReport = async (reportData) => {
  const id = reportIdFor(reportData.date, reportData.technicianName);
  const snap = await getReportsByTechnician(reportData.technicianName, reportData.date);
  const prev = snap.docs[0]?.data();
  await setDoc(doc(db, COLLECTION_NAME, id), {
    ...reportData,
    createdAt: prev?.createdAt || new Date().toISOString(),
  });
  const legacy = snap.docs.filter(d => d.id !== id);
  await Promise.all(legacy.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  clearCache(COLLECTION_NAME);
  return snap.empty ? 'created' : 'updated';
};

// Relatórios de uma data, sem orderBy (evita índice composto). Usado no status do Admin.
export const getReportsByDateRaw = (date) =>
  getDocs(query(collection(db, COLLECTION_NAME), where('date', '==', date)));

export const getReportsByTechnician = (technicianName, date) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('technicianName', '==', technicianName),
    where('date', '==', date)
  );
  return getDocs(q);
};

export const updateReport = async (reportId, updateData) => {
  const res = await updateDoc(doc(db, COLLECTION_NAME, reportId), updateData);
  clearCache(COLLECTION_NAME);
  return res;
};

// Exclui UM relatório (1 técnico + 1 dia) pelo id do documento.
export const deleteReport = async (reportId) => {
  await deleteDoc(doc(db, COLLECTION_NAME, reportId));
  clearCache(COLLECTION_NAME);
};

export const deleteAllReportsByTechnician = async (technicianName) => {
  const q = query(collection(db, COLLECTION_NAME), where('technicianName', '==', technicianName));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id)));
  const res = await Promise.all(deletes);
  clearCache(COLLECTION_NAME);
  return res;
};

// Apaga TODOS os relatórios de uma data (todos os técnicos). Requer login.
export const deleteAllReportsByDate = async (date) => {
  const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  clearCache(COLLECTION_NAME);
  return snap.size;
};
