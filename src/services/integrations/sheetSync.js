// Envio dos relatórios para a planilha do Google (via Apps Script Web App).
// É "best-effort": se falhar, NÃO atrapalha o salvamento no Firestore.

// URL do Web App do Apps Script (Google Sheets):
const SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyggMyt2_sIhhWfaxul2ZiF3lahbLRhmuqG2TRH-J7FQ6L-LL1iQTgCEOoIBLNUfGZC3g/exec';
// Mesmo token do Codigo.gs — vem do .env (VITE_SHEET_TOKEN), fora do git.
const SHEET_TOKEN = import.meta.env.VITE_SHEET_TOKEN || '';

const post = async (payload) => {
  if (!SHEET_WEBAPP_URL) return;
  try {
    const res = await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: SHEET_TOKEN, ...payload }),
    });
    const text = await res.text();
    console.log('[sheetSync] status:', res.status, '| resposta:', text);
  } catch (err) {
    console.warn('[sheetSync] FALHOU:', err.message || err);
  }
};

const cleanRecord = (r) => ({
  technicianName: r.technicianName || '',
  date: r.date || '',
  rescheduledCount: r.rescheduledCount || 0,
  observations: r.observations || '',
  serviceTypes: r.serviceTypes || [],
});

// Envia 1 relatório (após salvar/editar no Admin/Dashboard)
export const syncReportToSheet = (record) => post({ record: cleanRecord(record) });

// Envia vários de uma vez (importação de Excel)
export const syncReportsToSheet = (records) =>
  post({ records: (records || []).map(cleanRecord) });

// Apagar = ZERA as linhas na planilha (mantém a linha, permite refazer)
export const zeroDayInSheet = (date) => post({ action: 'zero', date });
export const zeroTechnicianInSheet = (technicianName) =>
  post({ action: 'zero', technician: technicianName });

// Excluir = REMOVE a linha (técnico + dia) da planilha de verdade (não zera).
export const deleteRowInSheet = (date, technicianName) =>
  post({ action: 'deleteRow', date, technician: technicianName });

// Remove TODAS as linhas de um técnico (usado ao renomear — limpa as linhas do nome antigo).
export const deleteTechnicianFromSheet = (technicianName) =>
  post({ action: 'deleteTechnician', technician: technicianName });

// Renomeia o técnico IN-PLACE em todas as abas (Fibra/Câmeras/Redes) — troca só
// a célula do nome. Best-effort; usado ao renomear colaborador de Câmeras/Redes.
export const renameTechnicianInSheet = (from, to) =>
  post({ action: 'renameTechnicians', pairs: [{ from, to }] });
