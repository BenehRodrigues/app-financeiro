/* =====================================================================
 * api.js — cliente HTTP da API (Cloudflare Workers + D1)
 *
 * Usamos Content-Type "text/plain;charset=utf-8" com corpo JSON para
 * evitar preflight CORS desnecessario quando o front-end roda no
 * GitHub Pages apontando para o Worker na Cloudflare.
 * ===================================================================== */
import { API_URL_PADRAO, CHAVES } from './config.js';

function normalizarUrlApi(url) {
  const limpo = String(url || '').trim();
  if (!limpo) return '';
  if (limpo.startsWith('/')) return limpo;
  try {
    const u = new URL(limpo);
    if ((u.hostname.endsWith('.workers.dev') || u.hostname.endsWith('.pages.dev')) && (u.pathname === '/' || u.pathname === '')) {
      u.pathname = '/api';
      return u.toString();
    }
  } catch (e) { /* mantem como esta */ }
  return limpo;
}

export function getApiUrl() {
  const salvo = localStorage.getItem(CHAVES.API_URL);
  if (salvo && !salvo.includes('script.google.com')) {
    return normalizarUrlApi(salvo);
  }
  if (salvo && salvo.includes('script.google.com')) {
    localStorage.removeItem(CHAVES.API_URL);
  }
  if (API_URL_PADRAO) return normalizarUrlApi(API_URL_PADRAO);

  // Se o front-end estiver hospedado direto no Cloudflare Workers/Pages, usa /api na mesma origem
  if (typeof location !== 'undefined' && (location.hostname.endsWith('.workers.dev') || location.hostname.endsWith('.pages.dev'))) {
    return `${location.origin}/api`;
  }
  return '';
}

export function setApiUrl(url) {
  const limpo = normalizarUrlApi(url);
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
 * Chama a API no Cloudflare Worker.
 * @param {string} acao  nome da acao (ex.: 'login', 'bootstrap')
 * @param {object} dados parametros extras
 */
export async function chamar(acao, dados = {}) {
  const url = getApiUrl();
  if (!url) {
    throw new ErroApi('API nao configurada. Informe a URL do seu Cloudflare Worker.', 'SEM_API');
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
      'Resposta invalida do servidor. Confira se a URL aponta para o seu Cloudflare Worker.',
      'RESPOSTA_INVALIDA'
    );
  }

  if (!dadosResp.ok) {
    const msg = dadosResp.erro || dadosResp.error || 'Erro desconhecido no servidor.';
    throw new ErroApi(msg, dadosResp.codigo || dadosResp.code || 'ERRO');
  }
  return dadosResp;
}
