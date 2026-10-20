/* =====================================================================
 * utils.js — formatacao, datas, icones e pequenos helpers de DOM
 * ===================================================================== */
import { CONFIG } from './config.js';

/* ------------------------------ texto ------------------------------- */
export function esc(v) {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/* ------------------------------ numeros ----------------------------- */
export function num(v, casas = 2) {
  const n = Number(v);
  if (!isFinite(n)) return '0';
  return n.toLocaleString(CONFIG.locale || 'pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

export function moeda(v, { sinal = false, compacto = false } = {}) {
  const n = Number(v) || 0;
  const sim = CONFIG.simbolo_moeda || 'R$';
  const casas = CONFIG.mostrar_centavos === 'NAO' ? 0 : 2;

  if (compacto && Math.abs(n) >= 1000) {
    const mil = n / 1000;
    const txt = mil.toLocaleString(CONFIG.locale || 'pt-BR', { maximumFractionDigits: 1 });
    return `${n < 0 ? '-' : (sinal ? '+' : '')}${sim} ${txt}k`;
  }

  const txt = Math.abs(n).toLocaleString(CONFIG.locale || 'pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
  const prefixo = n < 0 ? '-' : (sinal ? '+' : '');
  return `${prefixo}${sim} ${txt}`;
}

export function porcento(v, casas = 1) {
  const n = Number(v) || 0;
  return `${n.toLocaleString(CONFIG.locale || 'pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

export function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s) return 0;
  const limpo = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return isFinite(n) ? n : 0;
}

/* ------------------------------ datas ------------------------------- */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Converte 'yyyy-MM-dd' (sem fuso) em Date local — seguro. */
export function paraData(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return isNaN(iso.getTime()) ? null : iso;
  const s = String(iso).trim();
  if (!s) return null;

  // yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

  // dd/mm/yyyy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Normaliza qualquer formato de data para 'yyyy-MM-dd'.
 * Aceita: Date, 'yyyy-MM-dd', 'dd/mm/yyyy', 'yyyy-MM-ddTHH:mm:ss', timestamps.
 */
export function normalizarData(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
  }
  const s = String(v).trim();
  if (!s) return '';

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return '';
}

/**
 * Normaliza a competencia para 'yyyy-MM'.
 * Aceita: 'yyyy-MM', 'yyyy-MM-dd', 'dd/mm/yyyy', Date, numero (yyyymm),
 * string com espacos. Devolve '' quando nao da para interpretar.
 */
export function normalizarCompetencia(v) {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return normalizarData(v).slice(0, 7);

  const s = String(v).trim();
  if (!s) return '';

  // yyyy-mm ou yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${pad2(m[2])}`;

  // yyyymm
  m = s.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  // dd/mm/yyyy ou qualquer data reconhecivel
  const data = normalizarData(s);
  if (data) return data.slice(0, 7);

  return '';
}


export function dataBR(iso) {
  const d = paraData(iso);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function dataCurta(iso) {
  const d = paraData(iso);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function diaSemana(iso) {
  const d = paraData(iso);
  if (!d) return '';
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][d.getDay()];
}

/** 'yyyy-MM' -> 'out/2026' */
export function mesBR(ym) {
  if (!ym) return '';
  const [a, m] = String(ym).split('-');
  const i = (parseInt(m, 10) || 1) - 1;
  return `${MESES[i] || ''}/${a}`;
}

/** 'yyyy-MM' -> 'Outubro de 2026' */
export function mesExtenso(ym) {
  if (!ym) return '';
  const [a, m] = String(ym).split('-');
  const i = (parseInt(m, 10) || 1) - 1;
  return `${MESES_LONGOS[i] || ''} de ${a}`;
}

/** 'yyyy-MM' -> '2026-10-01' (primeiro dia) */
export function mesParaISO(ym) {
  return `${ym}-01`;
}

/** 'yyyy-MM' -> '2026-10' */
export function isoParaMes(iso) {
  return String(iso || '').slice(0, 7);
}

export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addMeses(ym, n) {
  const [a, m] = String(ym).split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function diffMeses(a, b) {
  const [aa, am] = String(a).split('-').map(Number);
  const [ba, bm] = String(b).split('-').map(Number);
  return (ba - aa) * 12 + (bm - am);
}

export function ultimoDiaDoMes(ym) {
  const [a, m] = String(ym).split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

export function diasAte(iso) {
  const d = paraData(iso);
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

/* ------------------------------ DOM --------------------------------- */
export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ------------------------------ icones ------------------------------ */
const ICONES = {
  painel: '<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="11" width="7" height="10" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  lancamentos: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  categorias: '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  contas: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
  caixinhas: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  relatorios: '<path d="M3 3v18h18"/><path d="M7 15v3M12 9v9M17 5v13"/>',
  acessos: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  mais: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
  somar: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  excluir: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  atualizar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  filtro: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
  esquerda: '<path d="m15 18-6-6 6-6"/>',
  direita: '<path d="m9 18 6-6-6-6"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 5-5"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  cofre: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5V7M12 16.5V17"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'
};

export function icone(nome, classe = '') {
  const d = ICONES[nome] || ICONES.info || '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" class="${classe}" aria-hidden="true">${d}</svg>`;
}

/* ------------------------------ cores ------------------------------- */
export function corDe(cores, indice, padrao = '#64748b') {
  if (!cores || !cores.length) return padrao;
  return cores[indice % cores.length];
}

export function corContrasta(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#000';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
}
