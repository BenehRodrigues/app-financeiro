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

  var temUsuario = false;
  try { temUsuario = lerLinhas('Acessos').length > 0; } catch (e) { /* ignora */ }

  if (!silencioso) {
    var msg = 'Planilha configurada!\n\n' +
              'Planilha: ' + ss.getName() + '\n' +
              'URL: ' + ss.getUrl() + '\n\n' +
              'Abas criadas: ' + nomes.join(', ') + '\n\n';
    msg += temUsuario
      ? 'Usuarios cadastrados: ' + lerLinhas('Acessos').length + '\n'
      : 'Nenhum usuario cadastrado ainda.\n';
    SpreadsheetApp.getUi().alert(msg);
    if (!temUsuario) criarAdminPeloMenu();
  }

  return { ss: ss, abas: nomes, temUsuario: temUsuario };
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
