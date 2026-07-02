/*
 * IBIUNET – FROTA: site → planilha da diretoria (Google Sheets).
 *
 * ESTRATÉGIA PRINCIPAL: copiar uma aba "RELATORIO CHECKLIST *" existente.
 * Fórmulas importadas do Excel (CONT.SE / CONT.SES) ficam no formato interno
 * nativo do Sheets e funcionam. setFormula() com nomes pt-BR → #NAME?;
 * com nomes en + vírgula → #ERROR! no locale pt-BR — por isso usamos cópia.
 *
 * FALLBACK: se não existir nenhuma aba modelo, cria do zero com
 * nomes em inglês + ponto-e-vírgula (único combo viável via setFormula()).
 *
 * ATIVAÇÃO:
 *  1. Cole este código inteiro no Apps Script (substitua tudo).
 *  2. Implantar → Gerenciar implantações → lápis → Nova versão → Implantar.
 *     (A URL não muda.)
 *  3. Delete a aba "RELATORIO CHECKLIST Julho 2026" com erros se existir.
 *     O próximo envio recria corretamente a partir da cópia de Junho.
 */

// ==================== CONFIG ====================
var SECRET         = 'ibiunet-frota-ibiunet2026';
var SPREADSHEET_ID = '1wc3KeHwg6dxuJswvSYCjUPK9X45lLzjMFTGTDJVwNMs';
// ================================================

var Q   = String.fromCharCode(34); // U+0022 — imune a smart-quotes ao colar
var SEP = ';';                     // separador de argumentos pt-BR

var MESES_PT = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho',
                'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

var COL_COLAB  = 1;   // A – Colaborador
var COL_TRSP   = 2;   // B – Termo Responsabilidade
var COL_TOCC   = 3;   // C – Termo Ocorrência
var COL_PLACA  = 4;   // D – Placa
var DAY_START  = 5;   // E – 1.º slot de dia
var DAY_END    = 35;  // AI – 31.º slot (sempre reservado)
var COL_SEP    = 36;  // AJ – separador vazio
var RES_AK     = 37;  // AK – CHECK LIST PADRAO
var RES_AL     = 38;  // AL – NAO FEZ
var RES_AM     = 39;  // AM – AUSENTE
var RES_AN     = 40;  // AN – ATRASADO
var COL_TOTAL  = 46;  // AT – TOTAL DE CHECK LIST
var LAST_COL   = 46;

var RESUMO = [
  ['CHECK LIST PADRAO',        '#CCCCCC', null      ],  // AK
  ['NAO FEZ',                  '#FF0000', '#212529' ],  // AL
  ['AUSENTE',                  '#00FFFF', '#FF0000' ],  // AM
  ['ATRASADO',                 '#FFFF00', '#FF0000' ],  // AN
  ['AUXILIAR',                 '#00FFFF', null      ],  // AO
  ['TROCA',                    '#4A86E8', '#212529' ],  // AP
  ['NAO USOU O CARRO',         '#E69138', '#212529' ],  // AQ
  ['PROBLEMA NO CELULAR/APP',  '#666666', '#212529' ],  // AR
  ['FERIAS',                   '#FFFFFF', '#212529' ],  // AS
  ['TOTAL DE CHECK LIST',      '#000000', '#FFFFFF' ],  // AT
];

// ─────────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET)
      return _json({ ok: false, error: 'token invalido' });
    if (!body.mes || !body.ano || !body.linhas)
      return _json({ ok: false, error: 'payload incompleto' });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = _getOrCreateSheet(ss, body.mes, body.ano, body.allColabs || []);
    var n  = _writeMatrix(sh, body.linhas);

    return _json({ ok: true, linhasEscritas: n,
                   url: ss.getUrl() + '#gid=' + sh.getSheetId() });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ── OBTÉM OU CRIA ABA ────────────────────────────────────────────────────────
function _getOrCreateSheet(ss, mes, ano, allColabs) {
  var name = 'RELATORIO CHECKLIST ' + mes + ' ' + ano;
  var sh   = ss.getSheetByName(name);
  if (!sh) sh = _buildSheet(ss, name, mes, ano, allColabs);
  return sh;
}

// ── CONSTRÓI ABA ─────────────────────────────────────────────────────────────
function _buildSheet(ss, name, mes, ano, allColabs) {
  var mesIdx = MESES_PT.indexOf(mes);
  if (mesIdx < 0) throw 'Mes nao reconhecido: ' + mes;
  var anoInt      = parseInt(ano, 10);
  var daysInMonth = new Date(anoInt, mesIdx + 1, 0).getDate();

  var source = _findSourceSheet(ss, name);
  if (source) {
    return _buildFromCopy(ss, source, name, mesIdx, anoInt, daysInMonth, allColabs);
  }
  return _buildFromScratch(ss, name, mesIdx, anoInt, daysInMonth, allColabs);
}

// Localiza qualquer aba "RELATORIO CHECKLIST *" existente (exceto a que está sendo criada)
function _findSourceSheet(ss, excludeName) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var n = sheets[i].getName();
    if (n.indexOf('RELATORIO CHECKLIST') === 0 && n !== excludeName) return sheets[i];
  }
  return null;
}

// ── CÓPIA DE ABA EXISTENTE (caminho primário) ────────────────────────────────
// Copia a aba-modelo inteira — fórmulas ficam no formato interno nativo e funcionam.
// Só atualiza datas, colaboradores e limpa os dados de dias.
function _buildFromCopy(ss, source, name, mesIdx, anoInt, daysInMonth, allColabs) {
  var sh = source.copyTo(ss);
  sh.setName(name);

  var lastRow     = sh.getLastRow();
  var numExisting = lastRow > 1 ? lastRow - 1 : 0;
  var numNew      = allColabs.length;

  // 1. Ajusta número de linhas de colaboradores
  if (numNew > numExisting) {
    if (numExisting > 0) {
      // Copia linha 2 (tem fórmulas nativas) para as linhas extras.
      // copyTo() ajusta referências relativas automaticamente.
      for (var r = numExisting + 2; r <= numNew + 1; r++) {
        sh.getRange(2, 1, 1, LAST_COL).copyTo(sh.getRange(r, 1, 1, LAST_COL));
      }
    } else {
      // Fonte sem linhas de dados — insere linhas e escreve fórmulas via setFormula
      sh.insertRows(2, numNew);
      _escreverFormulas(sh, 2, numNew);
    }
  } else if (numNew < numExisting) {
    sh.deleteRows(numNew + 2, numExisting - numNew);
  }

  // 2. Limpa dados de dias (E–AI) em todas as linhas de dados
  if (numNew > 0) {
    sh.getRange(2, DAY_START, numNew, DAY_END - DAY_START + 1).clearContent();
  }

  // 3. Atualiza cabeçalhos de data (linha 1, E–AI)
  // clearContent preserva o fundo preto e demais estilos da cópia
  sh.getRange(1, DAY_START, 1, 31).clearContent();
  for (var d = 1; d <= 31; d++) {
    if (d <= daysInMonth) {
      sh.getRange(1, DAY_START + d - 1)
        .setValue(new Date(anoInt, mesIdx, d))
        .setNumberFormat('dd/MM/yyyy');
    }
    // slots > daysInMonth ficam vazios com fundo preto da cópia — correto
  }

  // 4. Escreve colaboradores
  if (numNew > 0) {
    sh.getRange(2, COL_COLAB, numNew, 1)
      .setValues(allColabs.map(function(c) { return [c.nome || '']; }));
    sh.getRange(2, COL_PLACA, numNew, 1)
      .setValues(allColabs.map(function(c) { return [c.placa || '']; }));
  }

  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  return sh;
}

// ── CRIAÇÃO DO ZERO (fallback – só quando não existe nenhuma aba modelo) ──────
function _buildFromScratch(ss, name, mesIdx, anoInt, daysInMonth, allColabs) {
  var sh = ss.insertSheet(name);

  // Linha 1: valores
  var hdr = [
    'Colaborador',
    'TERMO RESPONSABILIDADE POR VEICULO',
    'TERMO OCORRENCIA',
    'PLACA DO DO CARRO EM QUE ASSINOU TERMO DE RESPONSABILIDADE'
  ];
  for (var d = 1; d <= 31; d++) {
    hdr.push(d <= daysInMonth ? new Date(anoInt, mesIdx, d) : '');
  }
  hdr.push(''); // AJ
  for (var ri = 0; ri < RESUMO.length; ri++) hdr.push(RESUMO[ri][0]);
  sh.getRange(1, 1, 1, hdr.length).setValues([hdr]);

  sh.getRange(1, DAY_START, 1, daysInMonth).setNumberFormat('dd/MM/yyyy');

  // Linha 1: estilos
  sh.getRange(1, 1, 1, LAST_COL)
    .setBackground('#000000')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sh.getRange(1, COL_COLAB).setFontSize(20).setFontWeight('normal');
  sh.getRange(1, COL_SEP).setBackground(null).setFontColor(null).setFontWeight('normal');

  for (var si = 0; si < RESUMO.length; si++) {
    var hc = sh.getRange(1, RES_AK + si);
    hc.setFontSize(13).setBackground(RESUMO[si][1]);
    hc.setFontColor(RESUMO[si][2] !== null ? RESUMO[si][2] : '#000000');
  }

  sh.setRowHeight(1, 80);

  // Colaboradores
  var n = allColabs.length;
  if (n > 0) {
    sh.getRange(2, COL_COLAB, n, 1)
      .setValues(allColabs.map(function(c) { return [c.nome || '']; }));
    sh.getRange(2, COL_PLACA, n, 1)
      .setValues(allColabs.map(function(c) { return [c.placa || '']; }));

    sh.getRange(2, COL_COLAB, n, 1)
      .setBackground('#B7B7B7')
      .setFontColor('#000000')
      .setFontWeight('bold')
      .setFontSize(12)
      .setVerticalAlignment('middle');

    sh.getRange(2, COL_TRSP, n, 3)
      .setBackground('#000000')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');

    sh.getRange(2, 1, n, LAST_COL)
      .setBorder(true, true, true, true, true, true,
                 '#000000', SpreadsheetApp.BorderStyle.THIN);

    _escreverFormulas(sh, 2, n);
  }

  // Larguras
  sh.setColumnWidth(COL_COLAB, 270);
  sh.setColumnWidth(COL_TRSP,  80);
  sh.setColumnWidth(COL_TOCC,  75);
  sh.setColumnWidth(COL_PLACA, 155);
  for (var dd = 0; dd < 31; dd++) sh.setColumnWidth(DAY_START + dd, 100);
  sh.setColumnWidth(COL_SEP,   15);
  sh.setColumnWidth(RES_AK,    130);
  sh.setColumnWidth(RES_AL,    100);
  sh.setColumnWidth(RES_AM,    100);
  sh.setColumnWidth(RES_AN,    100);
  sh.setColumnWidth(41,        100);
  sh.setColumnWidth(42,         80);
  sh.setColumnWidth(43,        130);
  sh.setColumnWidth(44,        150);
  sh.setColumnWidth(45,         80);
  sh.setColumnWidth(COL_TOTAL, 120);

  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  return sh;
}

// ── FÓRMULAS DE RESUMO ────────────────────────────────────────────────────────
// Chamado APENAS em _buildFromScratch (e no raro edge case de fonte sem linhas).
// Usa nomes em inglês + ponto-e-vírgula: inglês → sem #NAME?, ; → sem conflito
// com separador decimal pt-BR. Evita COUNTIFS usando COUNTA-AL-AM-AN para AK.
// NÃO é chamado em _writeMatrix — fórmulas da cópia já estão corretas e
// recalculam automaticamente quando os dados das células E–AI mudam.
function _escreverFormulas(sh, primeiraLinha, numLinhas) {
  for (var i = 0; i < numLinhas; i++) {
    var r   = primeiraLinha + i;
    var rng = 'E' + r + ':AI' + r;

    // AL, AM, AN primeiro — AK depende deles
    sh.getRange(r, RES_AL).setFormula(
      '=COUNTIF(' + rng + SEP + Q + 'NAO FEZ' + Q + ')');

    sh.getRange(r, RES_AM).setFormula(
      '=COUNTIF(' + rng + SEP + Q + 'AUSENTE' + Q + ')');

    sh.getRange(r, RES_AN).setFormula(
      '=COUNTIF(' + rng + SEP + Q + '*-ATRASADO' + Q + ')');

    // AK: não-vazios menos os três tipos registrados separadamente
    sh.getRange(r, RES_AK).setFormula(
      '=COUNTA(' + rng + ')-AL' + r + '-AM' + r + '-AN' + r);

    sh.getRange(r, COL_TOTAL).setFormula(
      '=SUM(AK' + r + ':AS' + r + ')');
  }
}

// ── GRAVA DADOS DIÁRIOS ───────────────────────────────────────────────────────
// Apenas escreve valores nas células E–AI. NÃO reescreve fórmulas —
// as fórmulas da cópia estão em formato nativo e recalculam automaticamente.
function _writeMatrix(sh, linhas) {
  var lastRow   = sh.getLastRow();
  var nomeVals  = sh.getRange(1, COL_COLAB, lastRow, 1).getValues();
  var rowByName = {};
  for (var r = 0; r < nomeVals.length; r++) {
    var nn = _norm(nomeVals[r][0]);
    if (nn) rowByName[nn] = r + 1;
  }

  var hdrDays = sh.getRange(1, DAY_START, 1, DAY_END - DAY_START + 1).getValues()[0];
  var dayCol  = {};
  for (var i = 0; i < hdrDays.length; i++) {
    if (hdrDays[i] instanceof Date) dayCol[hdrDays[i].getDate()] = DAY_START + i;
  }

  var escritas = 0;
  linhas.forEach(function(l) {
    var row = rowByName[_norm(l.nome)];
    if (!row) return;
    for (var d in l.dias) {
      var c = dayCol[parseInt(d, 10)];
      if (c) sh.getRange(row, c).setValue(l.dias[d]);
    }
    escritas++;
  });

  return escritas;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function _norm(s) {
  s = String(s == null ? '' : s).toLowerCase();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\(.*?\)/g, '');
  s = s.replace(/\b\d+[.,]?\d*\s?(km|mts|m)\b/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
