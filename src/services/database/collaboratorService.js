import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COLLECTION = 'collaborators';

export const getCollaborators = () => {
  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
  return getDocs(q);
};

// Salva o nome exatamente como informado (sem forçar maiúsculas)
export const addCollaborator = (name) => {
  return addDoc(collection(db, COLLECTION), {
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });
};

export const deleteCollaborator = (id) => {
  return deleteDoc(doc(db, COLLECTION, id));
};
