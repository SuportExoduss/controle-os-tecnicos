// jsPDF é carregado sob demanda (dynamic import) para não pesar o bundle inicial.

// Cede a thread para o navegador repintar o overlay de progresso entre etapas.
const yieldToBrowser = () => new Promise(resolve => setTimeout(resolve, 0));

const BLUE = [30, 64, 175];
const WHITE = [255, 255, 255];
const GRAY_LIGHT = [248, 250, 252];
const GRAY_TEXT = [107, 114, 128];
const DARK_TEXT = [31, 41, 55];
const BADGE_BG = [219, 234, 254];
const BADGE_TEXT = [29, 78, 216];
const ORANGE = [234, 88, 12];
const DIVIDER = [229, 231, 235];

const fmtDate = (dateString) => {
  if (!dateString) return '';
  const [y, m, d] = dateString.split('-');
  return `${d}/${m}/${y}`;
};

const addPageHeader = (pdf, technicianName, date) => {
  const W = pdf.internal.pageSize.getWidth();

  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, W, 42, 'F');

  pdf.setTextColor(...WHITE);
  pdf.setFontSize(15);
  pdf.setFont('helvetica', 'bold');
  pdf.text('IBIUNET — CONTROLE DE O.S', W / 2, 17, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Técnico: ${technicianName}  |  Data: ${fmtDate(date)}`, W / 2, 30, { align: 'center' });

  return 52;
};

const addPageFooter = (pdf) => {
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  pdf.setFillColor(...GRAY_LIGHT);
  pdf.rect(0, H - 12, W, 12, 'F');

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY_TEXT);
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, H - 4, { align: 'center' });
};

const buildReportContent = (pdf, report, startY) => {
  const W = pdf.internal.pageSize.getWidth();
  let y = startY;

  const divider = () => {
    pdf.setDrawColor(...DIVIDER);
    pdf.setLineWidth(0.2);
    pdf.line(20, y, W - 20, y);
    y += 6;
  };

  const field = (label, value, valueColor = DARK_TEXT) => {
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text(label.toUpperCase(), 20, y);
    y += 5;

    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...valueColor);
    pdf.text(String(value), 20, y);
    y += 12;
  };

  field('Total de O.S', report.totalOrders, BLUE);
  divider();

  field(
    'Reagendamentos',
    report.rescheduledCount || 0,
    report.rescheduledCount > 0 ? ORANGE : DARK_TEXT,
  );
  divider();

  field('Horário de Envio', report.submissionTime || '—');
  divider();

  // Service badges
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY_TEXT);
  pdf.text('TIPOS DE SERVIÇO', 20, y);
  y += 7;

  let bx = 20;
  (report.serviceTypes || []).forEach((svc, idx) => {
    const label = `${idx + 1}. ${svc}`;
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    const tw = pdf.getTextWidth(label) + 10;

    if (bx + tw > W - 20) {
      bx = 20;
      y += 11;
    }

    pdf.setFillColor(...BADGE_BG);
    pdf.rect(bx, y - 5.5, tw, 8, 'F');

    pdf.setTextColor(...BADGE_TEXT);
    pdf.text(label, bx + 5, y);
    bx += tw + 4;
  });

  y += 13;
  divider();

  // Observations
  if (report.observations) {
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY_TEXT);
    pdf.text('OBSERVAÇÕES', 20, y);
    y += 6;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...DARK_TEXT);
    const lines = pdf.splitTextToSize(report.observations, W - 40);
    pdf.text(lines, 20, y);
    y += lines.length * 5 + 5;
  }

  return y;
};

export const generateIndividualPDF = async (technicianName, report, onProgress) => {
  // Um técnico pode ter vários registros (dias) agrupados em _records.
  const records = (report._records && report._records.length) ? report._records : [report];
  const total = records.length;

  onProgress?.(5);
  const { jsPDF } = await import('jspdf');
  await yieldToBrowser();

  const pdf = new jsPDF('p', 'mm', 'a4');
  for (let i = 0; i < total; i++) {
    if (i > 0) pdf.addPage();
    const startY = addPageHeader(pdf, technicianName, records[i].date);
    buildReportContent(pdf, records[i], startY);
    addPageFooter(pdf);
    onProgress?.(Math.round(((i + 1) / total) * 95) + 5);
    await yieldToBrowser();
  }

  pdf.save(`${technicianName}-${report.date}.pdf`);
  onProgress?.(100);
};

export const generateGeneralPDF = async (reports, onProgress) => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const sorted = [...reports].sort((a, b) =>
    (a.technicianName || '').localeCompare(b.technicianName || ''),
  );

  const totalOS = sorted.reduce((acc, r) => acc + (r.totalOrders || 0), 0);
  const dateStr = sorted[0]?.date ? fmtDate(sorted[0].date) : new Date().toLocaleDateString('pt-BR');

  // Cover
  pdf.setFillColor(...BLUE);
  pdf.rect(0, 0, W, H, 'F');

  pdf.setTextColor(...WHITE);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text('IBIUNET', W / 2, H / 2 - 40, { align: 'center' });

  pdf.setFontSize(16);
  pdf.text('RELATÓRIO GERAL DE O.S', W / 2, H / 2 - 22, { align: 'center' });

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Data: ${dateStr}`, W / 2, H / 2, { align: 'center' });
  pdf.text(`Técnicos: ${sorted.length}`, W / 2, H / 2 + 12, { align: 'center' });
  pdf.text(`Total de O.S: ${totalOS}`, W / 2, H / 2 + 24, { align: 'center' });

  pdf.setFontSize(8);
  pdf.setTextColor(180, 200, 255);
  pdf.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, W / 2, H - 15, { align: 'center' });

  onProgress?.(2);
  await yieldToBrowser();

  // Individual pages — uma por técnico, com progresso real
  const total = sorted.length;
  for (let i = 0; i < total; i++) {
    const report = sorted[i];
    pdf.addPage();
    const startY = addPageHeader(pdf, report.technicianName || 'Sem nome', report.date);
    buildReportContent(pdf, report, startY);
    addPageFooter(pdf);
    onProgress?.(Math.round(((i + 1) / total) * 95) + 2);
    await yieldToBrowser();
  }

  pdf.save(`relatorio-geral-${new Date().toISOString().split('T')[0]}.pdf`);
  onProgress?.(100);
};
