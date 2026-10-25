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

-- Configurações padrão
INSERT OR IGNORE INTO Config (ID, Chave, Valor, Descricao) VALUES
  ('cfg-1', 'nome_app', 'Controle Financeiro', 'Nome exibido no topo do app'),
  ('cfg-2', 'simbolo_moeda', 'R$', 'Símbolo usado para formatar valores'),
  ('cfg-3', 'locale', 'pt-BR', 'Formato de data e número'),
  ('cfg-4', 'mostrar_centavos', 'SIM', 'Mostrar centavos nos valores'),
  ('cfg-5', 'atualizacao_auto_seg', '60', 'Atualização automática da tela (segundos). 0 = desliga'),
  ('cfg-6', 'permitir_parcelas', 'SIM', 'Permitir lançamentos parcelados'),
  ('cfg-7', 'tema_padrao', 'escuro', 'escuro | claro'),
  ('cfg-8', 'cor_primaria', '#22c55e', 'Cor de destaque do app'),
  ('cfg-9', 'alerta_saldo_negativo', 'SIM', 'Destacar saldo negativo no painel'),
  ('cfg-10', 'mostrar_projecao', 'SIM', 'Exibir projeção de gastos fixos/recorrentes');

-- Contas padrão
INSERT OR IGNORE INTO Contas (ID, Nome, Tipo, Instituicao, Limite, DiaVencimento, Cor, Ativo, Obs, CriadoEm) VALUES
  ('cnt-01', 'Conta Corrente', 'Conta Corrente', '', 0, 0, '#3b82f6', 'SIM', '', datetime('now')),
  ('cnt-02', 'Poupança', 'Poupança', '', 0, 0, '#22c55e', 'SIM', '', datetime('now')),
  ('cnt-03', 'Cartão de Crédito', 'Cartão de Crédito', '', 0, 10, '#f43f5e', 'SIM', '', datetime('now')),
  ('cnt-04', 'Carteira', 'Carteira', '', 0, 0, '#eab308', 'SIM', '', datetime('now'));

-- Caixinhas padrão
INSERT OR IGNORE INTO Caixinhas (ID, Nome, Descricao, Meta, Prazo, SaldoInicial, Cor, Ativo, CriadoEm, CriadoPor) VALUES
  ('cx-01', 'Reserva de Emergência', 'Gasto inesperado', 12000, '', 0, '#22c55e', 'SIM', datetime('now'), 'setup'),
  ('cx-02', 'Viagem', 'Fundo para viagens', 5000, '', 0, '#0ea5e9', 'SIM', datetime('now'), 'setup'),
  ('cx-03', 'Investimentos', 'Aportes para investimento', 30000, '', 0, '#a855f7', 'SIM', datetime('now'), 'setup');
