-- =====================================================================
-- schema.sql — Banco de dados Cloudflare D1 (SQLite)
-- Aplicativo: Controle Financeiro
--
-- Como executar via Wrangler CLI:
--   npx wrangler d1 execute app-financeiro-db --remote --file=./backend/schema.sql
--
-- Ou cole este conteudo no Console SQL do banco D1 no painel da Cloudflare.
-- Nota: O proprio Worker (backend/worker.js) tambem cria as tabelas e
-- popula os dados iniciais automaticamente no primeiro acesso!
-- =====================================================================

CREATE TABLE IF NOT EXISTS Config (
  ID TEXT PRIMARY KEY,
  Chave TEXT UNIQUE NOT NULL,
  Valor TEXT DEFAULT '',
  Descricao TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Acessos (
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
);

CREATE TABLE IF NOT EXISTS Categorias (
  ID TEXT PRIMARY KEY,
  Nome TEXT NOT NULL,
  Tipo TEXT NOT NULL DEFAULT 'Despesa',
  Grupo TEXT DEFAULT '',
  Cor TEXT DEFAULT '#64748b',
  OrcamentoMensal REAL DEFAULT 0,
  Ativo TEXT DEFAULT 'SIM',
  Obs TEXT DEFAULT '',
  CriadoEm TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS Contas (
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
);

CREATE TABLE IF NOT EXISTS Lancamentos (
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
);

CREATE TABLE IF NOT EXISTS Caixinhas (
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
);

CREATE TABLE IF NOT EXISTS Movimentacoes (
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
);

CREATE TABLE IF NOT EXISTS Sessoes (
  ID TEXT PRIMARY KEY,
  Token TEXT UNIQUE NOT NULL,
  UsuarioID TEXT NOT NULL,
  Email TEXT DEFAULT '',
  CriadoEm TEXT DEFAULT '',
  ExpiraEm TEXT DEFAULT '',
  Ativo TEXT DEFAULT 'SIM'
);

CREATE TABLE IF NOT EXISTS Log (
  ID TEXT PRIMARY KEY,
  Timestamp TEXT DEFAULT '',
  UsuarioID TEXT DEFAULT '',
  Email TEXT DEFAULT '',
  Acao TEXT DEFAULT '',
  Entidade TEXT DEFAULT '',
  EntidadeID TEXT DEFAULT '',
  Detalhes TEXT DEFAULT ''
);

-- Indices para consultas rapidas
CREATE INDEX IF NOT EXISTS idx_acessos_email ON Acessos(Email);
CREATE INDEX IF NOT EXISTS idx_lancamentos_competencia ON Lancamentos(Competencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON Lancamentos(Data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON Lancamentos(CategoriaID);
CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON Lancamentos(ContaID);
CREATE INDEX IF NOT EXISTS idx_lancamentos_caixinha ON Lancamentos(CaixinhaID);
CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo ON Lancamentos(GrupoParcelas);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixinha ON Movimentacoes(CaixinhaID);
CREATE INDEX IF NOT EXISTS idx_sessoes_token ON Sessoes(Token);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON Sessoes(UsuarioID);

-- Configuracoes padrao
INSERT OR IGNORE INTO Config (ID, Chave, Valor, Descricao) VALUES
  ('cfg-1', 'nome_app', 'Controle Financeiro', 'Nome exibido no topo do app'),
  ('cfg-2', 'simbolo_moeda', 'R$', 'Simbolo usado para formatar valores'),
  ('cfg-3', 'locale', 'pt-BR', 'Formato de data e numero'),
  ('cfg-4', 'mostrar_centavos', 'SIM', 'Mostrar centavos nos valores'),
  ('cfg-5', 'atualizacao_auto_seg', '60', 'Atualizacao automatica da tela (segundos). 0 = desliga'),
  ('cfg-6', 'permitir_parcelas', 'SIM', 'Permitir lancamentos parcelados'),
  ('cfg-7', 'tema_padrao', 'escuro', 'escuro | claro'),
  ('cfg-8', 'cor_primaria', '#22c55e', 'Cor de destaque do app'),
  ('cfg-9', 'alerta_saldo_negativo', 'SIM', 'Destacar saldo negativo no painel'),
  ('cfg-10', 'mostrar_projecao', 'SIM', 'Exibir projecao de gastos fixos/recorrentes');

-- Categorias padrao
INSERT OR IGNORE INTO Categorias (ID, Nome, Tipo, Grupo, Cor, OrcamentoMensal, Ativo, Obs, CriadoEm) VALUES
  ('cat-01', 'Aluguel', 'Despesa', 'Moradia', '#ef4444', 0, 'SIM', '', datetime('now')),
  ('cat-02', 'Condominio', 'Despesa', 'Moradia', '#f97316', 0, 'SIM', '', datetime('now')),
  ('cat-03', 'Energia eletrica', 'Despesa', 'Moradia', '#eab308', 0, 'SIM', '', datetime('now')),
  ('cat-04', 'Agua', 'Despesa', 'Moradia', '#38bdf8', 0, 'SIM', '', datetime('now')),
  ('cat-05', 'Gas', 'Despesa', 'Moradia', '#f59e0b', 0, 'SIM', '', datetime('now')),
  ('cat-06', 'Internet', 'Despesa', 'Moradia', '#0ea5e9', 0, 'SIM', '', datetime('now')),
  ('cat-07', 'IPTU', 'Despesa', 'Moradia', '#a855f7', 0, 'SIM', '', datetime('now')),
  ('cat-08', 'Mercado', 'Despesa', 'Alimentacao', '#22c55e', 0, 'SIM', '', datetime('now')),
  ('cat-09', 'Restaurante', 'Despesa', 'Alimentacao', '#16a34a', 0, 'SIM', '', datetime('now')),
  ('cat-10', 'Delivery', 'Despesa', 'Alimentacao', '#4ade80', 0, 'SIM', '', datetime('now')),
  ('cat-11', 'Combustivel', 'Despesa', 'Transporte', '#14b8a6', 0, 'SIM', '', datetime('now')),
  ('cat-12', 'Uber / 99', 'Despesa', 'Transporte', '#2dd4bf', 0, 'SIM', '', datetime('now')),
  ('cat-13', 'Estacionamento', 'Despesa', 'Transporte', '#64748b', 0, 'SIM', '', datetime('now')),
  ('cat-14', 'Manutencao do carro', 'Despesa', 'Transporte', '#f97316', 0, 'SIM', '', datetime('now')),
  ('cat-15', 'Cinema e lazer', 'Despesa', 'Lazer', '#ec4899', 0, 'SIM', '', datetime('now')),
  ('cat-16', 'Assinaturas', 'Despesa', 'Lazer', '#d946ef', 0, 'SIM', '', datetime('now')),
  ('cat-17', 'Viagem', 'Despesa', 'Lazer', '#f43f5e', 0, 'SIM', '', datetime('now')),
  ('cat-18', 'Farmacia', 'Despesa', 'Saude', '#22d3ee', 0, 'SIM', '', datetime('now')),
  ('cat-19', 'Plano de saude', 'Despesa', 'Saude', '#06b6d4', 0, 'SIM', '', datetime('now')),
  ('cat-20', 'Cursos', 'Despesa', 'Educacao', '#818cf8', 0, 'SIM', '', datetime('now')),
  ('cat-21', 'Compras', 'Despesa', 'Compras', '#f43f5e', 0, 'SIM', '', datetime('now')),
  ('cat-22', 'Juros do cartao', 'Despesa', 'Taxas', '#ef4444', 0, 'SIM', '', datetime('now')),
  ('cat-23', 'Impostos', 'Despesa', 'Taxas', '#b91c1c', 0, 'SIM', '', datetime('now')),
  ('cat-24', 'Outros', 'Despesa', 'Outros', '#94a3b8', 0, 'SIM', '', datetime('now')),
  ('cat-25', 'Salario', 'Receita', 'Renda', '#22c55e', 0, 'SIM', '', datetime('now')),
  ('cat-26', '13o salario', 'Receita', 'Renda', '#16a34a', 0, 'SIM', '', datetime('now')),
  ('cat-27', 'Ferias', 'Receita', 'Renda', '#4ade80', 0, 'SIM', '', datetime('now')),
  ('cat-28', 'Bonus', 'Receita', 'Extras', '#eab308', 0, 'SIM', '', datetime('now')),
  ('cat-29', 'Comissao', 'Receita', 'Extras', '#f59e0b', 0, 'SIM', '', datetime('now')),
  ('cat-30', 'Freela', 'Receita', 'Extras', '#84cc16', 0, 'SIM', '', datetime('now')),
  ('cat-31', 'Reembolso', 'Receita', 'Extras', '#a3e635', 0, 'SIM', '', datetime('now')),
  ('cat-32', 'Dividendos', 'Receita', 'Investimentos', '#2dd4bf', 0, 'SIM', '', datetime('now')),
  ('cat-33', 'Rendimentos', 'Receita', 'Investimentos', '#22d3ee', 0, 'SIM', '', datetime('now')),
  ('cat-34', 'Aportes', 'Receita', 'Investimentos', '#38bdf8', 0, 'SIM', '', datetime('now'));

-- Contas padrao
INSERT OR IGNORE INTO Contas (ID, Nome, Tipo, Instituicao, Limite, DiaVencimento, Cor, Ativo, Obs, CriadoEm) VALUES
  ('cnt-01', 'Conta Corrente', 'Conta Corrente', '', 0, 0, '#3b82f6', 'SIM', '', datetime('now')),
  ('cnt-02', 'Poupanca', 'Poupanca', '', 0, 0, '#22c55e', 'SIM', '', datetime('now')),
  ('cnt-03', 'Cartao de Credito', 'Cartao de Credito', '', 0, 10, '#f43f5e', 'SIM', '', datetime('now')),
  ('cnt-04', 'Carteira', 'Carteira', '', 0, 0, '#eab308', 'SIM', '', datetime('now'));

-- Caixinhas padrao
INSERT OR IGNORE INTO Caixinhas (ID, Nome, Descricao, Meta, Prazo, SaldoInicial, Cor, Ativo, CriadoEm, CriadoPor) VALUES
  ('cx-01', 'Reserva de Emergencia', 'Gasto inesperado', 12000, '', 0, '#22c55e', 'SIM', datetime('now'), 'setup'),
  ('cx-02', 'Viagem', 'Fundo para viagens', 5000, '', 0, '#0ea5e9', 'SIM', datetime('now'), 'setup'),
  ('cx-03', 'Investimentos', 'Aportes para investimento', 30000, '', 0, '#a855f7', 'SIM', datetime('now'), 'setup');
