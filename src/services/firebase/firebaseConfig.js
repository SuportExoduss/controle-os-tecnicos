import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Persistência via IndexedDB (padrão do Firebase): sobrevive a F5/navegação E
// sincroniza entre abas SEM os "storage events" do localStorage — evita que abrir
// uma aba (ex: Dashboard) deslogue outra já aberta (ex: Admin).
// O usuário só é deslogado por inatividade (1h) ou logout manual.
setPersistence(auth, indexedDBLocalPersistence).catch(() => { /* fallback silencioso */ });
export const db = getFirestore(app);
