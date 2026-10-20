/* =====================================================================
 * views/acessos.js — controle de usuarios (somente admin)
 * ===================================================================== */
import { esc, icone, dataBR } from '../utils.js';
import { store } from '../store.js';
import { toast, confirmar, abrirModal, fecharModal, comBotao } from '../ui.js';
import { PERFIS } from '../config.js';
import { chamar } from '../api.js';

let listaUsuarios = [];

export default {
  titulo: 'Acessos',

  render(ctx) {
    if (!store.ehAdmin) {
      return `<div class="pagina"><div class="card"><div class="vazio">
        <div class="icone">🔒</div>
        <h3>Area restrita</h3>
        <p>Somente administradores podem gerenciar acessos.</p>
      </div></div></div>`;
    }

    const linhas = listaUsuarios.length ? listaUsuarios : [];

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Controle de acesso</h1>
            <p>Usuarios autorizados a usar o app. Os dados vivem na aba <b>Acessos</b> da planilha.</p>
          </div>
          <div class="pagina-acoes">
            <button class="btn btn-pequeno" data-action="recarregar">${icone('atualizar')} Atualizar</button>
            <button class="btn btn-primario" data-action="novo">${icone('somar')} Novo usuario</button>
          </div>
        </div>

        <div class="card">
          ${linhas.length ? `
          <div class="tabela-wrap">
            <table class="tabela">
              <thead><tr>
                <th>Nome</th><th>E-mail</th><th style="width:110px">Perfil</th>
                <th style="width:100px">Situacao</th><th style="width:140px">Ultimo acesso</th><th style="width:150px"></th>
              </tr></thead>
              <tbody>
                ${linhas.map((u) => `
                  <tr>
                    <td style="font-weight:550">${esc(u.Nome)}
                      ${u.ID === store.estado.usuario?.ID ? '<span class="badge">voce</span>' : ''}</td>
                    <td class="num-pequeno">${esc(u.Email)}</td>
                    <td><span class="badge badge-${esc(u.Perfil)}">${esc(u.Perfil)}</span></td>
                    <td><span class="badge ${u.Ativo === 'SIM' ? 'badge-pago' : 'badge-pendente'}">${u.Ativo === 'SIM' ? 'ativo' : 'inativo'}</span></td>
                    <td class="num-pequeno">${u.UltimoAcesso ? esc(dataBR(String(u.UltimoAcesso).slice(0, 10))) : 'nunca'}</td>
                    <td class="acoes-celula">
                      <button class="btn-icone" data-action="editar" data-id="${u.ID}" title="Editar">${icone('editar')}</button>
                      <button class="btn-icone" data-action="alternar" data-id="${u.ID}" title="${u.Ativo === 'SIM' ? 'Desativar' : 'Ativar'}">${icone(u.Ativo === 'SIM' ? 'alerta' : 'ok')}</button>
                      ${u.ID === store.estado.usuario?.ID ? '' : `<button class="btn-icone" data-action="excluir" data-id="${u.ID}" title="Excluir">${icone('excluir')}</button>`}
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `
          <div class="vazio">
            <div class="icone">👥</div>
            <h3>Nenhum usuario listado</h3>
            <p>Clique em “Atualizar” para carregar a lista de acessos da planilha.</p>
          </div>`}
        </div>

        <div class="card card-pad">
          <h3 style="font-size:14.5px;margin-bottom:8px">Perfis de acesso</h3>
          <div class="grid grid-3">
            <div>
              <span class="badge badge-admin">admin</span>
              <p class="num-pequeno" style="margin-top:6px">Acesso total: usuarios, configuracoes, lancamentos e limpeza de dados.</p>
            </div>
            <div>
              <span class="badge badge-editor">editor</span>
              <p class="num-pequeno" style="margin-top:6px">Cria, edita e exclui lancamentos, categorias, contas e caixinhas.</p>
            </div>
            <div>
              <span class="badge badge-leitor">leitor</span>
              <p class="num-pequeno" style="margin-top:6px">Somente visualizacao e exportacao. Nao altera nada.</p>
            </div>
          </div>
        </div>
      </div>`;
  },

  afterRender() {
    if (store.ehAdmin && !listaUsuarios.length) this.actions.recarregar();
  },

  actions: {
    async recarregar() {
      try {
        const r = await chamar('listarusuarios');
        listaUsuarios = r.usuarios || [];
        window.dispatchEvent(new CustomEvent('app:repintar'));
      } catch (e) {
        toast(e.message, 'erro');
      }
    },

    novo() { abrirFormulario(null); },

    editar(el) {
      const u = listaUsuarios.find((x) => x.ID === el.dataset.id);
      if (u) abrirFormulario(u);
    },

    async alternar(el) {
      const u = listaUsuarios.find((x) => x.ID === el.dataset.id);
      if (!u) return;
      const novo = u.Ativo === 'SIM' ? 'NAO' : 'SIM';
      try {
        await store.acao('salvarusuario', {
          dados: { ID: u.ID, Nome: u.Nome, Email: u.Email, Perfil: u.Perfil, Ativo: novo }
        });
        await this.recarregar();
        toast(novo === 'SIM' ? 'Usuario ativado.' : 'Usuario desativado.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    },

    async excluir(el) {
      const u = listaUsuarios.find((x) => x.ID === el.dataset.id);
      if (!u) return;
      const ok = await confirmar({
        titulo: 'Excluir usuario',
        mensagem: `Excluir o acesso de "${u.Nome}" (${u.Email})? As sessoes ativas dele serao encerradas.`,
        textoOk: 'Excluir', perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluirusuario', { id: u.ID });
        await this.recarregar();
        toast('Usuario excluido.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    }
  }
};

function abrirFormulario(u) {
  const edicao = !!(u && u.ID);
  const d = u || { Nome: '', Email: '', Perfil: 'editor', Ativo: 'SIM', Obs: '' };

  const corpo = `
    <form id="form-user" style="display:grid;gap:14px">
      <input type="hidden" name="ID" value="${esc(d.ID || '')}">
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="u-nome">Nome <span class="obrig">*</span></label>
          <input class="input" id="u-nome" name="Nome" maxlength="80" value="${esc(d.Nome || '')}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="u-email">E-mail (login) <span class="obrig">*</span></label>
          <input class="input" id="u-email" name="Email" type="email" maxlength="120" value="${esc(d.Email || '')}" required>
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="u-perfil">Perfil</label>
          <select class="select" id="u-perfil" name="Perfil">
            ${PERFIS.map((p) => `<option value="${p}" ${d.Perfil === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="u-senha">${edicao ? 'Nova senha (em branco = manter)' : 'Senha'} ${edicao ? '' : '<span class="obrig">*</span>'}</label>
          <input class="input" id="u-senha" name="Senha" type="password" minlength="6" autocomplete="new-password">
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="u-obs">Observacao</label>
          <input class="input" id="u-obs" name="Obs" maxlength="200" value="${esc(d.Obs || '')}">
        </div>
        <div class="campo" style="justify-content:flex-end;gap:10px">
          <label class="checkbox"><input type="checkbox" name="Ativo" ${d.Ativo === 'SIM' ? 'checked' : ''}> Ativo</label>
        </div>
      </div>
      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: edicao ? 'Editar usuario' : 'Novo usuario',
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Salvar</button>`
  });

  const form = dlg.querySelector('#form-user');
  const erro = dlg.querySelector('#erro-form');
  const btn = dlg.querySelector('[data-salvar]');

  btn.addEventListener('click', async () => {
    const fd = new FormData(form);
    const dados = {
      ID: fd.get('ID') || '',
      Nome: String(fd.get('Nome') || '').trim(),
      Email: String(fd.get('Email') || '').trim(),
      Perfil: fd.get('Perfil'),
      Ativo: form.querySelector('[name=Ativo]').checked ? 'SIM' : 'NAO',
      Obs: String(fd.get('Obs') || '').trim(),
      Senha: String(fd.get('Senha') || '')
    };
    if (!dados.Nome) { erro.textContent = 'Informe o nome.'; return; }
    if (!dados.Email) { erro.textContent = 'Informe o e-mail.'; return; }
    if (!edicao && !dados.Senha) { erro.textContent = 'Defina uma senha.'; return; }
    if (dados.Senha && dados.Senha.length < 6) { erro.textContent = 'A senha precisa de 6 caracteres ou mais.'; return; }

    await comBotao(btn, async () => {
      try {
        await store.acao('salvarusuario', { dados });
        fecharModal();
        toast('Usuario salvo!', 'sucesso');
        const r = await chamar('listarusuarios');
        listaUsuarios = r.usuarios || [];
        window.dispatchEvent(new CustomEvent('app:repintar'));
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}
