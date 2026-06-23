import {
  collection, addDoc, getDocs, updateDoc,
  doc, orderBy, deleteDoc, query,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { readCache, writeCache, clearCache } from './queryCache';

const COL = 'network_orders';

export const saveNetworkOrder = async (data) => {
  const ref = await addDoc(collection(db, COL), { ...data, createdAt: new Date().toISOString() });
  clearCache(COL);
  return ref;
};

export const getAllNetworkOrders = () =>
  getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));

// Versão com cache (localStorage + TTL) — a "data efetiva" das ordens é
// composta (data/dataFechamento/dataAbertura), então não dá pra limitar por
// período no Firestore com segurança; o cache evita reler a cada abertura.
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

export const deleteNetworkOrder = async (id) => {
  const res = await deleteDoc(doc(db, COL, id));
  clearCache(COL);
  return res;
};
