/* =====================================================================
 * views/caixinhas.js — caixinhas (envelopes), aportes e projecao
 * ===================================================================== */
import { esc, icone, moeda, dataBR, hojeISO, mesBR, mesExtenso, addMeses } from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import * as graficos from '../charts.js';
import { toast, confirmar, abrirModal, fecharModal, comBotao } from '../ui.js';

const CORES = ['#22c55e', '#0ea5e9', '#a855f7', '#f59e0b', '#f43f5e', '#14b8a6', '#eab308'];

export default {
  titulo: 'Caixinhas',

  render(ctx) {
    const caixinhas = store.estado.caixinhas;
    const total = caixinhas.reduce((s, c) => s + calc.saldoCaixinha(c, store.estado.movimentacoes, store.estado.lancamentos), 0);
    const metaTotal = caixinhas.reduce((s, c) => s + (Number(c.Meta) || 0), 0);

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Caixinhas</h1>
            <p>Controle separado por objetivo, com projecao de quando chega na meta.</p>
          </div>
          <div class="pagina-acoes">
            ${store.podeEditar ? `<button class="btn btn-primario" data-action="nova">${icone('somar')} Nova caixinha</button>` : ''}
          </div>
        </div>

        ${caixinhas.length ? `
          <div class="kpis">
            <div class="kpi" style="--kpi-cor:#a855f7">
              <div class="kpi-rotulo">Total guardado</div>
              <div class="kpi-valor">${moeda(total)}</div>
            </div>
            <div class="kpi" style="--kpi-cor:#22c55e">
              <div class="kpi-rotulo">Meta somada</div>
              <div class="kpi-valor">${moeda(metaTotal)}</div>
              <div class="kpi-rodape">${metaTotal > 0 ? `${((total / metaTotal) * 100).toFixed(0)}% concluido` : ''}</div>
            </div>
            <div class="kpi" style="--kpi-cor:#f43f5e">
              <div class="kpi-rotulo">Falta para as metas</div>
              <div class="kpi-valor">${moeda(Math.max(0, metaTotal - total))}</div>
            </div>
          </div>

          <div class="grid grid-auto">
            ${caixinhas.map((c) => cartaoCaixinha(c)).join('')}
          </div>` : `
          <div class="card"><div class="vazio">
            <div class="icone">$</div>
            <h3>Nenhuma caixinha criada</h3>
            <p>Crie caixinhas para separar dinheiro por objetivo (reserva de emergencia, viagem, investimento…) e acompanhar a projecao.</p>
            ${store.podeEditar ? '<button class="btn btn-primario" data-action="nova">Criar primeira caixinha</button>' : ''}
          </div></div>`}
      </div>`;
  },

  actions: {
    nova() { abrirFormulario(null); },

    editar(el) {
      const c = store.estado.caixinhas.find((x) => x.ID === el.dataset.id);
      if (c) abrirFormulario(c);
    },

    async excluir(el) {
      const c = store.estado.caixinhas.find((x) => x.ID === el.dataset.id);
      if (!c) return;
      const ok = await confirmar({
        titulo: 'Excluir caixinha',
        mensagem: `Excluir "${c.Nome}"? Todas as movimentacoes dessa caixinha tambem serao apagadas.`,
        textoOk: 'Excluir', perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluircaixinha', { id: c.ID });
        toast('Caixinha excluida.', 'sucesso');
      } catch (e) {
        toast(e.message, 'erro');
      }
    },

    detalhe(el) { abrirDetalhe(el.dataset.id); },

    aporte(el) { abrirMovimentacao(el.dataset.id, 'Entrada'); },

    resgate(el) { abrirMovimentacao(el.dataset.id, 'Saida'); },

    async 'excluir-mov'(el) {
      const ok = await confirmar({
        titulo: 'Excluir movimentacao',
        mensagem: 'Remover esta movimentacao da caixinha?',
        textoOk: 'Excluir', perigo: true
      });
      if (!ok) return;
      try {
        await store.acao('excluirmovimentacao', { id: el.dataset.id });
        toast('Movimentacao removida.', 'sucesso');
        fecharModal();
      } catch (e) {
        toast(e.message, 'erro');
      }
    }
  }
};

/* ---------------------------------------------------------------------
 * Cartao
 * ------------------------------------------------------------------- */
function cartaoCaixinha(c) {
  const movs = calc.movimentosDe(c.ID, store.estado.movimentacoes);
  const p = calc.projecaoCaixinha(c, store.estado.movimentacoes, { lancamentos: store.estado.lancamentos });
  const cor = c.Cor || '#22c55e';
  const ultimo = movs[0];

  return `
    <div class="card">
      <div class="card-corpo caixinha">
        <div class="caixinha-topo">
          <div class="caixinha-icone" style="background:${cor}22;color:${cor}">$</div>
          <div style="flex:1;min-width:0">
            <div class="caixinha-nome">${esc(c.Nome)}</div>
            <div class="caixinha-desc">${esc(c.Descricao || 'Sem descricao')}</div>
          </div>
          ${c.Ativo === 'NAO' ? '<span class="badge">inativa</span>' : ''}
        </div>

        <div>
          <div class="caixinha-saldo" style="color:${p.saldo >= 0 ? 'var(--text)' : 'var(--despesa)'}">${moeda(p.saldo)}</div>
          <div class="num-pequeno">${movs.length} movimentacao(oes)</div>
        </div>

        <div class="barra-progresso"><div class="barra" style="width:${p.percentual.toFixed(1)}%;background:${cor}"></div></div>
        <div class="caixinha-info">
          <span>Meta <b>${moeda(p.meta)}</b></span>
          <span>${p.atingida ? '✓ Meta atingida' : `Faltam ${moeda(p.restante)}`}</span>
        </div>

        ${(p.qtdLancamentos || p.qtdMovimentacoes) ? `
        <div class="caixinha-info" style="border-top:1px solid var(--border-soft);padding-top:10px;flex-direction:column;gap:5px">
          ${p.qtdLancamentos ? `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Lancamentos vinculados (${p.qtdLancamentos})</span>
            <b style="color:${p.lances >= 0 ? 'var(--receita)' : 'var(--despesa)'}">${moeda(p.lances)}</b>
          </div>` : ''}
          ${p.qtdMovimentacoes ? `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Aportes manuais (${p.qtdMovimentacoes})</span>
            <b style="color:${p.manual >= 0 ? 'var(--receita)' : 'var(--despesa)'}">${moeda(p.manual)}</b>
          </div>` : ''}
          ${p.inicial ? `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Saldo inicial</span><b>${moeda(p.inicial)}</b>
          </div>` : ''}
        </div>` : ''}

        ${p.meta > 0 ? `
        <div class="caixinha-info" style="border-top:1px solid var(--border-soft);padding-top:10px;flex-direction:column;gap:5px">
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Aporte medio (3 meses)</span><b>${moeda(p.media)}</b>
          </div>
          ${p.mesesAteMeta !== null ? `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Chega na meta em</span><b>${p.mesesAteMeta} mes(es)</b>
          </div>` : `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Chega na meta em</span><b>—</b>
          </div>`}
          ${p.prazo ? `
          <div style="display:flex;justify-content:space-between;width:100%">
            <span>Para cumprir o prazo (${esc(mesBR(p.prazo))})</span>
            <b>${moeda(p.aporteNecessario || 0)}/mes</b>
          </div>` : ''}
        </div>` : ''}

        ${p.serie.length ? `
        <div class="grafico">${graficos.linha({
          labels: p.serie.map((s) => mesBR(s.mes)),
          series: [{ nome: 'Projecao', cor, valores: p.serie.map((s) => s.saldo) }],
          altura: 130,
          formatador: (v) => moeda(v)
        })}</div>` : ''}

        ${ultimo ? `<div class="num-pequeno">Ultimo: ${esc(ultimo.Descricao || ultimo.Tipo)} · ${esc(dataBR(ultimo.Data))} · ${moeda(ultimo.Valor)}</div>` : ''}

        ${store.podeEditar ? `
        <div class="caixinha-acoes">
          <button class="btn btn-pequeno btn-primario" data-action="aporte" data-id="${c.ID}">+ Depositar</button>
          <button class="btn btn-pequeno" data-action="resgate" data-id="${c.ID}">- Resgatar</button>
          <button class="btn btn-pequeno" data-action="detalhe" data-id="${c.ID}">Detalhes</button>
          <button class="btn btn-pequeno btn-icone" data-action="editar" data-id="${c.ID}" title="Editar">${icone('editar')}</button>
          <button class="btn btn-pequeno btn-icone btn-perigo" data-action="excluir" data-id="${c.ID}" title="Excluir">${icone('excluir')}</button>
        </div>` : `<div class="caixinha-acoes"><button class="btn btn-pequeno" data-action="detalhe" data-id="${c.ID}">Detalhes</button></div>`}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------------
 * Detalhe
 * ------------------------------------------------------------------- */
function abrirDetalhe(id) {
  const c = store.caixinhaPorId(id);
  if (!c) return;
  const movs = calc.movimentosDe(id, store.estado.movimentacoes);
  const p = calc.projecaoCaixinha(c, store.estado.movimentacoes, { lancamentos: store.estado.lancamentos });

  const corpo = `
    <div style="display:grid;gap:16px">
      <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="kpi" style="--kpi-cor:${c.Cor || '#22c55e'}">
          <div class="kpi-rotulo">Saldo</div><div class="kpi-valor">${moeda(p.saldo)}</div>
        </div>
        <div class="kpi" style="--kpi-cor:#38bdf8">
          <div class="kpi-rotulo">Meta</div><div class="kpi-valor">${moeda(p.meta)}</div>
          <div class="kpi-rodape">${p.restante > 0 ? `faltam ${moeda(p.restante)}` : 'atingida'}</div>
        </div>
        <div class="kpi" style="--kpi-cor:#f59e0b">
          <div class="kpi-rotulo">Aporte medio</div><div class="kpi-valor">${moeda(p.media)}</div>
          <div class="kpi-rodape">ultimos 3 meses</div>
        </div>
      </div>

      ${p.serie.length ? `
      <div>
        <h4 style="font-size:13px;color:var(--text-dim);margin-bottom:8px">Projecao (base: aporte medio)</h4>
        <div class="grafico">${graficos.linha({
          labels: p.serie.map((s) => mesBR(s.mes)),
          series: [{ nome: 'Saldo projetado', cor: c.Cor || '#22c55e', valores: p.serie.map((s) => s.saldo) }],
          altura: 180,
          formatador: (v) => moeda(v)
        })}</div>
      </div>` : ''}

      <div>
        <h4 style="font-size:13px;color:var(--text-dim);margin-bottom:8px">Movimentacoes manuais</h4>
        ${movs.length ? `<div class="lista">${movs.map((m) => `
          <div class="lista-item">
            <span class="ponto" style="background:${String(m.Tipo).toLowerCase().startsWith('sai') ? 'var(--despesa)' : 'var(--receita)'}"></span>
            <div class="principal">
              <div class="titulo">${esc(m.Descricao || m.Tipo)}</div>
              <div class="meta">${esc(dataBR(m.Data))} · ${esc(m.Tipo)}</div>
            </div>
            <span class="valor ${String(m.Tipo).toLowerCase().startsWith('sai') ? 'valor-despesa' : 'valor-receita'}">
              ${String(m.Tipo).toLowerCase().startsWith('sai') ? '-' : '+'}${moeda(m.Valor).replace('-', '')}
            </span>
            ${store.podeEditar ? `<button class="btn-icone" data-action="excluir-mov" data-id="${m.ID}" title="Excluir">${icone('excluir')}</button>` : ''}
          </div>`).join('')}</div>` : '<div class="vazio"><p>Sem aportes manuais.</p></div>'}
      </div>

      <div>
        <h4 style="font-size:13px;color:var(--text-dim);margin-bottom:8px">
          Lancamentos vinculados (${p.qtdLancamentos})
        </h4>
        ${p.lancamentos && p.lancamentos.length ? `<div class="lista">${p.lancamentos.map((l) => `
          <div class="lista-item">
            <span class="ponto" style="background:${store.categoriaPorId(l.CategoriaID)?.Cor || '#64748b'}"></span>
            <div class="principal">
              <div class="titulo">${esc(l.Descricao)}</div>
              <div class="meta">${esc(dataBR(l.Data))} · ${esc(store.nomeCategoria(l.CategoriaID))} · ${esc(l.Status || '')}</div>
            </div>
            <span class="valor ${l.Tipo === 'Receita' ? 'valor-receita' : 'valor-despesa'}">
              ${l.Tipo === 'Receita' ? '+' : '-'}${moeda(l.Valor).replace('-', '')}
            </span>
          </div>`).join('')}</div>` : `
          <div class="vazio"><p>
            Nenhum lancamento vinculado a esta caixinha.<br>
            Ao criar um lancamento, escolha esta caixinha no campo "Caixinha vinculada".
          </p></div>`}
      </div>
    </div>`;

  abrirModal({
    titulo: c.Nome,
    corpo,
    rodape: store.podeEditar ? `
      <button type="button" class="btn btn-primario" data-aporte>Depositar</button>
      <button type="button" class="btn" data-fechar>Fechar</button>` : `<button type="button" class="btn" data-fechar>Fechar</button>`
  });

  const dlg = document.getElementById('modal');
  const btnAporte = dlg.querySelector('[data-aporte]');
  if (btnAporte) btnAporte.addEventListener('click', () => abrirMovimentacao(c.ID, 'Entrada'));
}

/* ---------------------------------------------------------------------
 * Movimentacao (deposito / resgate)
 * ------------------------------------------------------------------- */
function abrirMovimentacao(caixinhaId, tipo) {
  const c = store.caixinhaPorId(caixinhaId);
  if (!c) return;

  const corpo = `
    <form id="form-mov" style="display:grid;gap:14px">
      <input type="hidden" name="CaixinhaID" value="${esc(caixinhaId)}">
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="m-tipo">Tipo</label>
          <select class="select" id="m-tipo" name="Tipo">
            <option value="Entrada" ${tipo === 'Entrada' ? 'selected' : ''}>Entrada (depositar)</option>
            <option value="Saida" ${tipo === 'Saida' ? 'selected' : ''}>Saida (resgatar)</option>
          </select>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="m-data">Data</label>
          <input class="input" id="m-data" name="Data" type="date" value="${hojeISO()}">
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="m-valor">Valor <span class="obrig">*</span></label>
          <input class="input" id="m-valor" name="Valor" inputmode="decimal" placeholder="0,00" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="m-desc">Descricao</label>
          <input class="input" id="m-desc" name="Descricao" maxlength="120" placeholder="Ex.: deposito mensal">
        </div>
      </div>
      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: `${tipo === 'Entrada' ? 'Depositar em' : 'Resgatar de'} ${c.Nome}`,
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Registrar</button>`
  });

  const form = dlg.querySelector('#form-mov');
  const erro = dlg.querySelector('#erro-form');
  const btn = dlg.querySelector('[data-salvar]');

  btn.addEventListener('click', async () => {
    const fd = new FormData(form);
    const dados = {
      CaixinhaID: fd.get('CaixinhaID'),
      Tipo: fd.get('Tipo'),
      Data: fd.get('Data') || hojeISO(),
      Valor: Number(String(fd.get('Valor') || '0').replace(',', '.')),
      Descricao: String(fd.get('Descricao') || '').trim()
    };
    if (!(dados.Valor > 0)) { erro.textContent = 'O valor deve ser maior que zero.'; return; }

    await comBotao(btn, async () => {
      try {
        await store.acao('movimentarcaixinha', { dados });
        fecharModal();
        toast('Movimentacao registrada!', 'sucesso');
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}

/* ---------------------------------------------------------------------
 * Formulario da caixinha
 * ------------------------------------------------------------------- */
function abrirFormulario(c) {
  const edicao = !!(c && c.ID);
  const d = c || { Nome: '', Descricao: '', Meta: 0, Prazo: '', SaldoInicial: 0, Cor: '#22c55e', Ativo: 'SIM' };

  const corpo = `
    <form id="form-caix" style="display:grid;gap:14px">
      <input type="hidden" name="ID" value="${esc(d.ID || '')}">
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="x-nome">Nome <span class="obrig">*</span></label>
          <input class="input" id="x-nome" name="Nome" maxlength="60" value="${esc(d.Nome || '')}" required>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="x-meta">Meta (valor alvo)</label>
          <input class="input" id="x-meta" name="Meta" inputmode="decimal" placeholder="0,00"
                 value="${d.Meta ? esc(d.Meta) : ''}">
        </div>
      </div>
      <div class="campo">
        <label class="campo-rotulo" for="x-desc">Descricao</label>
        <input class="input" id="x-desc" name="Descricao" maxlength="120" value="${esc(d.Descricao || '')}">
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="x-prazo">Prazo (mes limite)</label>
          <input class="input" id="x-prazo" name="Prazo" type="month" value="${esc(d.Prazo || '')}">
          <span class="num-pequeno">Usado para calcular quanto guardar por mes</span>
        </div>
        <div class="campo">
          <label class="campo-rotulo" for="x-inicial">Saldo inicial</label>
          <input class="input" id="x-inicial" name="SaldoInicial" inputmode="decimal" placeholder="0,00"
                 value="${d.SaldoInicial ? esc(d.SaldoInicial) : ''}">
        </div>
      </div>
      <div class="form-grid">
        <div class="campo">
          <label class="campo-rotulo" for="x-cor">Cor</label>
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
      <div class="erro-campo" id="erro-form"></div>
    </form>`;

  const dlg = abrirModal({
    titulo: edicao ? 'Editar caixinha' : 'Nova caixinha',
    corpo,
    rodape: `
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="button" class="btn btn-primario" data-salvar>Salvar</button>`
  });

  const form = dlg.querySelector('#form-caix');
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
      Descricao: String(fd.get('Descricao') || '').trim(),
      Meta: fd.get('Meta') || 0,
      Prazo: fd.get('Prazo') || '',
      SaldoInicial: fd.get('SaldoInicial') || 0,
      Cor: fd.get('Cor'),
      Ativo: form.querySelector('[name=Ativo]').checked ? 'SIM' : 'NAO'
    };
    if (!dados.Nome) { erro.textContent = 'Informe o nome.'; return; }

    await comBotao(btn, async () => {
      try {
        await store.acao('salvarcaixinha', { dados });
        fecharModal();
        toast('Caixinha salva!', 'sucesso');
      } catch (e) {
        erro.textContent = e.message;
        toast(e.message, 'erro');
      }
    });
  });
}
