/* =====================================================================
 * views/lancamentos.js — lista, filtros e CRUD de lancamentos
 * ===================================================================== */
import {
  esc, icone, moeda, dataBR, mesBR, mesExtenso, hojeISO, parseNum, diaSemana
} from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import { toast, confirmar, abrirModal, fecharModal, comBotao } from '../ui.js';
import { FORMAS_PAGAMENTO, STATUS } from '../config.js';

let filtros = { mes: '', tipo: '', categoriaId: '', contaId: '', status: '', forma: '', busca: '' };
let ordem = 'data-desc';
let paginaAtual = 1;
const POR_PAGINA = 25;

/* ---------------------------------------------------------------------
 * Filtros
 * ------------------------------------------------------------------- */
function aplicarFiltros(ctx) {
  if (filtros.mes === undefined || filtros.mes === null) filtros.mes = ctx.mes;
  return calc.filtrar(store.estado.lancamentos, filtros);
}

function opcoesCategoria(tipo) {
  const cats = store.estado.categorias
    .filter((c) => !tipo || c.Tipo === tipo)
    .sort((a, b) => String(a.Grupo || '').localeCompare(String(b.Grupo || '')) || String(a.Nome).localeCompare(String(b.Nome)));
  return cats;
}

/* ---------------------------------------------------------------------
 * Render
 * ------------------------------------------------------------------- */
export default {
  titulo: 'Lancamentos',

  render(ctx) {
    const lista = ordenarLista(aplicarFiltros(ctx));
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (paginaAtual > paginas) paginaAtual = paginas;
    const visiveis = lista.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

    const r = calc.resumo(lista);
    const cats = store.estado.categorias;
    const contas = store.estado.contas;

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Lancamentos</h1>
            <p>${total} lancamento(s) · ${esc(filtros.mes ? mesExtenso(filtros.mes) : 'todos os meses')}</p>
          </div>
          <div class="pagina-acoes">
            <button class="btn btn-pequeno" data-action="exportar">${icone('baixar')} CSV</button>
            ${store.podeEditar ? `<button class="btn btn-primario" data-action="novo">${icone('somar')} Novo lancamento</button>` : ''}
          </div>
        </div>

        <div class="card card-pad">
          <div class="filtros">
            <div class="campo">
              <label class="campo-rotulo">Buscar</label>
              <input class="input" id="f-busca" placeholder="descricao, observacao…" value="${esc(filtros.busca)}">
            </div>
            <div class="campo">
              <label class="campo-rotulo">Mes</label>
              <select class="select" id="f-mes">
                <option value="">Todos os meses</option>
                ${mesesDisponiveis().map((m) => `<option value="${m}" ${filtros.mes === m ? 'selected' : ''}>${esc(mesExtenso(m))}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label class="campo-rotulo">Tipo</label>
              <select class="select" id="f-tipo">
                <option value="">Todos</option>
                <option value="Despesa" ${filtros.tipo === 'Despesa' ? 'selected' : ''}>Despesas</option>
                <option value="Receita" ${filtros.tipo === 'Receita' ? 'selected' : ''}>Receitas</option>
              </select>
            </div>
            <div class="campo">
              <label class="campo-rotulo">Categoria</label>
              <select class="select" id="f-categoria">
                <option value="">Todas</option>
                ${cats.map((c) => `<option value="${c.ID}" ${filtros.categoriaId === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label class="campo-rotulo">Conta</label>
              <select class="select" id="f-conta">
                <option value="">Todas</option>
                ${contas.map((c) => `<option value="${c.ID}" ${filtros.contaId === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label class="campo-rotulo">Status</label>
              <select class="select" id="f-status">
                <option value="">Todos</option>
                ${STATUS.map((s) => `<option value="${s}" ${filtros.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
              </select>
            </div>
            <div class="campo">
              <label class="campo-rotulo">Ordenar</label>
              <select class="select" id="f-ordem">
                <option value="data-desc" ${ordem === 'data-desc' ? 'selected' : ''}>Mais recentes</option>
                <option value="data-asc" ${ordem === 'data-asc' ? 'selected' : ''}>Mais antigos</option>
                <option value="valor-desc" ${ordem === 'valor-desc' ? 'selected' : ''}>Maior valor</option>
                <option value="valor-asc" ${ordem === 'valor-asc' ? 'selected' : ''}>Menor valor</option>
                <option value="descricao" ${ordem === 'descricao' ? 'selected' : ''}>Descricao (A-Z)</option>
              </select>
            </div>
          </div>

          <div class="btn-grupo" style="margin-top:12px;justify-content:space-between;align-items:center">
            <div class="chips">
              <button class="chip ${!filtros.tipo ? 'ativo' : ''}" data-action="filtro-tipo" data-valor="">Tudo</button>
              <button class="chip ${filtros.tipo === 'Despesa' ? 'ativo' : ''}" data-action="filtro-tipo" data-valor="Despesa">Despesas</button>
              <button class="chip ${filtersTipoReceita() ? 'ativo' : ''}" data-action="filtro-tipo" data-valor="Receita">Receitas</button>
              <button class="chip ${filtros.status === 'Pendente' ? 'ativo' : ''}" data-action="filtro-status" data-valor="Pendente">Pendentes</button>
              <button class="chip ${filtros.forma === 'Credito' ? 'ativo' : ''}" data-action="filtro-forma" data-valor="Credito">No cartao</button>
            </div>
            <div style="font-size:13px;color:var(--text-dim)">
              Receitas <b class="valor-receita">${moeda(r.receitas, { compacto: true })}</b> ·
              Despesas <b class="valor-despesa">${moeda(r.despesas, { compacto: true })}</b> ·
              Saldo <b style="color:${r.saldo >= 0 ? 'var(--receita)' : 'var(--despesa)'}">${moeda(r.saldo, { compacto: true })}</b>
            </div>
          </div>
        </div>

        <div class="card">
          ${visiveis.length ? `
          <div class="tabela-wrap">
            <table class="tabela">
              <thead>
                <tr>
                  <th style="width:92px">Data</th>
                  <th>Descricao</th>
                  <th style="width:150px">Categoria</th>
                  <th style="width:130px">Conta</th>
                  <th style="width:110px">Forma</th>
                  <th style="width:130px">Status</th>
                  <th class="num" style="width:130px">Valor</th>
                  ${store.podeEditar ? '<th class="acoes-celula" style="width:110px"></th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${visiveis.map((l) => linhaLancamento(l)).join('')}
              </tbody>
            </table>
          </div>
          ${paginas > 1 ? `
          <div class="card-corpo" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <span class="num-pequeno">Pagina ${paginaAtual} de ${paginas}</span>
            <div class="btn-grupo">
              <button class="btn btn-pequeno" data-action="pagina" data-valor="${paginaAtual - 1}" ${paginaAtual <= 1 ? 'disabled' : ''}>Anterior</button>
              <button class="btn btn-pequeno" data-action="pagina" data-valor="${paginaAtual + 1}" ${paginaAtual >= paginas ? 'disabled' : ''}>Proxima</button>
            </div>
          </div>` : ''}
          ` : '<div class="vazio"><div class="icone">📋</div><h3>Nenhum lancamento encontrado</h3><p>Ajuste os filtros ou cadastre o primeiro lancamento.</p></div>'}
        </div>
      </div>`;
  },

  afterRender(ctx) {
    const map = {
      'f-busca': 'busca', 'f-mes': 'mes', 'f-tipo': 'tipo', 'f-categoria': 'categoriaId',
      'f-conta': 'contaId', 'f-status': 'status', 'f-ordem': '__ordem'
    };
    Object.entries(map).forEach(([id, chave]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const evento = el.tagName === 'SELECT' ? 'change' : 'input';
      const aplica = () => {
        if (chave === '__ordem') ordem = el.value;
        else filtros[chave] = el.value;
        paginaAtual = 1;
        ctx.repintar();
      };
      if (evento === 'input') {
        let timer;
        el.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(aplica, 260); });
      } else {
        el.addEventListener(evento, aplica);
      }
    });
  },

  actions: {
    novo() { abrirFormulario(null); },

    editar(el) {
      const l = store.estado.lancamentos.find((x) => x.ID === el.dataset.id);
      if (l) abrirFormulario(l);
    },

    duplicar(el) {
      const l = store.estado.lancamentos.find((x) => x.ID === el.dataset.id);
      if (!l) return;
      abrirFormulario({ ...l, ID: '', Data: hojeISO(), Descricao: `${l.Descricao} (copia)` });
    },

    async excluir(el) {
      const l = store.estado.lancamentos.find((x) => x.ID === el.dataset.id);
      if (!l) return;
      const temGrupo = !!l.GrupoParcelas;
      const ok = await confirmar({
        titulo: 'Excluir lancamento',
        mensagem: temGrupo
          ? `"${l.Descricao}" faz parte de um parcelamento (${l.ParcelaAtual}/${l.Parcelas}). Deseja excluir TODAS as parcelas?`
          : `Deseja excluir "${l.Descricao}" de ${moeda(l.Valor)}?`,
        textoOk: 'Excluir',
        perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluirlancamento', { id: l.ID, excluirGrupo: temGrupo });
        toast('Lancamento excluido.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    },

    async 'alternar-status'(el) {
      const l = store.estado.lancamentos.find((x) => x.ID === el.dataset.id);
      if (!l) return;
      const novo = l.Status === 'Pago' ? 'Pendente' : 'Pago';
      try {
        await store.acao('salvarlancamento', { dados: { ...l, Status: novo } });
        toast(`Marcado como ${novo.toLowerCase()}.`, 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    },

    'filtro-tipo'(el) {
      filtros.tipo = el.dataset.valor;
      paginaAtual = 1;
      window.dispatchEvent(new CustomEvent('app:repintar'));
    },

    'filtro-status'(el) {
      filtros.status = filtros.status === el.dataset.valor ? '' : el.dataset.valor;
      paginaAtual = 1;
      window.dispatchEvent(new CustomEvent('app:repintar'));
    },

    'filtro-forma'(el) {
      filtros.forma = filtros.forma === el.dataset.valor ? '' : el.dataset.valor;
      paginaAtual = 1;
      window.dispatchEvent(new CustomEvent('app:repintar'));
    },

    pagina(el) {
      paginaAtual = parseInt(el.dataset.valor, 10) || 1;
      window.dispatchEvent(new CustomEvent('app:repintar'));
    },

    exportar() {
      const lista = ordenarLista(aplicarFiltros({ mes: filtros.mes }));
      if (!lista.length) return toast('Nada para exportar.', 'info');
      const cab = ['Data', 'Tipo', 'Valor', 'Descricao', 'Categoria', 'Conta', 'FormaPagamento',
        'Parcelas', 'ParcelaAtual', 'Status', 'Recorrente', 'Fixo', 'Competencia', 'Caixinha', 'Observacao'];
      const linhas = [cab.join(';')];
      lista.forEach((l) => {
        linhas.push([
          dataBR(l.Data), l.Tipo, String(l.Valor).replace('.', ','), l.Descricao,
          store.nomeCategoria(l.CategoriaID), store.nomeConta(l.ContaID), l.FormaPagamento,
          l.Parcelas, l.ParcelaAtual, l.Status, l.Recorrente, l.Fixo, l.Competencia,
          store.caixinhaPorId(l.CaixinhaID)?.Nome || '', l.Obs || ''
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'));
      });
      const csv = '\uFEFF' + linhas.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `lancamentos-${hojeISO()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('CSV gerado.', 'sucesso');
    }
  }
};

/* ---------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------- */
function filtersTipoReceita() { return filtros.tipo === 'Receita'; }

function ordenarLista(lista) {
  return calc.ordenar(lista, ordem);
}

function mesesDisponiveis() {
  const set = new Set(store.estado.lancamentos.map((l) => calc.competencia(l)).filter(Boolean));
  set.add(hojeISO().slice(0, 7));
  return [...set].sort().reverse();
}

function linhaLancamento(l) {
  const cat = store.categoriaPorId(l.CategoriaID);
  const ehReceita = String(l.Tipo) === 'Receita';
  const status = String(l.Status || 'Pago');
  const clsStatus = status === 'Pago' ? 'badge-pago' : status === 'Cancelado' ? '' : 'badge-pendente';

  return `
    <tr>
      <td>
        <div>${esc(dataBR(l.Data))}</div>
        <div class="num-pequeno">${esc(diaSemana(l.Data))}</div>
      </td>
      <td class="desc">
        <div style="display:flex;align-items:center;gap:7px">
          <span class="ponto" style="background:${cat?.Cor || '#64748b'}"></span>
          <span style="font-weight:550">${esc(l.Descricao)}</span>
          ${l.Fixo === 'SIM' ? '<span class="badge badge-fixo">fixo</span>' : ''}
          ${l.Recorrente === 'SIM' ? '<span class="badge badge-recorrente">recorrente</span>' : ''}
        </div>
        ${l.Parcelas > 1 ? `<div class="num-pequeno">parcela ${l.ParcelaAtual}/${l.Parcelas}</div>` : ''}
        ${l.Obs ? `<div class="num-pequeno" title="${esc(l.Obs)}">${esc(String(l.Obs).slice(0, 60))}</div>` : ''}
      </td>
      <td>${esc(store.nomeCategoria(l.CategoriaID))}</td>
      <td class="num-pequeno nowrap" title="${esc(store.nomeConta(l.ContaID))}">${esc(store.nomeConta(l.ContaID))}</td>
      <td class="num-pequeno nowrap">${esc(l.FormaPagamento || '—')}</td>
      <td><span class="badge ${clsStatus}">${esc(status)}</span></td>
      <td class="num ${ehReceita ? 'valor-receita' : 'valor-despesa'}">
        ${ehReceita ? '+' : '-'}${moeda(l.Valor).replace('-', '')}
      </td>
      ${store.podeEditar ? `
      <td class="acoes-celula">
        <button class="btn-icone" data-action="editar" data-id="${l.ID}" title="Editar">${icone('editar')}</button>
        <button class="btn-icone" data-action="alternar-status" data-id="${l.ID}" title="Marcar como ${status === 'Pago' ? 'pendente' : 'pago'}">${icone(status === 'Pago' ? 'relogio' : 'ok')}</button>
        <button class="btn-icone" data-action="duplicar" data-id="${l.ID}" title="Duplicar">${icone('somar')}</button>
        <button class="btn-icone" data-action="excluir" data-id="${l.ID}" title="Excluir">${icone('excluir')}</button>
      </td>` : ''}
    </tr>`;
}

/* ---------------------------------------------------------------------
 * Formulario
 * ------------------------------------------------------------------- */
function abrirFormulario(l) {
  const edicao = !!(l && l.ID);
  const d = l || {
    Data: hojeISO(), Tipo: 'Despesa', Valor: '', Descricao: '', CategoriaID: '',
    ContaID: '', FormaPagamento: 'Debito', Parcelas: 1, ParcelaAtual: 1, Status: 'Pago',
    Recorrente: 'NAO', Fixo: 'NAO', CaixinhaID: '', Obs: ''
  };

  const catsDespesa = opcoesCategoria('Despesa');
  const catsReceita = opcoesCategoria('Receita');
  const contas = store.estado.contas;
  const caixinhas = store.estado.caixinhas;

  const corpo = `
    <form id="form-lanc" style="display:grid;gap:14px">
      <input type="hidden" name="ID" value="${esc(d.ID || '')}">
      <input type="hidden" name="GrupoParcelas" value="${esc(d.GrupoParcelas || '')}">

      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="l-data">Data <span class="obrig">*</span></label>
          <input class="input" id="l-data" name="Data" type="date" value="${esc(d.Data || hojeISO())}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="l-tipo">Tipo <span class="obrig">*</span></label>
          <select class="select" id="l-tipo" name="Tipo">
            <option value="Despesa" ${d.Tipo === 'Despesa' ? 'selected' : ''}>Despesa</option>
            <option value="Receita" ${d.Tipo === 'Receita' ? 'selected' : ''}>Receita</option>
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="l-valor">Valor <span class="obrig">*</span></label>
          <input class="input" id="l-valor" name="Valor" inputmode="decimal"
                 placeholder="0,00" value="${d.Valor ? esc(d.Valor) : ''}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="l-desc">Descricao <span class="obrig">*</span></label>
          <input class="input" id="l-desc" name="Descricao" maxlength="120"
                 placeholder="Ex.: Aluguel de outubro" value="${esc(d.Descricao || '')}" required>
        </div>
      </div>

      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="l-cat">Categoria</label>
          <select class="select" id="l-cat" name="CategoriaID">
            <option value="">Sem categoria</option>
            ${d.Tipo === 'Receita' ? `
              <optgroup label="Receitas">
                ${catsReceita.map((c) => `<option value="${c.ID}" ${d.CategoriaID === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
              </optgroup>` : `
              <optgroup label="Despesas">
                ${catsDespesa.map((c) => `<option value="${c.ID}" ${d.CategoriaID === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
              </optgroup>`}
          </select>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="l-conta">Conta / cartao</label>
          <select class="select" id="l-conta" name="ContaID">
            <option value="">Sem conta</option>
            ${contas.map((c) => `<option value="${c.ID}" ${d.ContaID === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="l-forma">Forma de pagamento</label>
          <select class="select" id="l-forma" name="FormaPagamento">
            ${FORMAS_PAGAMENTO.map((f) => `<option value="${f}" ${d.FormaPagamento === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="l-status">Status</label>
          <select class="select" id="l-status" name="Status">
            ${STATUS.map((s) => `<option value="${s}" ${d.Status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-secao">
        <div class="form-secao-titulo">Parcelamento e recorrencia</div>
        <div class="form-grid">
          <div class="campo">
            <label class="campo-rotulo" for="l-parcelas">Numero de parcelas</label>
            <input class="input" id="l-parcelas" name="Parcelas" type="number" min="1" max="60"
                   value="${esc(d.Parcelas || 1)}" ${edicao ? 'disabled' : ''}>
            ${edicao ? '<span class="num-pequeno">Nao editavel apos o parcelamento</span>' : ''}
          </div>
          <div class="campo" style="justify-content:flex-end;gap:10px">
            <label class="checkbox"><input type="checkbox" name="Fixo" ${d.Fixo === 'SIM' ? 'checked' : ''}> Gasto fixo mensal</label>
            <label class="checkbox"><input type="checkbox" name="Recorrente" ${d.Recorrente === 'SIM' ? 'checked' : ''}> Recorrente (repetir todo mes)</label>
          </div>
        </div>
      </div>

      <div class="form-secao">
        <div class="form-secao-titulo">Outros</div>
        <div class="form-grid">
          <div class="campo">
            <label class="campo-rotulo" for="l-caixinha">Caixinha vinculada</label>
            <select class="select" id="l-caixinha" name="CaixinhaID">
              <option value="">Nenhuma</option>
              ${caixinhas.map((c) => `<option value="${c.ID}" ${d.CaixinhaID === c.ID ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}
            </select>
          </div>
          <div class="campo">
            <label class="campo-rotulo" for="l-obs">Observacao</label>
            <input class="input" id="l-obs" name="Obs" maxlength="250" value="${esc(d.Obs || '')}">
          </div>
        </div>
      </div>

      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: edicao ? 'Editar lancamento' : 'Novo lancamento',
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>${edicao ? 'Salvar alteracoes' : 'Adicionar'}</button>`
  });

  const form = dlg.querySelector('#form-lanc');
  const erro = dlg.querySelector('#erro-form');
  const btn = dlg.querySelector('[data-salvar]');

  // troca as categorias quando muda o tipo
  const selTipo = form.querySelector('#l-tipo');
  const selCat = form.querySelector('#l-cat');
  selTipo.addEventListener('change', () => {
    const lista = selTipo.value === 'Receita' ? catsReceita : catsDespesa;
    selCat.innerHTML = `<option value="">Sem categoria</option>` +
      lista.map((c) => `<option value="${c.ID}">${esc(c.Nome)}</option>`).join('');
  });

  btn.addEventListener('click', async () => {
    const fd = new FormData(form);
    const dados = {
      ID: fd.get('ID') || '',
      Data: fd.get('Data'),
      Tipo: fd.get('Tipo'),
      Valor: parseNum(fd.get('Valor')),
      Descricao: String(fd.get('Descricao') || '').trim(),
      CategoriaID: fd.get('CategoriaID') || '',
      ContaID: fd.get('ContaID') || '',
      FormaPagamento: fd.get('FormaPagamento'),
      Parcelas: parseInt(fd.get('Parcelas') || 1, 10),
      ParcelaAtual: parseInt(fd.get('ParcelaAtual') || 1, 10),
      Status: fd.get('Status'),
      Recorrente: form.querySelector('[name=Recorrente]').checked ? 'SIM' : 'NAO',
      Fixo: form.querySelector('[name=Fixo]').checked ? 'SIM' : 'NAO',
      CaixinhaID: fd.get('CaixinhaID') || '',
      GrupoParcelas: fd.get('GrupoParcelas') || '',
      Obs: String(fd.get('Obs') || '').trim()
    };

    if (!dados.Data) { erro.textContent = 'Informe a data.'; return; }
    if (!(dados.Valor > 0)) { erro.textContent = 'O valor deve ser maior que zero.'; return; }
    if (!dados.Descricao) { erro.textContent = 'Informe a descricao.'; return; }
    erro.textContent = '';

    await comBotao(btn, async () => {
      try {
        const r = await store.acao('salvarlancamento', { dados });
        fecharModal();
        toast(r.ids && r.ids.length > 1 ? `${r.ids.length} parcelas cadastradas!` : 'Lancamento salvo!', 'sucesso');
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}
