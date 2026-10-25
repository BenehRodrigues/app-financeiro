/* =====================================================================
 * backend/worker.js — API Cloudflare Workers + Cloudflare D1 (SQLite)
 * Aplicativo: Controle Financeiro
 *
 * Compativel com:
 *  1) Deploy completo (Worker + Static Assets servindo a pasta site/)
 *  2) Deploy somente da API (consumido pelo GitHub Pages via CORS)
 *  3) Criacao direta pelo painel da Cloudflare (Workers & Pages + D1)
 *
 * Binding esperado do banco D1: DB (ou qualquer binding D1 no env)
 * ===================================================================== */

export const TZ = 'America/Sao_Paulo';
export const SESSAO_DIAS = 30;

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export const SCHEMA = {
  Config: {
    titulo: 'Configuracoes gerais do aplicativo (chave/valor)',
    colunas: [
      ['ID', 'texto'],
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

/* =====================================================================
 * DADOS PADRAO (SEED INICIAL)
 * ===================================================================== */
const SEED_CONFIG = [
  ['cfg-1', 'nome_app', 'Controle Financeiro', 'Nome exibido no topo do app'],
  ['cfg-2', 'simbolo_moeda', 'R$', 'Simbolo usado para formatar valores'],
  ['cfg-3', 'locale', 'pt-BR', 'Formato de data e numero'],
  ['cfg-4', 'mostrar_centavos', 'SIM', 'Mostrar centavos nos valores'],
  ['cfg-5', 'atualizacao_auto_seg', '60', 'Atualizacao automatica da tela (segundos). 0 = desliga'],
  ['cfg-6', 'permitir_parcelas', 'SIM', 'Permitir lancamentos parcelados'],
  ['cfg-7', 'tema_padrao', 'escuro', 'escuro | claro'],
  ['cfg-8', 'cor_primaria', '#22c55e', 'Cor de destaque do app'],
  ['cfg-9', 'alerta_saldo_negativo', 'SIM', 'Destacar saldo negativo no painel'],
  ['cfg-10', 'mostrar_projecao', 'SIM', 'Exibir projecao de gastos fixos/recorrentes']
];

const SEED_CATEGORIAS = [
  ['cat-01', 'Aluguel', 'Despesa', 'Moradia', '#ef4444'],
  ['cat-02', 'Condominio', 'Despesa', 'Moradia', '#f97316'],
  ['cat-03', 'Energia eletrica', 'Despesa', 'Moradia', '#eab308'],
  ['cat-04', 'Agua', 'Despesa', 'Moradia', '#38bdf8'],
  ['cat-05', 'Gas', 'Despesa', 'Moradia', '#f59e0b'],
  ['cat-06', 'Internet', 'Despesa', 'Moradia', '#0ea5e9'],
  ['cat-07', 'IPTU', 'Despesa', 'Moradia', '#a855f7'],
  ['cat-08', 'Mercado', 'Despesa', 'Alimentacao', '#22c55e'],
  ['cat-09', 'Restaurante', 'Despesa', 'Alimentacao', '#16a34a'],
  ['cat-10', 'Delivery', 'Despesa', 'Alimentacao', '#4ade80'],
  ['cat-11', 'Combustivel', 'Despesa', 'Transporte', '#14b8a6'],
  ['cat-12', 'Uber / 99', 'Despesa', 'Transporte', '#2dd4bf'],
  ['cat-13', 'Estacionamento', 'Despesa', 'Transporte', '#64748b'],
  ['cat-14', 'Manutencao do carro', 'Despesa', 'Transporte', '#f97316'],
  ['cat-15', 'Cinema e lazer', 'Despesa', 'Lazer', '#ec4899'],
  ['cat-16', 'Assinaturas', 'Despesa', 'Lazer', '#d946ef'],
  ['cat-17', 'Viagem', 'Despesa', 'Lazer', '#f43f5e'],
  ['cat-18', 'Farmacia', 'Despesa', 'Saude', '#22d3ee'],
  ['cat-19', 'Plano de saude', 'Despesa', 'Saude', '#06b6d4'],
  ['cat-20', 'Cursos', 'Despesa', 'Educacao', '#818cf8'],
  ['cat-21', 'Compras', 'Despesa', 'Compras', '#f43f5e'],
  ['cat-22', 'Juros do cartao', 'Despesa', 'Taxas', '#ef4444'],
  ['cat-23', 'Impostos', 'Despesa', 'Taxas', '#b91c1c'],
  ['cat-24', 'Outros', 'Despesa', 'Outros', '#94a3b8'],
  ['cat-25', 'Salario', 'Receita', 'Renda', '#22c55e'],
  ['cat-26', '13o salario', 'Receita', 'Renda', '#16a34a'],
  ['cat-27', 'Ferias', 'Receita', 'Renda', '#4ade80'],
  ['cat-28', 'Bonus', 'Receita', 'Extras', '#eab308'],
  ['cat-29', 'Comissao', 'Receita', 'Extras', '#f59e0b'],
  ['cat-30', 'Freela', 'Receita', 'Extras', '#84cc16'],
  ['cat-31', 'Reembolso', 'Receita', 'Extras', '#a3e635'],
  ['cat-32', 'Dividendos', 'Receita', 'Investimentos', '#2dd4bf'],
  ['cat-33', 'Rendimentos', 'Receita', 'Investimentos', '#22d3ee'],
  ['cat-34', 'Aportes', 'Receita', 'Investimentos', '#38bdf8']
];

const SEED_CONTAS = [
  ['cnt-01', 'Conta Corrente', 'Conta Corrente', '', 0, 0, '#3b82f6'],
  ['cnt-02', 'Poupanca', 'Poupanca', '', 0, 0, '#22c55e'],
  ['cnt-03', 'Cartao de Credito', 'Cartao de Credito', '', 0, 10, '#f43f5e'],
  ['cnt-04', 'Carteira', 'Carteira', '', 0, 0, '#eab308']
];

const SEED_CAIXINHAS = [
  ['cx-01', 'Reserva de Emergencia', 'Gasto inesperado', 12000, '', '#22c55e'],
  ['cx-02', 'Viagem', 'Fundo para viagens', 5000, '', '#0ea5e9'],
  ['cx-03', 'Investimentos', 'Aportes para investimento', 30000, '', '#a855f7']
];

const DDL_TABELAS = [
  `CREATE TABLE IF NOT EXISTS Config (
    ID TEXT PRIMARY KEY,
    Chave TEXT UNIQUE NOT NULL,
    Valor TEXT DEFAULT '',
    Descricao TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Acessos (
    ID TEXT PRIMARY KEY,
    Nome TEXT NOT NULL,
    Email TEXT UNIQUE NOT NULL,
    Perfil TEXT NOT NULL DEFAULT 'leitor',
    Ativo TEXT NOT NULL DEFAULT 'SIM',
    Salt TEXT NOT NULL,
    SenhaHash TEXT NOT NULL,
    CriadoEm TEXT DEFAULT '',
    UltimoAcesso TEXT DEFAULT '',
    Obs TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Categorias (
    ID TEXT PRIMARY KEY,
    Nome TEXT NOT NULL,
    Tipo TEXT NOT NULL DEFAULT 'Despesa',
    Grupo TEXT DEFAULT '',
    Cor TEXT DEFAULT '#64748b',
    OrcamentoMensal REAL DEFAULT 0,
    Ativo TEXT DEFAULT 'SIM',
    Obs TEXT DEFAULT '',
    CriadoEm TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Contas (
    ID TEXT PRIMARY KEY,
    Nome TEXT NOT NULL,
    Tipo TEXT NOT NULL DEFAULT 'Conta Corrente',
    Instituicao TEXT DEFAULT '',
    Limite REAL DEFAULT 0,
    DiaVencimento INTEGER DEFAULT 0,
    Cor TEXT DEFAULT '#3b82f6',
    Ativo TEXT DEFAULT 'SIM',
    Obs TEXT DEFAULT '',
    CriadoEm TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Lancamentos (
    ID TEXT PRIMARY KEY,
    Data TEXT NOT NULL,
    Tipo TEXT NOT NULL DEFAULT 'Despesa',
    Valor REAL NOT NULL DEFAULT 0,
    Descricao TEXT NOT NULL,
    CategoriaID TEXT DEFAULT '',
    ContaID TEXT DEFAULT '',
    FormaPagamento TEXT DEFAULT 'Outro',
    Parcelas INTEGER DEFAULT 1,
    ParcelaAtual INTEGER DEFAULT 1,
    Status TEXT DEFAULT 'Pago',
    Recorrente TEXT DEFAULT 'NAO',
    Fixo TEXT DEFAULT 'NAO',
    Competencia TEXT DEFAULT '',
    CaixinhaID TEXT DEFAULT '',
    GrupoParcelas TEXT DEFAULT '',
    Obs TEXT DEFAULT '',
    CriadoEm TEXT DEFAULT '',
    AtualizadoEm TEXT DEFAULT '',
    CriadoPor TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Caixinhas (
    ID TEXT PRIMARY KEY,
    Nome TEXT NOT NULL,
    Descricao TEXT DEFAULT '',
    Meta REAL DEFAULT 0,
    Prazo TEXT DEFAULT '',
    SaldoInicial REAL DEFAULT 0,
    Cor TEXT DEFAULT '#22c55e',
    Ativo TEXT DEFAULT 'SIM',
    CriadoEm TEXT DEFAULT '',
    CriadoPor TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Movimentacoes (
    ID TEXT PRIMARY KEY,
    CaixinhaID TEXT NOT NULL,
    Data TEXT NOT NULL,
    Tipo TEXT NOT NULL DEFAULT 'Entrada',
    Valor REAL NOT NULL DEFAULT 0,
    Descricao TEXT DEFAULT '',
    Origem TEXT DEFAULT 'Manual',
    LancamentoID TEXT DEFAULT '',
    CriadoEm TEXT DEFAULT '',
    CriadoPor TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS Sessoes (
    ID TEXT PRIMARY KEY,
    Token TEXT UNIQUE NOT NULL,
    UsuarioID TEXT NOT NULL,
    Email TEXT DEFAULT '',
    CriadoEm TEXT DEFAULT '',
    ExpiraEm TEXT DEFAULT '',
    Ativo TEXT DEFAULT 'SIM'
  )`,
  `CREATE TABLE IF NOT EXISTS Log (
    ID TEXT PRIMARY KEY,
    Timestamp TEXT DEFAULT '',
    UsuarioID TEXT DEFAULT '',
    Email TEXT DEFAULT '',
    Acao TEXT DEFAULT '',
    Entidade TEXT DEFAULT '',
    EntidadeID TEXT DEFAULT '',
    Detalhes TEXT DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_acessos_email ON Acessos(Email)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_competencia ON Lancamentos(Competencia)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON Lancamentos(Data)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON Lancamentos(CategoriaID)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON Lancamentos(ContaID)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_caixinha ON Lancamentos(CaixinhaID)`,
  `CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo ON Lancamentos(GrupoParcelas)`,
  `CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixinha ON Movimentacoes(CaixinhaID)`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_token ON Sessoes(Token)`,
  `CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON Sessoes(UsuarioID)`
];

/* =====================================================================
 * UTILITARIOS (DATAS, SENHA, TIPOS, ERRO)
 * ===================================================================== */
export function erroObj(msg, codigo = 'ERRO') {
  const e = new Error(msg);
  e.codigo = codigo;
  return e;
}

export function novoId() {
  return crypto.randomUUID();
}

export function gerarSalt() {
  return crypto.randomUUID().replace(/-/g, '');
}

export function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < arr.length; i++) {
    s += arr[i].toString(16).padStart(2, '0');
  }
  return s;
}

export async function hashSenha(senha, salt) {
  const msg = `${salt}|${String(senha)}`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return bytesToHex(buf);
}

export async function validarSenha(senha, usuario) {
  if (!usuario || !usuario.Salt || !usuario.SenhaHash) return false;
  const h = await hashSenha(senha, String(usuario.Salt));
  return h === String(usuario.SenhaHash);
}

export function parseData(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);

  const b = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (b) return new Date(+b[3], +b[2] - 1, +b[1], 12, 0, 0);

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function parseDataHora(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return null;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(:(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[7] || 0));

  return parseData(s);
}

export function fmtData(v) {
  const d = v instanceof Date ? v : parseData(v);
  if (!d || isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDataHora(v) {
  const d = v instanceof Date ? v : parseDataHora(v);
  if (!d || isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function agora() {
  // Ajusta para o horario de Sao Paulo (UTC-3) quando rodando em ambiente UTC (Workers)
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(now);
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const h = map.hour === '24' ? '00' : map.hour;
    return `${map.year}-${map.month}-${map.day} ${h}:${map.minute}:${map.second}`;
  } catch (e) {
    return fmtDataHora(now);
  }
}

export function addMesesData(v, n) {
  const d = parseData(v);
  if (!d) return null;
  const y = d.getFullYear();
  const m = d.getMonth() + n;
  const dia = d.getDate();
  const ultimoDia = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(dia, ultimoDia), 12, 0, 0);
}

export function competenciaDe(v) {
  const iso = fmtData(v);
  return iso ? iso.slice(0, 7) : '';
}

export function toCell(v, tipo) {
  if (v === undefined || v === null) return '';
  switch (tipo) {
    case 'num':
    case 'moeda': {
      if (v === '') return '';
      const n = Number(String(v).replace(',', '.'));
      return isNaN(n) ? '' : (tipo === 'moeda' ? Math.round(n * 100) / 100 : n);
    }
    case 'data': {
      const d = parseData(v);
      return d ? fmtData(d) : '';
    }
    case 'dt': {
      const d2 = parseDataHora(v);
      return d2 ? fmtDataHora(d2) : '';
    }
    case 'bool': {
      const s = String(v).trim().toUpperCase();
      return (s === 'SIM' || s === 'TRUE' || s === '1' || s === 'X') ? 'SIM' : 'NAO';
    }
    case 'mes':
      return String(v).trim();
    default:
      return String(v);
  }
}

export function fromCell(v, tipo) {
  if (v === undefined || v === null) return (tipo === 'num' || tipo === 'moeda') ? 0 : '';
  switch (tipo) {
    case 'num':
    case 'moeda': {
      const n = Number(String(v).replace(',', '.'));
      return isNaN(n) ? 0 : Math.round(n * 100) / 100;
    }
    case 'data':
      return v === '' ? '' : fmtData(v);
    case 'dt':
      return v === '' ? '' : fmtDataHora(v);
    case 'bool':
      return String(v).trim().toUpperCase() === 'SIM' ? 'SIM' : 'NAO';
    default:
      return String(v);
  }
}

function normalizarLinha(nomeTabela, row) {
  if (!row) return null;
  const cols = SCHEMA[nomeTabela]?.colunas || [];
  const out = {};
  for (const [col, tipo] of cols) {
    out[col] = fromCell(row[col], tipo);
  }
  return out;
}

/* =====================================================================
 * ACESSO E INICIALIZACAO DO BANCO D1
 * ===================================================================== */
export function obterDB(env) {
  if (!env) return null;
  if (env.DB && typeof env.DB.prepare === 'function') return env.DB;
  if (env.D1 && typeof env.D1.prepare === 'function') return env.D1;
  if (env.DATABASE && typeof env.DATABASE.prepare === 'function') return env.DATABASE;
  for (const k of Object.keys(env)) {
    if (env[k] && typeof env[k].prepare === 'function') return env[k];
  }
  return null;
}

/**
 * Cria as 9 tabelas e popula dados padrao caso o banco D1 esteja vazio.
 * Idempotente e seguro para rodar multiplas vezes.
 */
export async function garantirBanco(db) {
  if (!db) {
    throw erroObj(
      'Banco D1 nao vinculado ao Worker. No painel da Cloudflare, va em Worker > Settings > Bindings e adicione o D1 Database com nome de variavel "DB".',
      'SEM_BANCO'
    );
  }

  let jaExiste = false;
  try {
    const check = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='Lancamentos'").first();
    jaExiste = Number(check?.n || 0) > 0;
  } catch (e) {
    jaExiste = false;
  }

  // Cria tabelas e indices se necessario
  const stmts = DDL_TABELAS.map((sql) => db.prepare(sql));
  await db.batch(stmts);

  // Verifica se precisa semear Config, Categorias, Contas e Caixinhas
  const [cntCfg, cntCat, cntCnt, cntCx] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM Config'),
    db.prepare('SELECT COUNT(*) AS n FROM Categorias'),
    db.prepare('SELECT COUNT(*) AS n FROM Contas'),
    db.prepare('SELECT COUNT(*) AS n FROM Caixinhas')
  ]);

  const seedStmts = [];
  const ts = agora();

  if (Number(cntCfg.results?.[0]?.n || 0) === 0) {
    for (const [id, chave, valor, desc] of SEED_CONFIG) {
      seedStmts.push(
        db.prepare('INSERT OR IGNORE INTO Config (ID, Chave, Valor, Descricao) VALUES (?, ?, ?, ?)')
          .bind(id, chave, valor, desc)
      );
    }
  }

  if (Number(cntCat.results?.[0]?.n || 0) === 0) {
    for (const [id, nome, tipo, grupo, cor] of SEED_CATEGORIAS) {
      seedStmts.push(
        db.prepare('INSERT OR IGNORE INTO Categorias (ID, Nome, Tipo, Grupo, Cor, OrcamentoMensal, Ativo, Obs, CriadoEm) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)')
          .bind(id, nome, tipo, grupo, cor, 'SIM', '', ts)
      );
    }
  }

  if (Number(cntCnt.results?.[0]?.n || 0) === 0) {
    for (const [id, nome, tipo, inst, limite, venc, cor] of SEED_CONTAS) {
      seedStmts.push(
        db.prepare('INSERT OR IGNORE INTO Contas (ID, Nome, Tipo, Instituicao, Limite, DiaVencimento, Cor, Ativo, Obs, CriadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(id, nome, tipo, inst, limite, venc, cor, 'SIM', '', ts)
      );
    }
  }

  if (Number(cntCx.results?.[0]?.n || 0) === 0) {
    for (const [id, nome, desc, meta, prazo, cor] of SEED_CAIXINHAS) {
      seedStmts.push(
        db.prepare('INSERT OR IGNORE INTO Caixinhas (ID, Nome, Descricao, Meta, Prazo, SaldoInicial, Cor, Ativo, CriadoEm, CriadoPor) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)')
          .bind(id, nome, desc, meta, prazo, cor, 'SIM', ts, 'setup')
      );
    }
  }

  if (seedStmts.length > 0) {
    await db.batch(seedStmts);
  }

  return { criado: !jaExiste };
}

async function logAcao(db, usuario, acao, entidade, entidadeId, detalhes) {
  try {
    await db.prepare(
      'INSERT INTO Log (ID, Timestamp, UsuarioID, Email, Acao, Entidade, EntidadeID, Detalhes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      novoId(),
      agora(),
      usuario ? String(usuario.ID || '') : '',
      usuario ? String(usuario.Email || '') : '',
      String(acao || ''),
      String(entidade || ''),
      String(entidadeId || ''),
      detalhes ? String(detalhes) : ''
    ).run();
  } catch (e) {
    // Log nunca deve interromper a operacao principal
  }
}

/* =====================================================================
 * AUTENTICACAO E PERMISSOES
 * ===================================================================== */
export async function autenticar(db, req) {
  const token = String(req?.token || '').trim();
  if (!token) throw erroObj('Sessao expirada. Faca login novamente.', 'NAO_AUTENTICADO');

  const sessao = await db.prepare('SELECT * FROM Sessoes WHERE Token = ? LIMIT 1').bind(token).first();
  if (!sessao || String(sessao.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Sessao invalida. Faca login novamente.', 'NAO_AUTENTICADO');
  }
  if (!sessao.ExpiraEm || String(sessao.ExpiraEm) < agora()) {
    throw erroObj('Sessao expirada. Faca login novamente.', 'NAO_AUTENTICADO');
  }

  const u = await db.prepare('SELECT * FROM Acessos WHERE ID = ? LIMIT 1').bind(sessao.UsuarioID).first();
  if (!u) throw erroObj('Usuario nao encontrado.', 'NAO_AUTENTICADO');
  if (String(u.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Usuario desativado. Procure o administrador.', 'SEM_PERMISSAO');
  }

  return { token, usuario: u, sessao };
}

function exigirPerfil(ctx, perfis) {
  const p = String(ctx.usuario.Perfil || '').toLowerCase();
  if (!perfis.includes(p)) {
    throw erroObj(`Seu perfil (${ctx.usuario.Perfil}) nao permite esta operacao.`, 'SEM_PERMISSAO');
  }
}

/* =====================================================================
 * ROTEADOR DE ACOES DA API
 * ===================================================================== */
export async function executarRequisicao(req, env) {
  const acao = String(req?.acao || req?.action || '').trim().toLowerCase();

  if (acao === 'ping') {
    return { ok: true, ping: agora(), servidor: TZ, banco: 'Cloudflare D1' };
  }

  const db = obterDB(env);

  if (acao === 'status') {
    return await acaoStatus(db);
  }

  // Garante que as tabelas e seeds existam no D1 antes das operacoes
  await garantirBanco(db);

  if (acao === 'criarplanilha' || acao === 'inicializar') {
    return await acaoCriarPlanilha(db, req);
  }
  if (acao === 'login') {
    return await acaoLogin(db, req);
  }
  if (acao === 'criaradmininicial') {
    return await acaoCriarAdminInicial(db, req);
  }

  const ctx = await autenticar(db, req);
  return await executarAcaoAutenticada(db, acao, req, ctx);
}

async function executarAcaoAutenticada(db, acao, req, ctx) {
  switch (acao) {
    case 'bootstrap': return await acaoBootstrap(db, ctx);
    case 'logout': return await acaoLogout(db, ctx);

    case 'salvarlancamento': return await acaoSalvarLancamento(db, req, ctx);
    case 'excluirlancamento': return await acaoExcluirLancamento(db, req, ctx);
    case 'salvarcategoria': return await acaoSalvarCategoria(db, req, ctx);
    case 'excluircategoria': return await acaoExcluirCategoria(db, req, ctx);
    case 'salvarconta': return await acaoSalvarConta(db, req, ctx);
    case 'excluirconta': return await acaoExcluirConta(db, req, ctx);
    case 'salvarcaixinha': return await acaoSalvarCaixinha(db, req, ctx);
    case 'excluircaixinha': return await acaoExcluirCaixinha(db, req, ctx);
    case 'movimentarcaixinha': return await acaoMovimentarCaixinha(db, req, ctx);
    case 'excluirmovimentacao': return await acaoExcluirMovimentacao(db, req, ctx);

    case 'salvarusuario': return await acaoSalvarUsuario(db, req, ctx);
    case 'listarusuarios': return await acaoListarUsuarios(db, ctx);
    case 'excluirusuario': return await acaoExcluirUsuario(db, req, ctx);
    case 'trocarsenha': return await acaoTrocarSenha(db, req, ctx);
    case 'salvarconfig': return await acaoSalvarConfig(db, req, ctx);
    case 'limpar': return await acaoLimpar(db, req, ctx);

    default:
      throw erroObj(`Acao desconhecida: ${acao}`, 'ACAO_INVALIDA');
  }
}

/* =====================================================================
 * IMPLEMENTACAO DAS ACOES
 * ===================================================================== */
async function acaoStatus(db) {
  const agora_ = agora();
  if (!db) {
    return {
      ok: true,
      semPlanilha: true,
      semBanco: true,
      erro: 'Banco D1 nao vinculado ao Worker (adicione o binding DB nas configuracoes do Worker).',
      pronto: false,
      temUsuarios: false,
      usuarios: 0,
      agora: agora_
    };
  }

  try {
    await garantirBanco(db);
    const nomes = Object.keys(SCHEMA);
    const abas = [];
    for (const nome of nomes) {
      const r = await db.prepare(`SELECT COUNT(*) AS n FROM ${nome}`).first();
      abas.push({ nome, existe: true, linhas: Number(r?.n || 0) });
    }
    const usuarios = abas.find((a) => a.nome === 'Acessos')?.linhas || 0;

    return {
      ok: true,
      semPlanilha: false,
      banco: 'Cloudflare D1',
      planilha: 'Cloudflare D1',
      planilhaId: 'd1',
      planilhaUrl: '',
      abas,
      usuarios,
      temUsuarios: usuarios > 0,
      pronto: usuarios > 0,
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

async function acaoCriarPlanilha(db, req) {
  const res = await garantirBanco(db);
  const nome = String(req?.nome || '').trim() || 'Cloudflare D1';
  const rUser = await db.prepare('SELECT COUNT(*) AS n FROM Acessos').first();
  const temAdmin = Number(rUser?.n || 0) > 0;
  const abas = Object.keys(SCHEMA);

  await logAcao(db, null, 'criarplanilha', 'BancoD1', 'd1', res.criado ? 'Banco inicializado' : 'Banco ja existia');

  return {
    ok: true,
    criado: res.criado,
    planilha: nome,
    id: 'd1',
    url: '',
    abas,
    temAdmin
  };
}

async function acaoBootstrap(db, ctx) {
  const u = ctx.usuario;
  const [resCfg, resCat, resCnt, resLanc, resCx, resMov] = await db.batch([
    db.prepare('SELECT * FROM Config'),
    db.prepare('SELECT * FROM Categorias'),
    db.prepare('SELECT * FROM Contas'),
    db.prepare('SELECT * FROM Lancamentos'),
    db.prepare('SELECT * FROM Caixinhas'),
    db.prepare('SELECT * FROM Movimentacoes')
  ]);

  const config = {};
  for (const row of (resCfg.results || [])) {
    config[String(row.Chave || '').trim()] = String(row.Valor ?? '');
  }

  return {
    ok: true,
    usuario: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil },
    config,
    categorias: (resCat.results || []).map((r) => normalizarLinha('Categorias', r)),
    contas: (resCnt.results || []).map((r) => normalizarLinha('Contas', r)),
    lancamentos: (resLanc.results || []).map((r) => normalizarLinha('Lancamentos', r)),
    caixinhas: (resCx.results || []).map((r) => normalizarLinha('Caixinhas', r)),
    movimentacoes: (resMov.results || []).map((r) => normalizarLinha('Movimentacoes', r)),
    agora: agora()
  };
}

async function acaoLogin(db, req) {
  const email = String(req?.email || '').trim().toLowerCase();
  const senha = String(req?.senha || '');

  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Acessos').first();
  if (Number(cnt?.n || 0) === 0) {
    throw erroObj('Nenhum usuario cadastrado no banco. Crie o acesso administrador inicial na tela de login.', 'SEM_USUARIOS');
  }
  if (!email || !senha) throw erroObj('Informe e-mail e senha.', 'DADOS');

  const u = await db.prepare('SELECT * FROM Acessos WHERE LOWER(Email) = ? LIMIT 1').bind(email).first();
  if (!u) throw erroObj('Usuario nao encontrado.', 'CREDENCIAIS');
  if (String(u.Ativo || '').toUpperCase() !== 'SIM') {
    throw erroObj('Usuario desativado. Procure o administrador.', 'CREDENCIAIS');
  }
  if (!(await validarSenha(senha, u))) {
    throw erroObj('Senha incorreta.', 'CREDENCIAIS');
  }

  const token = gerarSalt() + gerarSalt();
  const expira = new Date(Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000);
  const expiraStr = fmtDataHora(expira);
  const agoraStr = agora();

  await db.batch([
    db.prepare(
      'INSERT INTO Sessoes (ID, Token, UsuarioID, Email, CriadoEm, ExpiraEm, Ativo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(novoId(), token, u.ID, u.Email, agoraStr, expiraStr, 'SIM'),
    db.prepare('UPDATE Acessos SET UltimoAcesso = ? WHERE ID = ?').bind(agoraStr, u.ID)
  ]);

  await logAcao(db, u, 'login', 'Acessos', u.ID, 'Login realizado');

  return {
    ok: true,
    token,
    expiraEm: expiraStr,
    usuario: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil }
  };
}

async function acaoCriarAdminInicial(db, req) {
  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Acessos').first();
  if (Number(cnt?.n || 0) > 0) {
    throw erroObj('Ja existe usuario cadastrado. Use o painel de Acessos.', 'JA_EXISTE');
  }

  const nome = String(req?.nome || '').trim();
  const email = String(req?.email || '').trim().toLowerCase();
  const senha = String(req?.senha || '');

  if (!nome || !email) throw erroObj('Informe nome e e-mail.', 'DADOS');
  if (senha.length < 6) throw erroObj('A senha precisa de 6 caracteres ou mais.', 'DADOS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erroObj('E-mail invalido.', 'DADOS');

  const salt = gerarSalt();
  const senhaHash = await hashSenha(senha, salt);
  const id = novoId();
  const criadoEm = agora();

  await db.prepare(
    'INSERT INTO Acessos (ID, Nome, Email, Perfil, Ativo, Salt, SenhaHash, CriadoEm, UltimoAcesso, Obs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, nome, email, 'admin', 'SIM', salt, senhaHash, criadoEm, '', 'Admin inicial').run();

  const u = { ID: id, Nome: nome, Email: email, Perfil: 'admin' };
  await logAcao(db, u, 'criar', 'Acessos', id, 'Administrador inicial criado pelo app');

  return { ok: true, usuario: u };
}

async function acaoLogout(db, ctx) {
  await db.prepare('DELETE FROM Sessoes WHERE ID = ?').bind(ctx.sessao.ID).run();
  await logAcao(db, ctx.usuario, 'logout', 'Acessos', ctx.usuario.ID, '');
  return { ok: true };
}

/* --------------------------- lancamentos ---------------------------- */
async function acaoSalvarLancamento(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const d = req?.dados || {};

  const dataObj = parseData(d.Data);
  if (!dataObj) throw erroObj('Informe uma data valida.', 'DADOS');

  const valor = Number(String(d.Valor === undefined || d.Valor === null ? '' : d.Valor).replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) throw erroObj('O valor deve ser maior que zero.', 'DADOS');

  const descricao = String(d.Descricao || '').trim();
  if (!descricao) throw erroObj('Informe uma descricao.', 'DADOS');

  const tipo = String(d.Tipo || '').toLowerCase() === 'receita' ? 'Receita' : 'Despesa';
  const parcelas = Math.max(1, Math.min(60, parseInt(d.Parcelas || 1, 10) || 1));
  const valorArredondado = Math.round(valor * 100) / 100;

  const existente = d.ID
    ? await db.prepare('SELECT * FROM Lancamentos WHERE ID = ? LIMIT 1').bind(String(d.ID)).first()
    : null;

  const base = {
    Data: fmtData(dataObj),
    Tipo: tipo,
    Valor: valorArredondado,
    Descricao: descricao,
    CategoriaID: String(d.CategoriaID || ''),
    ContaID: String(d.ContaID || ''),
    FormaPagamento: String(d.FormaPagamento || 'Outro'),
    Parcelas: parcelas,
    ParcelaAtual: Math.max(1, parseInt(d.ParcelaAtual || 1, 10) || 1),
    Status: String(d.Status || 'Pago'),
    Recorrente: (d.Recorrente === true || String(d.Recorrente).toUpperCase() === 'SIM') ? 'SIM' : 'NAO',
    Fixo: (d.Fixo === true || String(d.Fixo).toUpperCase() === 'SIM') ? 'SIM' : 'NAO',
    Competencia: competenciaDe(dataObj),
    CaixinhaID: String(d.CaixinhaID || ''),
    GrupoParcelas: String(d.GrupoParcelas || ''),
    Obs: String(d.Obs || ''),
    AtualizadoEm: agora(),
    CriadoPor: ctx.usuario.Email
  };

  if (existente) {
    const id = existente.ID;
    const criadoEm = existente.CriadoEm || agora();
    const criadoPor = existente.CriadoPor || ctx.usuario.Email;
    const grupo = base.GrupoParcelas || String(existente.GrupoParcelas || '');

    await db.prepare(
      `UPDATE Lancamentos SET
        Data = ?, Tipo = ?, Valor = ?, Descricao = ?, CategoriaID = ?, ContaID = ?,
        FormaPagamento = ?, Parcelas = ?, ParcelaAtual = ?, Status = ?, Recorrente = ?,
        Fixo = ?, Competencia = ?, CaixinhaID = ?, GrupoParcelas = ?, Obs = ?,
        CriadoEm = ?, AtualizadoEm = ?, CriadoPor = ?
      WHERE ID = ?`
    ).bind(
      base.Data, base.Tipo, base.Valor, base.Descricao, base.CategoriaID, base.ContaID,
      base.FormaPagamento, base.Parcelas, base.ParcelaAtual, base.Status, base.Recorrente,
      base.Fixo, base.Competencia, base.CaixinhaID, grupo, base.Obs,
      criadoEm, base.AtualizadoEm, criadoPor, id
    ).run();

    await logAcao(db, ctx.usuario, 'editar', 'Lancamentos', id, `${base.Descricao} - ${valorArredondado}`);
    return { ok: true, id };
  }

  if (parcelas > 1) {
    const grupo = novoId();
    const ids = [];
    const stmts = [];
    const criadoEm = agora();

    for (let i = 0; i < parcelas; i++) {
      const id = novoId();
      const dtParcela = addMesesData(dataObj, i);
      const dataStr = fmtData(dtParcela);
      const compStr = competenciaDe(dtParcela);
      ids.push(id);
      stmts.push(
        db.prepare(
          `INSERT INTO Lancamentos (
            ID, Data, Tipo, Valor, Descricao, CategoriaID, ContaID, FormaPagamento,
            Parcelas, ParcelaAtual, Status, Recorrente, Fixo, Competencia, CaixinhaID,
            GrupoParcelas, Obs, CriadoEm, AtualizadoEm, CriadoPor
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, dataStr, base.Tipo, base.Valor, base.Descricao, base.CategoriaID, base.ContaID,
          base.FormaPagamento, parcelas, i + 1, base.Status, base.Recorrente, base.Fixo,
          compStr, base.CaixinhaID, grupo, base.Obs, criadoEm, base.AtualizadoEm, base.CriadoPor
        )
      );
    }

    await db.batch(stmts);
    await logAcao(db, ctx.usuario, 'criar', 'Lancamentos', grupo, `${parcelas} parcelas de ${valorArredondado}`);
    return { ok: true, ids, grupo };
  }

  const id = novoId();
  const criadoEm = agora();
  await db.prepare(
    `INSERT INTO Lancamentos (
      ID, Data, Tipo, Valor, Descricao, CategoriaID, ContaID, FormaPagamento,
      Parcelas, ParcelaAtual, Status, Recorrente, Fixo, Competencia, CaixinhaID,
      GrupoParcelas, Obs, CriadoEm, AtualizadoEm, CriadoPor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, base.Data, base.Tipo, base.Valor, base.Descricao, base.CategoriaID, base.ContaID,
    base.FormaPagamento, base.Parcelas, base.ParcelaAtual, base.Status, base.Recorrente,
    base.Fixo, base.Competencia, base.CaixinhaID, base.GrupoParcelas, base.Obs,
    criadoEm, base.AtualizadoEm, base.CriadoPor
  ).run();

  await logAcao(db, ctx.usuario, 'criar', 'Lancamentos', id, `${base.Descricao} - ${valorArredondado}`);
  return { ok: true, id };
}

async function acaoExcluirLancamento(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const id = String(req?.id || '').trim();
  if (!id) throw erroObj('Informe o ID do lancamento.', 'DADOS');

  const alvo = await db.prepare('SELECT * FROM Lancamentos WHERE ID = ? LIMIT 1').bind(id).first();
  if (!alvo) throw erroObj('Lancamento nao encontrado.', 'NAO_ENCONTRADO');

  let removidas = 1;
  if (req?.excluirGrupo && alvo.GrupoParcelas) {
    const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Lancamentos WHERE GrupoParcelas = ?')
      .bind(String(alvo.GrupoParcelas)).first();
    removidas = Number(cnt?.n || 1);
    await db.prepare('DELETE FROM Lancamentos WHERE GrupoParcelas = ?').bind(String(alvo.GrupoParcelas)).run();
  } else {
    await db.prepare('DELETE FROM Lancamentos WHERE ID = ?').bind(id).run();
  }

  await logAcao(db, ctx.usuario, 'excluir', 'Lancamentos', id, `Linhas removidas: ${removidas}`);
  return { ok: true, removidas };
}

/* --------------------------- categorias ----------------------------- */
async function acaoSalvarCategoria(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const d = req?.dados || {};
  const nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da categoria.', 'DADOS');
  const tipo = String(d.Tipo || 'Despesa') === 'Receita' ? 'Receita' : 'Despesa';

  const duplicada = await db.prepare('SELECT * FROM Categorias WHERE LOWER(Nome) = ? LIMIT 1')
    .bind(nome.toLowerCase()).first();
  if (duplicada && String(duplicada.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe uma categoria com esse nome.', 'DUPLICADO');
  }

  const id = d.ID ? String(d.ID) : novoId();
  const grupo = String(d.Grupo || '').trim();
  const cor = String(d.Cor || '#64748b');
  const orcamento = Math.round((Number(String(d.OrcamentoMensal || 0).replace(',', '.')) || 0) * 100) / 100;
  const ativo = (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM';
  const obs = String(d.Obs || '');
  const criadoEm = d.CriadoEm ? fmtDataHora(d.CriadoEm) : agora();

  await db.prepare(
    `INSERT INTO Categorias (ID, Nome, Tipo, Grupo, Cor, OrcamentoMensal, Ativo, Obs, CriadoEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ID) DO UPDATE SET
       Nome = excluded.Nome, Tipo = excluded.Tipo, Grupo = excluded.Grupo,
       Cor = excluded.Cor, OrcamentoMensal = excluded.OrcamentoMensal,
       Ativo = excluded.Ativo, Obs = excluded.Obs`
  ).bind(id, nome, tipo, grupo, cor, orcamento, ativo, obs, criadoEm).run();

  await logAcao(db, ctx.usuario, 'salvar', 'Categorias', id, nome);
  return { ok: true, id };
}

async function acaoExcluirCategoria(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const id = String(req?.id || '').trim();
  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Lancamentos WHERE CategoriaID = ?').bind(id).first();
  const emUso = Number(cnt?.n || 0);
  if (emUso > 0) {
    throw erroObj(`Esta categoria esta em uso por ${emUso} lancamento(s). Desative-a em vez de excluir.`, 'EM_USO');
  }
  await db.prepare('DELETE FROM Categorias WHERE ID = ?').bind(id).run();
  await logAcao(db, ctx.usuario, 'excluir', 'Categorias', id, '');
  return { ok: true };
}

/* --------------------------- contas --------------------------------- */
async function acaoSalvarConta(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const d = req?.dados || {};
  const nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da conta.', 'DADOS');

  const duplicada = await db.prepare('SELECT * FROM Contas WHERE LOWER(Nome) = ? LIMIT 1')
    .bind(nome.toLowerCase()).first();
  if (duplicada && String(duplicada.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe uma conta com esse nome.', 'DUPLICADO');
  }

  const id = d.ID ? String(d.ID) : novoId();
  const tipo = String(d.Tipo || 'Conta Corrente');
  const inst = String(d.Instituicao || '').trim();
  const limite = Math.round((Number(String(d.Limite || 0).replace(',', '.')) || 0) * 100) / 100;
  const diaVenc = parseInt(d.DiaVencimento || 0, 10) || 0;
  const cor = String(d.Cor || '#3b82f6');
  const ativo = (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM';
  const obs = String(d.Obs || '');
  const criadoEm = d.CriadoEm ? fmtDataHora(d.CriadoEm) : agora();

  await db.prepare(
    `INSERT INTO Contas (ID, Nome, Tipo, Instituicao, Limite, DiaVencimento, Cor, Ativo, Obs, CriadoEm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ID) DO UPDATE SET
       Nome = excluded.Nome, Tipo = excluded.Tipo, Instituicao = excluded.Instituicao,
       Limite = excluded.Limite, DiaVencimento = excluded.DiaVencimento,
       Cor = excluded.Cor, Ativo = excluded.Ativo, Obs = excluded.Obs`
  ).bind(id, nome, tipo, inst, limite, diaVenc, cor, ativo, obs, criadoEm).run();

  await logAcao(db, ctx.usuario, 'salvar', 'Contas', id, nome);
  return { ok: true, id };
}

async function acaoExcluirConta(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const id = String(req?.id || '').trim();
  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Lancamentos WHERE ContaID = ?').bind(id).first();
  const emUso = Number(cnt?.n || 0);
  if (emUso > 0) {
    throw erroObj(`Esta conta esta em uso por ${emUso} lancamento(s). Desative-a em vez de excluir.`, 'EM_USO');
  }
  await db.prepare('DELETE FROM Contas WHERE ID = ?').bind(id).run();
  await logAcao(db, ctx.usuario, 'excluir', 'Contas', id, '');
  return { ok: true };
}

/* --------------------------- caixinhas ------------------------------ */
async function acaoSalvarCaixinha(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const d = req?.dados || {};
  const nome = String(d.Nome || '').trim();
  if (!nome) throw erroObj('Informe o nome da caixinha.', 'DADOS');

  const id = d.ID ? String(d.ID) : novoId();
  const desc = String(d.Descricao || '').trim();
  const meta = Math.round((Number(String(d.Meta || 0).replace(',', '.')) || 0) * 100) / 100;
  const prazo = String(d.Prazo || '').trim();
  const saldoInicial = Math.round((Number(String(d.SaldoInicial || 0).replace(',', '.')) || 0) * 100) / 100;
  const cor = String(d.Cor || '#22c55e');
  const ativo = (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM';
  const criadoEm = d.CriadoEm ? fmtDataHora(d.CriadoEm) : agora();

  await db.prepare(
    `INSERT INTO Caixinhas (ID, Nome, Descricao, Meta, Prazo, SaldoInicial, Cor, Ativo, CriadoEm, CriadoPor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ID) DO UPDATE SET
       Nome = excluded.Nome, Descricao = excluded.Descricao, Meta = excluded.Meta,
       Prazo = excluded.Prazo, SaldoInicial = excluded.SaldoInicial,
       Cor = excluded.Cor, Ativo = excluded.Ativo`
  ).bind(id, nome, desc, meta, prazo, saldoInicial, cor, ativo, criadoEm, ctx.usuario.Email).run();

  await logAcao(db, ctx.usuario, 'salvar', 'Caixinhas', id, nome);
  return { ok: true, id };
}

async function acaoExcluirCaixinha(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const id = String(req?.id || '').trim();
  const cnt = await db.prepare('SELECT COUNT(*) AS n FROM Movimentacoes WHERE CaixinhaID = ?').bind(id).first();
  const movs = Number(cnt?.n || 0);

  await db.batch([
    db.prepare('DELETE FROM Movimentacoes WHERE CaixinhaID = ?').bind(id),
    db.prepare('DELETE FROM Caixinhas WHERE ID = ?').bind(id)
  ]);

  await logAcao(db, ctx.usuario, 'excluir', 'Caixinhas', id, `${movs} movimentacao(oes) removida(s)`);
  return { ok: true, movsRemovidas: movs };
}

async function acaoMovimentarCaixinha(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const d = req?.dados || {};
  const idCaixinha = String(d.CaixinhaID || '').trim();
  if (!idCaixinha) throw erroObj('Informe a caixinha.', 'DADOS');

  const cx = await db.prepare('SELECT ID FROM Caixinhas WHERE ID = ? LIMIT 1').bind(idCaixinha).first();
  if (!cx) throw erroObj('Caixinha nao encontrada.', 'NAO_ENCONTRADO');

  const valor = Number(String(d.Valor || 0).replace(',', '.'));
  if (!isFinite(valor) || valor <= 0) throw erroObj('O valor deve ser maior que zero.', 'DADOS');
  const valorArredondado = Math.round(valor * 100) / 100;

  const dataStr = fmtData(parseData(d.Data) || new Date());
  const tipo = String(d.Tipo || '').toLowerCase().includes('sai') ? 'Saida' : 'Entrada';
  const id = novoId();

  await db.prepare(
    `INSERT INTO Movimentacoes (ID, CaixinhaID, Data, Tipo, Valor, Descricao, Origem, LancamentoID, CriadoEm, CriadoPor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, idCaixinha, dataStr, tipo, valorArredondado,
    String(d.Descricao || '').trim(),
    String(d.Origem || 'Manual'),
    String(d.LancamentoID || ''),
    agora(),
    ctx.usuario.Email
  ).run();

  await logAcao(db, ctx.usuario, 'movimentar', 'Caixinhas', idCaixinha, `${tipo} ${valorArredondado}`);
  return { ok: true, id };
}

async function acaoExcluirMovimentacao(db, req, ctx) {
  exigirPerfil(ctx, ['admin', 'editor']);
  const id = String(req?.id || '').trim();
  await db.prepare('DELETE FROM Movimentacoes WHERE ID = ?').bind(id).run();
  await logAcao(db, ctx.usuario, 'excluir', 'Movimentacoes', id, '');
  return { ok: true };
}

/* --------------------------- usuarios ------------------------------- */
async function acaoSalvarUsuario(db, req, ctx) {
  exigirPerfil(ctx, ['admin']);
  const d = req?.dados || {};

  const nome = String(d.Nome || '').trim();
  const email = String(d.Email || '').trim().toLowerCase();
  if (!nome) throw erroObj('Informe o nome.', 'DADOS');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erroObj('Informe um e-mail valido.', 'DADOS');

  const existente = d.ID
    ? await db.prepare('SELECT * FROM Acessos WHERE ID = ? LIMIT 1').bind(String(d.ID)).first()
    : null;
  const outro = await db.prepare('SELECT * FROM Acessos WHERE LOWER(Email) = ? LIMIT 1').bind(email).first();
  if (outro && String(outro.ID) !== String(d.ID || '')) {
    throw erroObj('Ja existe um usuario com esse e-mail.', 'DUPLICADO');
  }

  const perfil = ['admin', 'editor', 'leitor'].includes(String(d.Perfil || '').toLowerCase())
    ? String(d.Perfil).toLowerCase()
    : 'leitor';
  const ativo = (d.Ativo === false || String(d.Ativo).toUpperCase() === 'NAO') ? 'NAO' : 'SIM';

  const id = existente ? existente.ID : novoId();
  let salt = existente ? existente.Salt : '';
  let senhaHash = existente ? existente.SenhaHash : '';

  const senha = String(d.Senha || '');
  if (senha) {
    if (senha.length < 6) throw erroObj('A senha precisa de 6 caracteres ou mais.', 'DADOS');
    salt = gerarSalt();
    senhaHash = await hashSenha(senha, salt);
    if (existente) {
      await db.prepare('DELETE FROM Sessoes WHERE UsuarioID = ?').bind(existente.ID).run();
    }
  } else if (!existente) {
    throw erroObj('Defina uma senha para o novo usuario.', 'DADOS');
  }

  const obs = String(d.Obs ?? (existente ? existente.Obs : ''));
  const criadoEm = existente ? (existente.CriadoEm || agora()) : agora();
  const ultimoAcesso = existente ? (existente.UltimoAcesso || '') : '';

  await db.prepare(
    `INSERT INTO Acessos (ID, Nome, Email, Perfil, Ativo, Salt, SenhaHash, CriadoEm, UltimoAcesso, Obs)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(ID) DO UPDATE SET
       Nome = excluded.Nome, Email = excluded.Email, Perfil = excluded.Perfil,
       Ativo = excluded.Ativo, Salt = excluded.Salt, SenhaHash = excluded.SenhaHash,
       Obs = excluded.Obs`
  ).bind(id, nome, email, perfil, ativo, salt, senhaHash, criadoEm, ultimoAcesso, obs).run();

  await logAcao(db, ctx.usuario, 'salvar', 'Acessos', id, `${email} (${perfil})`);
  return { ok: true, id };
}

async function acaoListarUsuarios(db, ctx) {
  exigirPerfil(ctx, ['admin']);
  const res = await db.prepare('SELECT * FROM Acessos').all();
  const usuarios = (res.results || []).map((u) => ({
    ID: String(u.ID || ''),
    Nome: String(u.Nome || ''),
    Email: String(u.Email || ''),
    Perfil: String(u.Perfil || 'leitor'),
    Ativo: String(u.Ativo || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
    Obs: String(u.Obs || ''),
    CriadoEm: u.CriadoEm ? fmtDataHora(u.CriadoEm) : '',
    UltimoAcesso: u.UltimoAcesso ? fmtDataHora(u.UltimoAcesso) : ''
  }));
  return { ok: true, usuarios };
}

async function acaoExcluirUsuario(db, req, ctx) {
  exigirPerfil(ctx, ['admin']);
  const id = String(req?.id || '').trim();
  if (id === String(ctx.usuario.ID)) {
    throw erroObj('Voce nao pode excluir o proprio usuario.', 'DADOS');
  }
  await db.batch([
    db.prepare('DELETE FROM Sessoes WHERE UsuarioID = ?').bind(id),
    db.prepare('DELETE FROM Acessos WHERE ID = ?').bind(id)
  ]);
  await logAcao(db, ctx.usuario, 'excluir', 'Acessos', id, '');
  return { ok: true };
}

async function acaoTrocarSenha(db, req, ctx) {
  const atual = String(req?.senhaAtual || '');
  const nova = String(req?.senhaNova || '');
  if (nova.length < 6) throw erroObj('A nova senha precisa de 6 caracteres ou mais.', 'DADOS');
  if (!(await validarSenha(atual, ctx.usuario))) {
    throw erroObj('Senha atual incorreta.', 'CREDENCIAIS');
  }

  const salt = gerarSalt();
  const senhaHash = await hashSenha(nova, salt);

  await db.batch([
    db.prepare('UPDATE Acessos SET Salt = ?, SenhaHash = ? WHERE ID = ?').bind(salt, senhaHash, ctx.usuario.ID),
    db.prepare('DELETE FROM Sessoes WHERE UsuarioID = ?').bind(ctx.usuario.ID)
  ]);

  await logAcao(db, ctx.usuario, 'senha', 'Acessos', ctx.usuario.ID, 'Senha alterada');
  return { ok: true, mensagem: 'Senha alterada. Faca login novamente.' };
}

/* --------------------------- config / manutencao -------------------- */
async function acaoSalvarConfig(db, req, ctx) {
  exigirPerfil(ctx, ['admin']);
  const chave = String(req?.chave || '').trim();
  if (!chave) throw erroObj('Informe a chave de configuracao.', 'DADOS');
  const valor = String(req?.valor === undefined || req?.valor === null ? '' : req.valor);

  const atual = await db.prepare('SELECT * FROM Config WHERE LOWER(Chave) = ? LIMIT 1')
    .bind(chave.toLowerCase()).first();
  const id = atual ? atual.ID : novoId();
  const desc = atual ? (atual.Descricao || '') : '';

  await db.prepare(
    `INSERT INTO Config (ID, Chave, Valor, Descricao) VALUES (?, ?, ?, ?)
     ON CONFLICT(Chave) DO UPDATE SET Valor = excluded.Valor`
  ).bind(id, atual ? atual.Chave : chave, valor, desc).run();

  await logAcao(db, ctx.usuario, 'config', 'Config', chave, valor);
  return { ok: true };
}

async function acaoLimpar(db, req, ctx) {
  exigirPerfil(ctx, ['admin']);
  if (String(req?.confirmar || '') !== 'APAGAR TUDO') {
    throw erroObj('Confirmacao invalida. Digite exatamente APAGAR TUDO.', 'DADOS');
  }

  const [c1, c2, c3] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM Lancamentos'),
    db.prepare('SELECT COUNT(*) AS n FROM Movimentacoes'),
    db.prepare('SELECT COUNT(*) AS n FROM Caixinhas')
  ]);
  const total = Number(c1.results?.[0]?.n || 0) +
                Number(c2.results?.[0]?.n || 0) +
                Number(c3.results?.[0]?.n || 0);

  await db.batch([
    db.prepare('DELETE FROM Lancamentos'),
    db.prepare('DELETE FROM Movimentacoes'),
    db.prepare('DELETE FROM Caixinhas')
  ]);

  await logAcao(db, ctx.usuario, 'limpar', 'Lancamentos', '', `${total} linhas removidas`);
  return { ok: true, removidas: total };
}

/* =====================================================================
 * HANDLER HTTP DO CLOUDFLARE WORKER
 * ===================================================================== */
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const isApiRoute = url.pathname === '/api' || url.pathname.startsWith('/api/');

    if (request.method === 'POST') {
      let req = {};
      try {
        const raw = await request.text();
        req = JSON.parse(raw || '{}');
      } catch (e) {
        return jsonResponse({
          ok: false,
          erro: 'Requisicao invalida (JSON malformado).',
          codigo: 'JSON_INVALIDO'
        });
      }

      try {
        const res = await executarRequisicao(req, env);
        return jsonResponse(res);
      } catch (err) {
        return jsonResponse({
          ok: false,
          erro: err?.message || 'Erro inesperado no servidor.',
          codigo: err?.codigo || 'ERRO'
        });
      }
    }

    // Se o Worker tambem serve os arquivos estaticos do site (Cloudflare Workers Assets)
    if (request.method === 'GET' && !isApiRoute && env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    // GET na rota da API (ou na raiz quando implantado como Worker puro de API)
    return jsonResponse({
      ok: true,
      app: 'Controle Financeiro',
      versao: '2.0.0',
      banco: 'Cloudflare D1',
      dica: 'Use POST (JSON) para as operacoes. Ver docs/API.md.'
    });
  }
};
