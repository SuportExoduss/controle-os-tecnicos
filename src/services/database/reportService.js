import { collection, addDoc, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
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
