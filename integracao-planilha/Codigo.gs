/*
 * IBIUNET - Ponte do site para a planilha do Google (Apps Script).
 * Recebe os relatorios do site e escreve/atualiza na planilha automaticamente.
 * Mapeia as colunas pelo NOME do cabecalho (tolerante a acento/caixa).
 *
 * Passo a passo de instalacao: ver PASSO-A-PASSO.md
 */

// ===================== CONFIG =====================
// Mesmo token usado no site (NAO altere - ja esta igual no site):
var SECRET = 'ibiunet-sheets-3f7Kp9Qw2Lm8';
// Nome EXATO da aba onde ficam os lancamentos. Deixe '' para usar a 1a aba.
var SHEET_NAME = 'Lancamentos Equipe Fibra';
// =================================================

// Aliases: nosso campo -> possiveis nomes da coluna na planilha (sem acento, minusculo)
var HEADER_ALIASES = {
  date:       ['data'],
  technician: ['nome_tecnico', 'nome do tecnico', 'nome tecnico', 'tecnico', 'colaborador', 'nome'],
  reagend:    ['reagendamentos', 'reagendamento', 'reagend'],
  total:      ['total os', 'total_os', 'total', 'total de os', 'qtd', 'quantidade'],
  obs:        ['observacoes', 'obs', 'observacao']
};
var TYPE_ALIASES = {
  'INSTALACAO FIBRA':     ['instalacao fibra'],
  'MANUTENCAO FIBRA':     ['manutencao fibra'],
  'MUDANCA DE ENDERECO':  ['mudanca de endereco'],
  'MUDANCA DE PONTO':     ['mudanca de ponto'],
  'INSTALACAO WI-BINET':  ['instalacao wi-binet', 'instalacao wibinet', 'wi-binet'],
  'REPARO WI-BINET':      ['reparo wi-binet', 'reparo wibinet'],
  'INSTALACAO TV':        ['instalacao tv'],
  'REPARO TV':            ['reparo tv'],
  'OS AMPLIACAO':         ['os ampliacao', 'ampliacao'],
  'VISTORIA':             ['vistoria'],
  'FONTE QUEIMADA':       ['fonte queimada'],
  'TROCA DE EQUIPAMENTO': ['troca de equipamento'],
  'SINAL ALTO':           ['sinal alto'],
  'REINCIDENCIA':         ['reincidencia'],
  'IMPRODUTIVA':          ['improdutiva']
};

// Remove acentos sem usar caracteres combinantes (copia segura)
var ACCENTS = { 'á':'a','à':'a','ã':'a','â':'a','ä':'a','é':'e','ê':'e','è':'e','ë':'e','í':'i','ì':'i','î':'i','ï':'i','ó':'o','ô':'o','õ':'o','ò':'o','ö':'o','ú':'u','ù':'u','û':'u','ü':'u','ç':'c','ñ':'n' };
function norm(s) {
  s = String(s == null ? '' : s).trim().toLowerCase();
  return s.replace(/[áàãâäéêèëíìîïóôõòöúùûüçñ]/g, function (c) { return ACCENTS[c] || c; });
}

// Converte qualquer formato de data da planilha para 'YYYY-MM-DD'
// Lida com: objeto Date, numero serial (ex: 46828), texto dd/mm/yyyy
function cellToISO(cell) {
  if (cell instanceof Date) {
    // UTC evita desvio de fuso: meia-noite local (ex UTC-3) = 03:00 UTC, ainda no mesmo dia
    return Utilities.formatDate(cell, 'UTC', 'yyyy-MM-dd');
  }
  var s = String(cell == null ? '' : cell).trim();
  // Formato dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    var p = s.split('/');
    return p[2] + '-' + p[1] + '-' + p[0];
  }
  // Numero serial do Excel/Sheets (dias desde 30/12/1899)
  var n = Number(s);
  if (!isNaN(n) && n > 40000) {
    var d = new Date(Math.round((n - 25569) * 86400000));
    return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
  }
  return s;
}

// Converte 'YYYY-MM-DD' para numero serial inteiro do Sheets (sem problema de fuso horario)
function isoToDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  var p = iso.split('-');
  var ms = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  var epoch = Date.UTC(1899, 11, 30);
  return Math.round((ms - epoch) / 86400000);
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
}

function buildColMap(sheet) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(norm);
  function find(aliases) {
    for (var i = 0; i < headers.length; i++) if (aliases.indexOf(headers[i]) >= 0) return i;
    return -1;
  }
  var map = {
    date: find(HEADER_ALIASES.date),
    technician: find(HEADER_ALIASES.technician),
    reagend: find(HEADER_ALIASES.reagend),
    total: find(HEADER_ALIASES.total),
    obs: find(HEADER_ALIASES.obs),
    types: {}
  };
  for (var t in TYPE_ALIASES) map.types[t] = find(TYPE_ALIASES[t]);
  return { map: map, headers: headers, lastCol: lastCol };
}

// Ordena os dados: Data (asc) e depois Tecnico (alfabetico) — mantem o padrao
function sortSheet(sheet, map) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 3) return;
  sheet.getRange(2, 1, lastRow - 1, lastCol).sort([
    { column: map.date + 1, ascending: true },
    { column: map.technician + 1, ascending: true }
  ]);
}

// ZERA as linhas que batem (apagar = zera, mantem a linha para refazer depois).
// Zera TODAS as colunas (menos Data e Tecnico; Observacoes vira vazio), assim
// nenhuma coluna fica preenchida por engano. Tambem zera linhas SEM tecnico
// quando a exclusao e por data.
function zeroRows(sheet, map, date, technician) {
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var hasDate = data[i][map.date] !== '' && data[i][map.date] != null;
    var hasTech = data[i][map.technician] !== '' && data[i][map.technician] != null;
    if (!hasDate && !hasTech) continue; // linha totalmente vazia
    var dStr = cellToISO(data[i][map.date]);
    if (date && dStr !== date) continue;
    if (technician && norm(data[i][map.technician]) !== norm(technician)) continue;
    var row = data[i].slice();
    for (var c = 0; c < row.length; c++) {
      if (c === map.date || c === map.technician) continue; // preserva Data e Tecnico
      row[c] = (c === map.obs) ? '' : 0;                    // demais colunas zeradas
    }
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
    count++;
  }
  return count;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.token !== SECRET) return out({ ok: false, error: 'token invalido' });

    // Roteia a Equipe de Redes para a aba "Lancamentos Redes"
    if (body.team === 'redes') return handleRedes(body);

    // Roteia a Equipe de Cameras (WIBICAM) para a aba "Lancamentos Equipe Cameras"
    if (body.team === 'cameras') return handleCameras(body);

    var sheet = getSheet();
    if (!sheet) return out({ ok: false, error: 'aba nao encontrada' });

    var info = buildColMap(sheet);
    var map = info.map, lastCol = info.lastCol;
    if (map.date < 0 || map.technician < 0)
      return out({ ok: false, error: 'colunas Data/Tecnico nao encontradas' });

    // ACAO: zerar (apagar dia/colaborador → zera as linhas, mantem a possibilidade de refazer)
    if (body.action === 'zero') {
      var zeroed = zeroRows(sheet, map, body.date || null, body.technician || null);
      return out({ ok: true, zeroed: zeroed });
    }

    // ACAO: excluir a LINHA (tecnico + dia) de verdade — diferente do 'zero'
    if (body.action === 'deleteRow') {
      var removedFib = deleteRowsByDateTech(sheet, map, body.date, body.technician);
      return out({ ok: true, removed: removedFib });
    }

    // ACAO padrao: gravar/atualizar registros
    var records = body.records || (body.record ? [body.record] : []);
    var saved = 0;
    var debugOut = [];

    // Colunas dos tipos de servico (ordenadas) para montar a formula do Total OS
    var typeCols = [];
    for (var tk in map.types) if (map.types[tk] >= 0) typeCols.push(map.types[tk]);
    typeCols.sort(function (a, b) { return a - b; });

    records.forEach(function (r) {
      var counts = {};
      (r.serviceTypes || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });

      var row = [];
      for (var c = 0; c < lastCol; c++) row.push('');
      row[map.date] = isoToDate(r.date);
      row[map.technician] = r.technicianName || '';
      if (map.reagend >= 0) row[map.reagend] = r.rescheduledCount || 0;
      if (map.total >= 0) row[map.total] = (r.serviceTypes || []).length;
      if (map.obs >= 0) row[map.obs] = r.observations || '';
      for (var t in map.types) if (map.types[t] >= 0) row[map.types[t]] = countFor(counts, t);

      // Re-le a planilha (indices sempre atualizados)
      var data = sheet.getDataRange().getValues();
      var rDateNorm = r.date;
      var rTechNorm = norm(r.technicianName);

      // Debug: captura as primeiras linhas para diagnostico no console do browser
      var sample = [];
      for (var si = 1; si < Math.min(data.length, 5); si++) {
        sample.push({
          row: si + 1,
          cellDate: cellToISO(data[si][map.date]),
          rawDate: String(data[si][map.date]),
          cellTech: norm(data[si][map.technician]),
          rawTech: String(data[si][map.technician])
        });
      }

      // Deleta de baixo para cima TODAS as linhas do mesmo dia+tecnico (elimina duplicatas)
      var deleted = 0;
      for (var i = data.length - 1; i >= 1; i--) {
        if (cellToISO(data[i][map.date]) === rDateNorm &&
            norm(data[i][map.technician]) === rTechNorm) {
          sheet.deleteRow(i + 1);
          deleted++;
        }
      }

      sheet.appendRow(row);
      // Total OS como FORMULA (=soma dos tipos) — igual ao manual; recalcula
      // sozinho quando editam as celulas e a formatacao condicional acompanha.
      if (map.total >= 0 && typeCols.length) {
        var nr = sheet.getLastRow();
        sheet.getRange(nr, map.total + 1).setFormula(camTotalFormula(typeCols, nr));
      }
      saved++;
      debugOut.push({ rDate: rDateNorm, rTech: rTechNorm, deleted: deleted, sample: sample });
    });

    sortSheet(sheet, map);

    // Garante que a coluna Data exibe apenas a data (sem horario)
    if (map.date >= 0 && sheet.getLastRow() > 1) {
      sheet.getRange(2, map.date + 1, sheet.getLastRow() - 1, 1)
        .setNumberFormat('dd/mm/yyyy');
    }

    // Desenha a linha separadora no fim do bloco de cada dia (apos o ultimo tecnico)
    formatDaySeparators(sheet, map);

    return out({ ok: true, saved: saved, debug: debugOut });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// Conta quantos serviceTypes batem com o alias normalizado do tipo
function countFor(counts, normType) {
  var total = 0;
  for (var k in counts) if (norm(k) === norm(normType)) total += counts[k];
  return total;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== EQUIPE DE REDES =====================
// Aba e mapeamento de colunas (por nome do cabecalho, tolerante a acento/caixa).
var REDES_SHEET_NAME = 'Lancamentos Redes';
var REDES_ALIASES = {
  data:        ['data'],
  idOs:        ['id os', 'id_os', 'idos', 'id'],
  tecnico:     ['tecnico responsavel', 'tecnico_responsavel', 'tecnico', 'colaborador', 'nome'],
  assunto:     ['assunto'],
  transmissor: ['transmissor', 'olt'],
  abertura:    ['data abertura', 'data_abertura', 'abertura'],
  fechamento:  ['data fechamento', 'data_fechamento', 'fechamento', 'encerramento'],
  slaMedio:    ['sla medio', 'sla_medio'],
  slaSeg:      ['sla segundos', 'sla_segundos'],
  sla:         ['sla'],
  obs:         ['observacao', 'observacoes', 'obs']
};

// 'YYYY-MM-DD' -> objeto Date (meia-noite local) — vira data de verdade na planilha
function isoToDateObj(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  var p = iso.split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

// 'YYYY-MM-DD' + 'HH:MM' -> objeto Date (data + hora local) — data/hora de verdade
function isoDateTimeToDateObj(iso, time) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  var p = iso.split('-');
  var hh = 0, mm = 0;
  if (time && /^\d{1,2}:\d{2}$/.test(time)) { var t = time.split(':'); hh = Number(t[0]); mm = Number(t[1]); }
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), hh, mm);
}

function getRedesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return REDES_SHEET_NAME ? ss.getSheetByName(REDES_SHEET_NAME) : ss.getSheets()[0];
}

function buildRedesColMap(sheet) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(norm);
  function find(aliases) {
    for (var i = 0; i < headers.length; i++) if (aliases.indexOf(headers[i]) >= 0) return i;
    return -1;
  }
  var map = {};
  for (var k in REDES_ALIASES) map[k] = find(REDES_ALIASES[k]);
  return { map: map, lastCol: lastCol };
}

// Reordena a aba de Redes: DATA (asc) e depois TECNICO (alfabetico).
// Mantem cada tecnico agrupado sob o proprio nome, em ordem alfabetica.
function sortRedes(sheet, map) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 3) return;
  var keys = [];
  if (map.data >= 0)    keys.push({ column: map.data + 1, ascending: true });
  if (map.tecnico >= 0) keys.push({ column: map.tecnico + 1, ascending: true });
  if (!keys.length) return;
  sheet.getRange(2, 1, lastRow - 1, lastCol).sort(keys);
}

// Monta a linha (array com lastCol posicoes) a partir de um registro de O.S.
function buildRedesRow(r, map, lastCol) {
  var slaH = (r.slaHoras === '' || r.slaHoras == null) ? '' : Number(r.slaHoras);
  var row = [];
  for (var c = 0; c < lastCol; c++) row.push('');
  if (map.data >= 0)        row[map.data] = isoToDateObj(r.data);
  if (map.idOs >= 0)        row[map.idOs] = String(r.idOs == null ? '' : r.idOs).trim();
  if (map.tecnico >= 0)     row[map.tecnico] = r.tecnico || '';
  if (map.assunto >= 0)     row[map.assunto] = r.assunto || '';
  if (map.transmissor >= 0) row[map.transmissor] = r.transmissor || '';
  if (map.abertura >= 0)    row[map.abertura] = isoDateTimeToDateObj(r.dataAbertura, r.horaAbertura);
  if (map.fechamento >= 0)  row[map.fechamento] = isoDateTimeToDateObj(r.dataFechamento, r.horaFechamento);
  if (map.slaMedio >= 0)    row[map.slaMedio] = slaH === '' ? '' : slaH / 24;        // dias
  if (map.slaSeg >= 0)      row[map.slaSeg] = slaH === '' ? '' : Math.round(slaH * 3600); // segundos
  if (map.sla >= 0)         row[map.sla] = slaH;                                      // horas
  if (map.obs >= 0)         row[map.obs] = r.observacao || '';
  return row;
}

// Converte uma celula (Date / numero serial / texto) para numero serial do Sheets.
function redesSerialOf(cell) {
  if (cell instanceof Date) return (cell.getTime() - Date.UTC(1899, 11, 30)) / 86400000;
  var n = Number(cell);
  return isNaN(n) ? NaN : n;
}

// Assinatura normalizada dos campos gerenciados, para comparar (sem falso-positivo de fuso/precisao).
function redesSig(row, map) {
  function txt(c) { return c < 0 ? '' : norm(row[c]); }
  function dia(c) { return c < 0 ? '' : cellToISO(row[c]); }
  function minutos(c) { if (c < 0) return ''; var s = redesSerialOf(row[c]); return isNaN(s) ? '' : Math.round(s * 1440); }
  function num1(c) { if (c < 0) return ''; var v = Number(row[c]); return isNaN(v) ? '' : Math.round(v * 10) / 10; }
  return [
    dia(map.data), txt(map.tecnico), txt(map.assunto), txt(map.transmissor),
    minutos(map.abertura), minutos(map.fechamento), num1(map.sla), txt(map.obs)
  ].join('|');
}

// SINCRONIZACAO TOTAL (substituicao): o Firebase manda. Limpa todas as linhas de
// dados e reescreve EXATAMENTE os registros recebidos (sem deduplicar por ID, pois
// a base pode ter IDs de O.S repetidos). Garante planilha == Firebase.
function redesSyncAll(sheet, map, lastCol, records) {
  var rows = [];
  records.forEach(function (r) {
    var id = String(r.idOs == null ? '' : r.idOs).trim();
    if (!id) return;
    rows.push(buildRedesRow(r, map, lastCol));
  });

  // Limpa conteudo E validacao (dropdown) da area de dados — a validacao da
  // coluna TECNICO bloqueia a escrita de nomes fora da lista. Mantem cabecalho.
  var oldLast = sheet.getLastRow();
  var wideCol = Math.max(lastCol, sheet.getLastColumn());
  var clearRows = Math.max(oldLast - 1, rows.length);
  if (clearRows > 0) {
    var area = sheet.getRange(2, 1, clearRows, wideCol);
    area.clearContent();
    area.clearDataValidations();
  }

  // Reescreve tudo
  if (rows.length) sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);

  sortRedes(sheet, map);
  redesFormat(sheet, map);
  return out({ ok: true, added: rows.length, updated: 0, skipped: 0, total: rows.length });
}

// Aplica os formatos de data/hora + padroniza fonte/tamanho na aba inteira.
function redesFormat(sheet, map) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return;

  // Formatos de data/hora nas colunas
  if (map.data >= 0)       sheet.getRange(2, map.data + 1, lastRow - 1, 1).setNumberFormat('dd/mm/yyyy');
  if (map.abertura >= 0)   sheet.getRange(2, map.abertura + 1, lastRow - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  if (map.fechamento >= 0) sheet.getRange(2, map.fechamento + 1, lastRow - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm');

  // Padroniza fonte e tamanho (cabecalho em negrito; dados normais)
  var full = sheet.getRange(1, 1, lastRow, lastCol);
  full.setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle');
  sheet.getRange(1, 1, 1, lastCol).setFontWeight('bold');
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, lastCol).setFontWeight('normal');
}

function handleRedes(body) {
  var sheet = getRedesSheet();
  if (!sheet) return out({ ok: false, error: 'aba Lancamentos Redes nao encontrada' });

  var info = buildRedesColMap(sheet);
  var map = info.map, lastCol = info.lastCol;
  if (map.idOs < 0) return out({ ok: false, error: 'coluna ID OS nao encontrada' });

  // ACAO: excluir uma O.S (pela ID OS)
  if (body.action === 'delete') {
    var alvo = String(body.idOs == null ? '' : body.idOs).trim();
    var data = sheet.getDataRange().getValues();
    var removed = 0;
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][map.idOs]).trim() === alvo) { sheet.deleteRow(i + 1); removed++; }
    }
    return out({ ok: true, removed: removed });
  }

  // ACAO: contar quantas O.S existem na aba (para verificar se esta 100% populada)
  if (body.action === 'count') {
    var data = sheet.getDataRange().getValues();
    var count = 0;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][map.idOs]).trim()) count++;
    }
    return out({ ok: true, count: count });
  }

  // ACAO: sincronizar tudo (Firebase manda) — substituicao total (1 requisicao)
  if (body.action === 'syncAll') {
    return redesSyncAll(sheet, map, lastCol, body.records || []);
  }

  // ── SINCRONIZACAO EM LOTES (robusta) ──
  // 1) limpa todos os dados (conteudo + validacao/dropdown)
  if (body.action === 'syncReplace') {
    var oldLast = sheet.getLastRow();
    if (oldLast > 1) {
      var a = sheet.getRange(2, 1, oldLast - 1, sheet.getLastColumn());
      a.clearContent();
      a.clearDataValidations();
    }
    return out({ ok: true, cleared: true });
  }
  // 2) acrescenta um lote
  if (body.action === 'syncAppend') {
    var recs = body.records || [];
    var rows = [];
    recs.forEach(function (r) {
      var id = String(r.idOs == null ? '' : r.idOs).trim();
      if (id) rows.push(buildRedesRow(r, map, lastCol));
    });
    if (rows.length) {
      var wr = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, lastCol);
      wr.clearDataValidations();
      wr.setValues(rows);
    }
    return out({ ok: true, appended: rows.length });
  }
  // 3) ordena, formata e conta
  if (body.action === 'syncFinish') {
    sortRedes(sheet, map);
    redesFormat(sheet, map);
    var d = sheet.getDataRange().getValues();
    var count = 0;
    for (var i = 1; i < d.length; i++) if (String(d[i][map.idOs]).trim()) count++;
    return out({ ok: true, count: count });
  }

  // ACAO padrao: gravar/atualizar O.S (dedup pela ID OS) — 1 ou poucos registros
  var records = body.records || (body.record ? [body.record] : []);
  var saved = 0;
  records.forEach(function (r) {
    var id = String(r.idOs == null ? '' : r.idOs).trim();
    if (!id) return;
    var row = buildRedesRow(r, map, lastCol);

    // Remove linhas existentes com a mesma ID OS (de baixo para cima)
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][map.idOs]).trim() === id) sheet.deleteRow(i + 1);
    }
    var nr = sheet.getLastRow() + 1;
    var wr = sheet.getRange(nr, 1, 1, lastCol);
    wr.clearDataValidations();
    wr.setValues([row]);
    saved++;
  });

  sortRedes(sheet, map);
  redesFormat(sheet, map);
  return out({ ok: true, saved: saved });
}

// ===================== EQUIPE DE CAMERAS (WIBICAM) =====================
// Mesmo modelo da Fibra (contagem diaria por tecnico), com campos extras:
// KM Rodado, Pontos Instalados e Pontos Cancelados. Aba "Lancamentos Equipe Cameras".
var CAMERAS_SHEET_NAME = 'Lancamentos Equipe Cameras';

var CAMERAS_HEADER_ALIASES = {
  date:       ['data'],
  technician: ['tecnico', 'nome_tecnico', 'nome do tecnico', 'nome tecnico', 'colaborador', 'nome'],
  reagend:    ['reagendamentos', 'reagendamento', 'reagend'],
  km:         ['km rodado', 'km'],
  pontosIn:   ['pontos instalados'],
  pontosCanc: ['pontos cancelados'],
  total:      ['total os', 'total_os', 'total', 'total de os', 'qtd', 'quantidade'],
  obs:        ['observacoes', 'obs', 'observacao']
};

// Chave = nome do tipo no site (normalizado bate por norm()); valor = aliases do cabecalho.
var CAMERAS_TYPE_ALIASES = {
  'INSTALACAO WI-BICAM':               ['instalacao wi-bicam', 'instalacao wibicam'],
  'REPARO':                            ['reparo'],
  'TROCA ROTEADOR/VISTORIA/REPARO TV': ['troca de roteador/vistoria fibra/reparo tv', 'troca de roteador/vistoria/reparo tv'],
  'MUDANCA DE ENDERECO':               ['mudanca de endereco c/wi-bicam', 'mudanca de endereco'],
  'MUDANCA DE PONTO':                  ['mudanca de ponto c/wi-bicam', 'mudanca de ponto'],
  'VISTORIA TECNICA':                  ['vistoria tecnica wi-bicam', 'vistoria tecnica'],
  'RETIRADA':                          ['retirada']
};

function getCamerasSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return CAMERAS_SHEET_NAME ? ss.getSheetByName(CAMERAS_SHEET_NAME) : ss.getSheets()[0];
}

function buildCamerasColMap(sheet) {
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(norm);
  function find(aliases) {
    for (var i = 0; i < headers.length; i++) if (aliases.indexOf(headers[i]) >= 0) return i;
    return -1;
  }
  var map = {
    date: find(CAMERAS_HEADER_ALIASES.date),
    technician: find(CAMERAS_HEADER_ALIASES.technician),
    reagend: find(CAMERAS_HEADER_ALIASES.reagend),
    km: find(CAMERAS_HEADER_ALIASES.km),
    pontosIn: find(CAMERAS_HEADER_ALIASES.pontosIn),
    pontosCanc: find(CAMERAS_HEADER_ALIASES.pontosCanc),
    total: find(CAMERAS_HEADER_ALIASES.total),
    obs: find(CAMERAS_HEADER_ALIASES.obs),
    types: {}
  };
  for (var t in CAMERAS_TYPE_ALIASES) map.types[t] = find(CAMERAS_TYPE_ALIASES[t]);
  return { map: map, headers: headers, lastCol: lastCol };
}

// ZERA as linhas que batem (apagar = zera, mantem a linha para refazer depois).
// Zera TODAS as colunas (menos Data e Tecnico; Observacoes vira vazio), assim
// nenhuma coluna fica preenchida por engano, mesmo as que o script nao conhece.
// Tambem zera linhas SEM tecnico quando a exclusao e por data.
function zeroCamerasRows(sheet, map, date, technician) {
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    var hasDate = data[i][map.date] !== '' && data[i][map.date] != null;
    var hasTech = data[i][map.technician] !== '' && data[i][map.technician] != null;
    if (!hasDate && !hasTech) continue; // linha totalmente vazia
    var dStr = cellToISO(data[i][map.date]);
    if (date && dStr !== date) continue;
    if (technician && norm(data[i][map.technician]) !== norm(technician)) continue;
    var row = data[i].slice();
    for (var c = 0; c < row.length; c++) {
      if (c === map.date || c === map.technician) continue; // preserva Data e Tecnico
      row[c] = (c === map.obs) ? '' : 0;                    // demais colunas zeradas
    }
    sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
    count++;
  }
  return count;
}

// 'num' do site -> celula (numero) ou '' quando vazio
function camNum(v) {
  return (v === '' || v == null) ? '' : Number(v);
}

// Indice de coluna (0-based) -> letra(s) A1: 0->A, 25->Z, 26->AA
function colLetter(idx0) {
  var n = idx0 + 1, s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// Formula de Total OS = soma das colunas dos tipos de servico, na linha dada.
// Ex.: =C5+D5+E5+F5+G5+H5+I5 (igual ao relatorio manual). Como o total vira
// formula, qualquer edicao nas celulas dos tipos recalcula e a formatacao
// condicional (cores) acompanha sozinha.
function camTotalFormula(typeCols, rowNum) {
  return '=' + typeCols.map(function (ci) { return colLetter(ci) + rowNum; }).join('+');
}

function handleCameras(body) {
  var sheet = getCamerasSheet();
  if (!sheet) return out({ ok: false, error: 'aba Lancamentos Equipe Cameras nao encontrada' });

  var info = buildCamerasColMap(sheet);
  var map = info.map, lastCol = info.lastCol;
  if (map.date < 0 || map.technician < 0)
    return out({ ok: false, error: 'colunas Data/Tecnico nao encontradas (cameras)' });

  // ACAO: zerar (apagar dia/colaborador → zera as linhas)
  if (body.action === 'zero') {
    var zeroed = zeroCamerasRows(sheet, map, body.date || null, body.technician || null);
    return out({ ok: true, zeroed: zeroed });
  }

  // ACAO: excluir a LINHA (tecnico + dia) de verdade — diferente do 'zero'
  if (body.action === 'deleteRow') {
    var removedCam = deleteRowsByDateTech(sheet, map, body.date, body.technician);
    return out({ ok: true, removed: removedCam });
  }

  // ACAO padrao: gravar/atualizar registros (dedup por dia+tecnico)
  var records = body.records || (body.record ? [body.record] : []);
  var saved = 0;

  // Colunas dos tipos de servico (ordenadas) para montar a formula do Total OS
  var typeCols = [];
  for (var tk in map.types) if (map.types[tk] >= 0) typeCols.push(map.types[tk]);
  typeCols.sort(function (a, b) { return a - b; });

  records.forEach(function (r) {
    var counts = {};
    (r.serviceTypes || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; });

    var row = [];
    for (var c = 0; c < lastCol; c++) row.push('');
    row[map.date] = isoToDate(r.date);
    row[map.technician] = r.technicianName || '';
    if (map.reagend >= 0)    row[map.reagend] = r.rescheduledCount || 0;
    if (map.km >= 0)         row[map.km] = camNum(r.kmRodado);
    if (map.pontosIn >= 0)   row[map.pontosIn] = camNum(r.pontosInstalados);
    if (map.pontosCanc >= 0) row[map.pontosCanc] = camNum(r.pontosCancelados);
    if (map.total >= 0)      row[map.total] = (r.serviceTypes || []).length;
    if (map.obs >= 0)        row[map.obs] = r.observations || '';
    for (var t in map.types) if (map.types[t] >= 0) row[map.types[t]] = countFor(counts, t);

    // Re-le a planilha e remove (de baixo para cima) duplicatas do mesmo dia+tecnico
    var data = sheet.getDataRange().getValues();
    var rDateNorm = r.date;
    var rTechNorm = norm(r.technicianName);
    for (var i = data.length - 1; i >= 1; i--) {
      if (cellToISO(data[i][map.date]) === rDateNorm &&
          norm(data[i][map.technician]) === rTechNorm) {
        sheet.deleteRow(i + 1);
      }
    }

    sheet.appendRow(row);
    // Total OS como FORMULA (=soma dos tipos) — igual ao manual. Referencias
    // relativas na mesma linha sobrevivem ao sort do Sheets.
    if (map.total >= 0 && typeCols.length) {
      var nr = sheet.getLastRow();
      sheet.getRange(nr, map.total + 1).setFormula(camTotalFormula(typeCols, nr));
    }
    saved++;
  });

  // Ordena por Data (asc) e Tecnico (alfabetico) — reaproveita o sort generico
  sortSheet(sheet, map);

  // Garante que a coluna Data exibe apenas a data (sem horario)
  if (map.date >= 0 && sheet.getLastRow() > 1) {
    sheet.getRange(2, map.date + 1, sheet.getLastRow() - 1, 1).setNumberFormat('dd/mm/yyyy');
  }

  // Desenha a linha separadora no fim do bloco de cada dia (apos o ultimo tecnico)
  formatDaySeparators(sheet, map);

  return out({ ok: true, saved: saved });
}

// Desenha uma borda inferior grossa no fim do bloco de cada DIA — ou seja, na
// ultima linha de cada data (que, por estar ordenado por data+tecnico, e sempre
// o ultimo tecnico em ordem alfabetica daquele dia). Vale tambem para linhas de
// folga / 0 O.S (elas tem data e tecnico, entao contam no bloco do dia).
// Recalcula tudo do zero a cada chamada, entao se entrar um tecnico que vire o
// novo "ultimo", a linha vai automaticamente para baixo dele.
function formatDaySeparators(sheet, map) {
  if (map.date < 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  var nData = lastRow - 1;
  var endCol = (map.obs >= 0 ? map.obs + 1 : sheet.getLastColumn());

  // 1) Limpa as bordas inferiores/horizontais antigas na area de dados
  //    (mantem as linhas de grade padrao — gridlines nao sao "bordas").
  sheet.getRange(2, 1, nData, endCol).setBorder(null, null, false, null, null, false);

  // 2) Para cada linha cujo DIA muda na linha seguinte (ou e a ultima), desenha
  //    a borda inferior grossa atravessando as colunas de dados.
  var dates = sheet.getRange(2, map.date + 1, nData, 1).getValues();
  for (var i = 0; i < nData; i++) {
    var dCur = cellToISO(dates[i][0]);
    if (!dCur) continue; // linha sem data -> ignora
    var dNext = (i + 1 < nData) ? cellToISO(dates[i + 1][0]) : null;
    if (dNext !== dCur) {
      sheet.getRange(i + 2, 1, 1, endCol)
        .setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    }
  }
}

// Exclui (apaga de verdade) a(s) linha(s) que batem com data + tecnico. Diferente
// do 'zero' (que mantem a linha zerada), aqui a linha some. Redesenha os
// separadores de dia ao final. Retorna quantas linhas foram removidas.
function deleteRowsByDateTech(sheet, map, date, technician) {
  var alvoDate = date || '';
  var alvoTech = norm(technician || '');
  if (!alvoDate || !alvoTech || map.date < 0 || map.technician < 0) return 0;
  var data = sheet.getDataRange().getValues();
  var removed = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (cellToISO(data[i][map.date]) === alvoDate &&
        norm(data[i][map.technician]) === alvoTech) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }
  formatDaySeparators(sheet, map);
  return removed;
}

// >>> Rode para conferir o mapeamento da aba de CAMERAS (date/tecnico devem ser >= 0):
function debugHeadersCameras() {
  var sheet = getCamerasSheet();
  var info = buildCamerasColMap(sheet);
  Logger.log('Aba: ' + sheet.getName());
  Logger.log('Cabecalhos detectados: ' + JSON.stringify(info.headers));
  Logger.log('Mapeamento Cameras: ' + JSON.stringify(info.map));
}

// >>> Rode UMA vez no editor (botao Executar) para converter o Total OS de
// TODAS as linhas ja existentes (gravadas como numero fixo, ex.: a 422) em
// FORMULA =C+D+...+I, igual as linhas manuais. So mexe em linhas que tem
// tecnico; as vazias ficam intactas. Depois disso o total recalcula sozinho.
function camerasTotalsToFormula() {
  var sheet = getCamerasSheet();
  var info = buildCamerasColMap(sheet);
  var map = info.map;
  if (map.total < 0) { Logger.log('Coluna Total OS nao encontrada.'); return; }
  var typeCols = [];
  for (var t in map.types) if (map.types[t] >= 0) typeCols.push(map.types[t]);
  typeCols.sort(function (a, b) { return a - b; });
  if (!typeCols.length) { Logger.log('Nenhuma coluna de tipo de servico encontrada.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Sem linhas de dados.'); return; }
  var techs = sheet.getRange(2, map.technician + 1, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < techs.length; i++) {
    if (!String(techs[i][0]).trim()) continue; // pula linhas sem tecnico
    var rowNum = i + 2;
    sheet.getRange(rowNum, map.total + 1).setFormula(camTotalFormula(typeCols, rowNum));
    count++;
  }
  Logger.log('Total OS convertido para formula em ' + count + ' linha(s).');
}

// >>> Rode UMA vez no editor para desenhar as linhas separadoras de dia em TODA
// a aba de Cameras ja existente (sem precisar esperar um novo lancamento).
function camerasDesenharSeparadores() {
  var sheet = getCamerasSheet();
  var info = buildCamerasColMap(sheet);
  formatDaySeparators(sheet, info.map);
  Logger.log('Separadores de dia desenhados na aba de Cameras.');
}

// >>> Rode UMA vez no editor para converter o Total OS de TODAS as linhas ja
// existentes da aba FIBRA (gravadas como numero) em FORMULA =C+D+...
// So mexe em linhas que tem tecnico; as vazias ficam intactas.
function fibraTotalsToFormula() {
  var sheet = getSheet();
  var info = buildColMap(sheet);
  var map = info.map;
  if (map.total < 0) { Logger.log('Coluna Total OS nao encontrada.'); return; }
  var typeCols = [];
  for (var t in map.types) if (map.types[t] >= 0) typeCols.push(map.types[t]);
  typeCols.sort(function (a, b) { return a - b; });
  if (!typeCols.length) { Logger.log('Nenhuma coluna de tipo de servico encontrada.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Sem linhas de dados.'); return; }
  var techs = sheet.getRange(2, map.technician + 1, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < techs.length; i++) {
    if (!String(techs[i][0]).trim()) continue; // pula linhas sem tecnico
    var rowNum = i + 2;
    sheet.getRange(rowNum, map.total + 1).setFormula(camTotalFormula(typeCols, rowNum));
    count++;
  }
  Logger.log('Total OS (Fibra) convertido para formula em ' + count + ' linha(s).');
}

// >>> Rode UMA vez no editor para desenhar as linhas separadoras de dia em TODA
// a aba de FIBRA ja existente (sem precisar esperar um novo lancamento).
function fibraDesenharSeparadores() {
  var sheet = getSheet();
  var info = buildColMap(sheet);
  formatDaySeparators(sheet, info.map);
  Logger.log('Separadores de dia desenhados na aba de Fibra.');
}

// Rotulos (com acento) e ordem das colunas que devem existir na planilha.
var ENSURE_COLUMNS = [
  ['Instalação Fibra', 'INSTALACAO FIBRA'],
  ['Manutenção Fibra', 'MANUTENCAO FIBRA'],
  ['Mudança de endereço', 'MUDANCA DE ENDERECO'],
  ['Mudança de ponto', 'MUDANCA DE PONTO'],
  ['Instalação Wi-biNET', 'INSTALACAO WI-BINET'],
  ['Reparo Wi-biNET', 'REPARO WI-BINET'],
  ['Instalação TV', 'INSTALACAO TV'],
  ['Reparo TV', 'REPARO TV'],
  ['OS Ampliação', 'OS AMPLIACAO'],
  ['Vistoria', 'VISTORIA'],
  ['Fonte Queimada', 'FONTE QUEIMADA'],
  ['Troca de Equipamento', 'TROCA DE EQUIPAMENTO'],
  ['Sinal Alto', 'SINAL ALTO'],
  ['Reincidência', 'REINCIDENCIA'],
  ['Improdutiva', 'IMPRODUTIVA'],
  ['Reagendamentos', '__reagend'],
  ['Total OS', '__total'],
  ['Observacoes', '__obs']
];

// >>> Rode UMA vez para criar as colunas que faltam (no FINAL da planilha).
// ATENCAO: confirme antes que adicionar colunas nao quebra a dashboard da diretoria.
function ensureColumns() {
  var sheet = getSheet();
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(norm);
  var added = [];
  ENSURE_COLUMNS.forEach(function (pair) {
    var label = pair[0], key = pair[1];
    var aliases = TYPE_ALIASES[key] ||
      (key === '__reagend' ? HEADER_ALIASES.reagend :
       key === '__total'   ? HEADER_ALIASES.total :
       key === '__obs'     ? HEADER_ALIASES.obs : [norm(label)]);
    var exists = false;
    for (var i = 0; i < headers.length; i++) if (aliases.indexOf(headers[i]) >= 0) { exists = true; break; }
    if (!exists) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(label);
      headers.push(norm(label));
      added.push(label);
    }
  });
  Logger.log(added.length ? ('Colunas adicionadas: ' + added.join(', ')) : 'Nenhuma coluna nova (ja estava completo).');
}

// >>> Rode esta funcao no editor (botao Executar) para ver o que o script detectou:
function debugHeaders() {
  var sheet = getSheet();
  var info = buildColMap(sheet);
  Logger.log('Aba: ' + sheet.getName());
  Logger.log('Cabecalhos detectados: ' + JSON.stringify(info.headers));
  Logger.log('Mapeamento (indice de cada campo): ' + JSON.stringify(info.map));
}

// >>> Rode para conferir o mapeamento da aba de REDES (todos devem ser >= 0):
function debugHeadersRedes() {
  var sheet = getRedesSheet();
  var info = buildRedesColMap(sheet);
  Logger.log('Aba: ' + sheet.getName());
  Logger.log('Mapeamento Redes (indice de cada campo): ' + JSON.stringify(info.map));
}
