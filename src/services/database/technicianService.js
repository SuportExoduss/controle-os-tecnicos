// ─────────────────────────────────────────────────────────────────────────
// Cadastro único de técnico (technicians) + TRANSFERÊNCIA de setor.
// Fonte da verdade da identidade entre áreas. A transferência MOVE o técnico
// da lista de colaboradores do setor de origem para a do destino, atualiza
// technicians.sectors[] e move o grupo dele no fleet_config (a Frota acompanha).
// O HISTÓRICO de relatórios permanece onde foi criado (não se move).
// ─────────────────────────────────────────────────────────────────────────
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { formatName } from '../../utils/formatName';
import { clearCache } from './queryCache';

export const SECTOR_LABEL = { fibra: 'Fibra', redes: 'Redes', cameras: 'Câmeras' };
export const SECTOR_COL = { fibra: 'collaborators', redes: 'network_collaborators', cameras: 'camera_collaborators' };
const REPORT_SECTORS = ['fibra', 'redes', 'cameras'];

// Descobre em quais setores um técnico está hoje (pela presença na lista).
export const getTechnicianSectors = async (fullName) => {
  const name = formatName(fullName);
  const out = [];
  for (const s of REPORT_SECTORS) {
    const snap = await getDocs(query(collection(db, SECTOR_COL[s]), where('name', '==', name)));
    if (!snap.empty) out.push(s);
  }
  return out;
};

// Renomeia o técnico no CADASTRO ÚNICO e nas estruturas da Frota (fleet_config
// e fleet_reports), mantendo o techId. Chamado junto da renomeação específica
// de cada área (que cuida do doc de colaborador, relatórios e planilha), para
// que o registro-mestre nunca fique defasado.
export const renameTechnicianCanonical = async (oldName, newName) => {
  const from = formatName(oldName), to = formatName(newName);
  if (!to || from === to) return;

  // 1. cadastro technicians: atualiza fullName + guarda alias antigo
  const tSnap = await getDocs(query(collection(db, 'technicians'), where('fullName', '==', from)));
  await Promise.all(tSnap.docs.map((d) => {
    const data = d.data();
    const aliases = Array.from(new Set([...(data.aliases || []), from, to]));
    return updateDoc(doc(db, 'technicians', d.id), { fullName: to, aliases });
  }));

  // 2. fleet_config: renomeia o membro
  const cfgRef = doc(db, 'fleet_config', 'cadastro');
  const cfgSnap = await getDoc(cfgRef);
  if (cfgSnap.exists()) {
    const cfg = cfgSnap.data();
    let touched = false;
    const teams = (cfg.teams || []).map((t) => ({
      ...t,
      members: (t.members || []).map((m) => (m.name === from ? (touched = true, { ...m, name: to }) : m)),
    }));
    if (touched) { await setDoc(cfgRef, { ...cfg, teams, updatedAt: new Date().toISOString() }); clearCache('fleet_config'); }
  }

  // 3. fleet_reports: re-chaveia data/cal/occ do nome antigo (poucos docs)
  const frSnap = await getDocs(collection(db, 'fleet_reports'));
  await Promise.all(frSnap.docs.map(async (fd) => {
    const d = fd.data(); let touched = false;
    const rekey = (obj) => { if (!obj || !(from in obj)) return obj; touched = true; const { [from]: v, ...rest } = obj; return { ...rest, [to]: v }; };
    const data = rekey(d.data); const cal = rekey(d.cal);
    const occ = (d.occ || []).map((o) => (o.name === from ? (touched = true, { ...o, name: to }) : o));
    if (touched) { await setDoc(doc(db, 'fleet_reports', fd.id), { ...d, data, cal, occ, updatedAt: new Date().toISOString() }); clearCache('fleet_reports'); }
  }));
};

// Move o técnico de um setor para outro. Idempotente e seguro:
// remove da origem, garante no destino, atualiza cadastro e fleet_config.
export const transferTechnicianSector = async ({ fullName, fromSector, toSector }) => {
  const name = formatName(fullName);
  if (!SECTOR_COL[toSector]) throw new Error('Setor de destino inválido');
  if (fromSector === toSector) return { ok: true, unchanged: true };

  // 1. garante na lista do setor de destino ANTES de remover da origem
  // (se algo falhar no meio, a pessoa fica nas duas listas, nunca em nenhuma).
  const toSnap = await getDocs(query(collection(db, SECTOR_COL[toSector]), where('name', '==', name)));
  if (toSnap.empty) await addDoc(collection(db, SECTOR_COL[toSector]), { name, createdAt: new Date().toISOString() });

  // 2. remove da lista do setor de origem
  if (SECTOR_COL[fromSector]) {
    const fromSnap = await getDocs(query(collection(db, SECTOR_COL[fromSector]), where('name', '==', name)));
    await Promise.all(fromSnap.docs.map((d) => deleteDoc(doc(db, SECTOR_COL[fromSector], d.id))));
  }

  // 3. atualiza o cadastro único (sectors[] e frotaGroup seguem o novo setor)
  const techSnap = await getDocs(query(collection(db, 'technicians'), where('fullName', '==', name)));
  if (!techSnap.empty) {
    const tdoc = techSnap.docs[0];
    const data = tdoc.data();
    const sectors = Array.from(new Set([...(data.sectors || []).filter((s) => s !== fromSector), toSector]));
    const update = { sectors };
    if (REPORT_SECTORS.includes(data.frotaGroup)) update.frotaGroup = toSector; // Frota segue o setor
    await updateDoc(doc(db, 'technicians', tdoc.id), update);
  }

  // 4. move o membro no fleet_config para o grupo do novo setor (se estiver na frota)
  const cfgRef = doc(db, 'fleet_config', 'cadastro');
  const cfgSnap = await getDoc(cfgRef);
  if (cfgSnap.exists()) {
    const cfg = cfgSnap.data();
    let member = null;
    const teams = (cfg.teams || []).map((t) => {
      const keep = [];
      (t.members || []).forEach((m) => { if (m.name === name) member = m; else keep.push(m); });
      return { ...t, members: keep };
    });
    if (member) {
      const dest = teams.find((t) => t.key === toSector);
      if (dest) dest.members.push(member);
      await setDoc(cfgRef, { ...cfg, teams, updatedAt: new Date().toISOString() });
      clearCache('fleet_config');
    }
  }

  return { ok: true, name, fromSector, toSector };
};
