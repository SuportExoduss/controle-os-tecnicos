import {
  collection, addDoc, getDocs, updateDoc,
  doc, orderBy, deleteDoc, query, where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';

const COL = 'network_orders';

export const saveNetworkOrder = async (data) => {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: new Date().toISOString() });
  clearCache(COL);
  return ref;
};

// Busca SÓ o período pedido pelo campo `data` (auditoria 2026-07-02: `data` é a
// data efetiva em 100% dos docs — os importados já foram corrigidos para a data
// de encerramento). Cache por período; gravações invalidam. Range num único
// campo → não precisa de índice composto.
export const getNetworkOrdersByRange = async (start, end, { force = false } = {}) => {
  const key = `${COL}:${start}|${end}`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const snap = await getDocs(query(collection(db, COL), where('data', '>=', start), where('data', '<=', end)));
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

// Coleção completa com cache (localStorage + TTL) — usada no ADMIN, que precisa
// da lista inteira (dedupe por ID OS, "Enviar tudo"). Gravações invalidam.
export const getNetworkOrdersCached = async ({ force = false } = {}) => {
  const key = `${COL}:all`;
  if (!force) { const cached = readCache(key); if (cached) return cached; }
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  writeCache(key, arr);
  return arr;
};

export const updateNetworkOrder = async (id, data) => {
  const res = await updateDoc(doc(db, COL, id), data);
  clearCache(COL);
  return res;
};

// Renomeia o técnico em todas as ordens (id aleatório → só atualiza o campo).
export const renameOrdersByTechnician = async (oldName, newName) => {
  const snap = await getDocs(query(collection(db, COL), where('tecnico', '==', oldName)));
  await Promise.all(snap.docs.map((d) => updateDoc(doc(db, COL, d.id), { tecnico: newName })));
  clearCache(COL);
  return snap.size;
};

export const deleteNetworkOrder = async (id) => {
  const res = await deleteDoc(doc(db, COL, id));
  clearCache(COL);
  return res;
};
