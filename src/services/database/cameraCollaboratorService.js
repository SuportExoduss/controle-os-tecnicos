import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

// Colaboradores da equipe de câmeras (WIBICAM).
const COLLECTION = 'camera_collaborators';

// Nomes exatos da planilha "Lancamentos Equipe Cameras"
export const CAMERA_TECHNICIANS_FROM_EXCEL = [
  'Ewerson da Silva Marques',
  'Natan Krainer da Silva',
  'Gabriel Aranha Machado',
];

export const getCameraCollaborators = () => {
  const q = query(collection(db, COLLECTION), orderBy('name', 'asc'));
  return getDocs(q);
};

// Salva o nome exatamente como informado (sem forçar maiúsculas)
export const addCameraCollaborator = (name) => {
  return addDoc(collection(db, COLLECTION), {
    name: name.trim(),
    createdAt: new Date().toISOString(),
  });
};

export const deleteCameraCollaborator = (id) => {
  return deleteDoc(doc(db, COLLECTION, id));
};

// Popula a coleção com os técnicos da planilha caso esteja vazia.
export const seedCameraCollaborators = async () => {
  const snap = await getDocs(collection(db, COLLECTION));
  if (snap.empty) {
    for (const name of CAMERA_TECHNICIANS_FROM_EXCEL) {
      await addDoc(collection(db, COLLECTION), { name, createdAt: new Date().toISOString() });
    }
  }
};

// Apaga todos e recria com os nomes da planilha
export const syncCameraCollaboratorsFromExcel = async () => {
  const snap = await getDocs(collection(db, COLLECTION));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  for (const name of CAMERA_TECHNICIANS_FROM_EXCEL) {
    await addDoc(collection(db, COLLECTION), {
      name,
      createdAt: new Date().toISOString(),
    });
  }
  return CAMERA_TECHNICIANS_FROM_EXCEL.length;
};
