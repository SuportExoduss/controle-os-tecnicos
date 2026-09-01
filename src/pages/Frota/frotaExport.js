// Exports da FROTA — Texto / Excel / PDF da Relação do mês.
// Mesmo modus operandi das outras áreas: xlsx e jspdf por import dinâmico.
import { statsOf, isObrig, MESES } from './frotaCore';

const buildRows = (teams, data, d1, d2) => {
  const rows = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const s = statsOf(data, m.name, d1, d2);
    rows.push({ name: m.name, eq: t.short, obrig: isObrig(t.key), f: s.f, a: s.a, n: s.n, au: s.au, pg: s.pg, total: s.f + s.a + s.n + s.au + s.pg });
  }));
  return rows;
};

const fmtTs = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
};

const pad2 = (d) => String(d).padStart(2, '0');

// Relação da calibragem semanal (1x/semana): quantas semanas fez / não fez no mês.
const buildCal = (teams, cal, mesIndex, ano) => {
  const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
  const today = new Date();
  const isCurrent = today.getFullYear() === ano && today.getMonth() === mesIndex;
  const maxDay = isCurrent ? Math.min(today.getDate(), lastDay) : lastDay;
  const mondayKey = (d) => {
    const dt = new Date(ano, mesIndex, d);
    const dow = dt.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    return new Date(ano, mesIndex, d + diff).getTime();
  };
  const semanas = new Set();
  for (let d = 1; d <= maxDay; d++) semanas.add(mondayKey(d));
  const totalSemanas = semanas.size;
  const rows = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const c = (cal || {})[m.name] || {};
    const days = (c.days && c.days.length) ? c.days : (c.day != null ? [c.day] : []);
    const feito = new Set(days.map(mondayKey)).size;
    const naoFeito = Math.max(0, totalSemanas - feito);
    rows.push({ name: m.name, eq: t.short, obrig: isObrig(t.key), feito, naoFeito, days: days.slice().sort((a, b) => a - b) });
  }));
  return { totalSemanas, rows };
};

export const buildTextoRelacao = (teams, doc, mesIndex, ano) => {
  const d1 = 1, d2 = new Date(ano, mesIndex + 1, 0).getDate();
  const rows = buildRows(teams, doc?.data || {}, d1, d2);
  const L = [];
  L.push('╔════════════════════════════════════════════╗');
  L.push(`   RELATÓRIO DE FROTA — ${MESES[mesIndex]} ${ano}`);
  L.push('╚════════════════════════════════════════════╝');
  L.push(`Enviado por   : ${doc?.by || '—'}`);
  L.push(`Última subida : ${fmtTs(doc?.updatedAt)}`);
  L.push(`Gerado em     : ${new Date().toLocaleString('pt-BR')}`);
  L.push('─'.repeat(62));
  L.push('Colaborador | Equipe | Fez | Atrasado | Não fez | Ausente | Passageiro | Total');
  L.push('─'.repeat(62));
  rows.forEach((r) => L.push(`${r.name} | ${r.eq} | ${r.f} | ${r.a} | ${r.n} | ${r.au} | ${r.pg} | ${r.total}`));
  L.push('─'.repeat(62));

  // Calibragem semanal
  const cal = buildCal(teams, doc?.cal, mesIndex, ano);
  L.push('');
  L.push(`CALIBRAGEM SEMANAL — ${cal.totalSemanas} semana(s) no mês`);
  L.push('Colaborador | Equipe | Feito | Não feito | Dias feitos');
  L.push('─'.repeat(62));
  cal.rows.forEach((r) => L.push(`${r.name} | ${r.eq} | ${r.feito} | ${r.naoFeito} | ${r.days.map(pad2).join(', ') || '—'}`));
  L.push('─'.repeat(62));
  return L.join('\n');
};

export const exportExcelRelacao = async (teams, doc, mesIndex, ano, onProgress) => {
  const XLSX = await import('xlsx');
  onProgress?.(20);
  const d1 = 1, d2 = new Date(ano, mesIndex + 1, 0).getDate();
  const rows = buildRows(teams, doc?.data || {}, d1, d2);
  const meta = [
    [`Relatório de Frota — ${MESES[mesIndex]} ${ano}`],
    [`Enviado por: ${doc?.by || '—'}`],
    [`Última subida: ${fmtTs(doc?.updatedAt)}`],
    [`Gerado em: ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['Colaborador', 'Equipe', 'Obrigatório', 'Fez', 'Atrasado', 'Não fez', 'Ausente', 'Passageiro', 'Total'],
  ];
  const aoa = [...meta, ...rows.map((r) => [r.name, r.eq, r.obrig ? 'Sim' : 'Não', r.f, r.a, r.n, r.au, r.pg, r.total])];
  onProgress?.(60);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relacao Frota');

  // 2ª aba: Calibragem semanal
  const cal = buildCal(teams, doc?.cal, mesIndex, ano);
  const calAoa = [
    [`Calibragem semanal — ${MESES[mesIndex]} ${ano}`],
    [`Semanas no mês: ${cal.totalSemanas}`],
    [],
    ['Colaborador', 'Equipe', 'Obrigatório', 'Feito (semanas)', 'Não feito (semanas)', 'Dias feitos'],
    ...cal.rows.map((r) => [r.name, r.eq, r.obrig ? 'Sim' : 'Não', r.feito, r.naoFeito, r.days.map(pad2).join(', ')]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(calAoa), 'Calibragem');

  onProgress?.(90);
  XLSX.writeFile(wb, `relatorio-frota-${ano}-${String(mesIndex + 1).padStart(2, '0')}.xlsx`);
  onProgress?.(100);
};

export const exportPdfRelacao = async (teams, doc, mesIndex, ano, onProgress) => {
  const { jsPDF } = await import('jspdf');
  onProgress?.(20);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const d1 = 1, d2 = new Date(ano, mesIndex + 1, 0).getDate();
  const rows = buildRows(teams, doc?.data || {}, d1, d2);
  pdf.setFontSize(14); pdf.text(`Relatório de Frota — ${MESES[mesIndex]} ${ano}`, 14, 16);
  pdf.setFontSize(8);
  pdf.text(`Enviado por: ${doc?.by || '—'}   |   Última subida: ${fmtTs(doc?.updatedAt)}   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 23);
  pdf.setFontSize(9);
  let y = 32;
  const headers = [['Colaborador', 14], ['Eq', 90], ['Fez', 108], ['Atr', 122], ['NF', 136], ['Aus', 150], ['Pas', 166], ['Tot', 182]];
  headers.forEach(([h, x]) => pdf.text(h, x, y)); y += 5;
  onProgress?.(50);
  rows.forEach((r) => {
    if (y > 285) { pdf.addPage(); y = 16; }
    pdf.text(String(r.name).slice(0, 36), 14, y);
    pdf.text(r.eq, 90, y); pdf.text(String(r.f), 108, y); pdf.text(String(r.a), 122, y);
    pdf.text(String(r.n), 136, y); pdf.text(String(r.au), 150, y); pdf.text(String(r.pg), 166, y); pdf.text(String(r.total), 182, y);
    y += 5;
  });
  // ── Página de Calibragem semanal ──────────────────────────────────────────
  const cal = buildCal(teams, doc?.cal, mesIndex, ano);
  pdf.addPage();
  pdf.setFontSize(14); pdf.text(`Calibragem semanal — ${MESES[mesIndex]} ${ano}`, 14, 16);
  pdf.setFontSize(8);
  pdf.text(`Semanas no mês: ${cal.totalSemanas}   |   1x por semana   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 23);
  pdf.setFontSize(9);
  let yc = 32;
  const chead = [['Colaborador', 14], ['Eq', 92], ['Feito', 112], ['Não fez', 132], ['Dias feitos', 158]];
  chead.forEach(([h, x]) => pdf.text(h, x, yc)); yc += 5;
  cal.rows.forEach((r) => {
    if (yc > 285) { pdf.addPage(); yc = 16; }
    pdf.text(String(r.name).slice(0, 38), 14, yc);
    pdf.text(r.eq, 92, yc); pdf.text(String(r.feito), 112, yc); pdf.text(String(r.naoFeito), 132, yc);
    pdf.text((r.days.map(pad2).join(', ') || '—').slice(0, 34), 158, yc);
    yc += 5;
  });

  onProgress?.(90);
  pdf.save(`relatorio-frota-${ano}-${String(mesIndex + 1).padStart(2, '0')}.pdf`);
  onProgress?.(100);
};
