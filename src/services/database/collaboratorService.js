import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COLLECTION = 'collaborators';

// Nomes exatos da planilha "Lancamentos Equipe Fibra"
export const TECHNICIANS_FROM_EXCEL = [
  '(Terceirizada) Edson José Pinto',
  '(Terceirizada) Michel Galdino da Silva',
  'André Luiz Roberth Pereira de Barros',
  'Bruno Luiz Pupo da Costa',
  'Carlos Daniel Pedroso',
  'Danilo Tiburtino Sikorski',
  'Deyvison Vinícius Alves de Jesus',
  'Eduardo Calixto',
  'Felipe Aparecido Almeida da Luz',
  'Geovani Santos da Silva',
  'Gustavo Torolla',
  'Jose Luiz Campos',
  'Kaique Ribeiro Barbosa',
  'Marco Aurélio da Silva Araújo',
  'Matheus Henrique De Barros',
  'Matheus Mera de Moraes',
  'Natan Krainer da Silva',
  'Rafael Carvalho',
  'Thiago Matheus Moreira de Pontes',
  'Victor dos Santos Pires Gabriel',
  'Vitor Daniel Maciel de Oliveira',
  'Walter Alves dos Santos Junior',
  'Wesley Ribeiro de Araujo',
];

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

// Apaga todos e recria com os nomes da planilha
export const syncCollaboratorsFromExcel = async () => {
  const snap = await getDocs(collection(db, COLLECTION));
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  for (const name of TECHNICIANS_FROM_EXCEL) {
    await addDoc(collection(db, COLLECTION), {
      name,
      createdAt: new Date().toISOString(),
    });
  }
  return TECHNICIANS_FROM_EXCEL.length;
};
