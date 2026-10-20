/* =====================================================================
 * config.js — configuracoes estaticas e valores vindos da planilha
 * ===================================================================== */

/**
 * URL do Web App do Google Apps Script.
 *
 * Preenchido com a URL do seu projeto atual do Apps Script. Como o
 * endereco /macros/s/ID/exec pertence ao PROJETO do script (e nao ao
 * codigo), ele continua valido depois de publicar uma nova versao com os
 * arquivos novos de backend/.
 *
 * Se voce criar uma nova implantacao (nova URL), e so colar a nova URL na
 * tela de conexao do app — ela tem prioridade sobre este valor.
 */
export const API_URL_PADRAO = 'https://script.google.com/macros/s/AKfycbzQuY_CQCKpsbwognkCtyv-k5IR8wY_OS0QWHAoj21Bl38fQ8wbriRZadNkxGTSBK4T/exec';

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
