/* =====================================================================
 * app.js — bootstrap, shell da aplicacao, rotas e eventos globais
 * ===================================================================== */
import { store } from './store.js';
import { CONFIG, CHAVES } from './config.js';
import { esc, icone, mesExtenso, mesBR, mesAtual, addMeses, iniciais } from './utils.js';
import { toast, abrirModal, fecharModal, confirmar, comBotao } from './ui.js';
import { getApiUrl, setApiUrl, chamar } from './api.js';

import login from './views/login.js';
import dashboard from './views/dashboard.js';
import lancamentos from './views/lancamentos.js';
import categorias from './views/categorias.js';
import contas from './views/contas.js';
import caixinhas from './views/caixinhas.js';
import relatorios from './views/relatorios.js';
import acessos from './views/acessos.js';
import config from './views/config.js';

const VIEWS = {
  dashboard, lancamentos, categorias, contas, caixinhas, relatorios, acessos, config
};

const NAV = [
  { chave: 'dashboard', rotulo: 'Painel', icone: 'painel' },
  { chave: 'lancamentos', rotulo: 'Lancamentos', icone: 'lancamentos' },
  { chave: 'caixinhas', rotulo: 'Caixinhas', icone: 'caixinhas' },
  { chave: 'relatorios', rotulo: 'Relatorios', icone: 'relatorios' },
  { chave: 'categorias', rotulo: 'Categorias', icone: 'categorias' },
  { chave: 'contas', rotulo: 'Contas', icone: 'contas' },
  { chave: 'acessos', rotulo: 'Acessos', icone: 'acessos', admin: true },
  { chave: 'config', rotulo: 'Configuracoes', icone: 'config', admin: true }
];

const NAV_MOBILE = ['dashboard', 'lancamentos', 'caixinhas', 'relatorios'];

let viewAtual = null;
let modoShell = false;
let mesSelecionado = localStorage.getItem(CHAVES.MES) || mesAtual();

/* ---------------------------------------------------------------------
 * Inicializacao
 * ------------------------------------------------------------------- */
async function iniciar() {
  // tema: preferencia local > configuracao da planilha > padrao do app
  aplicarTema(localStorage.getItem(CHAVES.TEMA) || CONFIG.tema_padrao || 'escuro');

  if (!getApiUrl() || !store.autenticado) {
    modoShell = false;
    viewAtual = login;
    document.getElementById('app').innerHTML = login.render();
    login.afterRender();
    return;
  }

  try {
    await store.carregar();
  } catch (e) {
    await store.logout();
    modoShell = false;
    viewAtual = login;
    document.getElementById('app').innerHTML = login.render();
    login.afterRender();
    return;
  }

  // a planilha pode definir outro tema padrao (Config.tema_padrao)
  if (!localStorage.getItem(CHAVES.TEMA)) {
    aplicarTema(CONFIG.tema_padrao || 'escuro');
  }

  modoShell = true;
  montarShell();
  store.subscribe(() => { if (modoShell) render(); });
  window.addEventListener('hashchange', render);
  window.addEventListener('app:repintar', render);
  iniciarAutoRefresh();
  render();
}

/* ---------------------------------------------------------------------
 * Shell
 * ------------------------------------------------------------------- */
function montarShell() {
  const app = document.getElementById('app');
  app.className = '';
  app.innerHTML = `
    <div class="shell">
      <header class="topo">
        <button class="btn-icone" data-action="abrir-menu" aria-label="Menu" style="display:none" id="btn-menu">${icone('menu')}</button>
        <div class="topo-marca">
          <div class="topo-logo">₣</div>
          <div class="topo-titulo">
            <strong id="topo-nome">${esc(CONFIG.nome_app || 'Controle Financeiro')}</strong>
            <small id="topo-sub">${esc(store.estado.usuario?.Nome || '')}</small>
          </div>
        </div>
        <div class="topo-acoes">
          <div class="topo-mes">
            <button data-action="mes-anterior" aria-label="Mes anterior">${icone('esquerda')}</button>
            <span class="mes-label" id="topo-mes">${esc(mesBR(mesSelecionado))}</span>
            <button data-action="mes-proximo" aria-label="Proximo mes">${icone('direita')}</button>
          </div>
          <button class="btn-icone" data-action="atualizar" aria-label="Atualizar">${icone('atualizar')}</button>
          <button class="btn-icone" data-action="alternar-tema" aria-label="Alternar tema" id="btn-tema">${icone('lua')}</button>
          <div class="avatar" data-action="perfil" title="Minha conta">${esc(iniciais(store.estado.usuario?.Nome))}</div>
        </div>
      </header>

      <div class="corpo">
        <aside class="lateral" id="lateral">
          <div class="lateral-titulo">Navegacao</div>
          ${NAV.map((n) => navItem(n, false)).join('')}
        </aside>
        <main class="conteudo" id="conteudo"></main>
      </div>

      <nav class="nav-inferior">
        ${NAV_MOBILE.map((c) => navItem(NAV.find((n) => n.chave === c), true)).join('')}
        <button class="nav-item" data-action="mais">${icone('mais')}<span>Mais</span></button>
      </nav>
    </div>`;

  // no mobile, o botao de menu aparece
  const btnMenu = document.getElementById('btn-menu');
  if (btnMenu) btnMenu.style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none';
  window.addEventListener('resize', () => {
    if (btnMenu) btnMenu.style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none';
  });
}

function navItem(n, mobile) {
  if (!n) return '';
  if (n.admin && !store.ehAdmin) return '';
  return `<a class="nav-item" href="#/${n.chave}" data-nav="${n.chave}">
    ${icone(n.icone)}<span>${esc(n.rotulo)}</span>
  </a>`;
}

/* ---------------------------------------------------------------------
 * Render da rota atual
 * ------------------------------------------------------------------- */
function render() {
  if (!modoShell) return;
  const rota = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
  const view = VIEWS[rota] || VIEWS.dashboard;
  viewAtual = view;

  const ctx = {
    estado: store.estado,
    mes: mesSelecionado,
    store,
    repintar: render,
    ir: (r) => { location.hash = `#/${r}`; }
  };

  const alvo = document.getElementById('conteudo');
  if (!alvo) return;

  // preserva foco e cursor do campo que disparou o redesenho (ex.: busca)
  const ativo = document.activeElement;
  const idAtivo = ativo && ativo.id ? ativo.id : null;
  const cursor = ativo && typeof ativo.selectionStart === 'number' ? ativo.selectionStart : null;

  alvo.innerHTML = view.render(ctx);
  if (view.afterRender) view.afterRender(ctx);

  if (idAtivo) {
    const novo = document.getElementById(idAtivo);
    if (novo && typeof novo.focus === 'function') {
      novo.focus();
      if (cursor !== null && typeof novo.setSelectionRange === 'function') {
        try { novo.setSelectionRange(cursor, cursor); } catch (e) { /* ignora */ }
      }
    }
  }

  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('ativo', a.dataset.nav === rota);
  });

  const lbl = document.getElementById('topo-mes');
  if (lbl) lbl.textContent = mesBR(mesSelecionado);
  const sub = document.getElementById('topo-sub');
  if (sub) sub.textContent = `${store.estado.usuario?.Nome || ''} · ${store.estado.usuario?.Perfil || ''}`;
  const nome = document.getElementById('topo-nome');
  if (nome) nome.textContent = CONFIG.nome_app || 'Controle Financeiro';
  atualizarIconeTema();
}

/* ---------------------------------------------------------------------
 * Eventos globais
 * ------------------------------------------------------------------- */
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-action]');
  if (!alvo) return;

  const acao = alvo.dataset.action;

  if (viewAtual && viewAtual.actions && typeof viewAtual.actions[acao] === 'function') {
    e.preventDefault();
    viewAtual.actions[acao](alvo, e);
    return;
  }

  if (ACOES_GLOBAIS[acao]) {
    e.preventDefault();
    ACOES_GLOBAIS[acao](alvo, e);
    return;
  }

  // Rede de seguranca: avisa no console quando um botao aponta para
  // uma acao inexistente (ex.: "alternar-tema" x "alternarTema").
  console.warn('[app] acao sem handler:', acao, alvo);
});

const ACOES_GLOBAIS = {
  async atualizar(el) {
    const btn = el.closest('button');
    await comBotao(btn || el, async () => {
      try {
        await store.carregar();
        toast('Dados atualizados.', 'sucesso', 1800);
      } catch (e) {
        toast(e.message, 'erro');
      }
    }, 'Atualizando…');
  },

  async sair() {
    const ok = await confirmar({
      titulo: 'Sair do app',
      mensagem: 'Deseja encerrar a sessao?',
      textoOk: 'Sair'
    });
    if (!ok) return;
    await store.logout();
    window.location.reload();
  },

  'alternar-tema'() {
    const atual = document.documentElement.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro';
    aplicarTema(atual);
    localStorage.setItem(CHAVES.TEMA, atual);
    atualizarIconeTema();
  },

  'mes-anterior'() { mudarMes(-1); },
  'mes-proximo'() { mudarMes(1); },

  'abrir-menu'() {
    const l = document.getElementById('lateral');
    if (l) l.classList.toggle('aberta');
  },

  mais() { abrirMais(); },

  perfil() { abrirPerfil(); },

  'trocar-senha'() { abrirTrocaSenha(); },

  'ir-acesso'() {
    fecharModal();
    window.location.hash = '#/acessos';
  }
};

function mudarMes(delta) {
  mesSelecionado = addMeses(mesSelecionado, delta);
  localStorage.setItem(CHAVES.MES, mesSelecionado);
  render();
}

function aplicarTema(tema) {
  document.documentElement.setAttribute('data-tema', tema === 'claro' ? 'claro' : 'escuro');
  atualizarIconeTema();
}

/** O icone mostra o que sera aplicado no proximo clique. */
function atualizarIconeTema() {
  const btn = document.getElementById('btn-tema');
  if (!btn) return;
  const claro = document.documentElement.getAttribute('data-tema') === 'claro';
  btn.innerHTML = icone(claro ? 'lua' : 'sol');
  btn.title = claro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro';
}

/* ---------------------------------------------------------------------
 * Menu "mais" (mobile)
 * ------------------------------------------------------------------- */
function abrirMais() {
  const itens = NAV.filter((n) => (!n.admin || store.ehAdmin) && !NAV_MOBILE.includes(n.chave));
  const dlg = abrirModal({
    titulo: 'Mais',
    corpo: `<div class="lista">
      ${itens.map((n) => `
        <a class="lista-item" href="#/${n.chave}" data-fechar>
          <span style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--surface-3);color:var(--text-dim)">${icone(n.icone)}</span>
          <div class="principal"><div class="titulo">${esc(n.rotulo)}</div></div>
        </a>`).join('')}
    </div>`,
    rodape: `<button type="button" class="btn" data-fechar>Fechar</button>`
  });
  dlg.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => fecharModal()));
}

/* ---------------------------------------------------------------------
 * Perfil e troca de senha
 * ------------------------------------------------------------------- */
function abrirPerfil() {
  const u = store.estado.usuario || {};
  const dlg = abrirModal({
    titulo: 'Minha conta',
    corpo: `
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:18px">
        <div class="avatar" style="width:52px;height:52px;font-size:18px">${esc(iniciais(u.Nome))}</div>
        <div>
          <div style="font-weight:650;font-size:16px">${esc(u.Nome || '')}</div>
          <div class="num-pequeno">${esc(u.Email || '')} · perfil <b>${esc(u.Perfil || '')}</b></div>
        </div>
      </div>
      <div class="btn-grupo">
        <button class="btn" data-action="trocar-senha">Alterar minha senha</button>
        ${store.ehAdmin ? '<button class="btn" data-action="ir-acesso">Gerenciar acessos</button>' : ''}
        <button class="btn btn-perigo" data-action="sair">Sair</button>
      </div>`,
    rodape: `<button type="button" class="btn" data-fechar>Fechar</button>`
  });
  dlg.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => fecharModal()));
}

function abrirTrocaSenha() {
  const dlg = abrirModal({
    titulo: 'Alterar minha senha',
    corpo: `
      <form id="form-senha" style="display:grid;gap:14px">
        <div class="campo">
          <label class="campo-rotulo" for="s-atual">Senha atual</label>
          <input class="input" id="s-atual" name="senhaAtual" type="password" required autocomplete="current-password">
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="s-nova">Nova senha (minimo 6 caracteres)</label>
          <input class="input" id="s-nova" name="senhaNova" type="password" required minlength="6" autocomplete="new-password">
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="s-conf">Repetir a nova senha</label>
          <input class="input" id="s-conf" name="confirmar" type="password" required minlength="6" autocomplete="new-password">
        </div>
        <div class="erro-campo" id="erro-form"></div>
      </form>`,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Alterar senha</button>`
  });

  const form = dlg.querySelector('#form-senha');
  const erro = dlg.querySelector('#erro-form');
  const btn = dlg.querySelector('[data-salvar]');

  dlg.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => fecharModal()));

  btn.addEventListener('click', async () => {
    const fd = new FormData(form);
    const atual = String(fd.get('senhaAtual') || '');
    const nova = String(fd.get('senhaNova') || '');
    const conf = String(fd.get('confirmar') || '');

    if (nova.length < 6) { erro.textContent = 'A nova senha precisa de 6 caracteres ou mais.'; return; }
    if (nova !== conf) { erro.textContent = 'As senhas nao conferem.'; return; }

    await comBotao(btn, async () => {
      try {
        await chamar('trocarsenha', { senhaAtual: atual, senhaNova: nova });
        fecharModal();
        toast('Senha alterada. Faca login novamente.', 'sucesso');
        setTimeout(() => window.location.reload(), 1200);
      } catch (e) {
        erro.textContent = e.message;
      }
    });
  });
}

/* ---------------------------------------------------------------------
 * Atualizacao automatica
 * ------------------------------------------------------------------- */
function iniciarAutoRefresh() {
  const agendar = () => {
    const seg = parseInt(CONFIG.atualizacao_auto_seg, 10) || 0;
    const ms = seg > 0 ? seg * 1000 : 300000;
    setTimeout(async () => {
      if (modoShell && !document.hidden) {
        try { await store.carregar(); } catch (e) { /* silencioso */ }
      }
      agendar();
    }, ms);
  };
  agendar();
}

/* ---------------------------------------------------------------------
 * Start
 * ------------------------------------------------------------------- */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
