import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COLLECTION_NAME = 'daily_reports';

export const saveDailyReport = (reportData) => {
  return addDoc(collection(db, COLLECTION_NAME), {
    ...reportData,
    createdAt: new Date().toISOString(),
  });
};

export const getReportsByDate = (date) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('date', '==', date),
    orderBy('submissionTime', 'desc')
  );
  return getDocs(q);
};

export const getAllReports = () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  return getDocs(q);
};

export const getReportsByTechnician = (technicianName, date) => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('technicianName', '==', technicianName),
    where('date', '==', date)
  );
  return getDocs(q);
};

export const updateReport = (reportId, updateData) => {
  return updateDoc(doc(db, COLLECTION_NAME, reportId), updateData);
};

// Mapeamento: nome antigo (curto/maiúsculo) → nome exato da planilha
const NAME_MAP = {
  'ANDERSON':        null,
  'BRUNO LUIZ':      'Bruno Luiz Pupo da Costa',
  'CARLOS DANIEL':   'Carlos Daniel Pedroso',
  'DANILO TIBURTINO':'Danilo Tiburtino Sikorski',
  'GEOVANI SANTOS':  'Geovani Santos da Silva',
  'GUSTAVO TOROLLA': 'Gustavo Torolla',
  'MARCO AURELIO':   'Marco Aurélio da Silva Araújo',
  'MATHEUS HENRIQUE':'Matheus Henrique De Barros',
  'MATHEUS MERA':    'Matheus Mera de Moraes',
  'THIAGO MATHEUS':  'Thiago Matheus Moreira de Pontes',
  'VICTOR DOS SANTOS':'Victor dos Santos Pires Gabriel',
  'WESLEY RIBEIRO':  'Wesley Ribeiro de Araujo',
  'NATAN':           'Natan Krainer da Silva',
  'KAIQUE':          'Kaique Ribeiro Barbosa',
  'FELIPE':          'Felipe Aparecido Almeida da Luz',
  'EDUARDO':         'Eduardo Calixto',
  'WALTER':          'Walter Alves dos Santos Junior',
  'VITOR':           'Vitor Daniel Maciel de Oliveira',
  'JOSE LUIZ':       'Jose Luiz Campos',
  'DEYVISON':        'Deyvison Vinícius Alves de Jesus',
  'ANDRE':           'André Luiz Roberth Pereira de Barros',
  'RAFAEL':          'Rafael Carvalho',
};

export const migrateReportNames = async (date) => {
  const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  let updated = 0;
  let deleted = 0;

  for (const [oldName, newName] of Object.entries(NAME_MAP)) {
    if (!newName) continue;
    const oldRec = all.find(r => r.technicianName === oldName);
    const newRec = all.find(r => r.technicianName === newName);

    if (oldRec && newRec) {
      // Copia dados reais do registro antigo para o novo (cheio)
      await updateDoc(doc(db, COLLECTION_NAME, newRec.id), {
        totalOrders:      oldRec.totalOrders      || 0,
        serviceTypes:     oldRec.serviceTypes     || [],
        rescheduled:      oldRec.rescheduled      || false,
        rescheduledCount: oldRec.rescheduledCount || 0,
        observations:     oldRec.observations     || '',
        submissionTime:   oldRec.submissionTime   || '',
      });
      // Deleta o registro com nome antigo
      await deleteDoc(doc(db, COLLECTION_NAME, oldRec.id));
      updated++;
      deleted++;
    } else if (oldRec && !newRec) {
      // Só tem o antigo — apenas renomeia
      await updateDoc(doc(db, COLLECTION_NAME, oldRec.id), { technicianName: newName });
      updated++;
    }
  }

  return { updated, deleted, total: all.length };
};

export const deleteAllReportsByTechnician = async (technicianName) => {
  const q = query(collection(db, COLLECTION_NAME), where('technicianName', '==', technicianName));
  const snap = await getDocs(q);
  const deletes = snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id)));
  return Promise.all(deletes);
};

// Apaga TODOS os relatórios de uma data (todos os técnicos). Requer login.
export const deleteAllReportsByDate = async (date) => {
  const q = query(collection(db, COLLECTION_NAME), where('date', '==', date));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, COLLECTION_NAME, d.id))));
  return snap.size;
};
