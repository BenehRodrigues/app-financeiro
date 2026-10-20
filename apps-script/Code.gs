/**
 * ============================================================================
 *  GESTOR FINANCEIRO — Backend (Google Apps Script)
 *  ----------------------------------------------------------------------------
 *  Web App que faz a ponte entre o site (GitHub Pages) e o Google Sheets.
 *
 *  COMO IMPLANTAR:
 *  1. Abra a planilha: https://docs.google.com/spreadsheets/d/<ID>/edit
 *  2. Extensões → Apps Script
 *  3. Cole este código no editor (substitua o conteúdo de Code.gs)
 *  4. (Opcional) Arquivo → Propriedades do projeto → Propriedades do script
 *     → adicione APP_KEY com a MESMA chave de js/config.js
 *  5. Implantar → Nova implantação → tipo "Aplicativo da Web"
 *     - Executar como: Eu
 *     - Quem tem acesso: Qualquer pessoa
 *  6. Copie a URL "/exec" e cole em js/config.js (CONFIG.APPS_SCRIPT_URL)
 * ============================================================================
 */

/* ----------------------------- Configuração ----------------------------- */
var CONFIG = {
  SPREADSHEET_ID: '10WvCuo2yuY6RIjlMN54xERbHCsZReDkdkZt6NuZrJ5s',
  SHEET_LANCAMENTOS: 'Lançamentos',
  SHEET_DASHBOARD: 'Dashboard',
  SHEET_CAIXINHA: 'Caixinha',

  // Coluna H = ID (usada para editar/excluir com segurança)
  ID_COL: 8,
  FIRST_DATA_ROW: 2,          // Lançamentos: cabeçalho na linha 1

  // Células da Dashboard
  DASH_SALDO_LIQUIDO: 'C21',   // Saldo Líquido Mensal
  DASH_RESERVA_INICIAL: 'C22', // Caixa / Reserva Inicial (editável)

  // Aba Caixinha (criada automaticamente)
  CAIXINHA_META_CELL: 'B1',
  CAIXINHA_HEADER_ROW: 3,
  CAIXINHA_FIRST_ROW: 4
};

// Chave padrão caso a propriedade APP_KEY não esteja definida.
// Troque no Code.gs E no js/config.js.
var DEFAULT_APP_KEY = 'trocar-esta-chave-secreta-em-2026';

/* ------------------------------- Entrada -------------------------------- */
function doGet(e) {
  e = e || { parameter: {} };
  try {
    if (!authOk_((e.parameter && e.parameter.key) || '')) {
      return json_({ ok: false, error: 'unauthorized' }, e);
    }
    var action = (e.parameter && e.parameter.action) || 'list';
    var out;
    switch (action) {
      case 'ping': out = { ok: true, pong: true }; break;
      case 'list': out = listAll_(); break;
      default:     out = { ok: false, error: 'acao desconhecida: ' + action };
    }
    return json_(out, e);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, e);
  }
}

function doPost(e) {
  e = e || { parameter: {} };
  try {
    var key = (e.parameter && e.parameter.key) || '';
    if (!authOk_(key)) return json_({ ok: false, error: 'unauthorized' }, e);

    var body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (x) { body = {}; }
    }
    var action = body.action || (e.parameter && e.parameter.action) || '';
    var out;
    switch (action) {
      case 'create':            out = createLancamento_(body); break;
      case 'update':            out = updateLancamento_(body); break;
      case 'delete':            out = deleteLancamento_(body); break;
      case 'setReservaInicial': out = setReservaInicial_(body); break;
      case 'caixinhaCreate':    out = caixinhaCreate_(body); break;
      case 'caixinhaUpdate':    out = caixinhaUpdate_(body); break;
      case 'caixinhaDelete':    out = caixinhaDelete_(body); break;
      case 'caixinhaSetMeta':   out = caixinhaSetMeta_(body); break;
      default:                  out = { ok: false, error: 'acao desconhecida: ' + action };
    }
    return json_(out, e);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, e);
  }
}

/* --------------------------- Autenticação simples ----------------------- */
function authOk_(key) {
  var expected;
  try {
    expected = PropertiesService.getScriptProperties().getProperty('APP_KEY') || DEFAULT_APP_KEY;
  } catch (e) {
    expected = DEFAULT_APP_KEY;
  }
  return key === expected;
}

/* ------------------------------ Resposta -------------------------------- */
function json_(obj, e) {
  var json = JSON.stringify(obj);
  var cb = (e && e.parameter && e.parameter.callback) || '';
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------- Leitura -------------------------------- */
function listAll_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSchema_(ss);

  var sh = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
  var last = sh.getLastRow();
  var lancamentos = [];

  if (last >= CONFIG.FIRST_DATA_ROW) {
    var range = sh.getRange(CONFIG.FIRST_DATA_ROW, 1, last - CONFIG.FIRST_DATA_ROW + 1, CONFIG.ID_COL);
    var vals = range.getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      var data = r[0], mesAno = r[1], tipo = r[2], categoria = r[3],
          descricao = r[4], valor = r[5], status = r[6], id = r[7];
      if (isEmpty_(data) && isEmpty_(descricao) && isEmpty_(valor) && isEmpty_(id)) continue;
      lancamentos.push({
        id: id ? String(id) : '',
        data: toISODate_(data),
        mesAno: mesAno ? String(mesAno) : '',
        tipo: tipo ? String(tipo) : '',
        categoria: categoria ? String(categoria) : '',
        descricao: descricao ? String(descricao) : '',
        valor: toNumber_(valor),
        status: status ? String(status) : 'Realizado'
      });
    }
  }

  var dash = ss.getSheetByName(CONFIG.SHEET_DASHBOARD);
  var dashboard = {
    saldoLiquidoMensal: num_(dash.getRange(CONFIG.DASH_SALDO_LIQUIDO).getValue()),
    caixaReservaInicial: num_(dash.getRange(CONFIG.DASH_RESERVA_INICIAL).getValue()),
    receitaMediaMensal: num_(dash.getRange('B8').getValue()),
    despesaMediaMensal: num_(dash.getRange('C8').getValue()),
    saldoMedioMensal: num_(dash.getRange('E8').getValue()),
    caixaFinalProjetado: num_(dash.getRange('G8').getValue())
  };

  var caixinha = readCaixinha_(ss);
  var categorias = collectCategories_(lancamentos);

  return {
    ok: true,
    spreadsheetId: CONFIG.SPREADSHEET_ID,
    lancamentos: lancamentos,
    dashboard: dashboard,
    caixinha: caixinha,
    categorias: categorias
  };
}

/** Garante o cabeçalho e o preenchimento da coluna de ID (H). */
function ensureSchema_(ss) {
  var sh = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
  if (!sh) throw new Error('Aba "' + CONFIG.SHEET_LANCAMENTOS + '" não encontrada.');

  if (String(sh.getRange(1, CONFIG.ID_COL).getValue()).toUpperCase() !== 'ID') {
    sh.getRange(1, CONFIG.ID_COL).setValue('ID');
  }

  var last = sh.getLastRow();
  if (last < CONFIG.FIRST_DATA_ROW) return;

  var ids = sh.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.ID_COL, last - CONFIG.FIRST_DATA_ROW + 1, 1).getValues();
  var dirty = false;
  for (var i = 0; i < ids.length; i++) {
    if (!ids[i][0]) { ids[i][0] = newId_(); dirty = true; }
  }
  if (dirty) {
    sh.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.ID_COL, ids.length, 1).setValues(ids);
  }
}

/* ------------------------------ Escrita --------------------------------- */
function createLancamento_(body) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
  var id = newId_();

  var row = [
    parseDateBR_(body.data),
    body.mesAno || mesAnoFromISO_(body.data),
    body.tipo || 'Gasto Fixo',
    body.categoria || '',
    body.descricao || '',
    Number(body.valor) || 0,
    body.status || 'Realizado',
    id
  ];
  sh.appendRow(row);

  var r = sh.getLastRow();
  sh.getRange(r, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(r, 6).setNumberFormat('"R$" #,##0.00');
  return { ok: true, id: id };
}

function updateLancamento_(body) {
  if (!body.id) return { ok: false, error: 'id obrigatorio' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
  var found = findRowById_(sh, body.id);
  if (!found) return { ok: false, error: 'lancamento nao encontrado' };

  var row = found.row;
  sh.getRange(row, 1).setValue(parseDateBR_(body.data));
  sh.getRange(row, 2).setValue(body.mesAno || mesAnoFromISO_(body.data));
  sh.getRange(row, 3).setValue(body.tipo || '');
  sh.getRange(row, 4).setValue(body.categoria || '');
  sh.getRange(row, 5).setValue(body.descricao || '');
  sh.getRange(row, 6).setValue(Number(body.valor) || 0);
  sh.getRange(row, 7).setValue(body.status || '');
  sh.getRange(row, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(row, 6).setNumberFormat('"R$" #,##0.00');
  return { ok: true, id: body.id };
}

function deleteLancamento_(body) {
  if (!body.id) return { ok: false, error: 'id obrigatorio' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);
  var found = findRowById_(sh, body.id);
  if (!found) return { ok: false, error: 'lancamento nao encontrado' };
  sh.deleteRow(found.row);
  return { ok: true, id: body.id };
}

function setReservaInicial_(body) {
  var v = Number(body.valor);
  if (!isFinite(v)) return { ok: false, error: 'valor invalido' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var dash = ss.getSheetByName(CONFIG.SHEET_DASHBOARD);
  dash.getRange(CONFIG.DASH_RESERVA_INICIAL).setValue(v);
  dash.getRange(CONFIG.DASH_RESERVA_INICIAL).setNumberFormat('"R$" #,##0.00');
  return { ok: true, valor: v };
}

/* ------------------------------- Caixinha ------------------------------- */
function ensureCaixinha_(ss) {
  var sh = ss.getSheetByName(CONFIG.SHEET_CAIXINHA);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_CAIXINHA);
    sh.getRange('A1').setValue('Meta Emergencial (R$)');
    sh.getRange('B1').setValue(0);
    sh.getRange('B1').setNumberFormat('"R$" #,##0.00');
    sh.getRange('A3:E3').setValues([['Data', 'Tipo', 'Descricao', 'Valor (R$)', 'ID']]);
  }
  return sh;
}

function readCaixinha_(ss) {
  var sh = ensureCaixinha_(ss);
  var meta = num_(sh.getRange(CONFIG.CAIXINHA_META_CELL).getValue());
  var last = sh.getLastRow();
  var movimentos = [];

  if (last >= CONFIG.CAIXINHA_FIRST_ROW) {
    var vals = sh.getRange(CONFIG.CAIXINHA_FIRST_ROW, 1, last - CONFIG.CAIXINHA_FIRST_ROW + 1, 5).getValues();
    for (var i = 0; i < vals.length; i++) {
      var r = vals[i];
      if (isEmpty_(r[2]) && isEmpty_(r[3]) && isEmpty_(r[4])) continue;
      movimentos.push({
        id: r[4] ? String(r[4]) : '',
        data: toISODate_(r[0]),
        tipo: r[1] ? String(r[1]) : 'Aporte',
        descricao: r[2] ? String(r[2]) : '',
        valor: toNumber_(r[3])
      });
    }
  }

  var saldo = 0;
  for (var j = 0; j < movimentos.length; j++) saldo += movimentos[j].valor;
  return { meta: meta, saldo: saldo, movimentos: movimentos };
}

function caixinhaCreate_(body) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ensureCaixinha_(ss);
  var id = newId_();
  sh.appendRow([
    parseDateBR_(body.data),
    body.tipo || 'Aporte',
    body.descricao || '',
    Number(body.valor) || 0,
    id
  ]);
  var r = sh.getLastRow();
  sh.getRange(r, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(r, 4).setNumberFormat('"R$" #,##0.00');
  return { ok: true, id: id };
}

function caixinhaUpdate_(body) {
  if (!body.id) return { ok: false, error: 'id obrigatorio' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_CAIXINHA);
  if (!sh) return { ok: false, error: 'aba caixinha nao encontrada' };
  var found = findRowById_(sh, body.id);
  if (!found) return { ok: false, error: 'movimento nao encontrado' };
  var row = found.row;
  sh.getRange(row, 1).setValue(parseDateBR_(body.data));
  sh.getRange(row, 2).setValue(body.tipo || 'Aporte');
  sh.getRange(row, 3).setValue(body.descricao || '');
  sh.getRange(row, 4).setValue(Number(body.valor) || 0);
  sh.getRange(row, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(row, 4).setNumberFormat('"R$" #,##0.00');
  return { ok: true, id: body.id };
}

function caixinhaDelete_(body) {
  if (!body.id) return { ok: false, error: 'id obrigatorio' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ss.getSheetByName(CONFIG.SHEET_CAIXINHA);
  if (!sh) return { ok: false, error: 'aba caixinha nao encontrada' };
  var found = findRowById_(sh, body.id);
  if (!found) return { ok: false, error: 'movimento nao encontrado' };
  sh.deleteRow(found.row);
  return { ok: true, id: body.id };
}

function caixinhaSetMeta_(body) {
  var v = Number(body.meta);
  if (!isFinite(v)) return { ok: false, error: 'meta invalida' };
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sh = ensureCaixinha_(ss);
  sh.getRange(CONFIG.CAIXINHA_META_CELL).setValue(v);
  sh.getRange(CONFIG.CAIXINHA_META_CELL).setNumberFormat('"R$" #,##0.00');
  return { ok: true, meta: v };
}

/* ------------------------------- Helpers -------------------------------- */
function findRowById_(sh, id) {
  var last = sh.getLastRow();
  if (last < CONFIG.FIRST_DATA_ROW) return null;
  var ids = sh.getRange(CONFIG.FIRST_DATA_ROW, CONFIG.ID_COL, last - CONFIG.FIRST_DATA_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      return { row: CONFIG.FIRST_DATA_ROW + i };
    }
  }
  return null;
}

function collectCategories_(lancamentos) {
  var receita = {}, despesa = {};
  for (var i = 0; i < lancamentos.length; i++) {
    var l = lancamentos[i];
    if (!l.categoria) continue;
    if (/receita/i.test(l.tipo)) receita[l.categoria] = true;
    else despesa[l.categoria] = true;
  }
  return { receita: Object.keys(receita).sort(), despesa: Object.keys(despesa).sort() };
}

function newId_() { return Utilities.getUuid(); }

function isEmpty_(v) { return v === null || v === undefined || String(v).trim() === ''; }

function num_(v) { var n = toNumber_(v); return isNaN(n) ? 0 : n; }

function toNumber_(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  var s = String(v).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

function toISODate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  return s;
}

function isoToDate_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

function parseDateBR_(s) {
  var d = isoToDate_(s);
  if (d) return d;
  var m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s || ''));
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return s;
}

function mesAnoFromISO_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return '';
  var months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return months[Number(m[2]) - 1] + '/' + m[1];
}
