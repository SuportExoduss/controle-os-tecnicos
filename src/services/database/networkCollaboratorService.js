import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { formatName } from '../../utils/formatName';

const COL = 'network_collaborators';

export const TECNICOS_DEFAULT = [
  'GETÚLIO', 'JEFERSON', 'LUIZ FELIPE', 'MÁRCIO',
  'MAURÍCIO', 'PABLO DANTAS', 'ROBSON DONIZETE', 'VINICIUS ALVES',
];

export const getNetworkCollaborators = () =>
  getDocs(query(collection(db, COL), orderBy('name', 'asc')));

// Nome próprio canônico (Title Case) — sem MAIÚSCULO (padronização de identidade)
export const addNetworkCollaborator = (name) =>
  addDoc(collection(db, COL), { name: formatName(name), createdAt: new Date().toISOString() });

export const updateNetworkCollaborator = (id, newName) =>
  updateDoc(doc(db, COL, id), { name: formatName(newName) });

// Escala: time (azul/vermelho/amarelo) + papel (motorista/passageiro).
// Passageiro = não dirige → não é obrigado a fazer o CHECKLIST no seu dia.
export const updateNetworkCollaboratorEscala = (id, { team, motorista, passageiro }) =>
  updateDoc(doc(db, COL, id), {
    team: team || null,
    motorista: motorista !== undefined ? !!motorista : true,
    passageiro: !!passageiro,
  });

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
