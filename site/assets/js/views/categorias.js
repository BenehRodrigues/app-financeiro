/* =====================================================================
 * views/categorias.js — CRUD de categorias (com orcamento mensal)
 * ===================================================================== */
import { esc, icone, moeda, porcento, mesExtenso } from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import { toast, confirmar, abrirModal, fecharModal, comBotao } from '../ui.js';
import { GRUPOS_DESPESA, GRUPOS_RECEITA } from '../config.js';

const CORES = ['#22c55e', '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6',
  '#ec4899', '#84cc16', '#f97316', '#6366f1', '#06b6d4', '#d946ef'];

export default {
  titulo: 'Categorias',

  render(ctx) {
    const cats = store.estado.categorias;
    const despesas = cats.filter((c) => c.Tipo === 'Despesa');
    const receitas = cats.filter((c) => c.Tipo === 'Receita');
    const doMes = calc.filtrar(store.estado.lancamentos, { mes: ctx.mes });

    const bloco = (lista, tipo) => `
      <div class="card">
        <div class="card-cabecalho">
          <h3>${tipo === 'Despesa' ? 'Categorias de despesa' : 'Categorias de receita'}</h3>
          <span class="sub">${lista.length} cadastrada(s)</span>
        </div>
        <div class="card-corpo">
          ${lista.length ? `<div class="grid grid-auto">${lista.map((c) => cartao(c, doMes, ctx.mes)).join('')}</div>`
            : '<div class="vazio"><p>Nenhuma categoria cadastrada.</p></div>'}
        </div>
      </div>`;

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Categorias</h1>
            <p>Organize os gastos e receitas por grupo. O orcamento e compared com ${esc(mesExtenso(ctx.mes))}.</p>
          </div>
          <div class="pagina-acoes">
            ${store.podeEditar ? `<button class="btn btn-primario" data-action="nova">${icone('somar')} Nova categoria</button>` : ''}
          </div>
        </div>

        ${bloco(despesas, 'Despesa')}
        ${bloco(receitas, 'Receita')}
      </div>`;
  },

  actions: {
    nova() { abrirFormulario(null); },

    editar(el) {
      const c = store.estado.categorias.find((x) => x.ID === el.dataset.id);
      if (c) abrirFormulario(c);
    },

    async excluir(el) {
      const c = store.estado.categorias.find((x) => x.ID === el.dataset.id);
      if (!c) return;
      const ok = await confirmar({
        titulo: 'Excluir categoria',
        mensagem: `Excluir a categoria "${c.Nome}"? Se ela estiver em uso, a exclusao sera bloqueada.`,
        textoOk: 'Excluir', perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluircategoria', { id: c.ID });
        toast('Categoria excluida.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    }
  }
};

function cartao(c, lancamentosDoMes, mes) {
  const usados = lancamentosDoMes
    .filter((l) => l.CategoriaID === c.ID && l.Tipo === c.Tipo)
    .reduce((s, l) => s + (Number(l.Valor) || 0), 0);
  const orc = Number(c.OrcamentoMensal) || 0;
  const pct = orc > 0 ? (usados / orc) * 100 : 0;
  const total = lancamentosDoMes.filter((l) => l.CategoriaID === c.ID).length;

  return `
    <div class="caixinha" style="border:1px solid var(--border-soft);border-radius:var(--radius);padding:14px">
      <div class="caixinha-topo">
        <span class="ponto" style="background:${esc(c.Cor || '#64748b')};width:14px;height:14px"></span>
        <div style="flex:1;min-width:0">
          <div class="caixinha-nome">${esc(c.Nome)}</div>
          <div class="caixinha-desc">${esc(c.Grupo || 'Sem grupo')} · ${total} lancamento(s)</div>
        </div>
        ${c.Ativo === 'NAO' ? '<span class="badge">inativa</span>' : ''}
      </div>

      ${orc > 0 ? `
        <div class="barra-progresso"><div class="barra" style="width:${Math.min(100, pct).toFixed(1)}%;background:${pct > 100 ? 'var(--despesa)' : (c.Cor || '#22c55e')}"></div></div>
        <div class="caixinha-info">
          <span>Usado <b>${moeda(usados, { compacto: true })}</b></span>
          <span>Orcamento <b>${moeda(orc, { compacto: true })}</b></span>
        </div>` : `
        <div class="caixinha-info">
          <span>Gasto no mes</span>
          <span><b>${moeda(usados)}</b></span>
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
  const d = c || { Nome: '', Tipo: 'Despesa', Grupo: '', Cor: '#22c55e', OrcamentoMensal: 0, Ativo: 'SIM', Obs: '' };
  const grupos = d.Tipo === 'Receita' ? GRUPOS_RECEITA : GRUPOS_DESPESA;

  const corpo = `
    <form id="form-cat" style="display:grid;gap:14px">
      <input type="hidden" name="ID" value="${esc(d.ID || '')}">
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="c-nome">Nome <span class="obrig">*</span></label>
          <input class="input" id="c-nome" name="Nome" maxlength="60" value="${esc(d.Nome || '')}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="c-tipo">Tipo</label>
          <select class="select" id="c-tipo" name="Tipo">
            <option value="Despesa" ${d.Tipo === 'Despesa' ? 'selected' : ''}>Despesa</option>
            <option value="Receita" ${d.Tipo === 'Receita' ? 'selected' : ''}>Receita</option>
          </select>
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="c-grupo">Grupo</label>
          <input class="input" id="c-grupo" name="Grupo" list="lista-grupos" maxlength="40" value="${esc(d.Grupo || '')}">
          <datalist id="lista-grupos">${grupos.map((g) => `<option value="${g}">`).join('')}</datalist>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="c-orc">Orcamento mensal</label>
          <input class="input" id="c-orc" name="OrcamentoMensal" inputmode="decimal" placeholder="0,00"
                 value="${d.OrcamentoMensal ? esc(d.OrcamentoMensal) : ''}">
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="c-cor">Cor</label>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" id="cores">
            <input type="hidden" name="Cor" value="${esc(d.Cor || '#22c55e')}">
            ${CORES.map((c) => `<button type="button" class="btn-icone" data-cor="${c}"
              style="width:26px;height:26px;border-radius:8px;background:${c};border:2px solid ${(d.Cor || '#22c55e') === c ? 'var(--text)' : 'transparent'}"></button>`).join('')}
          </div>
        </div>
        <div class="campo" style="justify-content:flex-end;gap:10px">
          <label class="checkbox"><input type="checkbox" name="Ativo" ${d.Ativo === 'SIM' ? 'checked' : ''}> Ativa</label>
        </div>
      </div>
      <div class="campo">
        <label class="campo-rotulo" for="c-obs">Observacao</label>
        <input class="input" id="c-obs" name="Obs" maxlength="200" value="${esc(d.Obs || '')}">
      </div>
      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: edicao ? 'Editar categoria' : 'Nova categoria',
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Salvar</button>`
  });

  const form = dlg.querySelector('#form-cat');
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
      Grupo: String(fd.get('Grupo') || '').trim(),
      Cor: fd.get('Cor'),
      OrcamentoMensal: fd.get('OrcamentoMensal') || 0,
      Ativo: form.querySelector('[name=Ativo]').checked ? 'SIM' : 'NAO',
      Obs: String(fd.get('Obs') || '').trim()
    };
    if (!dados.Nome) { erro.textContent = 'Informe o nome.'; return; }

    await comBotao(btn, async () => {
      try {
        await store.acao('salvarcategoria', { dados });
        fecharModal();
        toast('Categoria salva!', 'sucesso');
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}
