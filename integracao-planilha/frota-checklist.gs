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
// TRANSICAO da rotacao (2026-07-02): novo e antigo valem juntos ate o site
// novo estar no ar. Depois, APAGUE a linha do antigo e implante NOVA VERSAO.
var SECRETS        = [
  'COLE_AQUI_O_SECRET_NOVO',   // = valor de VITE_FROTA_SHEETS_SECRET do .env (repo e publico: NUNCA commitar o valor real)
  'ibiunet-frota-ibiunet2026', // ANTIGO - apagar esta linha apos a transicao
];
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
    if (SECRETS.indexOf(body.secret) === -1)
      return _json({ ok: false, error: 'token invalido' });

    // Padroniza nomes na coluna A de TODAS as abas mensais (migracao de
    // identidade): troca a celula pelo nome canonico quando casa por _norm.
    // So altera o nome — nao apaga linha nem toca nos dias.
    if (body.action === 'renameTechnicians') return _json(_renameTechnicians(body));

    if (!body.mes || !body.ano || !body.linhas)
      return _json({ ok: false, error: 'payload incompleto' });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = _getOrCreateSheet(ss, body.mes, body.ano, body.allColabs || []);

    // Modo REFAZER (body.prune): remove linhas que não são do cadastro atual
    // (duplicatas, ex-colaboradores, linhas em branco) e zera os dias antes de
    // reescrever — deixa a aba idêntica ao que está no Firebase.
    var removidas = 0;
    if (body.prune) {
      removidas = _pruneColabs(sh, body.allColabs || []);
      _clearDays(sh);
    }

    var n = _writeMatrix(sh, body.linhas);

    return _json({ ok: true, linhasEscritas: n, linhasRemovidas: removidas,
                   url: ss.getUrl() + '#gid=' + sh.getSheetId() });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// ── OBTÉM OU CRIA ABA ────────────────────────────────────────────────────────
function _getOrCreateSheet(ss, mes, ano, allColabs) {
  var name = 'RELATORIO CHECKLIST ' + mes + ' ' + ano;
  var sh   = ss.getSheetByName(name);
  if (!sh) {
    sh = _buildSheet(ss, name, mes, ano, allColabs);
    // Mês novo entra LOGO ABAIXO da aba "RELATORIO CHECKLIST de CALIBRAGEM",
    // acima do mês anterior. As abas acima da calibragem ficam intocadas.
    _moverAbaixoDaCalibragem(ss, sh);
  } else {
    // A aba JÁ existe: garante que colaboradores novos (cadastrados depois da
    // criação da aba) ganhem linha — sem isso o _writeMatrix os descartava,
    // fazendo os dados aparecerem só na dashboard e nunca na planilha.
    _ensureColabs(sh, allColabs);
  }
  // Repara as fórmulas de resumo (AK–AN, AT) em todas as linhas — corrige
  // linhas com #ERRO/#NAME sem tocar nas colunas manuais AO–AS.
  _repairFormulas(sh);
  return sh;
}

// ── GARANTE LINHA PARA TODO COLABORADOR ──────────────────────────────────────
// Acrescenta ao fim da aba uma linha para cada colaborador de allColabs que
// ainda não tem linha. Copia a linha 2 (fórmulas nativas AK–AT + formatação)
// para herdar tudo, limpa os dias e escreve nome/placa do novo.
function _ensureColabs(sh, allColabs) {
  if (!allColabs || !allColabs.length) return;
  var lastRow = sh.getLastRow();

  var existing = {};
  if (lastRow >= 2) {
    var nomes = sh.getRange(2, COL_COLAB, lastRow - 1, 1).getValues();
    for (var i = 0; i < nomes.length; i++) {
      var nn = _norm(nomes[i][0]);
      if (nn) existing[nn] = true;
    }
  }

  var faltantes = [];
  for (var j = 0; j < allColabs.length; j++) {
    var nm = _norm(allColabs[j].nome);
    if (nm && !existing[nm]) { faltantes.push(allColabs[j]); existing[nm] = true; }
  }
  if (!faltantes.length) return;

  var temModelo = lastRow >= 2;               // há linha 2 para copiar fórmulas nativas?
  var firstNew  = (lastRow < 2 ? 2 : lastRow + 1);

  for (var k = 0; k < faltantes.length; k++) {
    var r = firstNew + k;
    if (temModelo) {
      sh.getRange(2, 1, 1, LAST_COL).copyTo(sh.getRange(r, 1, 1, LAST_COL));
      sh.getRange(r, DAY_START, 1, DAY_END - DAY_START + 1).clearContent(); // zera dias copiados
    } else {
      _escreverFormulas(sh, r, 1); // aba sem modelo → fórmulas via setFormula
    }
    sh.getRange(r, COL_COLAB).setValue(faltantes[k].nome  || '');
    sh.getRange(r, COL_PLACA).setValue(faltantes[k].placa || '');
  }
}

// ── REPARA FÓRMULAS DE RESUMO ────────────────────────────────────────────────
// Propaga as fórmulas nativas da linha 2 (AK, AL, AM, AN e AT) para todas as
// demais linhas de dados. Só copia FÓRMULAS (PASTE_FORMULA) — mantém bordas,
// cores e os valores manuais das colunas AO–AS intactos.
function _repairFormulas(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < 3) return;          // 0 ou 1 linha de dados: nada a propagar
  var nData = lastRow - 2;          // linhas 3..lastRow
  // AK:AN (contíguas)
  sh.getRange(2, RES_AK, 1, RES_AN - RES_AK + 1)
    .copyTo(sh.getRange(3, RES_AK, nData, RES_AN - RES_AK + 1),
            SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  // AT (total) — separado por causa das colunas manuais AO–AS no meio
  sh.getRange(2, COL_TOTAL, 1, 1)
    .copyTo(sh.getRange(3, COL_TOTAL, nData, 1),
            SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
}

// ── LIMPEZA: remove linhas que NÃO são do cadastro atual ─────────────────────
// Apaga linhas de dados cujo colaborador não está em allColabs, linhas em
// branco e ocorrências duplicadas do mesmo nome (mantém a primeira). Guarda:
// se allColabs vier vazio, NÃO faz nada (evita apagar a aba inteira por engano).
function _pruneColabs(sh, allColabs) {
  if (!allColabs || !allColabs.length) return 0;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  var valid = {};
  for (var i = 0; i < allColabs.length; i++) {
    var nm = _norm(allColabs[i].nome);
    if (nm) valid[nm] = true;
  }

  var nomes = sh.getRange(2, COL_COLAB, lastRow - 1, 1).getValues();
  var seen = {}, toDelete = [];
  for (var r = 0; r < nomes.length; r++) {
    var nn = _norm(nomes[r][0]);
    if (!nn || !valid[nn] || seen[nn]) toDelete.push(r + 2); // linha real na planilha
    else seen[nn] = true;
  }
  // Deleta de baixo para cima para não bagunçar os índices
  for (var d = toDelete.length - 1; d >= 0; d--) sh.deleteRow(toDelete[d]);
  return toDelete.length;
}

// Zera os dias (E–AI) de todas as linhas de dados — usado no modo REFAZER
// para a aba refletir exatamente o que está no Firebase.
function _clearDays(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return;
  sh.getRange(2, DAY_START, lastRow - 1, DAY_END - DAY_START + 1).clearContent();
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

// ── RENOMEAR TECNICOS (migracao de identidade) ───────────────────────────────
// Percorre as abas mensais ("RELATORIO CHECKLIST ...") e troca o nome na coluna
// A (Colaborador) pelo canonico quando _norm(celula) casa com um `from` do mapa.
// So altera o nome — nao apaga linha nem toca nos dias. Idempotente.
function _renameTechnicians(body) {
  var pairs = body.pairs || [];
  var m = {};
  for (var i = 0; i < pairs.length; i++) m[_norm(pairs[i].from)] = String(pairs[i].to);
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  var total = 0, tabs = [];
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (sh.getName().indexOf('RELATORIO CHECKLIST') !== 0) continue;
    var lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    var rng = sh.getRange(2, COL_COLAB, lastRow - 1, 1);
    var vals = rng.getValues();
    var changed = 0;
    for (var r = 0; r < vals.length; r++) {
      var cur = vals[r][0];
      if (cur === '' || cur == null) continue;
      var nn = _norm(cur);
      if (m[nn] != null && String(cur) !== m[nn]) { vals[r][0] = m[nn]; changed++; }
    }
    if (changed) { rng.setValues(vals); total += changed; tabs.push(sh.getName() + ':' + changed); }
  }
  return { ok: true, renamed: total, tabs: tabs };
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

// Acha a aba âncora "RELATORIO CHECKLIST de CALIBRAGEM" (ou null se não existir).
function _acharCalibragem(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var n = _norm(sheets[i].getName());
    if (n.indexOf('relatorio checklist') === 0 && n.indexOf('calibragem') >= 0) return sheets[i];
  }
  return null;
}

// Move a aba `sh` para logo ABAIXO da calibragem (ou pro topo se não houver âncora).
function _moverAbaixoDaCalibragem(ss, sh) {
  var cal = _acharCalibragem(ss);
  var pos = cal ? cal.getIndex() + 1 : 1;  // getIndex() é 1-based; +1 = logo abaixo
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(pos);
}

// ── ORGANIZADOR (rodar UMA vez no editor: Run → ordenarRelatoriosMensais) ─────
// Coloca as abas "RELATORIO CHECKLIST {Mes} {Ano}" em sequência LOGO ABAIXO da
// aba "RELATORIO CHECKLIST de CALIBRAGEM", com o mês MAIS NOVO em primeiro.
// Tudo que está ACIMA da calibragem permanece intocado.
function ordenarRelatoriosMensais() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets();
  var MESES_N = ['janeiro','fevereiro','marco','abril','maio','junho',
                 'julho','agosto','setembro','outubro','novembro','dezembro'];
  var achados = [];
  for (var i = 0; i < sheets.length; i++) {
    var nome = sheets[i].getName();
    var n = _norm(nome); // minúsculo, sem acento
    if (n.indexOf('relatorio checklist') !== 0) continue; // só relatórios mensais
    if (n.indexOf('calibragem') >= 0) continue;           // a âncora não se move
    var mesIdx = -1;
    for (var m = 0; m < 12; m++) { if (n.indexOf(MESES_N[m]) >= 0) { mesIdx = m; break; } }
    if (mesIdx < 0) continue;                       // sem mês reconhecível → ignora
    var am = nome.match(/20\d\d/);
    if (!am) continue;                              // sem ano (4 dígitos) → ignora
    achados.push({ sheet: sheets[i], ano: parseInt(am[0], 10), mes: mesIdx });
  }
  // Ordena do MAIS NOVO para o mais antigo (ano desc, depois mês desc)
  achados.sort(function(a, b) { return (b.ano - a.ano) || (b.mes - a.mes); });
  // Move de trás pra frente para logo abaixo da calibragem — recalcula a
  // posição a cada passo, ficando imune a deslocamentos.
  for (var k = achados.length - 1; k >= 0; k--) {
    _moverAbaixoDaCalibragem(ss, achados[k].sheet);
  }
  Logger.log('Relatorios reordenados abaixo da calibragem: ' + achados.length);
  return achados.length;
}
