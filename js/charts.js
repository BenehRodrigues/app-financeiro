/* ============================================================
 *  charts.js — Camada de gráficos (Chart.js)
 * ------------------------------------------------------------
 *  Centraliza a criação/destruição dos gráficos para evitar
 *  vazamento de instâncias ao re-renderizar.
 *  Se o Chart.js (CDN) não carregar, exibe aviso no lugar.
 * ============================================================ */

const Charts = (() => {
  const PALETTE = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
    '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#6366f1', '#eab308'
  ];
  const TEXT = '#64748b';
  const GRID = 'rgba(148,163,184,0.18)';

  const instances = {};

  function supported() {
    return typeof window.Chart !== 'undefined';
  }

  function init() {
    if (!supported()) return false;
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = TEXT;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    return true;
  }

  function destroy(name) {
    if (instances[name]) {
      instances[name].destroy();
      delete instances[name];
    }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  /** Barras agrupadas: receitas x despesas por mês. */
  function monthly(canvas, labels, receitas, despesas) {
    destroy('monthly');
    if (!canvas) return;
    if (!supported()) return showUnsupported(canvas);
    instances.monthly = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Receitas', data: receitas, backgroundColor: '#10b981', borderRadius: 6, maxBarThickness: 22 },
          { label: 'Despesas', data: despesas, backgroundColor: '#f43f5e', borderRadius: 6, maxBarThickness: 22 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + Format.brl(c.parsed.y) } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { callback: v => Format.brl(v, { minimumFractionDigits: 0 }) } }
        }
      }
    });
  }

  /** Rosca: distribuição por categoria. `name` identifica a instância. */
  function doughnut(canvas, labels, values, name) {
    const key = name || 'doughnut';
    destroy(key);
    if (!canvas) return;
    if (!supported()) return showUnsupported(canvas);
    const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
    instances[key] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { position: 'right' },
          tooltip: { callbacks: { label: c => { const total = c.dataset.data.reduce((a, b) => a + b, 0); const pct = total ? (c.parsed / total * 100).toFixed(1) : '0'; return ' ' + c.label + ': ' + Format.brl(c.parsed) + ' (' + pct + '%)'; } } }
        }
      }
    });
  }

  /** Linha + barras: caixa acumulado e saldo mensal projetado. */
  function projection(canvas, labels, caixa, saldos) {
    destroy('projection');
    if (!canvas) return;
    if (!supported()) return showUnsupported(canvas);
    instances.projection = new Chart(canvas, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar', label: 'Saldo do mês', data: saldos,
            backgroundColor: saldos.map(v => v >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(244,63,94,0.7)'),
            borderRadius: 4, maxBarThickness: 18, order: 2
          },
          {
            type: 'line', label: 'Caixa acumulado', data: caixa,
            borderColor: '#3b82f6', backgroundColor: '#3b82f6',
            borderWidth: 2, tension: 0.25, pointRadius: 3, order: 1
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + Format.brl(c.parsed.y) } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: GRID }, ticks: { callback: v => Format.brl(v, { minimumFractionDigits: 0 }) } }
        }
      }
    });
  }

  function showUnsupported(canvas) {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    wrap.innerHTML = '<div class="chart-unsupported">⚠️ Gráficos indisponíveis — verifique sua conexão com o CDN do Chart.js.</div>';
  }

  return { init, monthly, doughnut, projection, destroyAll, supported, PALETTE };

})();
