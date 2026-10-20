/* ====================================================================
 * TODOS_OS_SCRIPTS.gs - versao unica do backend (Utils + Setup + Code)
 *
 * Use este arquivo se preferir colar UM codigo so no editor do Apps Script.
 * Em vez dele, use os 3 arquivos separados (Utils.gs, Setup.gs, Code.gs).
 *
 * Como usar:
 *   1) Apps Script > Novo projeto (ou o projeto que voce quiser usar)
 *   2) Arquivo > + > Script   |   renomeie para 'Backend' (ou 'Code')
 *   3) Cole TODO este conteudo e salve
 *   4) Publicar > Implantar como aplicativo da web
 *        Executar como: Eu   |   Quem tem acesso: Qualquer pessoa
 *
 * Observacao: o Web App e a planilha sao independentes. A planilha e criada
 * pelo proprio app (botao 'Criar planilha') ou pela funcao criarNovaPlanilha.
 * ==================================================================== */

// ====================================================================
/* ---- PARTE 1/3: Utils.gs ---- */
// ====================================================================

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


// ====================================================================
/* ---- PARTE 2/3: Setup.gs ---- */
// ====================================================================

/* =====================================================================
 * Setup.gs — Cria a planilha (do zero), formata e popula o banco de dados.
 *
 * Cole este arquivo no editor do Google Apps Script como "Setup.gs"
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * MENU
 * ------------------------------------------------------------------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Financeiro')
    .addItem('1. Criar planilha nova (do zero)', 'criarNovaPlanilha')
    .addItem('2. Vincular planilha existente', 'vincularPlanilha')
    .addItem('3. Configurar planilha (criar abas)', 'configurarPlanilha')
    .addSeparator()
    .addItem('Criar usuario administrador', 'criarAdminPeloMenu')
    .addItem('Gerar hash de senha (para planilha)', 'gerarHashSenhaNoMenu')
    .addSeparator()
    .addItem('Diagnostico', 'diagnostico')
    .addItem('Testar conexao', 'testerConexao')
    .addItem('Revogar todas as sessoes', 'revogarSessoes')
    .addToUi();
}

/**
 * TUDO EM UM PASSO: cria a planilha, monta as abas e pergunta o admin.
 * Use esta funcao se voce quer o caminho mais curto:
 *   Apps Script > selecione "criarNovaPlanilha" > Executar
 */
function criarNovaPlanilha() {
  var ui = SpreadsheetApp.getUi();
  var nome = 'Controle Financeiro';

  var r = ui.prompt(
    'Criar planilha do zero',
    'Nome da planilha (ela sera o banco de dados do app):',
    ui.ButtonSet.OK_CANCEL
  );
  if (r.getSelectedButton() === ui.Button.OK) {
    var digitado = String(r.getResponseText() || '').trim();
    if (digitado) nome = digitado;
  } else {
    return;   // cancelou
  }

  var ss;
  try {
    ss = SpreadsheetApp.create(nome);
  } catch (e) {
    ui.alert('Nao consegui criar a planilha: ' + e.message);
    return;
  }

  var id = ss.getId();
  PropertiesService.getScriptProperties().setProperty(PROP_SS, id);
  try { ss.setSpreadsheetTimeZone(TZ); } catch (e) { /* fuso ja configurado */ }

  // monta as abas (sem alertas intermediarios)
  var res = configurarPlanilha({ silencioso: true });
  try { ss.setActiveSheet(ss.getSheetByName('Config')); } catch (e) { /* ignora */ }

  // administrador
  var temAdmin = false;
  try { temAdmin = lerLinhas('Acessos').length > 0; } catch (e) { /* ignora */ }
  var adm = true;
  if (!temAdmin) {
    adm = criarAdminPeloMenu();
  }

  var msg = 'Planilha criada e configurada!\n\n' +
            'Nome: ' + ss.getName() + '\n' +
            'URL:  ' + ss.getUrl() + '\n' +
            'Abas: ' + (res && res.abas ? res.abas.join(', ') : '') + '\n\n';

  if (adm) {
    msg += 'Administrador criado.\n\n';
  } else {
    msg += 'Nenhum administrador criado ( voce pode criar depois no menu).\n\n';
  }

  msg += 'O proximo passo e publicar a API:\n' +
         'No Apps Script: Publicar > Implantar como aplicativo da web\n' +
         'Executar como: Eu  |  Acesso: Qualquer pessoa\n\n' +
         'Depois cole a URL que aparecer no app (tela de conexao).';

  ui.alert(msg);
  try { ss.setActiveSheet(ss.getSheetByName('Config')); } catch (e) { /* ignora */ }
}

/** Alias curto: mesma coisa que criarNovaPlanilha. */
function instalar() {
  return criarNovaPlanilha();
}

/**
 * Configura (cria/ajusta) as abas da planilha ja vinculada.
 * @param {object} opcoes { silencioso: true }
 */
function configurarPlanilha(opcoes) {
  var silencioso = !!(opcoes && opcoes.silencioso);
  var ss;
  try {
    ss = getSS();
  } catch (e) {
    if (!silencioso) SpreadsheetApp.getUi().alert('ERRO: ' + e.message);
    return null;
  }

  var nomes = ['Config', 'Acessos', 'Categorias', 'Contas', 'Lancamentos', 'Caixinhas', 'Movimentacoes', 'Sessoes', 'Log'];

  for (var i = 0; i < nomes.length; i++) {
    var sh = ss.getSheetByName(nomes[i]);
    if (!sh) sh = ss.insertSheet(nomes[i]);
    prepararAba(sh, nomes[i]);
  }

  popularPadroes();

  // corrige a coluna Competencia (o Sheets pode ter convertido em data)
  var corrigidos = 0;
  try { corrigidos = corrigirCompetencia(); } catch (e) { /* ignora */ }

  var temUsuario = false;
  try { temUsuario = lerLinhas('Acessos').length > 0; } catch (e) { /* ignora */ }

  if (!silencioso) {
    var msg = 'Planilha configurada!\n\n' +
              'Planilha: ' + ss.getName() + '\n' +
              'URL: ' + ss.getUrl() + '\n\n' +
              'Abas criadas: ' + nomes.join(', ') + '\n';
    if (corrigidos) msg += 'Competencia corrigida em ' + corrigidos + ' linha(s).\n';
    msg += '\n';
    msg += temUsuario
      ? 'Usuarios cadastrados: ' + lerLinhas('Acessos').length + '\n'
      : 'Nenhum usuario cadastrado ainda.\n';
    SpreadsheetApp.getUi().alert(msg);
    if (!temUsuario) criarAdminPeloMenu();
  }

  return { ss: ss, abas: nomes, temUsuario: temUsuario, corrigidos: corrigidos };
}

/**
 * Reescreve a coluna Competencia como texto (AAAA-MM), sempre derivada da
 * coluna Data. O Sheets converte "2026-10" em data quando a coluna esta com
 * formato de data, e isso quebrava os relatorios do app.
 */
function corrigirCompetencia() {
  var s = getSheet('Lancamentos');
  var lastRow = s.getLastRow();
  if (lastRow < 2) return 0;

  var heads = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  for (var h = 0; h < heads.length; h++) { heads[h] = String(heads[h]).trim(); }

  var colData = heads.indexOf('Data') + 1;
  var colComp = heads.indexOf('Competencia') + 1;
  if (colData < 1 || colComp < 1) return 0;

  var datas = s.getRange(2, colData, lastRow - 1, 1).getValues();
  var atuais = s.getRange(2, colComp, lastRow - 1, 1).getValues();
  var novos = [];
  var alterados = 0;

  for (var i = 0; i < datas.length; i++) {
    var d = datas[i][0];
    var comp = d ? competenciaDe(d) : '';
    var atual = atuais[i][0];
    var atualTexto = String(atual === null || atual === undefined ? '' : atual).trim();
    // precisa regravar quando o valor atual e uma data ou difere do esperado
    if ((atual instanceof Date) || atualTexto !== comp) alterados++;
    novos.push([comp]);
  }

  // texto puro na coluna
  s.getRange(2, colComp, novos.length, 1).setNumberFormat('@');
  s.getRange(2, colComp, novos.length, 1).setValues(novos);

  return alterados;
}

/** Pede o ID/URL de uma planilha existente e guarda nas Script Properties. */
function vincularPlanilha() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt(
    'Vincular planilha',
    'Cole o ID ou a URL da planilha que sera o banco de dados do app:',
    ui.ButtonSet.OK_CANCEL
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var bruto = String(r.getResponseText() || '').trim();
  if (!bruto) { ui.alert('Informe o ID ou a URL.'); return; }

  var id = extrairId(bruto);
  if (!id) { ui.alert('Nao consegui ler o ID. Use o formato https://docs.google.com/spreadsheets/d/ID_AQUI/edit'); return; }

  try {
    var ss = SpreadsheetApp.openById(id);
    PropertiesService.getScriptProperties().setProperty(PROP_SS, id);
    ui.alert('Planilha vinculada com sucesso!\n\nID: ' + id + '\nNome: ' + ss.getName() +
             '\n\nAgora rode: Financeiro > 3. Configurar planilha (criar abas).');
  } catch (e) {
    ui.alert('Erro ao abrir a planilha: ' + e.message +
             '\n\nVerifique se o ID esta correto e se a conta que executa o script tem acesso a ela.');
  }
}

function extrairId(bruto) {
  var s = String(bruto || '').trim();
  if (!s) return '';
  var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;
  return '';
}

/* ---------------------------------------------------------------------
 * DIAGNOSTICO
 * ------------------------------------------------------------------- */
function diagnostico() {
  var ui = SpreadsheetApp.getUi();
  var l = [];

  l.push('=== DIAGNOSTICO ===');

  var vinculado = false;
  try {
    var ativa = SpreadsheetApp.getActiveSpreadsheet();
    vinculado = !!(ativa && ativa.getId());
  } catch (e) { /* ignora */ }
  l.push('Script vinculado a uma planilha: ' + (vinculado ? 'SIM' : 'NAO (standalone)'));

  var propId = PropertiesService.getScriptProperties().getProperty(PROP_SS);
  l.push('SPREADSHEET_ID guardado: ' + (propId || '(nao definido)'));

  var ss = null;
  try {
    ss = getSS();
    l.push('Planilha em uso: ' + ss.getName());
    l.push('ID: ' + ss.getId());
    l.push('URL: ' + ss.getUrl());
    var abas = [];
    ss.getSheets().forEach(function (s) {
      abas.push(s.getName() + ' (' + Math.max(s.getLastRow() - 1, 0) + ' linhas)');
    });
    l.push('Abas: ' + abas.join(', '));

    var faltando = ['Config', 'Acessos', 'Categorias', 'Contas', 'Lancamentos', 'Caixinhas', 'Movimentacoes', 'Sessoes', 'Log']
      .filter(function (n) { return !ss.getSheetByName(n); });
    l.push('Abas faltando: ' + (faltando.length ? faltando.join(', ') : 'nenhuma'));

    try { l.push('Usuarios cadastrados: ' + lerLinhas('Acessos').length); } catch (e) { l.push('Usuarios: erro ao ler'); }
    try { l.push('Lancamentos: ' + lerLinhas('Lancamentos').length); } catch (e) { l.push('Lancamentos: erro ao ler'); }
  } catch (e) {
    l.push('ERRO ao abrir a planilha: ' + e.message);
  }

  l.push('');
  l.push('O app esta pronto quando: abas faltando = nenhuma e usuarios >= 1.');

  ui.alert(l.join('\n'));
}

/* ---------------------------------------------------------------------
 * CONFIGURACAO DAS ABAS
 * ------------------------------------------------------------------- */
function prepararAba(sh, nome) {
  var def = SCHEMA[nome];
  var nomes = def.colunas.map(function (c) { return c[0]; });
  var tipos = {};
  def.colunas.forEach(function (c) { tipos[c[0]] = c[1]; });

  if (sh.getMaxColumns() < nomes.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), nomes.length - sh.getMaxColumns());
  }
  sh.getRange(1, 1, 1, nomes.length).setValues([nomes]);
  sh.setFrozenRows(1);

  // cabecalho
  var cab = sh.getRange(1, 1, 1, nomes.length);
  cab.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold').setFontSize(10);
  cab.setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);

  for (var i = 0; i < nomes.length; i++) {
    var col = i + 1;
    var t = tipos[nomes[i]];
    var cel = sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1);

    if (t === 'data') cel.setNumberFormat('dd/mm/yyyy');
    else if (t === 'dt') cel.setNumberFormat('dd/mm/yyyy hh:mm');
    else if (t === 'moeda') cel.setNumberFormat('#,##0.00');
    else if (t === 'num') cel.setNumberFormat('0');
    else if (t === 'mes') cel.setNumberFormat('@');

    sh.setColumnWidth(col, larguraColuna(nomes[i]));
    aplicarValidacao(sh, col, nomes[i]);
  }
}

function larguraColuna(nome) {
  var largas = { Descricao: 240, Obs: 260, Detalhes: 260, Valor: 110, SaldoInicial: 120, Meta: 110, OrcamentoMensal: 130, Limite: 110, Data: 105, CriadoEm: 150, AtualizadoEm: 150, Timestamp: 150, ExpiraEm: 150, UltimoAcesso: 150, SenhaHash: 220, Salt: 220, Token: 240, Instituicao: 160, Competencia: 105, Prazo: 100, Parcelas: 85, ParcelaAtual: 95, DiaVencimento: 120 };
  return largas[nome] || 130;
}

function aplicarValidacao(sh, col, nomeCol) {
  var lista = null;
  if (nomeCol === 'Tipo' && sh.getName() === 'Categorias') lista = ['Despesa', 'Receita'];
  else if (nomeCol === 'Tipo' && sh.getName() === 'Contas') lista = ['Conta Corrente', 'Poupanca', 'Cartao de Credito', 'Carteira', 'Investimento', 'Outro'];
  else if (nomeCol === 'Tipo' && sh.getName() === 'Lancamentos') lista = ['Despesa', 'Receita'];
  else if (nomeCol === 'Tipo' && sh.getName() === 'Movimentacoes') lista = ['Entrada', 'Saida'];
  else if (nomeCol === 'Status') lista = ['Pago', 'Pendente', 'Aguardando', 'Cancelado'];
  else if (nomeCol === 'FormaPagamento') lista = ['Debito', 'Credito', 'Pix', 'Dinheiro', 'Boleto', 'Transferencia', 'Outro'];
  else if (nomeCol === 'Perfil') lista = ['admin', 'editor', 'leitor'];
  else if (nomeCol === 'Ativo' || nomeCol === 'Recorrente' || nomeCol === 'Fixo') lista = ['SIM', 'NAO'];

  if (!lista) return;
  var regra = SpreadsheetApp.newDataValidation().requireValueInList(lista, true).setAllowInvalid(false).build();
  var lastRow = Math.max(sh.getMaxRows(), 2);
  sh.getRange(2, col, lastRow - 1, 1).setDataValidation(regra);
}

/* ---------------------------------------------------------------------
 * DADOS PADRAO (so preenche abas vazias)
 * ------------------------------------------------------------------- */
function popularPadroes() {
  if (lerLinhas('Config').length === 0) {
    var padroes = [
      ['nome_app', 'Controle Financeiro', 'Nome exibido no topo do app'],
      ['simbolo_moeda', 'R$', 'Simbolo usado para formatar valores'],
      ['locale', 'pt-BR', 'Formato de data e numero'],
      ['mostrar_centavos', 'SIM', 'Mostrar centavos nos valores'],
      ['atualizacao_auto_seg', '60', 'Atualizacao automatica da tela (segundos). 0 = desliga'],
      ['permitir_parcelas', 'SIM', 'Permitir lancamentos parcelados'],
      ['tema_padrao', 'escuro', 'escuro | claro'],
      ['cor_primaria', '#22c55e', 'Cor de destaque do app'],
      ['alerta_saldo_negativo', 'SIM', 'Destacar saldo negativo no painel'],
      ['mostrar_projecao', 'SIM', 'Exibir projecao de gastos fixos/recorrentes']
    ];
    padroes.forEach(function (p) {
      salvarLinha('Config', { ID: novoId(), Chave: p[0], Valor: p[1], Descricao: p[2] });
    });
  }

  if (lerLinhas('Categorias').length === 0) {
    var cats = [
      ['Aluguel', 'Despesa', 'Moradia', '#ef4444'],
      ['Condominio', 'Despesa', 'Moradia', '#f97316'],
      ['Energia eletrica', 'Despesa', 'Moradia', '#eab308'],
      ['Agua', 'Despesa', 'Moradia', '#38bdf8'],
      ['Gas', 'Despesa', 'Moradia', '#f59e0b'],
      ['Internet', 'Despesa', 'Moradia', '#0ea5e9'],
      ['IPTU', 'Despesa', 'Moradia', '#a855f7'],
      ['Mercado', 'Despesa', 'Alimentacao', '#22c55e'],
      ['Restaurante', 'Despesa', 'Alimentacao', '#16a34a'],
      ['Delivery', 'Despesa', 'Alimentacao', '#4ade80'],
      ['Combustivel', 'Despesa', 'Transporte', '#14b8a6'],
      ['Uber / 99', 'Despesa', 'Transporte', '#2dd4bf'],
      ['Estacionamento', 'Despesa', 'Transporte', '#64748b'],
      ['Manutencao do carro', 'Despesa', 'Transporte', '#f97316'],
      ['Cinema e lazer', 'Despesa', 'Lazer', '#ec4899'],
      ['Assinaturas', 'Despesa', 'Lazer', '#d946ef'],
      ['Viagem', 'Despesa', 'Lazer', '#f43f5e'],
      ['Farmacia', 'Despesa', 'Saude', '#22d3ee'],
      ['Plano de saude', 'Despesa', 'Saude', '#06b6d4'],
      ['Cursos', 'Despesa', 'Educacao', '#818cf8'],
      ['Compras', 'Despesa', 'Compras', '#f43f5e'],
      ['Juros do cartao', 'Despesa', 'Taxas', '#ef4444'],
      ['Impostos', 'Despesa', 'Taxas', '#b91c1c'],
      ['Outros', 'Despesa', 'Outros', '#94a3b8'],
      ['Salario', 'Receita', 'Renda', '#22c55e'],
      ['13o salario', 'Receita', 'Renda', '#16a34a'],
      ['Ferias', 'Receita', 'Renda', '#4ade80'],
      ['Bonus', 'Receita', 'Extras', '#eab308'],
      ['Comissao', 'Receita', 'Extras', '#f59e0b'],
      ['Freela', 'Receita', 'Extras', '#84cc16'],
      ['Reembolso', 'Receita', 'Extras', '#a3e635'],
      ['Dividendos', 'Receita', 'Investimentos', '#2dd4bf'],
      ['Rendimentos', 'Receita', 'Investimentos', '#22d3ee'],
      ['Aportes', 'Receita', 'Investimentos', '#38bdf8']
    ];
    cats.forEach(function (c) {
      salvarLinha('Categorias', {
        ID: novoId(), Nome: c[0], Tipo: c[1], Grupo: c[2], Cor: c[3],
        OrcamentoMensal: 0, Ativo: 'SIM', Obs: '', CriadoEm: new Date()
      });
    });
  }

  if (lerLinhas('Contas').length === 0) {
    var contas = [
      ['Conta Corrente', 'Conta Corrente', '', 0, 0, '#3b82f6'],
      ['Poupanca', 'Poupanca', '', 0, 0, '#22c55e'],
      ['Cartao de Credito', 'Cartao de Credito', '', 0, 10, '#f43f5e'],
      ['Carteira', 'Carteira', '', 0, 0, '#eab308']
    ];
    contas.forEach(function (c) {
      salvarLinha('Contas', {
        ID: novoId(), Nome: c[0], Tipo: c[1], Instituicao: c[2], Limite: c[3],
        DiaVencimento: c[4], Cor: c[5], Ativo: 'SIM', Obs: '', CriadoEm: new Date()
      });
    });
  }

  if (lerLinhas('Caixinhas').length === 0) {
    var caixinhas = [
      ['Reserva de Emergencia', 'Gasto inesperado', 12000, '', '#22c55e'],
      ['Viagem', 'Fundo para viagens', 5000, '', '#0ea5e9'],
      ['Investimentos', 'Aportes para investimento', 30000, '', '#a855f7']
    ];
    caixinhas.forEach(function (c) {
      salvarLinha('Caixinhas', {
        ID: novoId(), Nome: c[0], Descricao: c[1], Meta: c[2], Prazo: c[3],
        SaldoInicial: 0, Cor: c[4], Ativo: 'SIM', CriadoEm: new Date(), CriadoPor: 'setup'
      });
    });
  }
}

/* ---------------------------------------------------------------------
 * AJUDANTES DE USUARIO
 * ------------------------------------------------------------------- */
function criarAdminPeloMenu() {
  var ui = SpreadsheetApp.getUi();
  var rNome = ui.prompt('Administrador', 'Nome completo:', ui.ButtonSet.OK_CANCEL);
  if (rNome.getSelectedButton() !== ui.Button.OK) return false;
  var rEmail = ui.prompt('Administrador', 'E-mail (sera o login):', ui.ButtonSet.OK_CANCEL);
  if (rEmail.getSelectedButton() !== ui.Button.OK) return false;
  var rSenha = ui.prompt('Administrador', 'Senha (minimo 6 caracteres):', ui.ButtonSet.OK_CANCEL);
  if (rSenha.getSelectedButton() !== ui.Button.OK) return false;

  var nome = String(rNome.getResponseText() || '').trim();
  var email = String(rEmail.getResponseText() || '').trim().toLowerCase();
  var senha = String(rSenha.getResponseText() || '');

  if (!nome || !email || senha.length < 6) {
    ui.alert('Preencha todos os campos. A senha precisa de 6 caracteres ou mais.');
    return false;
  }
  if (acharPor('Acessos', 'Email', email)) {
    ui.alert('Ja existe um usuario com esse e-mail.');
    return false;
  }

  var salt = gerarSalt();
  salvarLinha('Acessos', {
    ID: novoId(), Nome: nome, Email: email, Perfil: 'admin', Ativo: 'SIM',
    Salt: salt, SenhaHash: hashSenha(senha, salt), CriadoEm: new Date(), UltimoAcesso: '', Obs: ''
  });
  ui.alert('Administrador criado!\n\nE-mail: ' + email + '\n\nAgora publique o Web App (veja o guia DEPLOY.md).');
  return true;
}

/** Gera salt+hash e mostra na tela, para quem quiser cadastrar usuario direto na planilha. */
function gerarHashSenhaNoMenu() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Gerar hash de senha', 'Digite a senha:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var senha = String(r.getResponseText() || '');
  if (!senha) return;
  var salt = gerarSalt();
  var hash = hashSenha(senha, salt);
  ui.alert('Copie os dois valores para a linha do usuario na aba Acessos:\n\nSalt: ' + salt + '\n\nSenhaHash: ' + hash +
          '\n\nA senha em texto puro nao aparece na planilha.');
}

function testarConexao() {
  var ui = SpreadsheetApp.getUi();
  try {
    var ss = getSS();
    var abas = ss.getSheets().map(function (s) { return s.getName(); });
    ui.alert('OK!\n\nPlanilha: ' + ss.getName() + '\nID: ' + ss.getId() +
             '\nAbas: ' + abas.join(', ') +
             '\nLancamentos: ' + lerLinhas('Lancamentos').length +
             '\nUsuarios: ' + lerLinhas('Acessos').length);
  } catch (e) {
    ui.alert('Erro: ' + e.message);
  }
}

function revogarSessoes() {
  var s = getSheet('Sessoes');
  if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
  SpreadsheetApp.getUi().alert('Sessoes revogadas.');
}


// ====================================================================
/* ---- PARTE 3/3: Code.gs ---- */
// ====================================================================

/* =====================================================================
 * Code.gs — API do aplicativo (Web App do Google Apps Script)
 *
 * O front-end (GitHub Pages) fala com este endereco:
 *   https://script.google.com/macros/s/XXXX/exec
 *
 * Cada requisicao e um POST com JSON (Content-Type: text/plain).
 * Resposta: { ok: true, ... } ou { ok: false, erro: "...", codigo: "..." }
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * ENTRADA / SAIDA HTTP
 * ------------------------------------------------------------------- */
function doGet(e) {
  return json_({
    ok: true,
    app: 'Controle Financeiro',
    versao: '1.0.0',
    dica: 'Use POST (JSON) para as operacoes. Ver docs/API.md.'
  });
}

function doPost(e) {
  var req = {};
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    req = JSON.parse(raw || '{}');
  } catch (err) {
    return json_({ ok: false, erro: 'Requisicao invalida (JSON malformado).', codigo: 'JSON_INVALIDO' });
  }

  var acao = String(req.acao || req.action || '').trim().toLowerCase();

  try {
    // acoes publicas
    if (acao === 'ping') return json_({ ok: true, ping: agora(), servidor: TZ });
    if (acao === 'status') return json_(acaoStatus());
    if (acao === 'login') return json_(acaoLogin(req));
    if (acao === 'criarplanilha') return json_(acaoCriarPlanilha(req));
    if (acao === 'criaradmininicial') return json_(acaoCriarAdminInicial(req));

    var ctx = autenticar(req);
    return json_(executarAcao(acao, req, ctx));
  } catch (err) {
    return json_({
      ok: false,
      erro: (err && err.message) ? err.message : 'Erro inesperado.',
      codigo: (err && err.codigo) ? err.codigo : 'ERRO'
    });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function erroObj(msg, codigo) {
  var e = new Error(msg);
  e.codigo = codigo || 'ERRO';
  return e;
}

/* ---------------------------------------------------------------------
 * AUTENTICACAO
 * ------------------------------------------------------------------- */
function autenticar(req) {
  var token = String((req && req.token) || '').trim();
  if (!token) throw erroObj('Sessao expirada. Faca login novamente.', 'NAO_AUTENTICADO');

  var sessoes = lerLinhas('Sessoes');
  var sessao = null;
  for (var i = 0; i < sessoes.length; i++) {
    if (String(sessoes[i].Token || '') === token) { sessao = sessoes[i]; break; }
  }
  if (!sessao || String(sessao.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Sessao invalida. Faca login novamente.', 'NAO_AUTENTICADO');
  }
  if (!sessao.ExpiraEm || String(sessao.ExpiraEm) < agora()) {
    throw erroObj('Sessao expirada. Faca login novamente.', 'NAO_AUTENTICADO');
  }

  var u = acharLinha('Acessos', sessao.UsuarioID);
  if (!u) throw erroObj('Usuario nao encontrado.', 'NAO_AUTENTICADO');
  if (String(u.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Usuario desativado. Procure o administrador.', 'SEM_PERMISSAO');
  }
  return { token: token, usuario: u, sessao: sessao };
}

function exigirPerfil(ctx, perfis) {
  if (perfis.indexOf(String(ctx.usuario.Perfil || '').toLowerCase()) === -1) {
    throw erroObj('Seu perfil (' + ctx.usuario.Perfil + ') nao permite esta operacao.', 'SEM_PERMISSAO');
  }
}

function ehAdmin(ctx) {
  return String(ctx.usuario.Perfil || '').toLowerCase() === 'admin';
}

function podeEditar(ctx) {
  return ['admin', 'editor'].indexOf(String(ctx.usuario.Perfil || '').toLowerCase()) !== -1;
}

/* ---------------------------------------------------------------------
 * ACOES
 * ------------------------------------------------------------------- */
function executarAcao(acao, req, ctx) {
  switch (acao) {
    case 'bootstrap': return acaoBootstrap(ctx);
    case 'logout': return acaoLogout(ctx);

    case 'salvarlancamento': return acaoSalvarLancamento(req, ctx);
    case 'excluirlancamento': return acaoExcluirLancamento(req, ctx);
    case 'salvarcategoria': return acaoSalvarCategoria(req, ctx);
    case 'excluircategoria': return acaoExcluirCategoria(req, ctx);
    case 'salvarconta': return acaoSalvarConta(req, ctx);
    case 'excluirconta': return acaoExcluirConta(req, ctx);
    case 'salvarcaixinha': return acaoSalvarCaixinha(req, ctx);
    case 'excluircaixinha': return acaoExcluirCaixinha(req, ctx);
    case 'movimentarcaixinha': return acaoMovimentarCaixinha(req, ctx);
    case 'excluirmovimentacao': return acaoExcluirMovimentacao(req, ctx);

    case 'salvarusuario': return acaoSalvarUsuario(req, ctx);
    case 'listarusuarios': return acaoListarUsuarios(ctx);
    case 'excluirusuario': return acaoExcluirUsuario(req, ctx);
    case 'trocarsenha': return acaoTrocarSenha(req, ctx);
    case 'salvarconfig': return acaoSalvarConfig(req, ctx);
    case 'limpar': return acaoLimpar(req, ctx);

    default: throw erroObj('Acao desconhecida: ' + acao, 'ACAO_INVALIDA');
  }
}

/**
 * Cria a planilha do zero (usado pelo app na primeira utilizacao).
 * Se ja existir uma planilha vinculada, apenas devolve os dados dela.
 */
function acaoCriarPlanilha(req) {
  var propId = PropertiesService.getScriptProperties().getProperty(PROP_SS);
  var ss = null;
  var criado = false;

  if (propId) {
    try { ss = SpreadsheetApp.openById(propId); } catch (e) { ss = null; }
  }

  if (!ss) {
    var nome = String((req && req.nome) || '').trim() || 'Controle Financeiro';
    try {
      ss = SpreadsheetApp.create(nome);
    } catch (e) {
      throw erroObj('Nao consegui criar a planilha: ' + e.message +
        '\n\nVerifique se a conta que executa o script tem permissao para criar planilhas ' +
        '(e autorizou o app na primeira vez).', 'ERRO');
    }
    PropertiesService.getScriptProperties().setProperty(PROP_SS, ss.getId());
    try { ss.setSpreadsheetTimeZone(TZ); } catch (e2) { /* fuso ja ok */ }
    criado = true;
  }

  // garante que as abas existem e estao formatadas
  var precisaConfigurar = !ss.getSheetByName('Lancamentos') || !ss.getSheetByName('Acessos');
  var abas = [];
  if (precisaConfigurar) {
    try {
      var res = configurarPlanilha({ silencioso: true });
      abas = (res && res.abas) ? res.abas : [];
    } catch (e3) { /* log */ }
  } else {
    abas = ['Config', 'Acessos', 'Categorias', 'Contas', 'Lancamentos', 'Caixinhas', 'Movimentacoes', 'Sessoes', 'Log'];
  }

  var temAdmin = false;
  try { temAdmin = lerLinhas('Acessos').length > 0; } catch (e4) { /* ignora */ }

  logAcao(null, 'criarplanilha', 'Planilha', ss.getId(), criado ? 'Planilha criada' : 'Planilha ja existia');

  return {
    ok: true,
    criado: criado,
    planilha: ss.getName(),
    id: ss.getId(),
    url: ss.getUrl(),
    abas: abas,
    temAdmin: temAdmin
  };
}

/** Diagnostico da planilha (usado pela tela de conexao do app). */
function acaoStatus() {
  var agora_ = agora();
  try {
    var ss = getSS();
    var abas = [], total = 0;
    var nomes = Object.keys(SCHEMA);
    for (var i = 0; i < nomes.length; i++) {
      var s = ss.getSheetByName(nomes[i]);
      abas.push({ nome: nomes[i], existe: !!s, linhas: s ? Math.max(s.getLastRow() - 1, 0) : 0 });
      if (s) total += Math.max(s.getLastRow() - 1, 0);
    }
    var usuarios = 0;
    try { usuarios = lerLinhas('Acessos').length; } catch (e) { /* ignora */ }

    return {
      ok: true,
      semPlanilha: false,
      planilha: ss.getName(),
      planilhaId: ss.getId(),
      planilhaUrl: ss.getUrl(),
      abas: abas,
      usuarios: usuarios,
      temUsuarios: usuarios > 0,
      pronto: abas.every(function (a) { return a.existe; }) && usuarios > 0,
      agora: agora_
    };
  } catch (e) {
    return {
      ok: true,
      semPlanilha: true,
      erro: e.message,
      pronto: false,
      temUsuarios: false,
      usuarios: 0,
      agora: agora_
    };
  }
}

/** Carrega tudo que o app precisa em uma unica chamada. */
function acaoBootstrap(ctx) {
  var u = ctx.usuario;
  return {
    ok: true,
    usuario: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil },
    config: lerConfig(),
    categorias: serializarTodas('Categorias'),
    contas: serializarTodas('Contas'),
    lancamentos: serializarTodas('Lancamentos'),
    caixinhas: serializarTodas('Caixinhas'),
    movimentacoes: serializarTodas('Movimentacoes'),
    agora: agora()
  };
}

function lerConfig() {
  var linhas = lerLinhas('Config');
  var cfg = {};
  for (var i = 0; i < linhas.length; i++) {
    cfg[String(linhas[i].Chave || '').trim()] = String(linhas[i].Valor === undefined || linhas[i].Valor === null ? '' : linhas[i].Valor);
  }
  return cfg;
}

/* --------------------------- login ---------------------------------- */
function acaoLogin(req) {
  var email = String(req.email || '').trim().toLowerCase();
  var senha = String(req.senha || '');

  if (lerLinhas('Acessos').length === 0) {
    throw erroObj('Nenhum usuario cadastrado na planilha. Use "Criar acesso admin" na tela de login.', 'SEM_USUARIOS');
  }
  if (!email || !senha) throw erroObj('Informe e-mail e senha.', 'DADOS');

  var u = acharPor('Acessos', 'Email', email);
  if (!u) throw erroObj('Usuario nao encontrado.', 'CREDENCIAIS');
  if (String(u.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Usuario desativado. Procure o administrador.', 'CREDENCIAIS');
  }
  if (!validarSenha(senha, u)) throw erroObj('Senha incorreta.', 'CREDENCIAIS');

  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var expira = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000);

  salvarLinha('Sessoes', {
    ID: novoId(), Token: token, UsuarioID: u.ID, Email: u.Email,
    CriadoEm: new Date(), ExpiraEm: expira, Ativo: 'SIM'
  });

  // atualiza UltimoAcesso
  var upd = { ID: u.ID, UltimoAcesso: new Date() };
  salvarLinha('Acessos', upd);

  logAcao(u, 'login', 'Acessos', u.ID, 'Login realizado');

  return {
    ok: true,
    token: token,
    expiraEm: fmtDataHora(expira),
    usuario: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil }
  };
}

/** Cria o primeiro administrador (so funciona se ainda nao houver nenhum usuario). */
function acaoCriarAdminInicial(req) {
  if (lerLinhas('Acessos').length > 0) {
    throw erroObj('Ja existe usuario cadastrado. Use o painel de Acessos.', 'JA_EXISTE');
  }
  var nome = String(req.nome || '').trim();
  var email = String(req.email || '').trim().toLowerCase();
  var senha = String(req.senha || '');

  if (!nome || !email) throw erroObj('Informe nome e e-mail.', 'DADOS');
  if (senha.length < 6) throw erroObj('A senha precisa de 6 caracteres ou mais.', 'DADOS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erroObj('E-mail invalido.', 'DADOS');

  var salt = gerarSalt();
  var u = { ID: novoId(), Nome: nome, Email: email, Perfil: 'admin', Ativo: 'SIM',
            Salt: salt, SenhaHash: hashSenha(senha, salt), CriadoEm: new Date(), UltimoAcesso: '', Obs: 'Admin inicial' };
  salvarLinha('Acessos', u);
  logAcao(u, 'criar', 'Acessos', u.ID, 'Administrador inicial criado pelo app');
  return { ok: true, usuario: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil } };
}

function acaoLogout(ctx) {
  excluirLinha('Sessoes', ctx.sessao.ID);
  logAcao(ctx.usuario, 'logout', 'Acessos', ctx.usuario.ID, '');
  return { ok: true };
}

/* --------------------------- lancamentos ---------------------------- */
function acaoSalvarLancamento(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var d = req.dados || {};

  var data = parseData(d.Data);
  if (!data) throw erroObj('Informe uma data valida.', 'DADOS');

  var valor = Number(String(d.Valor === undefined || d.Valor === null ? '' : d.Valor).replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) throw erroObj('O valor deve ser maior que zero.', 'DADOS');

  var tipo = String(d.Tipo || '').toLowerCase() === 'receita' ? 'Receita' : 'Despesa';
  var parcelas = Math.max(1, Math.min(60, parseInt(d.Parcelas || 1, 10) || 1));
  var existente = d.ID ? acharLinha('Lancamentos', d.ID) : null;

  var base = {
    Data: data,
    Tipo: tipo,
    Valor: valor,
    Descricao: String(d.Descricao || '').trim(),
    CategoriaID: String(d.CategoriaID || ''),
    ContaID: String(d.ContaID || ''),
    FormaPagamento: String(d.FormaPagamento || 'Outro'),
    Parcelas: parcelas,
    ParcelaAtual: Math.max(1, parseInt(d.ParcelaAtual || 1, 10) || 1),
    Status: String(d.Status || 'Pago'),
    Recorrente: (d.Recorrente === true || String(d.Recorrente).toUpperCase() === 'SIM') ? 'SIM' : 'NAO',
    Fixo: (d.Fixo === true || String(d.Fixo).toUpperCase() === 'SIM') ? 'SIM' : 'NAO',
    Competencia: competenciaDe(data),
    CaixinhaID: String(d.CaixinhaID || ''),
    GrupoParcelas: String(d.GrupoParcelas || ''),
    Obs: String(d.Obs || ''),
    AtualizadoEm: new Date(),
    CriadoPor: ctx.usuario.Email
  };

  if (!base.Descricao) throw erroObj('Informe uma descricao.', 'DADOS');

  // edicao
  if (existente) {
    base.ID = existente.ID;
    base.CriadoEm = existente.CriadoEm || new Date();
    base.CriadoPor = existente.CriadoPor || ctx.usuario.Email;
    if (!base.GrupoParcelas) base.GrupoParcelas = String(existente.GrupoParcelas || '');
    salvarLinha('Lancamentos', base);
    logAcao(ctx.usuario, 'editar', 'Lancamentos', base.ID, base.Descricao + ' - ' + valor);
    return { ok: true, id: base.ID };
  }

  // novo com parcelas -> gera o grupo completo
  if (parcelas > 1) {
    var grupo = novoId();
    var ids = [];
    for (var i = 0; i < parcelas; i++) {
      var reg = {};
      for (var k in base) { if (Object.prototype.hasOwnProperty.call(base, k)) reg[k] = base[k]; }
      reg.ID = novoId();
      reg.Data = addMesesData(data, i);
      reg.Competencia = competenciaDe(reg.Data);
      reg.Parcelas = parcelas;
      reg.ParcelaAtual = i + 1;
      reg.GrupoParcelas = grupo;
      reg.CriadoEm = new Date();
      salvarLinha('Lancamentos', reg);
      ids.push(reg.ID);
    }
    logAcao(ctx.usuario, 'criar', 'Lancamentos', grupo, parcelas + ' parcelas de ' + valor);
    return { ok: true, ids: ids, grupo: grupo };
  }

  base.ID = novoId();
  base.CriadoEm = new Date();
  salvarLinha('Lancamentos', base);
  logAcao(ctx.usuario, 'criar', 'Lancamentos', base.ID, base.Descricao + ' - ' + valor);
  return { ok: true, id: base.ID };
}

function acaoExcluirLancamento(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var id = String(req.id || '');
  if (!id) throw erroObj('Informe o ID do lancamento.', 'DADOS');

  var alvo = acharLinha('Lancamentos', id);
  if (!alvo) throw erroObj('Lancamento nao encontrado.', 'NAO_ENCONTRADO');

  var n = 1;
  if (req.excluirGrupo && alvo.GrupoParcelas) {
    n = excluirLinhasOnde('Lancamentos', 'GrupoParcelas', String(alvo.GrupoParcelas));
  } else {
    excluirLinha('Lancamentos', id);
  }
  logAcao(ctx.usuario, 'excluir', 'Lancamentos', id, 'Linhas removidas: ' + n);
  return { ok: true, removidas: n };
}

/* --------------------------- categorias ----------------------------- */
function acaoSalvarCategoria(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var d = req.dados || {};
  var nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da categoria.', 'DADOS');
  var tipo = String(d.Tipo || 'Despesa') === 'Receita' ? 'Receita' : 'Despesa';

  var duplicada = acharPor('Categorias', 'Nome', nome);
  if (duplicada && String(duplicada.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe uma categoria com esse nome.', 'DUPLICADO');
  }

  var reg = {
    ID: d.ID || novoId(),
    Nome: nome,
    Tipo: tipo,
    Grupo: String(d.Grupo || '').trim(),
    Cor: String(d.Cor || '#64748b'),
    OrcamentoMensal: Number(String(d.OrcamentoMensal || 0).replace(',', '.')) || 0,
    Ativo: (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM',
    Obs: String(d.Obs || ''),
    CriadoEm: d.CriadoEm ? parseDataHora(d.CriadoEm) : new Date()
  };
  salvarLinha('Categorias', reg);
  logAcao(ctx.usuario, 'salvar', 'Categorias', reg.ID, nome);
  return { ok: true, id: reg.ID };
}

function acaoExcluirCategoria(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var id = String(req.id || '');
  var emUso = contar('Lancamentos', 'CategoriaID', id);
  if (emUso > 0) {
    throw erroObj('Esta categoria esta em uso por ' + emUso + ' lancamento(s). Desative-a em vez de excluir.', 'EM_USO');
  }
  excluirLinha('Categorias', id);
  logAcao(ctx.usuario, 'excluir', 'Categorias', id, '');
  return { ok: true };
}

/* --------------------------- contas --------------------------------- */
function acaoSalvarConta(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var d = req.dados || {};
  var nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da conta.', 'DADOS');

  var duplicada = acharPor('Contas', 'Nome', nome);
  if (duplicada && String(duplicada.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe uma conta com esse nome.', 'DUPLICADO');
  }

  var reg = {
    ID: d.ID || novoId(),
    Nome: nome,
    Tipo: String(d.Tipo || 'Conta Corrente'),
    Instituicao: String(d.Instituicao || '').trim(),
    Limite: Number(String(d.Limite || 0).replace(',', '.')) || 0,
    DiaVencimento: parseInt(d.DiaVencimento || 0, 10) || 0,
    Cor: String(d.Cor || '#3b82f6'),
    Ativo: (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM',
    Obs: String(d.Obs || ''),
    CriadoEm: d.CriadoEm ? parseDataHora(d.CriadoEm) : new Date()
  };
  salvarLinha('Contas', reg);
  logAcao(ctx.usuario, 'salvar', 'Contas', reg.ID, nome);
  return { ok: true, id: reg.ID };
}

function acaoExcluirConta(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var id = String(req.id || '');
  var emUso = contar('Lancamentos', 'ContaID', id);
  if (emUso > 0) {
    throw erroObj('Esta conta esta em uso por ' + emUso + ' lancamento(s). Desative-a em vez de excluir.', 'EM_USO');
  }
  excluirLinha('Contas', id);
  logAcao(ctx.usuario, 'excluir', 'Contas', id, '');
  return { ok: true };
}

/* --------------------------- caixinhas ------------------------------ */
function acaoSalvarCaixinha(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var d = req.dados || {};
  var nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da caixinha.', 'DADOS');

  var reg = {
    ID: d.ID || novoId(),
    Nome: nome,
    Descricao: String(d.Descricao || '').trim(),
    Meta: Number(String(d.Meta || 0).replace(',', '.')) || 0,
    Prazo: String(d.Prazo || '').trim(),
    SaldoInicial: Number(String(d.SaldoInicial || 0).replace(',', '.')) || 0,
    Cor: String(d.Cor || '#22c55e'),
    Ativo: (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM',
    CriadoEm: d.CriadoEm ? parseDataHora(d.CriadoEm) : new Date(),
    CriadoPor: ctx.usuario.Email
  };
  salvarLinha('Caixinhas', reg);
  logAcao(ctx.usuario, 'salvar', 'Caixinhas', reg.ID, nome);
  return { ok: true, id: reg.ID };
}

function acaoExcluirCaixinha(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var id = String(req.id || '');
  var movs = contar('Movimentacoes', 'CaixinhaID', id);
  excluirLinhasOnde('Movimentacoes', 'CaixinhaID', id);
  excluirLinha('Caixinhas', id);
  logAcao(ctx.usuario, 'excluir', 'Caixinhas', id, movs + ' movimentacao(oes) removida(s)');
  return { ok: true, movsRemovidas: movs };
}

function acaoMovimentarCaixinha(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var d = req.dados || {};
  var idCaixinha = String(d.CaixinhaID || '');
  if (!idCaixinha) throw erroObj('Informe a caixinha.', 'DADOS');
  if (!acharLinha('Caixinhas', idCaixinha)) throw erroObj('Caixinha nao encontrada.', 'NAO_ENCONTRADO');

  var valor = Number(String(d.Valor || 0).replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) throw erroObj('O valor deve ser maior que zero.', 'DADOS');

  var data = parseData(d.Data) || new Date();
  var tipo = String(d.Tipo || '').toLowerCase().indexOf('sai') >= 0 ? 'Saida' : 'Entrada';

  var reg = {
    ID: novoId(),
    CaixinhaID: idCaixinha,
    Data: data,
    Tipo: tipo,
    Valor: valor,
    Descricao: String(d.Descricao || '').trim(),
    Origem: String(d.Origem || 'Manual'),
    LancamentoID: String(d.LancamentoID || ''),
    CriadoEm: new Date(),
    CriadoPor: ctx.usuario.Email
  };
  salvarLinha('Movimentacoes', reg);
  logAcao(ctx.usuario, 'movimentar', 'Caixinhas', idCaixinha, tipo + ' ' + valor);
  return { ok: true, id: reg.ID };
}

function acaoExcluirMovimentacao(req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  var id = String(req.id || '');
  excluirLinha('Movimentacoes', id);
  logAcao(ctx.usuario, 'excluir', 'Movimentacoes', id, '');
  return { ok: true };
}

/* --------------------------- usuarios ------------------------------- */
function acaoSalvarUsuario(req, ctx) {
  exigirPerfil(ctx, ['admin']);
  var d = req.dados || {};

  var nome = String(d.Nome || '').trim();
  var email = String(d.Email || '').trim().toLowerCase();
  if (!nome) throw erroObj('Informe o nome.', 'DADOS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erroObj('Informe um e-mail valido.', 'DADOS');

  var existente = d.ID ? acharLinha('Acessos', d.ID) : null;
  var outro = acharPor('Acessos', 'Email', email);
  if (outro && String(outro.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe um usuario com esse e-mail.', 'DUPLICADO');
  }

  var perfil = ['admin', 'editor', 'leitor'].indexOf(String(d.Perfil || '').toLowerCase()) >= 0
    ? String(d.Perfil).toLowerCase() : 'leitor';
  var ativo = (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM';

  var reg = {
    ID: existente ? existente.ID : novoId(),
    Nome: nome,
    Email: email,
    Perfil: perfil,
    Ativo: ativo,
    Obs: String(d.Obs || (existente ? existente.Obs : '')),
    CriadoEm: existente ? (existente.CriadoEm || new Date()) : new Date(),
    UltimoAcesso: existente ? (existente.UltimoAcesso || '') : '',
    Salt: existente ? existente.Salt : '',
    SenhaHash: existente ? existente.SenhaHash : ''
  };

  var senha = String(d.Senha || '');
  if (senha) {
    if (senha.length < 6) throw erroObj('A senha precisa de 6 caracteres ou mais.', 'DADOS');
    reg.Salt = gerarSalt();
    reg.SenhaHash = hashSenha(senha, reg.Salt);
    // derruba sessoes do usuario ao trocar a senha
    if (existente) revogarSessoesDoUsuario(existente.ID);
  } else if (!existente) {
    throw erroObj('Defina uma senha para o novo usuario.', 'DADOS');
  }

  salvarLinha('Acessos', reg);
  logAcao(ctx.usuario, 'salvar', 'Acessos', reg.ID, email + ' (' + perfil + ')');
  return { ok: true, id: reg.ID };
}

/** Lista os usuarios (sem hashes de senha). Apenas admin. */
function acaoListarUsuarios(ctx) {
  exigirPerfil(ctx, ['admin']);
  var linhas = lerLinhas('Acessos');
  var out = [];
  for (var i = 0; i < linhas.length; i++) {
    var u = linhas[i];
    out.push({
      ID: String(u.ID || ''),
      Nome: String(u.Nome || ''),
      Email: String(u.Email || ''),
      Perfil: String(u.Perfil || 'leitor'),
      Ativo: String(u.Ativo || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
      Obs: String(u.Obs || ''),
      CriadoEm: u.CriadoEm ? fmtDataHora(u.CriadoEm) : '',
      UltimoAcesso: u.UltimoAcesso ? fmtDataHora(u.UltimoAcesso) : ''
    });
  }
  return { ok: true, usuarios: out };
}

function acaoExcluirUsuario(req, ctx) {
  exigirPerfil(ctx, ['admin']);
  var id = String(req.id || '');
  if (id === String(ctx.usuario.ID)) throw erroObj('Voce nao pode excluir o proprio usuario.', 'DADOS');
  revogarSessoesDoUsuario(id);
  excluirLinha('Acessos', id);
  logAcao(ctx.usuario, 'excluir', 'Acessos', id, '');
  return { ok: true };
}

/** Troca a propria senha (qualquer perfil). */
function acaoTrocarSenha(req, ctx) {
  var atual = String(req.senhaAtual || '');
  var nova = String(req.senhaNova || '');
  if (nova.length < 6) throw erroObj('A nova senha precisa de 6 caracteres ou mais.', 'DADOS');
  if (!validarSenha(atual, ctx.usuario)) throw erroObj('Senha atual incorreta.', 'CREDENCIAIS');

  var salt = gerarSalt();
  salvarLinha('Acessos', { ID: ctx.usuario.ID, Salt: salt, SenhaHash: hashSenha(nova, salt) });
  revogarSessoesDoUsuario(ctx.usuario.ID);
  logAcao(ctx.usuario, 'senha', 'Acessos', ctx.usuario.ID, 'Senha alterada');
  return { ok: true, mensagem: 'Senha alterada. Faca login novamente.' };
}

function revogarSessoesDoUsuario(usuarioId) {
  var s = getSheet('Sessoes');
  var lastRow = s.getLastRow();
  if (lastRow < 2) return;
  var lastCol = s.getLastColumn();
  var heads = s.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var h = 0; h < heads.length; h++) { heads[h] = String(heads[h]).trim(); }
  var idxUser = heads.indexOf('UsuarioID');
  if (idxUser < 0) return;
  var vals = s.getRange(2, idxUser + 1, lastRow - 1, 1).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i][0]) === String(usuarioId)) s.deleteRow(i + 2);
  }
}

/* --------------------------- config / manutencao -------------------- */
function acaoSalvarConfig(req, ctx) {
  exigirPerfil(ctx, ['admin']);
  var chave = String(req.chave || '').trim();
  if (!chave) throw erroObj('Informe a chave de configuracao.', 'DADOS');

  var atual = acharPor('Config', 'Chave', chave);
  var reg = {
    ID: atual ? atual.ID : novoId(),
    Chave: chave,
    Valor: String(req.valor === undefined || req.valor === null ? '' : req.valor),
    Descricao: atual ? atual.Descricao : ''
  };
  salvarLinha('Config', reg);
  logAcao(ctx.usuario, 'config', 'Config', chave, String(reg.Valor));
  return { ok: true };
}

/** Limpa todos os dados financeiros (mantem usuarios e configuracoes). */
function acaoLimpar(req, ctx) {
  exigirPerfil(ctx, ['admin']);
  if (String(req.confirmar || '') !== 'APAGAR TUDO') {
    throw erroObj('Confirmacao invalida. Digite exatamente APAGAR TUDO.', 'DADOS');
  }
  var total = 0;
  var abas = ['Lancamentos', 'Movimentacoes', 'Caixinhas'];
  for (var i = 0; i < abas.length; i++) {
    var s = getSheet(abas[i]);
    var lastRow = s.getLastRow();
    if (lastRow > 1) { s.deleteRows(2, lastRow - 1); total += lastRow - 1; }
  }
  logAcao(ctx.usuario, 'limpar', 'Lancamentos', '', total + ' linhas removidas');
  return { ok: true, removidas: total };
}

/** Conta linhas onde coluna == valor */
function contar(nome, coluna, valor) {
  var alvo = String(valor === undefined || valor === null ? '' : valor).trim();
  if (!alvo) return 0;
  var linhas = lerLinhas(nome);
  var n = 0;
  for (var i = 0; i < linhas.length; i++) {
    var v = linhas[i][coluna];
    if (String(v === undefined || v === null ? '' : v).trim() === alvo) n++;
  }
  return n;
}
