/* =====================================================================
 * views/login.js — assistente de conexao, inicializacao do D1 e login
 *
 * Fluxo: conectar a API -> inicializar banco (se preciso) -> criar admin -> entrar
 * ===================================================================== */
import { esc, icone } from '../utils.js';
import { getApiUrl, setApiUrl, chamar } from '../api.js';
import { CHAVES } from '../config.js';
import { toast } from '../ui.js';

let modo = 'login';           // login | api | criar-planilha | admin
let mensagem = '';
let subMensagem = '';
let criando = false;
let statusChecado = false;
let planilhaUrl = '';

function rerender() {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = mod.render();
  mod.afterRender();
}

let mod = null;

/**
 * Traduz o erro do servidor em uma dica util.
 */
function dicaDeConexao(msg) {
  const m = String(msg || '').toLowerCase();
  if (m.includes('unauthorized') || m.includes('desconhecido') || m.includes('unknown')) {
    return 'O servidor respondeu, mas parece estar desatualizado. ' +
      'Atualize o codigo do seu Cloudflare Worker com backend/worker.js e tente novamente.';
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Nao consegui falar com o servidor. Confira a URL do seu Cloudflare Worker e a sua conexao.';
  }
  return msg || 'Nao consegui falar com o servidor.';
}

const view = {
  titulo: 'Entrar',

  render() {
    const url = getApiUrl();

    if (modo === 'api' || !url) return this.renderApi();
    if (modo === 'criar-planilha') return this.renderCriarPlanilha();
    if (modo === 'admin') return this.renderAdmin();
    return this.renderLogin(url);
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
    const fa = document.getElementById('form-api');
    if (fa) {
      fa.addEventListener('submit', (e) => {
        e.preventDefault();
        this.actions.testarApi(fa);
      });
    }
    const fad = document.getElementById('form-admin');
    if (fad) {
      fad.addEventListener('submit', (e) => {
        e.preventDefault();
        this.actions.criarAdmin(fad);
      });
    }
    const fp = document.getElementById('form-planilha');
    if (fp) {
      fp.addEventListener('submit', (e) => {
        e.preventDefault();
        this.actions.criarPlanilha(fp);
      });
    }

    // ja tem API configurada: descobre em que etapa estamos
    if (getApiUrl() && !statusChecado) this.actions.checarStatus();
  },

  /* --------------------------- telas ------------------------------- */
  renderLogin(url) {
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
            <button class="link-btn" data-action="tela-admin">Criar admin inicial</button>
          </div>
        </div>
      </div>`;
  },

  renderApi() {
    return `
      <div class="login-wrap">
        <div class="login-card">
          ${this.botaoTema()}
          <div class="login-logo">₣</div>
          <h1>Conectar ao servidor</h1>
          <p class="sub">Cole a URL do seu Cloudflare Worker para conectar o app ao banco de dados D1.</p>

          ${mensagem ? `<div class="toast erro" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('alerta')}</span><span>${esc(mensagem)}</span></div>` : ''}
          ${subMensagem ? `<div class="toast info" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('info')}</span><span>${esc(subMensagem)}</span></div>` : ''}

          <form id="form-api" style="display:grid;gap:14px">
            <div class="campo">
              <label class="campo-rotulo" for="api">URL da API (Cloudflare Worker)</label>
              <input class="input" id="api" name="api" type="url" required
                     placeholder="https://app-financeiro.seu-subdominio.workers.dev/api"
                     value=""
                     autocomplete="off" spellcheck="false"
                     style="font-size:12px;font-family:var(--mono)">
              <span class="erro-campo" id="erro-api"></span>
              <span class="num-pequeno">
                O que voce digitar fica salvo apenas neste navegador. Voce tambem pode fixar a URL em <code>site/assets/js/config.js</code>.
              </span>
            </div>
            <button class="btn btn-primario btn-bloco" type="submit">Testar e salvar</button>
          </form>

          <p style="margin-top:16px;font-size:12.5px;color:var(--text-mute);line-height:1.5">
            Onde encontrar essa URL? No painel da Cloudflare em <b>Workers &amp; Pages</b> apos implantar o Worker com o banco D1 vinculado.
            Veja <b>docs/DEPLOY.md</b>.
          </p>
        </div>
      </div>`;
  },

  renderCriarPlanilha() {
    return `
      <div class="login-wrap">
        <div class="login-card">
          ${this.botaoTema()}
          <div class="login-logo">₣</div>
          <h1>Inicializar banco de dados</h1>
          <p class="sub">
            Vamos preparar as tabelas no Cloudflare D1 — categorias, contas e
            caixinhas padrao sao criadas automaticamente.
          </p>

          ${mensagem ? `<div class="toast info" style="margin-bottom:16px;position:static">
            <span class="ico">${icone('info')}</span><span>${esc(mensagem)}</span></div>` : ''}

          <form id="form-planilha" style="display:grid;gap:14px">
            <div class="campo">
              <label class="campo-rotulo" for="p-nome">Nome da organizacao / controle</label>
              <input class="input" id="p-nome" name="nome" value="Controle Financeiro" maxlength="80" required>
            </div>
            <button class="btn btn-primario btn-bloco" type="submit" ${criando ? 'disabled' : ''}>
              ${criando ? 'Inicializando…' : 'Inicializar banco D1'}
            </button>
          </form>

          <p style="margin-top:16px;font-size:12.5px;color:var(--text-mute);line-height:1.5">
            Certifique-se de que o banco D1 esta vinculado ao Worker com o nome de variavel <code>DB</code>.
          </p>
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
          <p class="sub">O banco de dados ainda nao tem nenhum usuario. Crie o primeiro acesso (administrador).</p>

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
    async checarStatus() {
      statusChecado = true;
      try {
        const r = await chamar('status');
        if (r.semPlanilha) {
          modo = 'criar-planilha';
          mensagem = r.erro || '';
        } else if (!r.temUsuarios) {
          modo = 'admin';
          mensagem = '';
        } else {
          modo = 'login';
        }
        rerender();
      } catch (e) {
        modo = getApiUrl() ? 'login' : 'api';
        mensagem = dicaDeConexao(e.message);
        rerender();
      }
    },

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
      statusChecado = true;
      rerender();
    },

    'tela-admin'() {
      modo = 'admin';
      mensagem = '';
      rerender();
    },

    'tela-api'() {
      modo = 'api';
      mensagem = '';
      statusChecado = true;
      rerender();
    },

    /** Apaga o servidor guardado (e a sessao) deste navegador. */
    'esquecer-servidor'() {
      localStorage.removeItem(CHAVES.API_URL);
      localStorage.removeItem(CHAVES.TOKEN);
      localStorage.removeItem(CHAVES.USUARIO);
      statusChecado = false;
      modo = 'api';
      mensagem = 'Servidor esquecido. Cole a URL do seu Cloudflare Worker.';
      rerender();
      toast('Servidor removido deste navegador.', 'sucesso');
    },

    async testarApi(form) {
      const url = form.api.value.trim();
      const erroEl = document.getElementById('erro-api');
      if (erroEl) erroEl.textContent = '';
      if (!url) return;

      let valida = false;
      try {
        const u = new URL(url);
        valida = (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
      } catch (e) { valida = false; }

      if (!valida) {
        if (erroEl) erroEl.textContent = 'Informe uma URL completa, comecando com https://';
        return;
      }

      const anterior = getApiUrl();
      setApiUrl(url);
      try {
        await chamar('status');
        setApiUrl(url);
        statusChecado = false;
        toast('Servidor conectado!', 'sucesso');
        await this.checarStatus();
      } catch (e) {
        setApiUrl(anterior);
        const alvo = document.getElementById('erro-api');
        if (alvo) alvo.textContent = dicaDeConexao(e.message);
      }
    },

    async criarPlanilha(form) {
      criando = true;
      mensagem = '';
      try {
        const r = await chamar('criarplanilha', { nome: String(form.nome.value || '').trim() });
        planilhaUrl = r.url || '';
        statusChecado = false;
        mensagem = r.criado
          ? 'Banco "' + r.planilha + '" inicializado e configurado.'
          : 'O banco "' + r.planilha + '" ja estava configurado.';
        modo = r.temAdmin ? 'login' : 'admin';
        if (modo === 'admin') mensagem = mensagem + ' Agora crie o acesso administrador.';
        toast(mensagem, 'sucesso');
      } catch (e) {
        mensagem = e.message;
        toast(e.message, 'erro');
      } finally {
        criando = false;
      }
      rerender();
    },

    async criarAdmin(form) {
      criando = true;
      mensagem = '';
      try {
        await chamar('criaradmininicial', {
          nome: form.nome.value.trim(),
          email: form.email.value.trim(),
          senha: form.senha.value
        });
        toast('Administrador criado! Agora faca o login.', 'sucesso');
        modo = 'login';
        mensagem = '';
        statusChecado = true;
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
