import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COLLECTION = 'userProfiles';

// Busca o perfil (apelido) de um usuário pelo uid
export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const snap = await getDoc(doc(db, COLLECTION, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// Cria/define o apelido na primeira vez
export const setUserNickname = async (uid, email, nickname) => {
  await setDoc(doc(db, COLLECTION, uid), {
    nickname: nickname.trim(),
    email: email || '',
    createdAt: new Date().toISOString(),
  });
  return { uid, nickname: nickname.trim(), email };
};

// Verifica se um apelido já está em uso por outro usuário
export const isNicknameTaken = async (nickname, currentUid) => {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.some(d => d.id !== currentUid && (d.data().nickname || '').toLowerCase() === nickname.trim().toLowerCase());
};
