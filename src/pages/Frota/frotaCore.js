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
  // Lista completa — Apps Script usa para criar a aba quando ela não existe ainda.
  const allColabs = [];
  teams.forEach((t) => t.members.forEach((m) => {
    allColabs.push({ nome: m.name, placa: m.plate || '', equipe: t.short });
  }));

  // Apenas quem tem entradas no mês — dados diários a gravar.
  const linhas = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const dias = {}; const r = (data && data[m.name]) || {};
    for (let d = 1; d <= 31; d++) { const c = cellFor(r[d]); if (c) dias[d] = c; }
    if (Object.keys(dias).length) linhas.push({ nome: m.name, dias });
  }));

  return { secret, mes: MESES[mesIndex], ano: String(ano), allColabs, linhas };
};

// Merge de um payload de mês sobre o doc existente (PURO — testável sem Firestore).
// • data: por pessoa→dia; null = fora do range do arquivo → preserva o existente.
//   ANTI-REBAIXAMENTO: "não fez" NUNCA substitui um registro real já gravado
//   (feito/atrasado/ausente) — "não fez" é ausência de informação, não evidência.
//   Correção deliberada para "não fez" continua possível pela entrada manual.
// • cal: por pessoa (novo vence; quem não vem no payload é preservado).
// • occ: union deduplicada por pessoa+dia+hora (novo vence).
// • period: expande o intervalo para cobrir ambos os envios.
export const mergeFrotaMonth = (ex, payload) => {
  const mergedData = {};
  const allNames = new Set([...Object.keys(ex.data || {}), ...Object.keys(payload.data || {})]);
  allNames.forEach((person) => {
    const base = { ...((ex.data || {})[person] || {}) };
    const incoming = (payload.data || {})[person] || {};
    for (const day in incoming) {
      const inc = incoming[day];
      if (inc === null) continue; // fora do range do arquivo → não sobrescreve
      const cur = base[day];
      if (inc.st === 'naofez' && cur && cur.st && cur.st !== 'naofez') continue; // anti-rebaixamento
      base[day] = inc;
    }
    mergedData[person] = base;
  });
  const mergedCal = { ...(ex.cal || {}), ...(payload.cal || {}) };
  const occMap = {};
  [...(ex.occ || []), ...(payload.occ || [])].forEach((o) => {
    occMap[`${o.name}:${o.day ?? ''}:${o.dt ?? ''}`] = o;
  });
  const exP = ex.period || {};
  const newP = payload.period || {};
  const mergedPeriod = {
    d1: Math.min(exP.d1 ?? 1,  newP.d1 ?? 1),
    d2: Math.max(exP.d2 ?? 31, newP.d2 ?? 31),
  };
  return { ...ex, data: mergedData, cal: mergedCal, occ: Object.values(occMap), period: mergedPeriod };
};

// Parser do CSV do Prolog. Recebe o texto e o cadastro atual de equipes.
// MULTI-MÊS: as linhas são agrupadas por mês/ano — um export que cruza a
// virada do mês gera um payload POR MÊS (cada um vai pro seu doc fleet_reports,
// nunca mistura). Correções de 2026-07-03:
//   • o período de "não fez" é definido SÓ pelas linhas de checklist DIÁRIO
//     (ocorrência/calibragem não inflam o range nem geram "não fez" falso);
//   • cal só inclui quem TEM linha semanal no arquivo (o merge preserva a
//     calibragem dos demais em vez de zerar todo mundo a cada import);
//   • ocorrências carregam `day` (dedupe correto no merge do frotaService).
// `registry` (opcional): lista de technicians ({fullName, aliases[], frotaGroup}).
// Quando passado, o parser acha o DONO do nome pelos aliases (normalizados, sem
// acento) e usa o nome canônico + o setor do cadastro — mesmo que o Prolog mande
// uma grafia diferente. É o que garante "sempre encontrar o dono do relatório".
// Retorna { teams, months: [{ano, mesIndex, data, cal, occ, period, count, people}], count, people, novos }.
export const parseProlog = (text, teamsIn, registry = []) => {
  // Deep copy: members são objetos, usar spread
  const teams = teamsIn.map((t) => ({ ...t, members: t.members.map((m) => ({ ...m })) }));
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) throw new Error('Arquivo vazio ou inválido.');
  const H = lines[0].replace(/^\uFEFF/, '').split(';').map(norm);
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

  // Índice do cadastro por alias normalizado (sem acento). Acha o dono do nome
  // mesmo com grafia diferente: match exato de alias, ou tokens do alias ⊆ nome
  // do Prolog (ou vice-versa). Retorna { fullName, frotaGroup } | null.
  const regIndex = (registry || []).map((t) => ({
    fullName: t.fullName,
    frotaGroup: t.frotaGroup || null,
    aliasNorms: Array.from(new Set([t.fullName, ...(t.aliases || [])].map(norm).filter(Boolean))),
  }));
  const matchRegistry = (nm) => {
    const n = norm(nm); if (!n) return null;
    const nTokens = new Set(n.split(' ').filter(Boolean));
    for (const r of regIndex) if (r.aliasNorms.includes(n)) return r; // match exato de alias
    let best = null, bl = 0;
    for (const r of regIndex) for (const a of r.aliasNorms) {
      const at = a.split(' ').filter(Boolean);
      if (at.length < 2) continue;
      const aSet = new Set(at);
      const sub = at.every((tok) => nTokens.has(tok)) || (nTokens.size >= 2 && [...nTokens].every((tok) => aSet.has(tok)));
      if (sub && at.length > bl) { best = r; bl = at.length; }
    }
    return best;
  };

  // Balde por mês: 'YYYY-MM' → dados isolados daquele mês
  const buckets = {};
  let novos = 0, totalCount = 0;
  const allPeople = new Set();
  lines.slice(1).forEach((line) => {
    const r = line.split(';');
    const dm = (r[ci.data] || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (!dm) return;
    const day = +dm[1], mesIdx = +dm[2] - 1, anoRow = +dm[3];
    const time = dm[4].padStart(2, '0') + ':' + dm[5];
    const nome = (r[ci.nome] || '').trim(); if (!nome) return;
    const modelo = norm(r[ci.modelo] || ''); const tipo = norm(r[ci.tipo] || '');
    // LISTA BRANCA de modelos conhecidos do Prolog (Padrão/diário, Ocorrência,
    // Semanal). Qualquer outro modelo — VISTORIA TÉCNICA ou qualquer novo que o
    // Prolog venha a criar — é IGNORADO. Antes o parser tratava "tudo que não
    // era ocorrência/semanal" como diário, então um modelo novo criava técnicos
    // fantasmas (o campo "Colaborador" da vistoria é o CLIENTE, não um técnico).
    const isOcorrencia = modelo.indexOf('ocorrencia') >= 0;
    const isSemanal    = modelo.indexOf('semanal')    >= 0;
    const isDiario     = modelo.indexOf('padrao')     >= 0;
    if (!isOcorrencia && !isSemanal && !isDiario) return; // modelo desconhecido → ignora
    const plate = (r[ci.placa] || '').trim().replace(/[-\s]/g, '');
    let fm = find(nome), name;
    if (fm) {
      name = fm.m.name;
    } else if (isDiario) {
      // Só o checklist DIÁRIO pode cadastrar/resolver um técnico — é o único modelo
      // cujo "Colaborador" é sempre um técnico da frota. Isso impede que modelos
      // estranhos criem fantasmas mesmo que passem pela lista branca no futuro.
      // 1º tenta o CADASTRO ÚNICO (aliases) — acha o dono mesmo com grafia diferente.
      const reg = matchRegistry(nome);
      name = reg ? reg.fullName : nome;
      // Já é membro da frota (em qualquer equipe)? então só usa o nome canônico.
      if (!idxM.find((it) => it.n === norm(name))) {
        const key = (reg && reg.frotaGroup) || groupOf(r[ci.equipe], r[ci.cargo]); // setor do cadastro vence
        const t = teams.find((x) => x.key === key) || teams[0];
        const newMember = { name, plate: plate || '—' };
        t.members.push(newMember);
        idxM.push({ m: newMember, t, n: norm(name) });
        novos++;
      }
    } else {
      // ocorrência/semanal: tenta resolver o dono pelo cadastro; se não achar, ignora
      const reg = matchRegistry(nome);
      if (!reg || !idxM.find((it) => it.n === norm(reg.fullName))) return;
      name = reg.fullName;
    }
    const bkey = anoRow + '-' + String(mesIdx + 1).padStart(2, '0');
    const b = buckets[bkey] = buckets[bkey] || { ano: anoRow, mesIdx, daily: {}, cal: {}, occ: [], minDaily: 99, maxDaily: 0, minAny: 99, maxAny: 0, count: 0, people: new Set() };
    b.count++; totalCount++; b.people.add(name); allPeople.add(name);
    b.minAny = Math.min(b.minAny, day); b.maxAny = Math.max(b.maxAny, day);
    if (isOcorrencia) { b.occ.push({ name, plate, day, dt: pad(day) + '/' + pad(mesIdx + 1) + ' ' + time, obs: (r[ci.obs] || '').trim() || '(sem observação)', nok: +(r[ci.nok] || 0), pa: +(r[ci.pa] || 0), pc: +(r[ci.pc] || 0), km: +(r[ci.km] || 0) }); return; }
    if (isSemanal) { const wd = new Date(anoRow, mesIdx, day).getDay(); const prev = b.cal[name]; if (!prev || day < prev.day) b.cal[name] = { day, st: wd === 1 ? 'feito' : 'atrasado' }; return; }
    // Checklist DIÁRIO — só ele define o período de "não fez"
    b.minDaily = Math.min(b.minDaily, day); b.maxDaily = Math.max(b.maxDaily, day);
    if (!b.daily[name]) b.daily[name] = {}; if (!b.daily[name][day]) b.daily[name][day] = []; b.daily[name][day].push({ time, plate, tipo });
  });
  if (!totalCount) throw new Error('Nenhum registro de checklist encontrado no arquivo.');

  const months = Object.values(buckets)
    .sort((x, y) => (x.ano - y.ano) || (x.mesIdx - y.mesIdx))
    .map((b) => {
      const hasDaily = b.maxDaily >= b.minDaily;
      const data = {}, calOut = {};
      teams.forEach((t) => t.members.forEach((m) => {
        const byDay = b.daily[m.name] || {}; const out = {};
        for (let d = 1; d <= 31; d++) {
          const dt = new Date(b.ano, b.mesIdx, d);
          if (dt.getMonth() !== b.mesIdx) { out[d] = null; continue; }
          // Domingo: só a equipe de Redes trabalha — registra quem FEZ checklist;
          // quem não fez fica null (não "naofez") e o popup pós-import define folga/ausente.
          if (!hasDaily || d < b.minDaily || d > b.maxDaily) { out[d] = null; continue; }
          const arr = byDay[d];
          if (!arr || !arr.length) { out[d] = dt.getDay() === 0 ? null : { st: 'naofez' }; continue; }
          const sortedAll = arr.slice().sort((p, q) => (p.time < q.time ? -1 : 1));
          const sd = sortedAll.filter((x) => x.tipo === 'saida');
          const base = (sd.length ? sd : sortedAll)[0];
          const st = base.time <= '09:00' ? 'feito' : 'atrasado';
          // Detecta TODAS as trocas: cada mudança de placa consecutiva = 1 troca
          const swapsList = [];
          for (let i = 1; i < sortedAll.length; i++) {
            const prev = sortedAll[i - 1], curr = sortedAll[i];
            if (curr.plate && prev.plate && curr.plate !== prev.plate)
              swapsList.push({ plateFrom: prev.plate, plateTo: curr.plate, timeFrom: prev.time, timeTo: curr.time });
          }
          const p2 = swapsList.length > 0 ? swapsList[swapsList.length - 1].plateTo : null;
          out[d] = { st, plate: base.plate || null, p2, time: base.time, ...(swapsList.length ? { swaps: swapsList } : {}) };
        }
        data[m.name] = out;
        if (b.cal[m.name]) calOut[m.name] = b.cal[m.name]; // só quem calibrou de fato
      }));
      const occOut = b.occ.map((o) => ({ ...o, sev: o.pc > 0 ? 'critica' : (o.pa > 0 || o.nok >= 4) ? 'alta' : 'normal' }));
      return {
        ano: b.ano, mesIndex: b.mesIdx, data, cal: calOut, occ: occOut,
        period: hasDaily ? { d1: b.minDaily, d2: b.maxDaily } : { d1: b.minAny, d2: b.maxAny },
        count: b.count, people: b.people.size,
      };
    });

  return { teams, months, count: totalCount, people: allPeople.size, novos };
};
