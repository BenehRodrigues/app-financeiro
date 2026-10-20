/* =====================================================================
 * charts.js — graficos em SVG puro (sem libs externas, 100% responsivos)
 * ===================================================================== */

const NS = 'http://www.w3.org/2000/svg';

function curto(v) {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n * 100) / 100);
}

function escala(maxV, ticks = 4) {
  if (!isFinite(maxV) || maxV <= 0) return { max: 1, step: 0.25 };
  const bruto = maxV / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  let mult = 1;
  if (norm > 1 && norm <= 2) mult = 2;
  else if (norm > 2 && norm <= 2.5) mult = 2.5;
  else if (norm > 2.5 && norm <= 5) mult = 5;
  else if (norm > 5) mult = 10;
  const step = mult * mag;
  return { max: Math.ceil(maxV / step) * step, step };
}

function encurtar(t, n = 9) {
  const s = String(t ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ---------------------------------------------------------------------
 * Barras agrupadas verticais
 * ------------------------------------------------------------------- */
export function barras({ labels = [], series = [], altura = 240, formatador = (v) => String(v) }) {
  const W = 760, H = altura;
  const pad = { t: 16, r: 10, b: 30, l: 52 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const valores = series.flatMap((s) => (s.valores || []).map((v) => Math.abs(Number(v) || 0)));
  const { max, step } = escala(Math.max(1, ...valores));
  const n = Math.max(1, labels.length);
  const grupo = iw / n;
  const qtd = Math.max(1, series.length);
  const gap = Math.min(16, grupo * 0.22);
  const largura = Math.max(3, ((grupo - gap) / qtd) * 0.78);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">`;

  // grade
  for (let v = 0; v <= max + step / 2; v += step) {
    const y = pad.t + ih - (v / max) * ih;
    svg += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"
      stroke="currentColor" stroke-opacity=".12" stroke-width="1"/>`;
    svg += `<text x="${pad.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end"
      font-size="11" fill="currentColor" fill-opacity=".5">${curto(v)}</text>`;
  }

  labels.forEach((rot, i) => {
    const centro = pad.l + grupo * i + grupo / 2;
    const larguraTotal = largura * qtd + gap * (qtd - 1);
    const x0 = centro - larguraTotal / 2;

    series.forEach((s, j) => {
      const v = Number((s.valores || [])[i]) || 0;
      const alt = Math.max(0, (Math.abs(v) / max) * ih);
      const x = x0 + j * (largura + gap);
      const y = pad.t + ih - alt;
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${largura.toFixed(1)}"
        height="${Math.max(alt, v === 0 ? 0 : 1.5).toFixed(1)}" rx="${Math.min(4, largura / 2).toFixed(1)}"
        fill="${s.cor || '#64748b'}"><title>${s.nome}: ${formatador(v)}</title></rect>`;
    });

    svg += `<text x="${centro.toFixed(1)}" y="${H - 10}" text-anchor="middle"
      font-size="11" fill="currentColor" fill-opacity=".6">${encurtar(rot, 10)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

/* ---------------------------------------------------------------------
 * Rosca (donut)
 * ------------------------------------------------------------------- */
export function rosca({ valores = [], cores = [], formato = (v) => String(v), tam = 260, esp = 40 }) {
  const total = valores.reduce((s, v) => s + (Math.abs(Number(v)) || 0), 0);
  const r = (tam - esp) / 2;
  const cx = tam / 2, cy = tam / 2;
  const C = 2 * Math.PI * r;

  let svg = `<svg viewBox="0 0 ${tam} ${tam}" role="img" preserveAspectRatio="xMidYMid meet"
    style="max-width:${tam}px;margin:0 auto">`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="${esp}"/>`;

  if (total > 0) {
    let acumulado = 0;
    valores.forEach((v, i) => {
      const val = Math.abs(Number(v) || 0);
      if (val <= 0) return;
      const len = (val / total) * C;
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${cores[i % (cores.length || 1)] || '#64748b'}" stroke-width="${esp}"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
        stroke-dashoffset="${(-acumulado).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt">
        <title>${formato(val)}</title></circle>`;
      acumulado += len;
    });
  }

  svg += '</svg>';
  return svg;
}

/* ---------------------------------------------------------------------
 * Linha / area
 * ------------------------------------------------------------------- */
export function linha({ labels = [], series = [], altura = 240, formatador = (v) => String(v) }) {
  const W = 760, H = altura;
  const pad = { t: 16, r: 12, b: 30, l: 52 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const todos = series.flatMap((s) => (s.valores || []).map((v) => Number(v) || 0));
  const { max, step } = escala(Math.max(1, ...todos.map(Math.abs)));
  const n = Math.max(1, labels.length);
  const px = (i) => pad.l + (iw / n) * (i + 0.5);
  const py = (v) => pad.t + ih - (Math.abs(v) / max) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">`;

  for (let v = 0; v <= max + step / 2; v += step) {
    const y = pad.t + ih - (v / max) * ih;
    svg += `<line x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"
      stroke="currentColor" stroke-opacity=".12"/>`;
    svg += `<text x="${pad.l - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11"
      fill="currentColor" fill-opacity=".5">${curto(v)}</text>`;
  }

  series.forEach((s) => {
    const vals = s.valores || [];
    const pontos = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
    if (!pontos.length) return;

    if (s.area !== false) {
      const area = `M ${px(0).toFixed(1)},${(pad.t + ih).toFixed(1)} L ${pontos.join(' L ')} L ${px(vals.length - 1).toFixed(1)},${(pad.t + ih).toFixed(1)} Z`;
      svg += `<path d="${area}" fill="${s.cor || '#64748b'}" fill-opacity=".13"/>`;
    }

    svg += `<polyline points="${pontos.join(' ')}" fill="none" stroke="${s.cor || '#64748b'}"
      stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;

    vals.forEach((v, i) => {
      svg += `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3.2" fill="${s.cor || '#64748b'}"
        stroke="var(--surface)" stroke-width="1.6"><title>${s.nome}: ${formatador(v)}</title></circle>`;
    });
  });

  labels.forEach((rot, i) => {
    svg += `<text x="${px(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="11"
      fill="currentColor" fill-opacity=".6">${encurtar(rot, 10)}</text>`;
  });

  svg += '</svg>';
  return svg;
}

/* ---------------------------------------------------------------------
 * Barras horizontais (ranking)
 * ------------------------------------------------------------------- */
export function hbarras({ itens = [], altura = 22, formatador = (v) => String(v) }) {
  if (!itens.length) return '';
  const W = 760;
  const larguraRotulo = 150;
  const larguraValor = 96;
  const iw = W - larguraRotulo - larguraValor - 12;
  const max = Math.max(1, ...itens.map((i) => Math.abs(Number(i.valor) || 0)));
  const H = itens.length * (altura + 12);

  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">`;
  itens.forEach((item, i) => {
    const y = i * (altura + 12);
    const v = Math.abs(Number(item.valor) || 0);
    const w = Math.max(2, (v / max) * iw);
    svg += `<text x="${larguraRotulo - 10}" y="${y + altura / 2 + 4}" text-anchor="end" font-size="12"
      fill="currentColor" fill-opacity=".75">${encurtar(item.rotulo, 20)}</text>`;
    svg += `<rect x="${larguraRotulo}" y="${y}" width="${iw}" height="${altura}" rx="5"
      fill="currentColor" fill-opacity=".07"/>`;
    svg += `<rect x="${larguraRotulo}" y="${y}" width="${w.toFixed(1)}" height="${altura}" rx="5"
      fill="${item.cor || '#64748b'}"><title>${item.rotulo}: ${formatador(v)}</title></rect>`;
    svg += `<text x="${W - 4}" y="${y + altura / 2 + 4}" text-anchor="end" font-size="12"
      fill="currentColor" fill-opacity=".9" font-weight="600">${formatador(v)}</text>`;
  });
  svg += '</svg>';
  return svg;
}

export { NS };
