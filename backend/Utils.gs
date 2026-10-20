/* =====================================================================
 * Utils.gs — Schema das abas + utilitarios (tipos, IO, senha, sessao)
 *
 * Cole este arquivo no editor do Google Apps Script como "Utils.gs"
 * (Extensions > Apps Script > Arquivos > + > Script)
 * ===================================================================== */

var TZ = 'America/Sao_Paulo';
var PROP_SS = 'SPREADSHEET_ID';   // Script Property com o ID da planilha
var SESSAO_DIAS = 30;             // validade da sessao (dias)

/* ---------------------------------------------------------------------
 * SCHEMA — definicao unica de todas as abas.
 * Formato: [nomeDaColuna, tipo]
 * Tipos: texto | longa | num | moeda | data | dt | bool | mes
 * ------------------------------------------------------------------- */
var SCHEMA = {

  Config: {
    titulo: 'Configuracoes gerais do aplicativo (chave/valor)',
    colunas: [
      ['Chave', 'texto'],
      ['Valor', 'texto'],
      ['Descricao', 'texto']
    ]
  },

  Acessos: {
    titulo: 'Usuarios autorizados (controle de acesso)',
    colunas: [
      ['ID', 'texto'],
      ['Nome', 'texto'],
      ['Email', 'texto'],
      ['Perfil', 'texto'],
      ['Ativo', 'bool'],
      ['Salt', 'texto'],
      ['SenhaHash', 'texto'],
      ['CriadoEm', 'dt'],
      ['UltimoAcesso', 'dt'],
      ['Obs', 'texto']
    ]
  },

  Categorias: {
    titulo: 'Categorias de receita e despesa',
    colunas: [
      ['ID', 'texto'],
      ['Nome', 'texto'],
      ['Tipo', 'texto'],
      ['Grupo', 'texto'],
      ['Cor', 'texto'],
      ['OrcamentoMensal', 'moeda'],
      ['Ativo', 'bool'],
      ['Obs', 'texto'],
      ['CriadoEm', 'dt']
    ]
  },

  Contas: {
    titulo: 'Contas, cartoes e carteiras',
    colunas: [
      ['ID', 'texto'],
      ['Nome', 'texto'],
      ['Tipo', 'texto'],
      ['Instituicao', 'texto'],
      ['Limite', 'moeda'],
      ['DiaVencimento', 'num'],
      ['Cor', 'texto'],
      ['Ativo', 'bool'],
      ['Obs', 'texto'],
      ['CriadoEm', 'dt']
    ]
  },

  Lancamentos: {
    titulo: 'Todos os lancamentos financeiros',
    colunas: [
      ['ID', 'texto'],
      ['Data', 'data'],
      ['Tipo', 'texto'],
      ['Valor', 'moeda'],
      ['Descricao', 'texto'],
      ['CategoriaID', 'texto'],
      ['ContaID', 'texto'],
      ['FormaPagamento', 'texto'],
      ['Parcelas', 'num'],
      ['ParcelaAtual', 'num'],
      ['Status', 'texto'],
      ['Recorrente', 'bool'],
      ['Fixo', 'bool'],
      ['Competencia', 'mes'],
      ['CaixinhaID', 'texto'],
      ['GrupoParcelas', 'texto'],
      ['Obs', 'longa'],
      ['CriadoEm', 'dt'],
      ['AtualizadoEm', 'dt'],
      ['CriadoPor', 'texto']
    ]
  },

  Caixinhas: {
    titulo: 'Caixinhas (envelopes de controle e projecao)',
    colunas: [
      ['ID', 'texto'],
      ['Nome', 'texto'],
      ['Descricao', 'texto'],
      ['Meta', 'moeda'],
      ['Prazo', 'mes'],
      ['SaldoInicial', 'moeda'],
      ['Cor', 'texto'],
      ['Ativo', 'bool'],
      ['CriadoEm', 'dt'],
      ['CriadoPor', 'texto']
    ]
  },

  Movimentacoes: {
    titulo: 'Entradas e saidas de cada caixinha',
    colunas: [
      ['ID', 'texto'],
      ['CaixinhaID', 'texto'],
      ['Data', 'data'],
      ['Tipo', 'texto'],
      ['Valor', 'moeda'],
      ['Descricao', 'texto'],
      ['Origem', 'texto'],
      ['LancamentoID', 'texto'],
      ['CriadoEm', 'dt'],
      ['CriadoPor', 'texto']
    ]
  },

  Sessoes: {
    titulo: 'Sessoes ativas (tokens de login)',
    colunas: [
      ['ID', 'texto'],
      ['Token', 'texto'],
      ['UsuarioID', 'texto'],
      ['Email', 'texto'],
      ['CriadoEm', 'dt'],
      ['ExpiraEm', 'dt'],
      ['Ativo', 'bool']
    ]
  },

  Log: {
    titulo: 'Auditoria: tudo que foi feito no app',
    colunas: [
      ['ID', 'texto'],
      ['Timestamp', 'dt'],
      ['UsuarioID', 'texto'],
      ['Email', 'texto'],
      ['Acao', 'texto'],
      ['Entidade', 'texto'],
      ['EntidadeID', 'texto'],
      ['Detalhes', 'longa']
    ]
  }
};

/* ===================== acesso a planilha ===================== */

/**
 * Devolve a planilha que sera o banco de dados.
 * Ordem de resolucao:
 *  1) ID guardado em Script Properties (definido por "criarNovaPlanilha" ou "vincularPlanilha")
 *  2) a planilha onde o script esta instalado (script vinculado / container-bound)
 *  3) erro com instrucao clara
 */
function getSS() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SS);
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // a planilha foi apagada ou o acesso caiu: tenta a planilha ativa
    }
  }

  // script vinculado a uma planilha (criado em Extensoes > Apps Script)
  try {
    var ativa = SpreadsheetApp.getActiveSpreadsheet();
    if (ativa && ativa.getId()) {
      PropertiesService.getScriptProperties().setProperty(PROP_SS, ativa.getId());
      return ativa;
    }
  } catch (e) { /* sem contexto de planilha */ }

  throw new Error('Nenhuma planilha vinculada. Use o menu "Financeiro > 1. Criar planilha nova (do zero)" ' +
    'ou "2. Vincular planilha existente". Se o script foi criado avulso (script.google.com), ' +
    'execute a funcao criarNovaPlanilha pelo editor do Apps Script.');
}

function getSheet(nome) {
  var s = getSS().getSheetByName(nome);
  if (!s) {
    throw new Error('Aba "' + nome + '" nao encontrada. Rode: Financeiro > Configurar planilha.');
  }
  return s;
}

function tiposDaAba(nome) {
  var cols = (SCHEMA[nome] && SCHEMA[nome].colunas) || [];
  var t = {};
  for (var i = 0; i < cols.length; i++) { t[cols[i][0]] = cols[i][1]; }
  return t;
}

/* ===================== leitura / escrita ===================== */

/** Le todas as linhas de uma aba (a partir da linha 2) como objetos {COLUNA: valorBruto} */
function lerLinhas(nome) {
  var s = getSheet(nome);
  var lastRow = s.getLastRow();
  var lastCol = s.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var heads = s.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var h = 0; h < heads.length; h++) { heads[h] = String(heads[h]).trim(); }

  var vals = s.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var linha = {}, preenchida = false;
    for (var c = 0; c < heads.length; c++) {
      var v = vals[i][c];
      linha[heads[c]] = v;
      if (v !== '' && v !== null && v !== undefined) { preenchida = true; }
    }
    if (preenchida) out.push(linha);
  }
  return out;
}

/** Encontra uma linha pelo valor da coluna ID (coluna A) */
function acharLinha(nome, id) {
  if (!id) return null;
  var alvo = String(id).trim();
  var linhas = lerLinhas(nome);
  for (var i = 0; i < linhas.length; i++) {
    if (String(linhas[i].ID || '').trim() === alvo) return linhas[i];
  }
  return null;
}

/** Encontra a primeira linha onde coluna == valor */
function acharPor(nome, coluna, valor) {
  var alvo = String(valor === undefined || valor === null ? '' : valor).trim().toLowerCase();
  var linhas = lerLinhas(nome);
  for (var i = 0; i < linhas.length; i++) {
    if (String(linhas[i][coluna] === undefined || linhas[i][coluna] === null ? '' : linhas[i][coluna]).trim().toLowerCase() === alvo) {
      return linhas[i];
    }
  }
  return null;
}

/**
 * Insere ou atualiza uma linha (upsert) usando a coluna ID.
 * Colunas fora do schema sao preservadas na atualizacao.
 */
function salvarLinha(nome, obj) {
  var s = getSheet(nome);
  var lastCol = s.getLastColumn();
  if (lastCol < 1) throw new Error('Aba "' + nome + '" sem cabecalho.');

  var heads = s.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var h = 0; h < heads.length; h++) { heads[h] = String(heads[h]).trim(); }
  var tipos = tiposDaAba(nome);

  var id = String(obj.ID || '').trim();
  var linhaAtual = null;
  var linhaIdx = 0;
  var lastRow = s.getLastRow();

  if (id && lastRow >= 2) {
    var ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) {
        linhaIdx = i + 2;
        linhaAtual = s.getRange(linhaIdx, 1, 1, lastCol).getValues()[0];
        break;
      }
    }
  }

  var valores = [];
  for (var c = 0; c < heads.length; c++) {
    var nomeCol = heads[c];
    if (Object.prototype.hasOwnProperty.call(obj, nomeCol)) {
      valores.push(toCell(obj[nomeCol], tipos[nomeCol]));
    } else if (linhaAtual) {
      valores.push(linhaAtual[c]);           // coluna extra: preserva o que ja existia
    } else {
      valores.push('');
    }
  }

  if (linhaIdx) {
    s.getRange(linhaIdx, 1, 1, lastCol).setValues([valores]);
  } else {
    s.appendRow(valores);
  }
  return id;
}

/** Apaga a linha cujo ID esta na coluna A */
function excluirLinha(nome, id) {
  var s = getSheet(nome);
  var alvo = String(id || '').trim();
  var lastRow = s.getLastRow();
  if (!alvo || lastRow < 2) return false;
  var ids = s.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]).trim() === alvo) {
      s.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

/** Apaga todas as linhas em que uma coluna tem determinado valor. Retorna quantas apagou. */
function excluirLinhasOnde(nome, coluna, valor) {
  var s = getSheet(nome);
  var lastRow = s.getLastRow();
  var lastCol = s.getLastColumn();
  if (lastRow < 2) return 0;
  var heads = s.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var h = 0; h < heads.length; h++) { heads[h] = String(heads[h]).trim(); }
  var idx = heads.indexOf(coluna);
  if (idx < 0) return 0;
  var alvo = String(valor || '').trim();
  var apagadas = 0;
  var colVals = s.getRange(2, idx + 1, lastRow - 1, 1).getValues();
  for (var i = colVals.length - 1; i >= 0; i--) {
    if (String(colVals[i][0] === null || colVals[i][0] === undefined ? '' : colVals[i][0]).trim() === alvo) {
      s.deleteRow(i + 2);
      apagadas++;
    }
  }
  return apagadas;
}

/* ===================== conversao de tipos ===================== */

function toCell(v, tipo) {
  if (v === undefined || v === null) return '';
  switch (tipo) {
    case 'num':
    case 'moeda': {
      if (v === '') return '';
      var n = Number(String(v).replace(',', '.'));
      return isNaN(n) ? '' : (tipo === 'moeda' ? Math.round(n * 100) / 100 : n);
    }
    case 'data': {
      var d = parseData(v);
      return d ? d : '';
    }
    case 'dt': {
      var d2 = parseDataHora(v);
      return d2 ? d2 : '';
    }
    case 'bool': {
      var s = String(v).trim().toUpperCase();
      return (s === 'SIM' || s === 'TRUE' || s === '1' || s === 'X') ? 'SIM' : 'NAO';
    }
    case 'mes': {
      var m = String(v).trim();
      return m ? m : '';
    }
    default:
      return String(v);
  }
}

function fromCell(v, tipo) {
  if (v === undefined || v === null) return tipo === 'num' || tipo === 'moeda' ? 0 : '';
  switch (tipo) {
    case 'num':
    case 'moeda': {
      var n = Number(String(v).replace(',', '.'));
      return isNaN(n) ? 0 : Math.round(n * 100) / 100;
    }
    case 'data': {
      return v === '' ? '' : fmtData(v);
    }
    case 'dt': {
      return v === '' ? '' : fmtDataHora(v);
    }
    case 'bool': {
      return String(v).trim().toUpperCase() === 'SIM' ? 'SIM' : 'NAO';
    }
    default:
      return String(v);
  }
}

/** Converte uma linha crua da planilha em objeto pronto para o front (datas ISO, numeros) */
function serializarLinha(linha, tipos) {
  var o = {};
  for (var k in linha) {
    if (!Object.prototype.hasOwnProperty.call(linha, k)) continue;
    o[k] = fromCell(linha[k], tipos[k]);
  }
  return o;
}

function serializarTodas(nome) {
  var tipos = tiposDaAba(nome);
  var linhas = lerLinhas(nome);
  var out = [];
  for (var i = 0; i < linhas.length; i++) { out.push(serializarLinha(linhas[i], tipos)); }
  return out;
}

/* ===================== datas ===================== */

function agora() { return fmtDataHora(new Date()); }

function parseData(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return null;

  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                 // 2026-10-15
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);

  var b = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);               // 15/10/2026
  if (b) return new Date(+b[3], +b[2] - 1, +b[1], 12, 0, 0);

  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseDataHora(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return null;

  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(:(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[7] || 0));

  var d = parseData(s);
  return d;
}

function fmtData(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function fmtDataHora(v) {
  var d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd HH:mm:ss');
}

/** Soma meses a uma data, ajustando o dia (31/01 + 1 mes = 28/02) */
function addMesesData(v, n) {
  var d = parseData(v);
  if (!d) return null;
  var y = d.getFullYear();
  var m = d.getMonth() + n;
  var dia = d.getDate();
  var ultimoDia = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dia, ultimoDia), 12, 0, 0);
}

/** Competencia (yyyy-mm) de uma data */
function competenciaDe(v) {
  var d = parseData(v);
  if (!d) return '';
  return Utilities.formatDate(d, TZ, 'yyyy-MM');
}

/* ===================== senha e sessao ===================== */

function gerarSalt() {
  return Utilities.getUuid().replace(/-/g, '');
}

function bytesToHex(b) {
  var s = '';
  for (var i = 0; i < b.length; i++) {
    var h = (b[i] < 0 ? b[i] + 256 : b[i]).toString(16);
    s += (h.length === 1 ? '0' : '') + h;
  }
  return s;
}

function hashSenha(senha, salt) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '|' + String(senha),
    Utilities.Charset.UTF_8
  );
  return bytesToHex(bytes);
}

function validarSenha(senha, usuario) {
  if (!usuario || !usuario.Salt || !usuario.SenhaHash) return false;
  return hashSenha(senha, String(usuario.Salt)) === String(usuario.SenhaHash);
}

function novoId() {
  return Utilities.getUuid();
}

/* ===================== log de auditoria ===================== */

function logAcao(usuario, acao, entidade, entidadeId, detalhes) {
  try {
    salvarLinha('Log', {
      ID: novoId(),
      Timestamp: new Date(),
      UsuarioID: usuario ? usuario.ID : '',
      Email: usuario ? usuario.Email : '',
      Acao: acao,
      Entidade: entidade,
      EntidadeID: entidadeId || '',
      Detalhes: detalhes ? String(detalhes) : ''
    });
  } catch (e) {
    // log nunca pode derrubar a operacao
  }
}
