// Overrides manuais da Escala de Redes — 1 doc por mês.
//   network_escala/{YYYY-MM} = { month, overrides: { [dia]: ['azul','amarelo'] } }
// Sem override → vale a regra automática (Azul ímpar, Vermelho par, Amarelo seg–sex).
// overrides[dia] = lista de times que trabalham nesse dia (substitui a regra).
// Lista vazia [] = ninguém trabalha (todos de folga).
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const COL = 'network_escala';
export const escalaMonthId = (ano, mesIndex) => `${ano}-${String(mesIndex + 1).padStart(2, '0')}`;

export const getEscalaMonth = async (ano, mesIndex) => {
  const snap = await getDoc(doc(db, COL, escalaMonthId(ano, mesIndex)));
  return snap.exists() ? (snap.data().overrides || {}) : {};
};

// Define os times de UM dia (override). teamKeys=null → volta para a regra (remove o override).
export const setEscalaDayOverride = async (ano, mesIndex, day, teamKeys) => {
  const id = escalaMonthId(ano, mesIndex);
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  const base = snap.exists() ? snap.data() : { month: id, overrides: {} };
  if (!base.overrides) base.overrides = {};
  if (teamKeys === null) delete base.overrides[day];
  else base.overrides[day] = teamKeys;
  await setDoc(ref, { ...base, updatedAt: new Date().toISOString() });
  return { ok: true };
};
