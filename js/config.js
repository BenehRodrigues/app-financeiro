/* ============================================================
 *  config.js — Configuração do Gestor Financeiro
 * ------------------------------------------------------------
 *  EDITE ESTE ARQUIVO após publicar o Apps Script.
 *  Nunca compartilhe uma chave real em repositório público
 *  sem entender que a chave fica visível no código do cliente.
 * ============================================================ */

const CONFIG = {
  /* Planilha Google (banco de dados) */
  SPREADSHEET_ID: '10WvCuo2yuY6RIjlMN54xERbHCsZReDkdkZt6NuZrJ5s',

  /* URL do Web App do Google Apps Script (após "Implantar > Nova implantação")
   * Cole aqui o endereço terminado em /exec */
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/SEU_CODIGO_AQUI/exec',

  /* Chave compartilhada com o Apps Script (Script Property: APP_KEY).
   * Troque por uma string aleatória e use a MESMA no Code.gs */
  APP_KEY: 'trocar-esta-chave-secreta-em-2026',

  /* Abas da planilha */
  SHEET_LANCAMENTOS: 'Lançamentos',
  SHEET_DASHBOARD: 'Dashboard',
  SHEET_CAIXINHA: 'Caixinha',

  /* Células da aba Dashboard */
  DASH_SALDO_LIQUIDO: 'C21',      // Saldo Líquido Mensal
  DASH_RESERVA_INICIAL: 'C22',    // Caixa / Reserva Inicial (editável no app)

  /* Comportamento */
  META_MESES_PADRAO: 6,           // meta da caixinha em meses de gasto
  MESES_PROJECAO: 12,             // horizonte da projeção
  MESES_GRAFICO: 12,              // meses exibidos no gráfico mensal
  MESES_MEDIA: 3,                 // meses usados para a média de projeção

  /* Formatação */
  LOCALE: 'pt-BR',
  CURRENCY: 'BRL',
  TIMEZONE: 'America/Sao_Paulo'
};

/* Tipos de lançamento permitidos */
const TIPOS_LANCAMENTO = [
  'Receita',
  'Gasto Fixo',
  'Gasto Variável',
  'Cartão de Crédito',
  'Empréstimo'
];

/* Categorias sugeridas por tipo (o usuário pode digitar outras) */
const CATEGORIAS_SUGERIDAS = {
  'Receita': ['Salário', 'Comissão', 'Bônus', '13º Salário', 'Vale Alimentação', 'Aluguel', 'Outros'],
  'Gasto Fixo': ['Moradia', 'Serviços', 'Saúde', 'Consórcio', 'DAS', 'Educação', 'Transporte', 'Outros'],
  'Gasto Variável': ['Estética', 'Alimentação', 'Lazer', 'Compras', 'Viagem', 'Outros'],
  'Cartão de Crédito': ['Cartão de Crédito'],
  'Empréstimo': ['Consignado', 'Financiamento', 'Empréstimo Pessoal']
};
