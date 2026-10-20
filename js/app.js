/* ============================================================
 *  app.js — Aplicação (estado, renderização e eventos)
 * ============================================================ */

const App = (() => {

  /* ---------------- Estado ---------------- */
  const state = {
    lancamentos: [],
    dashboard: {},
    caixinha: { meta: 0, saldo: 0, movimentos: [] },
    categorias: { receita: [], despesa: [] },
    selectedMonth: Format.currentMonthKey(),
    filters: { tipo: '', categoria: '', status: '' },
    loading: true,
    error: null,
    chartsOk: true
  };

  /* ---------------- Helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function monthLancamentos() {
    return Store.filter(state.lancamentos, { key: state.selectedMonth });
  }

  function mediaDespesas() {
    return Store.averages(state.lancamentos, CONFIG.MESES_MEDIA).despesas;
  }

  /* ---------------- Bootstrap ---------------- */
  async function init() {
    state.chartsOk = Charts.init();
    bindEvents();
    setMonthPickerDefault();
    renderSkeleton();
    if (isConfigured()) {
      await load();
    } else {
      showSetupNeeded();
    }
  }

  function isConfigured() {
    return !/SEU_CODIGO_AQUI/.test(CONFIG.APPS_SCRIPT_URL);
  }

  function setMonthPickerDefault() {
    const d = new Date();
    $('monthPicker').value = Format.currentMonthKey();
  }

  function renderSkeleton() {
    // garante que o seletor de mês reflete o estado
    state.selectedMonth = $('monthPicker').value || Format.currentMonthKey();
  }

  /* ---------------- Carregamento ---------------- */
  async function load() {
    showLoading(true);
    hideError();
    try {
      const data = await Api.list();
      state.lancamentos = (data.lancamentos || []).map(Store.normalize);
      state.dashboard = data.dashboard || {};
      state.caixinha = data.caixinha || { meta: 0, saldo: 0, movimentos: [] };
      state.categorias = data.categorias || { receita: [], despesa: [] };
      state.error = null;
      renderAll();
    } catch (e) {
      state.error = (e && e.message) ? e.message : String(e);
      showError(state.error);
    } finally {
      showLoading(false);
    }
  }

  function renderAll() {
    renderKpis();
    renderCharts();
    renderProjections();
    renderCaixinha();
    renderFilters();
    renderTable();
    renderDatalist();
  }

  /* ---------------- KPIs ---------------- */
  function renderKpis() {
    const t = Store.monthTotals(state.lancamentos, state.selectedMonth);
    const comprometimento = t.receitas > 0 ? t.despesas / t.receitas : 0;
    const saldoClass = t.saldo >= 0 ? 'pos' : 'neg';

    $('kpis').innerHTML = `
      <article class="kpi">
        <span class="kpi-label">Receitas</span>
        <span class="kpi-value pos">${Format.brl(t.receitas)}</span>
        <span class="kpi-sub">${esc(Format.monthLabelLong(state.selectedMonth))}</span>
      </article>
      <article class="kpi">
        <span class="kpi-label">Despesas</span>
        <span class="kpi-value neg">${Format.brl(t.despesas)}</span>
        <span class="kpi-sub">${esc(Format.monthLabelLong(state.selectedMonth))}</span>
      </article>
      <article class="kpi">
        <span class="kpi-label">Saldo do mês</span>
        <span class="kpi-value ${saldoClass}">${Format.brl(t.saldo)}</span>
        <span class="kpi-sub">${t.saldo >= 0 ? 'Superávit' : 'Déficit'}</span>
      </article>
      <article class="kpi">
        <span class="kpi-label">Comprometimento</span>
        <span class="kpi-value">${Format.pct(comprometimento)}</span>
        <span class="kpi-sub">das receitas comprometidas</span>
      </article>`;
  }

  /* ---------------- Gráficos ---------------- */
  function renderCharts() {
    if (!state.chartsOk) {
      ['chartMonthly', 'chartExpCat', 'chartIncCat', 'chartProjection'].forEach(id => {
        const c = $(id);
        if (c && c.parentElement) {
          c.parentElement.innerHTML = '<div class="chart-unsupported">⚠️ Gráficos indisponíveis (Chart.js não carregou).</div>';
        }
      });
      return;
    }

    // Mensal (meses com lançamentos)
    const dataKeys = Store.monthsWithData(state.lancamentos).slice(-CONFIG.MESES_GRAFICO);
    const agg = Store.monthlyAgg(state.lancamentos, dataKeys);
    Charts.monthly(
      $('chartMonthly'),
      dataKeys.map(Format.monthLabel),
      dataKeys.map(k => agg[k].receitas),
      dataKeys.map(k => agg[k].despesas)
    );

    // Categorias (mês selecionado)
    const ml = monthLancamentos();
    const expCat = Store.byCategory(ml, false);
    const incCat = Store.byCategory(ml, true);
    $('chartCatPeriod').textContent = Format.monthLabelLong(state.selectedMonth);
    Charts.doughnut($('chartExpCat'), expCat.map(c => c.name), expCat.map(c => c.value), 'expCat');
    Charts.doughnut($('chartIncCat'), incCat.map(c => c.name), incCat.map(c => c.value), 'incCat');

    // Projeção
    const reserva = Number(state.dashboard.caixaReservaInicial) || 0;
    const proj = Store.project(state.lancamentos, reserva);
    Charts.projection(
      $('chartProjection'),
      proj.series.map(p => Format.monthLabel(p.key)),
      proj.series.map(p => p.caixa),
      proj.series.map(p => p.saldo)
    );
  }

  /* ---------------- Projeções ---------------- */
  function renderProjections() {
    const reserva = Number(state.dashboard.caixaReservaInicial) || 0;
    const saldoLiquido = Number(state.dashboard.saldoLiquidoMensal);
    const saldoMes = isFinite(saldoLiquido) && saldoLiquido !== 0 ? saldoLiquido : Store.monthTotals(state.lancamentos, state.selectedMonth).saldo;
    const caixaFinalProjetado = reserva + saldoMes;

    const proj = Store.project(state.lancamentos, reserva);
    const caixaFuturo = proj.series.length ? proj.series[proj.series.length - 1].caixa : reserva;
    const mediaR = proj.mediaReceitas;
    const mediaD = proj.mediaDespesas;

    const card = (label, value, sub, cls = '', extra = '') => `
      <article class="proj-card">
        <span class="proj-label">${esc(label)}</span>
        <span class="proj-value ${cls}">${value}</span>
        <span class="proj-sub">${esc(sub)}</span>
        ${extra}
      </article>`;

    $('projectionCards').innerHTML =
      card('Caixa / Reserva Inicial',
        Format.brl(reserva),
        'valor base (editável)',
        '',
        `<div class="inline-edit">
           <input type="number" id="reservaInput" step="0.01" value="${reserva}" aria-label="Caixa / Reserva Inicial">
           <button class="btn btn-sm btn-primary" id="btnSaveReserva">Salvar</button>
         </div>`) +
      card('Saldo Líquido Mensal', Format.brl(saldoMes), 'receitas − despesas do mês') +
      card('Caixa Final Projetado', Format.brl(caixaFinalProjetado), 'reserva + saldo do mês', caixaFinalProjetado >= 0 ? 'pos' : 'neg') +
      card('Caixa Futuro (12 meses)', Format.brl(caixaFuturo), 'projeção acumulada', caixaFuturo >= 0 ? 'pos' : 'neg') +
      card('Projeção de Receitas', Format.brl(mediaR), 'média mensal (últimos ' + proj.mediaMeses + ' meses)', 'pos') +
      card('Projeção de Despesas', Format.brl(mediaD), 'média mensal (últimos ' + proj.mediaMeses + ' meses)', 'neg');

    const saveBtn = $('btnSaveReserva');
    if (saveBtn) saveBtn.addEventListener('click', saveReserva);
  }

  /* ---------------- Caixinha ---------------- */
  function renderCaixinha() {
    const cx = state.caixinha || {};
    const saldo = Number(cx.saldo) || 0;
    const meta = Number(cx.meta) || 0;
    const progresso = meta > 0 ? Math.max(0, Math.min(1, saldo / meta)) : 0;
    const mediaD = mediaDespesas();
    const cobertura = mediaD > 0 ? saldo / mediaD : 0;
    const status = progresso >= 1 ? 'Completa 🎉' : (progresso > 0 ? 'Em construção' : 'Comece agora');

    const movimentos = (cx.movimentos || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 6);

    $('caixinha').innerHTML = `
      <div class="cx-main">
        <div class="cx-saldo">
          <span class="cx-label">Saldo da caixinha</span>
          <span class="cx-value ${saldo >= 0 ? 'pos' : 'neg'}">${Format.brl(saldo)}</span>
          <span class="cx-sub">${status} · ${cobertura.toFixed(1)} mês(es) de gasto</span>
        </div>
        <div class="cx-meta">
          <span class="cx-label">Meta emergencial</span>
          <span class="cx-value">${Format.brl(meta)}</span>
          <button class="btn btn-sm btn-ghost" id="btnEditMeta">Editar meta</button>
        </div>
      </div>
      <div class="progress"><div class="progress-bar" style="width:${(progresso * 100).toFixed(1)}%"></div></div>
      <div class="cx-movs">
        <span class="cx-label">Últimos movimentos</span>
        ${movimentos.length ? `<ul>${movimentos.map(m => `
          <li>
            <span class="mov-date">${esc(Format.toBR(m.data))}</span>
            <span class="mov-desc">${esc(m.descricao || m.tipo)}</span>
            <span class="mov-val ${m.valor >= 0 ? 'pos' : 'neg'}">${Format.brl(m.valor)}</span>
            <button class="icon-btn" data-del-mov="${esc(m.id)}" aria-label="Excluir">🗑</button>
          </li>`).join('')}</ul>`
        : '<p class="muted">Nenhum movimento ainda.</p>'}
      </div>`;

    const editBtn = $('btnEditMeta');
    if (editBtn) editBtn.addEventListener('click', editMeta);
    document.querySelectorAll('[data-del-mov]').forEach(btn => {
      btn.addEventListener('click', () => deleteMovimento(btn.getAttribute('data-del-mov')));
    });
  }

  /* ---------------- Filtros e tabela ---------------- */
  function renderFilters() {
    const selTipo = $('filterTipo');
    const selCat = $('filterCat');

    if (!selTipo.dataset.filled) {
      selTipo.innerHTML = '<option value="">Todos os tipos</option>' +
        TIPOS_LANCAMENTO.map(t => `<option>${esc(t)}</option>`).join('');
      selTipo.dataset.filled = '1';
    }
    if (!selCat.dataset.filled) {
      const cats = [...new Set(state.lancamentos.map(l => l.categoria).filter(Boolean))].sort();
      selCat.innerHTML = '<option value="">Todas as categorias</option>' +
        cats.map(c => `<option>${esc(c)}</option>`).join('');
      selCat.dataset.filled = '1';
    }
  }

  function renderTable() {
    const list = Store.filter(state.lancamentos, state.filters)
      .slice()
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.id || '').localeCompare(a.id || ''));

    const tbody = $('tbodyLanc');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum lançamento encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(l => `
      <tr>
        <td>${esc(Format.toBR(l.data))}</td>
        <td><span class="tag ${l.isReceita ? 'tag-inc' : 'tag-exp'}">${esc(l.tipo)}</span></td>
        <td>${esc(l.categoria)}</td>
        <td class="desc">${esc(l.descricao)}</td>
        <td class="num ${l.isReceita ? 'pos' : 'neg'}">${l.isReceita ? '+' : '−'}${Format.brl(l.valor)}</td>
        <td><span class="status status-${l.status === 'Previsto' ? 'prev' : 'real'}">${esc(l.status)}</span></td>
        <td class="actions">
          <button class="icon-btn" data-edit="${esc(l.id)}" aria-label="Editar" title="Editar">✏️</button>
          <button class="icon-btn" data-del="${esc(l.id)}" aria-label="Excluir" title="Excluir">🗑</button>
        </td>
      </tr>`).join('');

    tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(b.getAttribute('data-edit'))));
    tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => deleteLanc(b.getAttribute('data-del'))));
  }

  function renderDatalist() {
    const cats = [...new Set(state.lancamentos.map(l => l.categoria).filter(Boolean))];
    $('catList').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  }

  /* ---------------- Modal (novo/editar) ---------------- */
  function openModal(id) {
    const form = $('formLanc');
    form.reset();
    $('fId').value = '';
    if (id) {
      const l = state.lancamentos.find(x => x.id === id);
      if (!l) return;
      $('modalTitle').textContent = 'Editar lançamento';
      $('fId').value = l.id;
      $('fData').value = l.data;
      $('fTipo').value = l.tipo;
      $('fCategoria').value = l.categoria;
      $('fDescricao').value = l.descricao;
      $('fValor').value = l.valor;
      $('fStatus').value = l.status;
    } else {
      $('modalTitle').textContent = 'Novo lançamento';
      $('fData').value = Format.toISO(new Date());
      $('fTipo').value = 'Receita';
      $('fStatus').value = 'Realizado';
    }
    $('modal').classList.add('open');
    setTimeout(() => $('fDescricao').focus(), 50);
  }

  function closeModal() {
    $('modal').classList.remove('open');
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      id: $('fId').value || undefined,
      data: $('fData').value,
      tipo: $('fTipo').value,
      categoria: $('fCategoria').value.trim(),
      descricao: $('fDescricao').value.trim(),
      valor: Format.parseBRL($('fValor').value),
      status: $('fStatus').value
    };
    if (!payload.data || isNaN(payload.valor)) {
      toast('Preencha data e valor corretamente.', 'error');
      return;
    }
    payload.mesAno = Format.mesAno(payload.data);

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = payload.id
        ? await Api.post('update', payload)
        : await Api.post('create', payload);
      if (!res.ok) throw new Error(res.error || 'Falha ao salvar');
      closeModal();
      toast(payload.id ? 'Lançamento atualizado na planilha ✅' : 'Lançamento incluído na planilha ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteLanc(id) {
    if (!confirm('Excluir este lançamento da planilha?')) return;
    try {
      const res = await Api.post('delete', { id });
      if (!res.ok) throw new Error(res.error || 'Falha ao excluir');
      toast('Lançamento excluído ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    }
  }

  /* ---------------- Ações de caixa/caixinha ---------------- */
  async function saveReserva() {
    const input = $('reservaInput');
    const valor = Format.parseBRL(input.value);
    if (isNaN(valor)) return toast('Informe um valor válido.', 'error');
    try {
      const res = await Api.post('setReservaInicial', { valor });
      if (!res.ok) throw new Error(res.error || 'Falha');
      toast('Reserva inicial atualizada na planilha ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    }
  }

  async function caixinhaMovimento(tipo) {
    const valor = Format.parseBRL($('cxValor').value);
    const descricao = $('cxDescricao').value.trim();
    if (isNaN(valor) || valor <= 0) return toast('Informe um valor maior que zero.', 'error');
    const signed = tipo === 'Retirada' ? -Math.abs(valor) : Math.abs(valor);
    try {
      const res = await Api.post('caixinhaCreate', {
        data: Format.toISO(new Date()),
        tipo,
        descricao,
        valor: signed
      });
      if (!res.ok) throw new Error(res.error || 'Falha');
      $('cxValor').value = '';
      $('cxDescricao').value = '';
      toast((tipo === 'Retirada' ? 'Retirada' : 'Aporte') + ' registrado ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    }
  }

  async function editMeta() {
    const atual = Number(state.caixinha.meta) || 0;
    const input = prompt('Nova meta da caixinha emergencial (R$):', String(atual));
    if (input === null) return;
    const meta = Format.parseBRL(input);
    if (isNaN(meta)) return toast('Valor inválido.', 'error');
    try {
      const res = await Api.post('caixinhaSetMeta', { meta });
      if (!res.ok) throw new Error(res.error || 'Falha');
      toast('Meta atualizada ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    }
  }

  async function deleteMovimento(id) {
    if (!confirm('Excluir este movimento da caixinha?')) return;
    try {
      const res = await Api.post('caixinhaDelete', { id });
      if (!res.ok) throw new Error(res.error || 'Falha');
      toast('Movimento excluído ✅', 'success');
      await load();
    } catch (err) {
      toast('Erro: ' + err.message, 'error');
    }
  }

  /* ---------------- Eventos ---------------- */
  function bindEvents() {
    $('monthPicker').addEventListener('change', (e) => {
      state.selectedMonth = e.target.value || Format.currentMonthKey();
      renderKpis();
      renderCharts();
      renderTable();
    });

    $('btnNew').addEventListener('click', () => openModal(null));
    $('modalClose').addEventListener('click', closeModal);
    $('btnCancel').addEventListener('click', closeModal);
    $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    $('formLanc').addEventListener('submit', onSubmit);

    $('filterTipo').addEventListener('change', (e) => { state.filters.tipo = e.target.value; renderTable(); });
    $('filterCat').addEventListener('change', (e) => { state.filters.categoria = e.target.value; renderTable(); });
    $('filterStatus').addEventListener('change', (e) => { state.filters.status = e.target.value; renderTable(); });

    $('cxAporte').addEventListener('click', () => caixinhaMovimento('Aporte'));
    $('cxRetirada').addEventListener('click', () => caixinhaMovimento('Retirada'));

    const refresh = $('btnRefresh');
    if (refresh) refresh.addEventListener('click', () => { toast('Sincronizando…'); load(); });
  }

  /* ---------------- UI feedback ---------------- */
  function toast(msg, type = 'info') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  function showLoading(on) {
    const el = $('loading');
    if (el) el.classList.toggle('show', on);
    document.body.classList.toggle('loading', on);
  }

  function showError(msg) {
    const el = $('errorBanner');
    if (!el) return;
    el.innerHTML = `
      <strong>Não foi possível conectar à planilha.</strong>
      <span>${esc(msg)}</span>
      <button class="btn btn-sm btn-primary" id="btnRetry">Tentar novamente</button>`;
    el.classList.add('show');
    const btn = $('btnRetry');
    if (btn) btn.addEventListener('click', load);
  }

  function hideError() {
    const el = $('errorBanner');
    if (el) el.classList.remove('show');
  }

  function showSetupNeeded() {
    const el = $('errorBanner');
    if (!el) return;
    el.innerHTML = `
      <strong>Configuração pendente</strong>
      <span>Você precisa publicar o Apps Script e preencher <code>CONFIG.APPS_SCRIPT_URL</code> em <code>js/config.js</code>. Siga o passo a passo em <code>docs/SETUP.md</code>.</span>`;
    el.classList.add('show');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
