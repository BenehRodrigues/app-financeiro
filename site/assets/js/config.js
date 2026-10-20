/* =====================================================================
 * config.js — configuracoes estaticas e valores vindos da planilha
 * ===================================================================== */

/**
 * URL do Web App do Google Apps Script.
 *两种 formas de configurar:
 *  1) Preencher aqui antes de publicar (recomendado, evita digitar no celular)
 *  2) Deixar vazio e colar a URL pela tela de login (fica salva no navegador)
 */
export const API_URL_PADRAO = '';

/** Configuracoes vindas da aba "Config" da planilha (sincronizadas pelo store). */
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

export const FORMAS_PAGAMENTO = ['Debito', 'Credito', 'Pix', 'Dinheiro', 'Boleto', 'Transferencia', 'Outro'];
export const STATUS = ['Pago', 'Pendente', 'Aguardando', 'Cancelado'];
export const TIPOS_CONTA = ['Conta Corrente', 'Poupanca', 'Cartao de Credito', 'Carteira', 'Investimento', 'Outro'];
export const PERFIS = ['admin', 'editor', 'leitor'];
export const GRUPOS_DESPESA = ['Moradia', 'Alimentacao', 'Transporte', 'Lazer', 'Saude', 'Educacao', 'Compras', 'Taxas', 'Outros'];
export const GRUPOS_RECEITA = ['Renda', 'Extras', 'Investimentos', 'Outros'];
