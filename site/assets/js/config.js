/* =====================================================================
 * config.js — configuracoes estaticas e valores vindos do Cloudflare D1
 * ===================================================================== */

/**
 * URL da API do Cloudflare Worker.
 *
 * - Se voce publicar o site + API juntos no Cloudflare Workers, o app
 *   detecta automaticamente "/api" na mesma origem.
 * - Se voce publicar o site no GitHub Pages e a API no Cloudflare Workers,
 *   voce pode colar a URL do Worker (ex.: "https://app-financeiro.seu-nome.workers.dev/api")
 *   aqui em API_URL_PADRAO ou direto na tela inicial do app.
 */
export const API_URL_PADRAO = 'https://app-financeiro.beneditorodrigues-dev.workers.dev/api';

/** Configuracoes vindas da tabela "Config" do banco D1 (sincronizadas pelo store). */
export const CONFIG = {
  nome_app: 'Controle Financeiro',
  simbolo_moeda: 'R$',
  locale: 'pt-BR',
  mostrar_centavos: 'SIM',
  atualizacao_auto_seg: '60',
  permitir_parcelas: 'SIM',
  tema_padrao: 'escuro',
  cor_primaria: '#22c55e',
  alerta_saldo_negativo: 'SIM',
  mostrar_projecao: 'SIM'
};

export function aplicarConfig(novo) {
  Object.assign(CONFIG, novo || {});
  return CONFIG;
}

export const CHAVES = {
  TOKEN: 'fin.token',
  USUARIO: 'fin.usuario',
  API_URL: 'fin.apiUrl',
  TEMA: 'fin.tema',
  MES: 'fin.mes'
};

export const TABELAS = {
  LANCAMENTOS: 'Lancamentos',
  CATEGORIAS: 'Categorias',
  CONTAS: 'Contas',
  CAIXINHAS: 'Caixinhas',
  MOVIMENTACOES: 'Movimentacoes',
  ACESSOS: 'Acessos',
  CONFIG: 'Config'
};

export const FORMAS_PAGAMENTO = ['Débito', 'Crédito', 'Pix', 'Dinheiro', 'Boleto', 'Transferência', 'Outro'];
export const STATUS = ['Pago', 'Pendente', 'Aguardando', 'Cancelado'];
export const TIPOS_CONTA = ['Conta Corrente', 'Poupança', 'Cartão de Crédito', 'Carteira', 'Investimento', 'Outro'];
export const PERFIS = ['admin', 'editor', 'leitor'];
export const GRUPOS_DESPESA = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Educação', 'Compras', 'Taxas', 'Outros'];
export const GRUPOS_RECEITA = ['Renda', 'Extras', 'Investimentos', 'Outros'];
