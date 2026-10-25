/* =====================================================================
 * views/contas.js — CRUD de contas, cartoes e carteiras
 * ===================================================================== */
import { esc, icone, moeda, mesExtenso } from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import { toast, confirmar, abrirModal, fecharModal, comBotao } from '../ui.js';
import { TIPOS_CONTA } from '../config.js';

const CORES = ['#3b82f6', '#22c55e', '#f43f5e', '#eab308', '#a855f7', '#06b6d4', '#f97316'];

export default {
  titulo: 'Contas',

  render(ctx) {
    const contas = store.estado.contas;
    const doMes = calc.filtrar(store.estado.lancamentos, { mes: ctx.mes });

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Contas e cartões</h1>
            <p>Onde o dinheiro entra e sai. Uso referente a ${esc(mesExtenso(ctx.mes))}.</p>
          </div>
          <div class="pagina-acoes">
            ${store.podeEditar ? `<button class="btn btn-primario" data-action="nova">${icone('somar')} Nova conta</button>` : ''}
          </div>
        </div>

        ${contas.length ? `<div class="grid grid-auto">
          ${contas.map((c) => cartaoConta(c, doMes)).join('')}
        </div>` : `
        <div class="card"><div class="vazio">
          <div class="icone">💳</div>
          <h3>Nenhuma conta cadastrada</h3>
          <p>Crie a conta corrente, a poupança e os cartões de crédito para classificar seus lançamentos.</p>
          ${store.podeEditar ? '<button class="btn btn-primario" data-action="nova">Criar primeira conta</button>' : ''}
        </div></div>`}
      </div>`;
  },

  actions: {
    nova() { abrirFormulario(null); },

    editar(el) {
      const c = store.estado.contas.find((x) => x.ID === el.dataset.id);
      if (c) abrirFormulario(c);
    },

    async excluir(el) {
      const c = store.estado.contas.find((x) => x.ID === el.dataset.id);
      if (!c) return;
      const ok = await confirmar({
        titulo: 'Excluir conta',
        mensagem: `Excluir a conta "${c.Nome}"? Se houver lançamentos vinculados, a exclusão será bloqueada.`,
        textoOk: 'Excluir', perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluirconta', { id: c.ID });
        toast('Conta excluída.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    }
  }
};

function cartaoConta(c, lancamentosDoMes) {
  const doMes = lancamentosDoMes.filter((l) => l.ContaID === c.ID);
  const entradas = doMes.filter((l) => l.Tipo === 'Receita').reduce((s, l) => s + (Number(l.Valor) || 0), 0);
  const saidas = doMes.filter((l) => l.Tipo === 'Despesa').reduce((s, l) => s + (Number(l.Valor) || 0), 0);
  const saldo = entradas - saidas;
  const limite = Number(c.Limite) || 0;

  return `
    <div class="caixinha" style="border:1px solid var(--border-soft);border-radius:var(--radius);padding:14px">
      <div class="caixinha-topo">
        <div class="caixinha-icone" style="background:${(c.Cor || '#3b82f6')}22;color:${c.Cor || '#3b82f6'}">$</div>
        <div style="flex:1;min-width:0">
          <div class="caixinha-nome">${esc(c.Nome)}</div>
          <div class="caixinha-desc">${esc(c.Tipo)}${c.Instituicao ? ' · ' + esc(c.Instituicao) : ''}</div>
        </div>
        ${c.Ativo === 'NAO' ? '<span class="badge">inativa</span>' : ''}
      </div>

      <div class="caixinha-saldo" style="color:${saldo >= 0 ? 'var(--text)' : 'var(--despesa)'}">${moeda(saldo)}</div>

      <div class="caixinha-info">
        <span>Entradas <b>${moeda(entradas, { compacto: true })}</b></span>
        <span>Saídas <b>${moeda(saidas, { compacto: true })}</b></span>
      </div>

      ${limite > 0 ? `
        <div class="barra-progresso"><div class="barra" style="width:${Math.min(100, (saidas / limite) * 100).toFixed(1)}%;background:${saidas > limite ? 'var(--despesa)' : (c.Cor || '#3b82f6')}"></div></div>
        <div class="caixinha-info">
          <span>Limite <b>${moeda(limite, { compacto: true })}</b></span>
          <span>${c.DiaVencimento ? `Vence dia ${c.DiaVencimento}` : 'Sem vencimento'}</span>
        </div>` : `
        <div class="caixinha-info">
          <span>${doMes.length} lançamento(s) no mês</span>
          <span>${c.DiaVencimento ? `Vence dia ${c.DiaVencimento}` : ''}</span>
        </div>`}

      ${store.podeEditar ? `
      <div class="caixinha-acoes">
        <button class="btn btn-pequeno" data-action="editar" data-id="${c.ID}">${icone('editar')} Editar</button>
        <button class="btn btn-pequeno btn-perigo" data-action="excluir" data-id="${c.ID}">${icone('excluir')}</button>
      </div>` : ''}
    </div>`;
}

function abrirFormulario(c) {
  const edicao = !!(c && c.ID);
  const d = c || { Nome: '', Tipo: 'Conta Corrente', Instituicao: '', Limite: 0, DiaVencimento: 0, Cor: '#3b82f6', Ativo: 'SIM', Obs: '' };

  const corpo = `
    <form id="form-conta" style="display:grid;gap:14px">
      <input type="hidden" name="ID" value="${esc(d.ID || '')}">
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="k-nome">Nome <span class="obrig">*</span></label>
          <input class="input" id="k-nome" name="Nome" maxlength="60" value="${esc(d.Nome || '')}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="k-tipo">Tipo</label>
          <select class="select" id="k-tipo" name="Tipo">
            ${TIPOS_CONTA.map((t) => `<option value="${esc(t)}" ${d.Tipo === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="k-inst">Instituição</label>
          <input class="input" id="k-inst" name="Instituicao" maxlength="60" value="${esc(d.Instituicao || '')}">
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="k-limite">Limite (cartão)</label>
          <input class="input" id="k-limite" name="Limite" inputmode="decimal" placeholder="0,00"
                 value="${d.Limite ? esc(d.Limite) : ''}">
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="k-dia">Dia de vencimento</label>
          <input class="input" id="k-dia" name="DiaVencimento" type="number" min="0" max="31"
                 value="${esc(d.DiaVencimento || 0)}">
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="k-cor">Cor</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="cores">
            <input type="hidden" name="Cor" value="${esc(d.Cor || '#3b82f6')}">
            ${CORES.map((c) => `<button type="button" class="btn-icone" data-cor="${c}"
              style="width:26px;height:26px;border-radius:8px;background:${c};border:2px solid ${(d.Cor || '#3b82f6') === c ? 'var(--text)' : 'transparent'}"></button>`).join('')}
          </div>
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="k-obs">Observação</label>
          <input class="input" id="k-obs" name="Obs" maxlength="200" value="${esc(d.Obs || '')}">
        </div>
        <div class="campo" style="justify-content:flex-end;gap:10px">
          <label class="checkbox"><input type="checkbox" name="Ativo" ${d.Ativo === 'SIM' ? 'checked' : ''}> Ativa</label>
        </div>
      </div>
      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: edicao ? 'Editar conta' : 'Nova conta',
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Salvar</button>`
  });

  const form = dlg.querySelector('#form-conta');
  const erro = dlg.querySelector('#erro-form');
  const btn = dlg.querySelector('[data-salvar]');

  dlg.querySelectorAll('[data-cor]').forEach((b) => {
    b.addEventListener('click', () => {
      form.querySelector('[name=Cor]').value = b.dataset.cor;
      dlg.querySelectorAll('[data-cor]').forEach((x) => {
        x.style.borderColor = x.dataset.cor === b.dataset.cor ? 'var(--text)' : 'transparent';
      });
    });
  });

  btn.addEventListener('click', async () => {
    const fd = new FormData(form);
    const dados = {
      ID: fd.get('ID') || '',
      Nome: String(fd.get('Nome') || '').trim(),
      Tipo: fd.get('Tipo'),
      Instituicao: String(fd.get('Instituicao') || '').trim(),
      Limite: fd.get('Limite') || 0,
      DiaVencimento: parseInt(fd.get('DiaVencimento') || 0, 10),
      Cor: fd.get('Cor'),
      Ativo: form.querySelector('[name=Ativo]').checked ? 'SIM' : 'NAO',
      Obs: String(fd.get('Obs') || '').trim()
    };
    if (!dados.Nome) { erro.textContent = 'Informe o nome.'; return; }

    await comBotao(btn, async () => {
      try {
        await store.acao('salvarconta', { dados });
        fecharModal();
        toast('Conta salva!', 'sucesso');
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}
