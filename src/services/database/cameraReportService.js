import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';
import { eachDayISO } from './reportService';

// Relatórios diários da equipe de câmeras (IbiuCam).
const COLLECTION_NAME = 'camera_reports';

// ID determinístico: 1 documento por técnico+dia por construção (mesmo padrão
// do reportService da Fibra). '/' é proibido em ID de doc; replace é cinto de
// segurança (nenhum nome tem hoje — auditado 2026-07-02).
export const cameraReportIdFor = (date, technicianName) =>
  `${date}_${String(technicianName || '').trim()}`.replace(/\//g, '-');

// Busca SÓ o período pedido (mês visível) e SÓ registros com O.S > 0.
// Folgas/faltas (zerados) não são lidos → não contam na cota. O dashboard já
// descarta zerados na exibição, então o resultado é idêntico.
// Fallback: sem o índice composto (date + totalOrders), lê o período completo.
export const getCameraReportsByDateRange = async (start, end, { force = false } = {}) => {
  const key = `${COLLECTION_NAME}:${start}|${end}`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const base = [where('date', '>=', start), where('date', '<=', end)];
  let snap;
  try {
    snap = await getDocs(query(collection(db, COLLECTION_NAME), ...base, where('totalOrders', '>', 0)));
  } catch (e) {
    console.warn('[getCameraReportsByDateRange] filtro >0 indisponível (índice?), lendo período completo:', e.code || e.message);
    snap = await getDocs(query(collection(db, COLLECTION_NAME), ...base));
  }
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

// Histórico COMPLETO de um técnico (inclui folgas/faltas zeradas) — sob demanda.
export const getCameraReportsByTechnicianAll = async (technicianName, { force = false } = {}) => {
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
export const upsertCameraReport = async (reportData) => {
  const id = cameraReportIdFor(reportData.date, reportData.technicianName);
  const snap = await getCameraReportsByTechnician(reportData.technicianName, reportData.date);
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
export const getCameraReportsByDateRaw = (date) =>
  getDocs(query(collection(db, COLLECTION_NAME), where('date', '==', date)));

export const getCameraReportsByTechnician = (technicianName, date) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('technicianName', '==', technicianName),
    where('date', '==', date)
  );
  return getDocs(q);
};

export const updateCameraReport = async (reportId, updateData) => {
  const res = await updateDoc(doc(db, COLLECTION_NAME, reportId), updateData);
  clearCache(COLLECTION_NAME);
  return res;
};

// Exclui UM relatório (1 técnico + 1 dia) pelo id do documento.
export const deleteCameraReport = async (reportId) => {
  await deleteDoc(doc(db, COLLECTION_NAME, reportId));
  clearCache(COLLECTION_NAME);
};

// Marca um PERÍODO como ausência (mesma lógica da Fibra; campos de KM/pontos
// nulos). Preserva dias com O.S; grava em lote; retorna os registros criados.
export const saveCameraAbsencePeriod = async (technicianName, start, end, motivo, meta = {}) => {
  const all = await getCameraReportsByTechnicianAll(technicianName, { force: true });
  const comOS = new Set(all.filter(r => r.date >= start && r.date <= end && (r.totalOrders || 0) > 0).map(r => r.date));
  const prevByDate = {}; all.forEach(r => { prevByDate[r.date] = r; });
  const now = new Date().toISOString();
  const records = eachDayISO(start, end).filter(ds => !comOS.has(ds)).map(ds => ({
    technicianName, totalOrders: 0, rescheduled: false, rescheduledCount: 0,
    kmInicial: null, kmFinal: null, kmRodado: null, pontosInstalados: null, pontosCancelados: null,
    observations: motivo, serviceTypes: [], date: ds, submissionTime: '00:00:00',
    createdByNickname: meta.nickname || 'Desconhecido', createdByEmail: meta.email || '', createdByUid: meta.uid || '',
    createdAt: prevByDate[ds]?.createdAt || now,
  }));
  const CHUNK = 400;
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = writeBatch(db);
    records.slice(i, i + CHUNK).forEach(r => batch.set(doc(db, COLLECTION_NAME, cameraReportIdFor(r.date, r.technicianName)), r));
    await batch.commit();
  }
  clearCache(COLLECTION_NAME);
  return records;
};

// Renomeia TODOS os relatórios de um técnico (nome faz parte do ID → recria doc).
export const renameCameraReportsByTechnician = async (oldName, newName) => {
  const snap = await getDocs(query(collection(db, COLLECTION_NAME), where('technicianName', '==', oldName)));
  await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const newId = cameraReportIdFor(data.date, newName);
    await setDoc(doc(db, COLLECTION_NAME, newId), { ...data, technicianName: newName });
    if (d.id !== newId) await deleteDoc(doc(db, COLLECTION_NAME, d.id));
  }));
  clearCache(COLLECTION_NAME);
  return snap.docs.map(d => ({ ...d.data(), technicianName: newName }));
};

// Apaga TODOS os relatórios de uma data (todos os técnicos). Requer login.
export const deleteAllCameraReportsByDate = async (date) => {
  const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  clearCache(COLLECTION_NAME);
  return snap.size;
};
