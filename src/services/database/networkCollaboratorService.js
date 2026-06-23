import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COL = 'network_collaborators';

export const TECNICOS_DEFAULT = [
  'GETÚLIO', 'JEFERSON', 'LUIZ FELIPE', 'MÁRCIO',
  'MAURÍCIO', 'PABLO DANTAS', 'ROBSON DONIZETE', 'VINICIUS ALVES',
];

export const getNetworkCollaborators = () =>
  getDocs(query(collection(db, COL), orderBy('name', 'asc')));

export const addNetworkCollaborator = (name) =>
  addDoc(collection(db, COL), { name: name.trim().toUpperCase(), createdAt: new Date().toISOString() });

export const deleteNetworkCollaborator = (id) =>
  deleteDoc(doc(db, COL, id));

export const seedNetworkCollaborators = async () => {
  const snap = await getDocs(collection(db, COL));
  if (snap.empty) {
    for (const name of TECNICOS_DEFAULT) {
      await addDoc(collection(db, COL), { name, createdAt: new Date().toISOString() });
    }
  }
};
