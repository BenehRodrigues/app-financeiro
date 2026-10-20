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
