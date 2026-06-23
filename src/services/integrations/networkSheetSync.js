// Envio das ordens de serviço da Equipe de Redes para a planilha do Google
// (via Apps Script Web App). É "best-effort": se falhar, NÃO atrapalha o
// salvamento no Firestore. Usa o MESMO Web App e token da fibra, com team:'redes',
// gravando na aba "Lancamentos Redes".

const SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyggMyt2_sIhhWfaxul2ZiF3lahbLRhmuqG2TRH-J7FQ6L-LL1iQTgCEOoIBLNUfGZC3g/exec';
const SHEET_TOKEN = 'ibiunet-sheets-3f7Kp9Qw2Lm8';

const post = async (payload, attempt = 0) => {
  if (!SHEET_WEBAPP_URL) return { ok: false, error: 'URL do Web App não configurada' };
  try {
    const res = await fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: SHEET_TOKEN, team: 'redes', ...payload }),
    });
    const text = await res.text();
    console.log('[networkSheetSync] status:', res.status, '| resposta:', text);
    try {
      return JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: `Resposta não-JSON (HTTP ${res.status}). Provável causa: implantação não publicada como "Qualquer pessoa", ou a nova versão não foi implantada.`,
        status: res.status,
        raw: String(text).slice(0, 400),
      };
    }
  } catch (err) {
    // Retry automático para falhas transitórias de rede/CORS
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      return post(payload, attempt + 1);
    }
    return { ok: false, error: `Falha de rede/CORS: ${err.message || err}. O request não chegou ou foi bloqueado.` };
  }
};

const cleanOrder = (o) => ({
  idOs: String(o.idOs || ''),
  data: o.data || '',
  tecnico: o.tecnico || '',
  assunto: o.assunto || '',
  transmissor: o.transmissor || '',
  dataAbertura: o.dataAbertura || '',
  horaAbertura: o.horaAbertura || '',
  dataFechamento: o.dataFechamento || '',
  horaFechamento: o.horaFechamento || '',
  slaHoras: o.slaHoras != null ? o.slaHoras : '',
  observacao: o.observacao || '',
});

// Envia 1 ordem (após registrar / atualizar / fechar no Admin)
export const syncNetworkOrderToSheet = (order) => post({ record: cleanOrder(order) });

// Sincroniza várias de uma vez (1 requisição). Mantido por compatibilidade.
export const syncNetworkOrdersToSheet = (orders) =>
  post({ action: 'syncAll', records: (orders || []).map(cleanOrder) });

// Sincronização ROBUSTA em lotes: limpa a aba, envia em pedaços pequenos e finaliza
// (ordena + formata). Evita falha por tamanho/tempo num único request grande.
// onProgress(feitos, total) é opcional. Retorna { ok, count } ou { ok:false, error }.
export const syncNetworkOrdersChunked = async (orders, onProgress) => {
  const recs = (orders || []).map(cleanOrder);

  const rep = await post({ action: 'syncReplace' });
  if (!rep || !rep.ok) return rep && rep.error ? rep : { ok: false, error: 'Falha ao limpar a planilha (replace).' };

  const CHUNK = 50;
  let appended = 0;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const chunk = recs.slice(i, i + CHUNK);
    const r = await post({ action: 'syncAppend', records: chunk });
    if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'Falha ao enviar um lote (append).', appended };
    appended += (r.appended || 0);
    if (onProgress) onProgress(Math.min(i + CHUNK, recs.length), recs.length);
  }

  const fin = await post({ action: 'syncFinish' });
  if (!fin || !fin.ok) return { ok: false, error: (fin && fin.error) || 'Falha ao finalizar (sort/format).', appended };
  return { ok: true, count: fin.count, appended };
};

// Excluir = remove a linha da O.S na planilha (pela ID OS)
export const deleteNetworkOrderInSheet = (idOs) =>
  post({ action: 'delete', idOs: String(idOs) });

// Conta quantas O.S existem na aba "Lancamentos Redes" (para verificar se está populada).
// Retorna { ok, count } ou null se não conseguir ler a resposta.
export const countNetworkOrdersInSheet = () => post({ action: 'count' });
