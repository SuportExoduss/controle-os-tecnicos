/*
 * IBIUNET - FROTA: ponte do site -> planilha da diretoria (Google Sheets).
 *
 * O QUE FAZ
 *  - Recebe do site a matriz mensal do checklist de frota.
 *  - Cria um ARQUIVO NOVO por mes (copia de um template) numa pasta do Drive,
 *    chamado "RELATORIO CHECKLIST <Mes> <Ano>" (so cria se ainda nao existir).
 *  - Escreve as celulas de cada dia mapeando a coluna pelo NOME do cabecalho
 *    (tolerante a acento/caixa) e localizando a linha pelo NOME do colaborador.
 *  - Recalcula as 4 colunas-resumo (CHECK LIST PADRAO / NAO FEZ / ATRASADO /
 *    AUSENTE) por formula CONT.SE - recalculam sozinhas no proprio Sheets.
 *  - NAO grava CPF e NAO grava "origem" (manual/importado) na planilha.
 *
 * ESTA DORMENTE. Para LIGAR (quando aprovado):
 *  1. Crie o template no Google Sheets com o layout exato da aba
 *     "RELATORIO CHECKLIST Junho 2026" (cabecalhos identicos). Copie o ID dele.
 *  2. Crie/escolha a pasta do Drive onde os arquivos mensais vao nascer. Copie o ID.
 *  3. Preencha o CONFIG abaixo (SECRET, TEMPLATE_ID, FOLDER_ID).
 *  4. Implantar > Nova implantacao > App da Web > Executar como voce / Acesso "qualquer pessoa".
 *  5. Cole a URL gerada no site (VITE_FROTA_SHEETS_URL) - ver frota-sheets-sync.js.
 *
 * CONTRATO DO PAYLOAD (POST JSON, vindo do site):
 *  {
 *    "secret": "<igual ao SECRET>",
 *    "mes": "Junho", "ano": "2026",
 *    "linhas": [
 *      { "nome": "Andre Luiz Roberth Pereira de Barros",
 *        "dias": { "1": "TIV1I01", "5": "TIV1I01-ATRASADO", "9": "NAO FEZ",
 *                  "19": "SGV5D67 + PYZ0H96 (troca)", "21": "AUSENTE" } }
 *    ]
 *  }
 *  As strings das celulas ja vem PRONTAS do site (placa / placa-ATRASADO /
 *  NAO FEZ / AUSENTE / troca). O Apps Script so as posiciona.
 */

// ===================== CONFIG (preencher ao ligar) =====================
var SECRET      = 'ibiunet-frota-TROQUE-ESTE-TOKEN';
var TEMPLATE_ID = 'COLE_AQUI_O_ID_DO_TEMPLATE';
var FOLDER_ID   = 'COLE_AQUI_O_ID_DA_PASTA';
var TAB_NAME    = 'RELATORIO CHECKLIST'; // nome da aba dentro do arquivo do mes
// =======================================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return _json({ ok: false, error: 'token invalido' });
    if (!body.mes || !body.ano || !body.linhas) return _json({ ok: false, error: 'payload incompleto' });

    var ss = _getMonthFile(body.mes, body.ano);
    var sh = ss.getSheetByName(TAB_NAME) || ss.getSheets()[0];
    var escritas = _writeMatrix(sh, body.linhas);

    return _json({ ok: true, fileId: ss.getId(), url: ss.getUrl(), linhasEscritas: escritas });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

// Acha (ou cria copiando o template) o arquivo do mes.
function _getMonthFile(mes, ano) {
  var nome = 'RELATORIO CHECKLIST ' + mes + ' ' + ano;
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var it = folder.getFilesByName(nome);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  var copy = DriveApp.getFileById(TEMPLATE_ID).makeCopy(nome, folder);
  return SpreadsheetApp.open(copy);
}

// Normaliza texto p/ casar cabecalho/nome (minusculo, sem acento, sem apelido/KM).
function _norm(s) {
  s = String(s == null ? '' : s).toLowerCase();
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\(.*?\)/g, '');          // remove "(Sao Lourenco)" etc.
  s = s.replace(/\b\d+[.,]?\d*\s?(km|mts|m)\b/g, ''); // remove KM embutido
  return s.replace(/\s+/g, ' ').trim();
}

function _headerMap(sh) {
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < hdr.length; i++) map[_norm(hdr[i])] = i + 1;
  return map;
}
function _col(map, aliases) {
  for (var i = 0; i < aliases.length; i++) { var c = map[_norm(aliases[i])]; if (c) return c; }
  return 0;
}

function _writeMatrix(sh, linhas) {
  var map = _headerMap(sh);
  var colNome = _col(map, ['colaborador', 'nome']);
  if (!colNome) throw 'coluna Colaborador nao encontrada';

  // linha de cada colaborador pelo nome normalizado
  var lastRow = sh.getLastRow();
  var nomes = sh.getRange(1, colNome, lastRow, 1).getValues();
  var rowByName = {};
  for (var r = 0; r < nomes.length; r++) {
    var nn = _norm(nomes[r][0]);
    if (nn) rowByName[nn] = r + 1;
  }

  // colunas dos dias: aceita o cabecalho como DATA (ex.: 2026-06-01) OU texto "01/06".
  var hdrRaw = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var dayCol = {};
  for (var i = 0; i < hdrRaw.length; i++) {
    var v = hdrRaw[i];
    if (v instanceof Date) { dayCol[v.getDate()] = i + 1; continue; }
    var mm = String(v).match(/^\s*(\d{1,2})\/(\d{1,2})/);
    if (mm) dayCol[parseInt(mm[1], 10)] = i + 1;
  }

  var escritas = 0;
  linhas.forEach(function (l) {
    var row = rowByName[_norm(l.nome)];
    if (!row) return; // colaborador nao esta na planilha (cadastro) -> ignora
    for (var d in l.dias) {
      var c = dayCol[parseInt(d, 10)];
      if (c) sh.getRange(row, c).setValue(l.dias[d]);
    }
    escritas++;
  });

  _resumo(sh, map, dayCol, rowByName);
  return escritas;
}

// Recalcula CHECK LIST PADRAO / ATRASADO / NAO FEZ / AUSENTE por formula.
function _resumo(sh, map, dayCol, rowByName) {
  var cols = [];
  for (var d in dayCol) cols.push(dayCol[d]);
  cols.sort(function (a, b) { return a - b; });
  if (!cols.length) return;

  var letter = function (c) { return sh.getRange(1, c).getA1Notation().replace(/[0-9]/g, ''); };
  var firstC = letter(cols[0]), lastC = letter(cols[cols.length - 1]);

  var cPad = _col(map, ['check list padrao', 'checklist padrao']);
  var cAtr = _col(map, ['atrasado']);
  var cNao = _col(map, ['nao fez']);
  var cAus = _col(map, ['ausente']);

  for (var nn in rowByName) {
    var row = rowByName[nn];
    var rng = firstC + row + ':' + lastC + row;
    // Padrao = celula preenchida, que NAO seja NAO FEZ, AUSENTE nem contenha ATRASADO.
    if (cPad) sh.getRange(row, cPad).setFormula(
      '=COUNTIFS(' + rng + ',"<>",' + rng + ',"<>NAO FEZ",' + rng + ',"<>AUSENTE",' + rng + ',"<>*ATRASADO*")');
    if (cAtr) sh.getRange(row, cAtr).setFormula('=COUNTIF(' + rng + ',"*ATRASADO*")');
    if (cNao) sh.getRange(row, cNao).setFormula('=COUNTIF(' + rng + ',"NAO FEZ")');
    if (cAus) sh.getRange(row, cAus).setFormula('=COUNTIF(' + rng + ',"AUSENTE")');
  }
}

function _json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
