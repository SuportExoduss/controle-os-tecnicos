// Exports da FROTA — Texto / Excel / PDF da Relação do mês.
// Mesmo modus operandi das outras áreas: xlsx e jspdf por import dinâmico.
import { statsOf, isObrig, MESES } from './frotaCore';

const buildRows = (teams, data, d1, d2) => {
  const rows = [];
  teams.forEach((t) => t.members.forEach((m) => {
    const s = statsOf(data, m.name, d1, d2);
    rows.push({ name: m.name, eq: t.short, obrig: isObrig(t.key), f: s.f, a: s.a, n: s.n, au: s.au, total: s.f + s.a + s.n + s.au });
  }));
  return rows;
};

export const buildTextoRelacao = (teams, doc, mesIndex, ano) => {
  const d1 = 1, d2 = new Date(ano, mesIndex + 1, 0).getDate();
  const rows = buildRows(teams, doc?.data || {}, d1, d2);
  const L = [];
  L.push('╔════════════════════════════════════════════╗');
  L.push(`   RELATÓRIO DE FROTA — ${MESES[mesIndex]} ${ano}`);
  L.push('╚════════════════════════════════════════════╝');
  L.push('Colaborador | Equipe | Fez | Atrasado | Não fez | Ausente | Total');
  L.push('─'.repeat(62));
  rows.forEach((r) => L.push(`${r.name} | ${r.eq} | ${r.f} | ${r.a} | ${r.n} | ${r.au} | ${r.total}`));
  L.push('─'.repeat(62));
  L.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  return L.join('\n');
};

export const exportExcelRelacao = async (teams, doc, mesIndex, ano, onProgress) => {
  const XLSX = await import('xlsx');
  onProgress?.(20);
  const d1 = 1, d2 = new Date(ano, mesIndex + 1, 0).getDate();
  const rows = buildRows(teams, doc?.data || {}, d1, d2);
  const header = ['Colaborador', 'Equipe', 'Obrigatório', 'Fez', 'Atrasado', 'Não fez', 'Ausente', 'Total'];
  const aoa = [header, ...rows.map((r) => [r.name, r.eq, r.obrig ? 'Sim' : 'Não', r.f, r.a, r.n, r.au, r.total])];
  onProgress?.(60);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relacao Frota');
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
  pdf.setFontSize(9);
  let y = 26;
  const headers = [['Colaborador', 14], ['Eq', 92], ['Fez', 112], ['Atr', 127], ['NF', 142], ['Aus', 155], ['Tot', 170]];
  headers.forEach(([h, x]) => pdf.text(h, x, y)); y += 5;
  onProgress?.(50);
  rows.forEach((r) => {
    if (y > 285) { pdf.addPage(); y = 16; }
    pdf.text(String(r.name).slice(0, 38), 14, y);
    pdf.text(r.eq, 92, y); pdf.text(String(r.f), 112, y); pdf.text(String(r.a), 127, y);
    pdf.text(String(r.n), 142, y); pdf.text(String(r.au), 155, y); pdf.text(String(r.total), 170, y);
    y += 5;
  });
  onProgress?.(90);
  pdf.save(`relatorio-frota-${ano}-${String(mesIndex + 1).padStart(2, '0')}.pdf`);
  onProgress?.(100);
};
