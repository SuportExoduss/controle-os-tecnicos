import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';

// Relatórios diários da equipe de câmeras (WIBICAM).
const COLLECTION_NAME = 'camera_reports';

export const saveCameraReport = async (reportData) => {
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    ...reportData,
    createdAt: new Date().toISOString(),
  });
  clearCache(COLLECTION_NAME);
  return ref;
};

// Busca SÓ o período pedido (mês visível) — evita reler todo o histórico.
export const getCameraReportsByDateRange = async (start, end, { force = false } = {}) => {
  const key = `${COLLECTION_NAME}:${start}|${end}`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('date', '>=', start),
    where('date', '<=', end)
  );
  const snap = await getDocs(q);
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

// Cria OU atualiza o relatório de um técnico+data (evita duplicar).
// Se houver duplicatas, mantém uma e remove as extras. Retorna 'created' | 'updated'.
export const upsertCameraReport = async (reportData) => {
  const snap = await getCameraReportsByTechnician(reportData.technicianName, reportData.date);
  if (snap.empty) {
    await addDoc(collection(db, COLLECTION_NAME), { ...reportData, createdAt: new Date().toISOString() });
    clearCache(COLLECTION_NAME);
    return 'created';
  }
  const [first, ...extras] = snap.docs;
  await updateDoc(doc(db, COLLECTION_NAME, first.id), { ...reportData });
  await Promise.all(extras.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  clearCache(COLLECTION_NAME);
  return 'updated';
};

export const getCameraReportsByDate = (date) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('date', '==', date),
    orderBy('submissionTime', 'desc')
  );
  return getDocs(q);
};

export const getAllCameraReports = () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  return getDocs(q);
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

export const deleteAllCameraReportsByTechnician = async (technicianName) => {
  const q = query(collection(db, COLLECTION_NAME), where('technicianName', '==', technicianName));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id)));
  const res = await Promise.all(deletes);
  clearCache(COLLECTION_NAME);
  return res;
};

// Apaga TODOS os relatórios de uma data (todos os técnicos). Requer login.
export const deleteAllCameraReportsByDate = async (date) => {
  const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  clearCache(COLLECTION_NAME);
  return snap.size;
};
