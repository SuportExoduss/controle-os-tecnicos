// Envio dos relatórios da equipe de câmeras (WIBICAM) para a planilha do Google
// (via Apps Script Web App). É "best-effort": se falhar, NÃO atrapalha o
// salvamento no Firestore. Usa o MESMO Web App e token, com team:'cameras',
// gravando na aba "Lancamentos Equipe Cameras".

const SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyggMyt2_sIhhWfaxul2ZiF3lahbLRhmuqG2TRH-J7FQ6L-LL1iQTgCEOoIBLNUfGZC3g/exec';
const SHEET_TOKEN = 'ibiunet-sheets-3f7Kp9Qw2Lm8';

const post = async (payload) => {
  if (!SHEET_WEBAPP_URL) return;
  try {
    const res = await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: SHEET_TOKEN, team: 'cameras', ...payload }),
    });
    const text = await res.text();
    console.log('[cameraSheetSync] status:', res.status, '| resposta:', text);
  } catch (err) {
    console.warn('[cameraSheetSync] FALHOU:', err.message || err);
  }
};

const cleanRecord = (r) => ({
  technicianName: r.technicianName || '',
  date: r.date || '',
  rescheduledCount: r.rescheduledCount || 0,
  kmInicial: r.kmInicial != null ? r.kmInicial : '',
  kmFinal: r.kmFinal != null ? r.kmFinal : '',
  kmRodado: r.kmRodado != null ? r.kmRodado : '',
  pontosInstalados: r.pontosInstalados != null ? r.pontosInstalados : '',
  pontosCancelados: r.pontosCancelados != null ? r.pontosCancelados : '',
  observations: r.observations || '',
  serviceTypes: r.serviceTypes || [],
});

// Envia 1 relatório (após salvar/editar no Admin/Dashboard)
export const syncCameraReportToSheet = (record) => post({ record: cleanRecord(record) });

// Envia vários de uma vez (importação de Excel)
export const syncCameraReportsToSheet = (records) =>
  post({ records: (records || []).map(cleanRecord) });

// Apagar = ZERA as linhas na planilha (mantém a linha, permite refazer)
export const zeroCameraDayInSheet = (date) => post({ action: 'zero', date });
export const zeroCameraTechnicianInSheet = (technicianName) =>
  post({ action: 'zero', technician: technicianName });
