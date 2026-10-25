/* =====================================================================
 * views/login.js — tela de login e cadastro do administrador inicial
 * ===================================================================== */
import { esc, icone } from '../utils.js';
import { chamar } from '../api.js';
import { toast } from '../ui.js';

let modo = 'login';           // login | admin
let mensagem = '';
let subMensagem = '';
let criando = false;

function rerender() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = mod.render();
  mod.afterRender();
}

let mod = null;

const view = {
  titulo: 'Entrar',

  render() {
    if (modo === 'admin') return this.renderAdmin();
    return this.renderLogin();
  },

  /** Botao de tema, disponivel tambem antes do login. */
  botaoTema() {
    const claro = document.documentElement.getAttribute('data-tema') === 'claro';
    return `<button type="button" class="btn-icone login-tema" data-action="tema-tela"
      title="${claro ? 'Mudar para o tema escuro' : 'Mudar para o tema claro'}"
      aria-label="Alternar tema">${icone(claro ? 'lua' : 'sol')}</button>`;
  },

  afterRender() {
    const f = document.getElementById('form-login');
    if (f) {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        this.actions.entrar(f);
      });
    }
    const fad = document.getElementById('form-admin');
    if (fad) {
      fad.addEventListener('submit', (e) => {
        e.preventDefault();
        this.actions.criarAdmin(fad);
      });
    }
  },

  /* --------------------------- telas ------------------------------- */
  renderLogin() {
    return `
      <div class="login-wrap">
        <div class="login-card">
          ${this.botaoTema()}
          <div class="login-logo">₣</div>
          <h1>Controle Financeiro</h1>
          <p class="sub">Entre com o seu e-mail e senha cadastrados.</p>

          ${mensagem ? `<div class="toast erro" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('alerta')}</span><span>${esc(mensagem)}</span></div>` : ''}

          <form id="form-login" class="login-acoes" style="gap:14px">
            <div class="campo">
              <label class="campo-rotulo" for="email">E-mail</label>
              <input class="input" id="email" name="email" type="email" autocomplete="username"
                     placeholder="voce@email.com" required>
            </div>
            <div class="campo">
              <label class="campo-rotulo" for="senha">Senha</label>
              <input class="input" id="senha" name="senha" type="password" autocomplete="current-password"
                     placeholder="••••••••" required>
            </div>
            <button class="btn btn-primario btn-bloco" type="submit" ${criando ? 'disabled' : ''}>
              ${criando ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
            <button class="link-btn" data-action="tela-admin">Primeiro acesso? Criar administrador</button>
          </div>
        </div>
      </div>`;
  },

  renderAdmin() {
    return `
      <div class="login-wrap">
        <div class="login-card">
          ${this.botaoTema()}
          <div class="login-logo">₣</div>
          <h1>Criar acesso administrador</h1>
          <p class="sub">Crie o primeiro usuario administrador do sistema.</p>

          ${mensagem ? `<div class="toast erro" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('alerta')}</span><span>${esc(mensagem)}</span></div>` : ''}
          ${subMensagem ? `<div class="toast info" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('info')}</span><span>${esc(subMensagem)}</span></div>` : ''}

          <form id="form-admin" style="display:grid;gap:14px">
            <div class="campo">
              <label class="campo-rotulo" for="nome">Nome</label>
              <input class="input" id="nome" name="nome" required placeholder="Seu nome">
            </div>
            <div class="campo">
              <label class="campo-rotulo" for="adm-email">E-mail (login)</label>
              <input class="input" id="adm-email" name="email" type="email" required placeholder="voce@email.com">
            </div>
            <div class="campo">
              <label class="campo-rotulo" for="adm-senha">Senha (minimo 6 caracteres)</label>
              <input class="input" id="adm-senha" name="senha" type="password" required minlength="6">
            </div>
            <button class="btn btn-primario btn-bloco" type="submit" ${criando ? 'disabled' : ''}>
              ${criando ? 'Criando…' : 'Criar administrador'}
            </button>
            <button class="link-btn" type="button" data-action="tela-login">Voltar para o login</button>
          </form>
        </div>
      </div>`;
  },

  /* --------------------------- acoes ------------------------------- */
  actions: {
    'tema-tela'() {
      const claro = document.documentElement.getAttribute('data-tema') === 'claro';
      document.documentElement.setAttribute('data-tema', claro ? 'escuro' : 'claro');
      localStorage.setItem('fin.tema', claro ? 'escuro' : 'claro');
      rerender();
    },

    async entrar(form) {
      const email = form.email.value.trim();
      const senha = form.senha.value;
      if (!email || !senha) return;
      criando = true;
      mensagem = '';
      rerender();
      try {
        const { store } = await import('../store.js');
        await store.login(email, senha);
        window.location.reload();
      } catch (e) {
        mensagem = e.message || 'Nao foi possivel entrar.';
        if (e.codigo === 'SEM_USUARIOS') modo = 'admin';
      } finally {
        criando = false;
      }
      rerender();
    },

    'tela-login'() {
      modo = 'login';
      mensagem = '';
      rerender();
    },

    'tela-admin'() {
      modo = 'admin';
      mensagem = '';
      rerender();
    },

    async criarAdmin(form) {
      const nome = form.nome.value.trim();
      const email = form.email.value.trim();
      const senha = form.senha.value;
      criando = true;
      mensagem = '';
      rerender();
      try {
        await chamar('criaradmininicial', { nome, email, senha });
        toast('Administrador criado! Agora faca o login.', 'sucesso');
        modo = 'login';
        mensagem = '';
      } catch (e) {
        mensagem = e.message;
      } finally {
        criando = false;
      }
      rerender();
    }
  }
};

mod = view;
export default view;
