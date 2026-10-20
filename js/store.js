/* ============================================================
 *  store.js — Estado e regras de negócio (agregações)
 * ------------------------------------------------------------
 *  Toda a lógica de totais, médias, projeções e caixinha mora
 *  aqui, separada da interface.
 * ============================================================ */

const Store = (() => {

  /** Normaliza um lançamento vindo da planilha. */
  function normalize(row) {
    const tipo = (row.tipo || '').trim();
    const isReceita = /receita/i.test(tipo);
    return {
      id: String(row.id || ''),
      data: row.data || '',
      mesAno: row.mesAno || '',
      tipo,
      isReceita,
      categoria: (row.categoria || '').trim(),
      descricao: (row.descricao || '').trim(),
      valor: Math.abs(Number(row.valor) || 0),
      status: (row.status || 'Realizado').trim(),
      key: row.key || (row.data ? Format.monthKeyFromISO(row.data) : Format.monthKey(row.mesAno))
    };
  }

  /** Lista de meses (chaves) com dados, ordenada. */
  function monthsWithData(lancamentos) {
    const set = new Set();
    lancamentos.forEach(l => { if (l.key) set.add(l.key); });
    return [...set].sort();
  }

  /** Agregação por mês para as chaves informadas. */
  function monthlyAgg(lancamentos, keys) {
    const map = {};
    keys.forEach(k => { map[k] = { receitas: 0, despesas: 0, saldo: 0 }; });
    lancamentos.forEach(l => {
      const k = l.key;
      if (!map[k]) map[k] = { receitas: 0, despesas: 0, saldo: 0 };
      if (l.isReceita) map[k].receitas += l.valor; else map[k].despesas += l.valor;
    });
    Object.keys(map).forEach(k => { map[k].saldo = map[k].receitas - map[k].despesas; });
    return map;
  }

  /** Totais de um mês específico. */
  function monthTotals(lancamentos, key) {
    let receitas = 0, despesas = 0;
    lancamentos.forEach(l => {
      if (l.key !== key) return;
      if (l.isReceita) receitas += l.valor; else despesas += l.valor;
    });
    return { receitas, despesas, saldo: receitas - despesas };
  }

  /** Totais filtrados (para KPIs do período). */
  function totalsFor(lancamentos) {
    let receitas = 0, despesas = 0;
    lancamentos.forEach(l => {
      if (l.isReceita) receitas += l.valor; else despesas += l.valor;
    });
    return { receitas, despesas, saldo: receitas - despesas };
  }

  /** Soma por categoria. Retorna array ordenado desc. */
  function byCategory(lancamentos, isReceita) {
    const map = {};
    lancamentos.forEach(l => {
      if (l.isReceita !== isReceita) return;
      const c = l.categoria || (isReceita ? 'Receitas' : 'Outros');
      map[c] = (map[c] || 0) + l.valor;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  /** Soma por tipo (macro categoria). */
  function byType(lancamentos) {
    const map = {};
    lancamentos.forEach(l => {
      const t = l.tipo || 'Outros';
      if (!map[t]) map[t] = { receitas: 0, despesas: 0 };
      if (l.isReceita) map[t].receitas += l.valor; else map[t].despesas += l.valor;
    });
    return map;
  }

  /** Média mensal de receitas e despesas considerando os últimos N meses COM DADOS. */
  function averages(lancamentos, n) {
    const keys = monthsWithData(lancamentos);
    const lastN = keys.slice(-n);
    const agg = monthlyAgg(lancamentos, lastN);
    let r = 0, d = 0;
    lastN.forEach(k => { r += agg[k].receitas; d += agg[k].despesas; });
    const div = lastN.length || 1;
    return { receitas: r / div, despesas: d / div, mesesUsados: lastN.length };
  }

  /**
   * Projeção de caixa:
   *  - Para meses com lançamentos (realizado/previsto) usa o saldo real.
   *  - Para meses futuros usa a média mensal (últimos N meses com dados).
   * Retorna lista de { key, receitas, despesas, saldo, caixa, isProjecao }.
   */
  function project(lancamentos, reservaInicial, opts = {}) {
    const mediaMeses = opts.mediaMeses || CONFIG.MESES_MEDIA;
    const horizonte = opts.horizonte || CONFIG.MESES_PROJECAO;
    const avg = averages(lancamentos, mediaMeses);

    const dataKeys = monthsWithData(lancamentos);
    const atual = Format.currentMonthKey();
    const startKey = dataKeys.length ? dataKeys[0] : atual;
    // garante que o mês atual e o futuro entrem na janela
    const keys = [];
    const d0 = Format.keyToDate(startKey);
    const d1 = Format.keyToDate(atual);
    if (d0 && d1) {
      const start = d0 < d1 ? d0 : d1;
      for (let i = 0; i < horizonte; i++) {
        keys.push(start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0'));
        start.setMonth(start.getMonth() + 1);
      }
    } else {
      keys.push(...Format.monthKeys(atual, horizonte));
    }

    const agg = monthlyAgg(lancamentos, keys);
    let caixa = Number(reservaInicial) || 0;
    const series = keys.map(k => {
      const hasData = agg[k].receitas > 0 || agg[k].despesas > 0;
      const receitas = hasData ? agg[k].receitas : avg.receitas;
      const despesas = hasData ? agg[k].despesas : avg.despesas;
      const saldo = receitas - despesas;
      caixa += saldo;
      return { key: k, receitas, despesas, saldo, caixa, isProjecao: !hasData };
    });
    return { series, mediaReceitas: avg.receitas, mediaDespesas: avg.despesas, mediaMeses: avg.mesesUsados };
  }

  /** Saldo da caixinha (soma dos valores, que já vêm com sinal). */
  function caixinhaSaldo(movimentos) {
    return (movimentos || []).reduce((acc, m) => acc + (Number(m.valor) || 0), 0);
  }

  /** Total de lançamentos filtrados. */
  function filter(lancamentos, filters = {}) {
    return lancamentos.filter(l => {
      if (filters.key && l.key !== filters.key) return false;
      if (filters.tipo && l.tipo !== filters.tipo) return false;
      if (filters.categoria && l.categoria !== filters.categoria) return false;
      if (filters.status && l.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!(l.descricao || '').toLowerCase().includes(q) && !(l.categoria || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  return {
    normalize, monthsWithData, monthlyAgg, monthTotals, totalsFor,
    byCategory, byType, averages, project, caixinhaSaldo, filter
  };
})();
