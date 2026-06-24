import { signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';

// "Lembrar dispositivo": local = sessão persiste entre reinícios do navegador;
// session = só enquanto a aba/navegador estiver aberto. Chamar ANTES do login.
export const setRememberDevice = (remember) =>
  setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);

export const loginUser = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = () => {
  return signOut(auth);
};

export const onAuthStateChangedListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};
