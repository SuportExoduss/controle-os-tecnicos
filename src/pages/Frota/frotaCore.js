// ─────────────────────────────────────────────────────────────────────────
// FROTA — núcleo compartilhado (constantes, parser do Prolog, helpers puros).
// Usado pela dashboard (leitura) e pelo admin (import → Firestore + Sheets).
// Sem CPF (LGPD): casa colaborador por nome normalizado (tokens).
// ─────────────────────────────────────────────────────────────────────────

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const OBRIG = ['fibra', 'redes', 'cameras'];
export const isObrig = (k) => OBRIG.includes(k);
export const ST = {
  feito: { c: '#34d399', l: 'Checklist' },
  atrasado: { c: '#fbbf24', l: 'Atrasado' },
  naofez: { c: '#f87171', l: 'Não fez' },
  ausente: { c: '#fb923c', l: 'Ausente' },
};
export const SEV = {
  critica: { c: '#f87171', l: 'Crítica', i: 'AlertOctagon' },
  alta: { c: '#fbbf24', l: 'Alta', i: 'AlertTriangle' },
  normal: { c: '#3d8bff', l: 'Normal', i: 'InfoCircle' },
};

// Cadastro padrão — members são objetos {name, plate} (Firestore não aceita arrays aninhados).
export const DEFAULT_TEAMS = [
  { key: 'fibra', label: 'Técnicos de Fibra', short: 'Fibra', accent: '#5fa3ff', members: [
    { name: 'Andre Luiz Roberth', plate: 'TIV1I01' },
    { name: 'Bruno Luiz Pupo', plate: 'SJI3F16' },
    { name: 'Carlos Daniel Pedroso', plate: 'CUI8B34' },
    { name: 'Danilo Tiburtino', plate: 'SUV0A56' },
    { name: 'Deyvison Vinícius', plate: 'TIO7A14' },
    { name: 'Eduardo Calixto', plate: 'GFJ5A85' },
    { name: 'Felipe Aparecido', plate: 'BTR5G04' },
    { name: 'Geovani Santos', plate: 'CUN0C95' },
    { name: 'José Luiz Campos', plate: 'SUA3B34' },
    { name: 'Kaique Ribeiro', plate: 'GFP7106' },
    { name: 'Marco Aurélio', plate: 'TMJ7A39' },
    { name: 'Matheus Henrique', plate: 'UGG4F94' },
    { name: 'Rafael Carvalho', plate: 'DVD6I69' },
    { name: 'Thiago Matheus', plate: 'UFD1G43' },
    { name: 'Vitor Daniel', plate: 'TLO2A48' },
    { name: 'Walter Alves', plate: 'UGA0H38' },
    { name: 'Wesley Ribeiro', plate: 'SUM8B53' },
  ] },
  { key: 'redes', label: 'Técnicos de Redes', short: 'Redes', accent: '#fbbf24', members: [
    { name: 'Getulio Benedito', plate: 'TIT2C23' },
    { name: 'Mattheus Mera', plate: 'UDY7D49' },
    { name: 'Pablo Henrique Dantas', plate: 'PYZ0H96' },
    { name: 'Richard Luis Barbosa', plate: 'QNE0F56' },
    { name: 'Robson Donizete', plate: 'GBN1F45' },
    { name: 'Walter Victor Jacob', plate: 'RMN3A56' },
  ] },
  { key: 'cameras', label: 'Técnicos de Câmeras', short: 'Câmeras', accent: '#34d399', members: [
    { name: 'Ewerson Marques', plate: 'SWU8J67' },
    { name: 'Gabriel Aranha', plate: 'GGV3700' },
    { name: 'Natan Krainer', plate: 'PZU8D07' },
    { name: 'Gustavo Torolla', plate: 'GJX1958' },
  ] },
  { key: 'frota', label: 'Equipe de Frota', short: 'Frota', accent: '#a78bfa', members: [
    { name: 'Gustavo Vítor Domingues', plate: 'EVP3E93' },
    { name: 'Lucas Camargo de Oliveira', plate: 'TMA4A51' },
  ] },
  { key: 'demais', label: 'Demais colaboradores', short: 'Demais', accent: '#93a6c6', members: [
    { name: 'Victor Hideki (Supervisor)', plate: 'TMA4A51' },
    { name: 'Paulo Benedito (Supervisor)', plate: 'SSX8J76' },
    { name: 'Beatriz da Silva (Supervisor)', plate: 'EVP3E93' },
    { name: 'Ronaldo Pacheco (Fiscal)', plate: 'TLT5I68' },
    { name: 'Angela da Silva (Vendas)', plate: 'QQR6A88' },
    { name: 'Anselmo Cavalcante', plate: 'EBF3H85' },
  ] },
];

export const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
export const initials = (n) => { const c = norm(n).split(' '); return ((c[0] || '')[0] || '').toUpperCase() + ((c[1] || '')[0] || '').toUpperCase(); };
const pad = (n) => (n < 10 ? '0' : '') + n;

const groupOf = (eq, cg) => {
  const e = norm(eq), c = norm(cg);
  if (c.indexOf('redes') >= 0) return 'redes';
  if (e.indexOf('camera') >= 0 || c.indexOf('camera') >= 0) return 'cameras';
  if (e === 'frota' || c.indexOf('frota') >= 0 || c.indexOf('logistica') >= 0) return 'frota';
  if (c.indexOf('vendedor') >= 0 || c.indexOf('supervisor') >= 0 || c.indexOf('fiscal') >= 0 || c.indexOf('estoque') >= 0) return 'demais';
  return 'fibra';
};

export const teamOf = (teams, name) => teams.find((t) => t.members.some((m) => m.name === name));

// Conta os estados de um colaborador no período. monthData[name] = { dia: {st,...}|null }
export const statsOf = (monthData, name, d1, d2) => {
  const r = (monthData && monthData[name]) || {};
  let f = 0, a = 0, n = 0, au = 0, tr = 0, rec = 0;
  for (let d = d1; d <= d2; d++) {
    const x = r[d];
    if (!x) continue;
    rec++;
    if (x.st === 'feito') f++; else if (x.st === 'atrasado') a++; else if (x.st === 'naofez') n++; else au++;
    if (x.p2) tr++;
  }
  return { f, a, n, au, tr, rec };
};

// Texto da célula para a planilha da diretoria.
export const cellFor = (x) => {
  if (!x) return '';
  if (x.st === 'naofez') return 'NAO FEZ';
  if (x.st === 'ausente') return 'AUSENTE';
  if (x.p2) return `${x.plate} + ${x.p2} (troca)`;
  return x.plate + (x.st === 'atrasado' ? '-ATRASADO' : '');
};

export const buildSheetsPayload = (teams, data, ano, mesIndex, secret) => {
  const linhas = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const dias = {}; const r = (data && data[m.name]) || {};
    for (let d = 1; d <= 31; d++) { const c = cellFor(r[d]); if (c) dias[d] = c; }
    if (Object.keys(dias).length) linhas.push({ nome: m.name, dias });
  }));
  return { secret, mes: MESES[mesIndex], ano: String(ano), linhas };
};

// Parser do CSV do Prolog. Recebe o texto e o cadastro atual de equipes.
// Retorna { teams (com novos colaboradores), data, cal, occ, period, count, people, novos }.
export const parseProlog = (text, teamsIn) => {
  // Deep copy: members são objetos, usar spread
  const teams = teamsIn.map((t) => ({ ...t, members: t.members.map((m) => ({ ...m })) }));
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) throw new Error('Arquivo vazio ou inválido.');
  const H = lines[0].replace(/^﻿/, '').split(';').map(norm);
  const I = (n) => H.indexOf(norm(n));
  const ci = { modelo: I('Modelo checklist'), data: I('Data realização'), nome: I('Colaborador'), equipe: I('Equipe'), cargo: I('Cargo'), placa: I('Placa'), km: I('KM'), tipo: I('Tipo'), nok: I('Total NOK'), pa: I('Prioridade alta'), pc: I('Prioridade critica'), obs: I('Observação') };
  if (ci.nome < 0 || ci.data < 0) throw new Error('Cabeçalho não reconhecido — esperado o CSV do Prolog (separador ; ).');

  const idxM = [];
  teams.forEach((t) => t.members.forEach((m) => idxM.push({ m, t, n: norm(m.name) })));
  const find = (nm) => {
    const xs = new Set(norm(nm).split(' ').filter(Boolean)); let best = null, bl = 0;
    idxM.forEach((it) => { const mt = it.n.split(' ').filter(Boolean); if (mt.length < 2) return; if (mt.every((tok) => xs.has(tok)) && mt.length > bl) { best = it; bl = mt.length; } });
    return best;
  };

  const daily = {}, cal = {}, occ = [];
  let minD = 99, maxD = 0, count = 0, novos = 0, mesIdx = 5; const people = new Set();
  lines.slice(1).forEach((line) => {
    const r = line.split(';');
    const dm = (r[ci.data] || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!dm) return;
    const day = +dm[1]; mesIdx = +dm[2] - 1;
    const time = dm[4].padStart(2, '0') + ':' + dm[5];
    const nome = (r[ci.nome] || '').trim(); if (!nome) return;
    const modelo = norm(r[ci.modelo] || ''); const tipo = norm(r[ci.tipo] || '');
    const plate = (r[ci.placa] || '').trim().replace(/[-\s]/g, '');
    let fm = find(nome), name;
    if (fm) { name = fm.m.name; } else {
      const key = groupOf(r[ci.equipe], r[ci.cargo]); name = nome;
      const t = teams.find((x) => x.key === key) || teams[0];
      if (!t.members.find((x) => norm(x.name) === norm(nome))) {
        const newMember = { name: nome, plate: plate || '—' };
        t.members.push(newMember);
        idxM.push({ m: newMember, t, n: norm(nome) });
        novos++;
      }
    }
    count++; people.add(name); minD = Math.min(minD, day); maxD = Math.max(maxD, day);
    if (modelo.indexOf('ocorrencia') >= 0) { occ.push({ name, plate, dt: pad(day) + '/' + pad(mesIdx + 1) + ' ' + time, obs: (r[ci.obs] || '').trim() || '(sem observação)', nok: +(r[ci.nok] || 0), pa: +(r[ci.pa] || 0), pc: +(r[ci.pc] || 0), km: +(r[ci.km] || 0) }); return; }
    if (modelo.indexOf('semanal') >= 0) { const wd = new Date(dm[3], mesIdx, day).getDay(); const prev = cal[name]; if (!prev || day < prev.day) cal[name] = { day, st: wd === 1 ? 'feito' : 'atrasado' }; return; }
    if (!daily[name]) daily[name] = {}; if (!daily[name][day]) daily[name][day] = []; daily[name][day].push({ time, plate, tipo });
  });
  if (!count) throw new Error('Nenhum registro de checklist encontrado no arquivo.');

  const ano = +(lines[1].split(';')[ci.data] || '').trim().match(/\/(\d{4})/)?.[1] || new Date().getFullYear();
  const data = {}, calOut = {};
  teams.forEach((t) => t.members.forEach((m) => {
    const byDay = daily[m.name] || {}; const out = {};
    for (let d = 1; d <= 31; d++) {
      const wd = new Date(ano, mesIdx, d).getDay();
      if (new Date(ano, mesIdx, d).getMonth() !== mesIdx) { out[d] = null; continue; }
      if (wd === 0 || d < minD || d > maxD) { out[d] = null; continue; }
      const arr = byDay[d];
      if (!arr || !arr.length) { out[d] = { st: 'naofez' }; continue; }
      const sd = arr.filter((x) => x.tipo === 'saida');
      const base = (sd.length ? sd : arr).slice().sort((a, b) => (a.time < b.time ? -1 : 1))[0];
      const st = base.time <= '09:00' ? 'feito' : 'atrasado';
      const plates = [...new Set(arr.map((x) => x.plate).filter(Boolean))];
      const p2 = plates.length > 1 ? (plates.find((p) => p !== base.plate) || null) : null;
      out[d] = { st, plate: base.plate || null, p2, time: base.time };
    }
    data[m.name] = out;
    calOut[m.name] = cal[m.name] || { st: 'naofez', day: null };
  }));
  const occOut = occ.map((o) => ({ ...o, sev: o.pc > 0 ? 'critica' : (o.pa > 0 || o.nok >= 4) ? 'alta' : 'normal' }));

  return { teams, data, cal: calOut, occ: occOut, period: { d1: minD, d2: maxD }, ano, mesIndex: mesIdx, count, people: people.size, novos };
};
