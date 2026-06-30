// ─────────────────────────────────────────────────────────────────────────
// FROTA → Google Sheets (cliente). DORMENTE até configurar a URL.
//
// Espelha o padrão do sheetSync da Fibra: monta o payload e faz POST para o
// Apps Script (frota-checklist.gs), que cria o arquivo do mês e escreve a matriz.
//
// PARA LIGAR: defina VITE_FROTA_SHEETS_URL no .env com a URL do App da Web.
// Enquanto vazio, enabled=false e sendFrotaToSheets() não faz nada (no-op).
//
// IMPORTANTE: aqui NÃO vai CPF nem "origem" (manual/importado) — só a matriz.
// ─────────────────────────────────────────────────────────────────────────

const URL = (import.meta?.env?.VITE_FROTA_SHEETS_URL) || '';
const SECRET = (import.meta?.env?.VITE_FROTA_SHEETS_SECRET) || 'ibiunet-frota-TROQUE-ESTE-TOKEN';

export const frotaSheetsEnabled = () => !!URL;

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Monta a string da célula a partir do estado do dia.
// st: 'feito' | 'atrasado' | 'naofez' | 'ausente'
export const buildCell = ({ st, placa, placa2 }) => {
  if (st === 'naofez') return 'NAO FEZ';
  if (st === 'ausente') return 'AUSENTE';
  if (placa2) return `${placa} + ${placa2} (troca)`;
  return st === 'atrasado' ? `${placa}-ATRASADO` : placa;
};

// matrizMes: { ano, mesIndex(0-11), linhas: [{ nome, dias: { [dia:number]: {st, placa, placa2} } }] }
export const buildPayload = (matrizMes) => ({
  secret: SECRET,
  mes: MESES[matrizMes.mesIndex],
  ano: String(matrizMes.ano),
  linhas: matrizMes.linhas.map((l) => ({
    nome: l.nome,
    dias: Object.fromEntries(
      Object.entries(l.dias).map(([d, cell]) => [d, buildCell(cell)])
    ),
  })),
});

// Envia para o Google Sheets. No-op se a integração estiver desligada.
export const sendFrotaToSheets = async (matrizMes) => {
  if (!frotaSheetsEnabled()) {
    console.info('[frota-sheets] integração desligada (defina VITE_FROTA_SHEETS_URL).');
    return { ok: false, skipped: true };
  }
  const res = await fetch(URL, {
    method: 'POST',
    // text/plain evita o preflight CORS do Apps Script (mesmo truque do sheetSync da Fibra)
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(buildPayload(matrizMes)),
  });
  return res.json();
};
