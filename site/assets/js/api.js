/* =====================================================================
 * api.js — cliente do Web App do Google Apps Script
 *
 * Observacao importante: usamos Content-Type "text/plain" (nao
 * "application/json") para evitar o preflight CORS, que o Google
 * Apps Script nao responde. O corpo continua sendo JSON puro.
 * ===================================================================== */
import { API_URL_PADRAO, CHAVES } from './config.js';

export function getApiUrl() {
  return localStorage.getItem(CHAVES.API_URL) || API_URL_PADRAO || '';
}

export function setApiUrl(url) {
  const limpo = String(url || '').trim();
  if (limpo) localStorage.setItem(CHAVES.API_URL, limpo);
  else localStorage.removeItem(CHAVES.API_URL);
  return limpo;
}

export function getToken() {
  return localStorage.getItem(CHAVES.TOKEN) || '';
}

export function setToken(t) {
  if (t) localStorage.setItem(CHAVES.TOKEN, t);
  else localStorage.removeItem(CHAVES.TOKEN);
}

export class ErroApi extends Error {
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo || 'ERRO';
  }
}

/**
 * Chama a API.
 * @param {string} acao  nome da acao (ex.: 'login', 'bootstrap')
 * @param {object} dados parametros extras
 */
export async function chamar(acao, dados = {}) {
  const url = getApiUrl();
  if (!url) {
    throw new ErroApi('API nao configurada. Informe a URL do Web App do Apps Script.', 'SEM_API');
  }

  const corpo = JSON.stringify({ acao, token: getToken(), ...dados });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);

  let resposta;
  try {
    resposta = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: corpo,
      signal: ctrl.signal,
      redirect: 'follow'
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new ErroApi('A requisicao demorou demais. Verifique sua conexao.', 'TIMEOUT');
    }
    throw new ErroApi('Nao foi possivel falar com o servidor. Verifique a URL da API.', 'SEM_CONEXAO');
  }
  clearTimeout(timer);

  const texto = await resposta.text();
  let dadosResp;
  try {
    dadosResp = JSON.parse(texto);
  } catch (e) {
    throw new ErroApi(
      'Resposta invalida do servidor. A URL da API deve apontar para ".../exec" do Web App publicado.',
      'RESPOSTA_INVALIDA'
    );
  }

  if (!dadosResp.ok) {
    throw new ErroApi(dadosResp.erro || 'Erro desconhecido no servidor.', dadosResp.codigo);
  }
  return dadosResp;
}
