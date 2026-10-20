/* =====================================================================
 * store.js — estado central do app (fonte unica de verdade)
 * ===================================================================== */
import { chamar, setToken, getToken, ErroApi } from './api.js';
import { aplicarConfig, CHAVES } from './config.js';

const estado = {
  usuario: null,
  config: {},
  categorias: [],
  contas: [],
  lancamentos: [],
  caixinhas: [],
  movimentacoes: [],
  carregando: false,
  ultimoSync: null,
  erro: null
};

try {
  const salvo = localStorage.getItem(CHAVES.USUARIO);
  if (salvo) estado.usuario = JSON.parse(salvo);
} catch (e) { /* ignora storage corrompido */ }

const assinantes = new Set();

export const store = {
  get estado() { return estado; },

  subscribe(fn) {
    assinantes.add(fn);
    return () => assinantes.delete(fn);
  },

  emitir() {
    assinantes.forEach((fn) => { try { fn(estado); } catch (e) { console.error(e); } });
  },

  get autenticado() {
    return !!estado.usuario && !!getToken();
  },

  get podeEditar() {
    const p = String(estado.usuario?.Perfil || '').toLowerCase();
    return p === 'admin' || p === 'editor';
  },

  get ehAdmin() {
    return String(estado.usuario?.Perfil || '').toLowerCase() === 'admin';
  },

  /* ------------------------------ login ---------------------------- */
  async login(email, senha) {
    const r = await chamar('login', { email, senha });
    setToken(r.token);
    estado.usuario = r.usuario;
    localStorage.setItem(CHAVES.USUARIO, JSON.stringify(r.usuario));
    await this.carregar();
    return r;
  },

  async logout() {
    try { await chamar('logout'); } catch (e) { /* ignora */ }
    setToken('');
    localStorage.removeItem(CHAVES.USUARIO);
    estado.usuario = null;
    estado.lancamentos = [];
    estado.categorias = [];
    estado.contas = [];
    estado.caixinhas = [];
    estado.movimentacoes = [];
    this.emitir();
  },

  /* ------------------------------ carga ---------------------------- */
  async carregar() {
    const r = await chamar('bootstrap');
    estado.usuario = r.usuario;
    estado.config = r.config || {};
    estado.categorias = r.categorias || [];
    estado.contas = r.contas || [];
    estado.lancamentos = r.lancamentos || [];
    estado.caixinhas = r.caixinhas || [];
    estado.movimentacoes = r.movimentacoes || [];
    estado.ultimoSync = new Date();
    estado.erro = null;
    aplicarConfig(estado.config);
    localStorage.setItem(CHAVES.USUARIO, JSON.stringify(estado.usuario));
    this.emitir();
    return r;
  },

  /**
   * Executa uma acao no servidor e recarrega os dados.
   * @param {string} acao nome da acao
   * @param {object} dados parametros
   */
  async acao(acao, dados = {}) {
    const r = await chamar(acao, dados);
    await this.carregar();
    return r;
  },

  /* ------------------------------ cache --------------------------- */
  categoriaPorId(id) {
    return estado.categorias.find((c) => c.ID === id) || null;
  },

  contaPorId(id) {
    return estado.contas.find((c) => c.ID === id) || null;
  },

  caixinhaPorId(id) {
    return estado.caixinhas.find((c) => c.ID === id) || null;
  },

  nomeCategoria(id) {
    const c = this.categoriaPorId(id);
    return c ? c.Nome : 'Sem categoria';
  },

  nomeConta(id) {
    const c = this.contaPorId(id);
    return c ? c.Nome : 'Sem conta';
  }
};

export { ErroApi };
