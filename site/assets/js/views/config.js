/* =====================================================================
 * views/config.js — configuracoes do app (somente admin)
 * ===================================================================== */
import { esc, icone } from '../utils.js';
import { store } from '../store.js';
import { toast, confirmar, comBotao } from '../ui.js';
import { getApiUrl } from '../api.js';

const CAMPOS = [
  { chave: 'nome_app', rotulo: 'Nome do aplicativo', tipo: 'texto' },
  { chave: 'simbolo_moeda', rotulo: 'Símbolo da moeda', tipo: 'texto', dica: 'Ex.: R$, $, EUR' },
  { chave: 'locale', rotulo: 'Formato regional', tipo: 'texto', dica: 'Ex.: pt-BR, en-US' },
  { chave: 'mostrar_centavos', rotulo: 'Mostrar centavos', tipo: 'bool' },
  { chave: 'atualizacao_auto_seg', rotulo: 'Atualização automática (segundos)', tipo: 'texto', dica: '0 desliga a atualização automática' },
  { chave: 'permitir_parcelas', rotulo: 'Permitir parcelamento', tipo: 'bool' },
  { chave: 'tema_padrao', rotulo: 'Tema padrão', tipo: 'texto', dica: 'escuro ou claro' },
  { chave: 'cor_primaria', rotulo: 'Cor primária', tipo: 'texto', dica: 'Ex.: #22c55e' },
  { chave: 'alerta_saldo_negativo', rotulo: 'Destacar saldo negativo', tipo: 'bool' },
  { chave: 'mostrar_projecao', rotulo: 'Exibir projeção no painel', tipo: 'bool' }
];

export default {
  titulo: 'Configurações',

  render(ctx) {
    if (!store.ehAdmin) {
      return `<div class="pagina"><div class="card"><div class="vazio">
        <div class="icone">⚙️</div><h3>Área restrita</h3>
        <p>Somente administradores podem alterar as configurações.</p>
      </div></div></div>`;
    }

    const cfg = store.estado.config || {};
    const url = getApiUrl();

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Configurações</h1>
            <p>Valores salvos na tabela <b>Config</b> do banco Cloudflare D1 e aplicados a todos os usuários.</p>
          </div>
          <div class="pagina-acoes">
            <button class="btn btn-primario" data-action="salvar">${icone('ok')} Salvar</button>
          </div>
        </div>

        <div class="card card-pad">
          <form id="form-config">
            <div class="grid grid-2">
              ${CAMPOS.map((c) => `
                <div class="campo">
                  <label class="campo-rotulo" for="cfg-${c.chave}">${esc(c.rotulo)}</label>
                  ${c.tipo === 'bool' ? `
                    <label class="checkbox">
                      <input type="checkbox" id="cfg-${c.chave}" name="${c.chave}" ${String(cfg[c.chave] ?? 'NAO').toUpperCase() === 'SIM' ? 'checked' : ''}>
                      Ativado
                    </label>` : `
                    <input class="input" id="cfg-${c.chave}" name="${c.chave}" value="${esc(cfg[c.chave] ?? '')}">
                    ${c.dica ? `<span class="num-pequeno">${esc(c.dica)}</span>` : ''}`}
                </div>`).join('')}
            </div>
          </form>
        </div>

        <div class="card card-pad">
          <h3 style="font-size:14.5px;margin-bottom:10px">Conexão</h3>
          <div class="campo">
            <label class="campo-rotulo">URL da API (Cloudflare Worker)</label>
            <input class="input" value="${esc(url)}" readonly style="font-family:var(--mono);font-size:12px">
            <span class="num-pequeno">Esta URL fica salva neste navegador (ou definida em config.js).</span>
          </div>
        </div>

        <div class="card card-pad" style="border-color:color-mix(in srgb, var(--danger) 40%, transparent)">
          <h3 style="font-size:14.5px;margin-bottom:6px;color:var(--danger)">Zona de risco</h3>
          <p class="num-pequeno" style="margin-bottom:12px">
            Apaga todos os lançamentos, movimentações de caixinha e caixinhas. Usuários e configurações permanecem.
          </p>
          <button class="btn btn-perigo" data-action="limpar">${icone('excluir')} Apagar todos os dados financeiros</button>
        </div>
      </div>`;
  },

  actions: {
    async salvar(el) {
      const form = document.getElementById('form-config');
      if (!form) return;
      const novos = {};
      CAMPOS.forEach((c) => {
        const input = form.querySelector(`[name="${c.chave}"]`);
        if (!input) return;
        novos[c.chave] = c.tipo === 'bool' ? (input.checked ? 'SIM' : 'NAO') : input.value.trim();
      });

      await comBotao(el, async () => {
        try {
          for (const chave of Object.keys(novos)) {
            await store.acao('salvarconfig', { chave, valor: novos[chave] });
          }
          toast('Configurações salvas!', 'sucesso');
          window.dispatchEvent(new CustomEvent('app:repintar'));
        } catch (e) {
          toast(e.message, 'erro');
        }
      }, 'Salvando…');
    },

    async limpar() {
      const ok = await confirmar({
        titulo: 'Apagar todos os dados',
        mensagem: 'Todos os lançamentos, caixinhas e movimentações serão apagados do banco de dados. Esta ação não pode ser desfeita. Continuar?',
        textoOk: 'Sim, apagar tudo',
        perigo: true
      });
      if (!ok) return;
      const ok2 = await confirmar({
        titulo: 'Confirmação final',
        mensagem: 'Clique em OK e digite APAGAR TUDO no campo abaixo para confirmar.',
        textoOk: 'Continuar',
        perigo: true
      });
      if (!ok2) return;
      const texto = window.prompt('Digite APAGAR TUDO para confirmar:');
      if (texto !== 'APAGAR TUDO') return toast('Confirmação inválida. Nada foi apagado.', 'info');
      try {
        const r = await store.acao('limpar', { confirmar: 'APAGAR TUDO' });
        toast(`${r.removidas} linha(s) apagada(s).`, 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    }
  }
};
