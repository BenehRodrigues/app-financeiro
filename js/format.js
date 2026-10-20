/* ============================================================
 *  format.js — Utilitários de formatação (moeda, data, mês)
 * ============================================================ */

const Format = (() => {

  /** Converte texto/número para número. Aceita "R$ 2.391,90", "2391.9", "2.391,90". */
  function parseBRL(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (value === null || value === undefined) return NaN;
    const clean = String(value)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')   // remove separador de milhar (pt-BR)
      .replace(',', '.');   // vírgula decimal -> ponto
    const n = parseFloat(clean);
    return isFinite(n) ? n : NaN;
  }

  /** Formata número para "R$ 1.234,56". */
  function brl(value, opts = {}) {
    const n = Number(value) || 0;
    return n.toLocaleString(CONFIG.LOCALE, {
      style: 'currency',
      currency: CONFIG.CURRENCY,
      minimumFractionDigits: opts.minimumFractionDigits ?? 2,
      maximumFractionDigits: opts.maximumFractionDigits ?? 2
    });
  }

  /** Formata número para "1.234,56" (sem símbolo de moeda). */
  function num(value, digits = 2) {
    const n = Number(value) || 0;
    return n.toLocaleString(CONFIG.LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  /** Formata percentual: 0.36 -> "36,0%". */
  function pct(fraction, digits = 1) {
    const n = (Number(fraction) || 0) * 100;
    return n.toLocaleString(CONFIG.LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }) + '%';
  }

  const MONTHS_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  /** "2026-10-05" -> "out./2026" (formato da coluna Mês/Ano da planilha). */
  function mesAno(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return MONTHS_ABBR[d.getMonth()] + '/' + d.getFullYear();
  }

  /** "out./2026" -> "2026-10" (chave de mês). */
  function monthKey(mesAnoStr) {
    const parts = String(mesAnoStr || '').split('/');
    if (parts.length < 2) return '';
    const idx = MONTHS_ABBR.indexOf(parts[0].toLowerCase());
    if (idx < 0) return '';
    return parts[1].trim() + '-' + String(idx + 1).padStart(2, '0');
  }

  /** "2026-10-05" -> "2026-10". */
  function monthKeyFromISO(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  /** "2026-10" -> "out./2026". */
  function monthLabel(key) {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return key;
    return MONTHS_ABBR[m - 1] + '/' + y;
  }

  /** "2026-10" -> "Outubro/2026". */
  function monthLabelLong(key) {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return key;
    return MONTHS_FULL[m - 1].charAt(0).toUpperCase() + MONTHS_FULL[m - 1].slice(1) + '/' + y;
  }

  /** Converte "2026-10-05" (ISO) ou "05/10/2026" (BR) para Date local. */
  function parseISO(str) {
    if (str instanceof Date) return isNaN(str) ? null : str;
    const s = String(str || '').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }

  /** Date -> "2026-10-05" (ISO). */
  function toISO(date) {
    if (typeof date === 'string') {
      const d = parseISO(date);
      if (d) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      return date;
    }
    if (!(date instanceof Date) || isNaN(date)) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  /** Date -> "05/10/2026". */
  function toBR(date) {
    const d = parseISO(date);
    if (!d) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  /** "2026-10" -> Date (primeiro dia do mês). */
  function keyToDate(key) {
    const [y, m] = String(key).split('-').map(Number);
    if (!y || !m) return null;
    return new Date(y, m - 1, 1);
  }

  /** Lista de chaves de mês: de startKey por `count` meses. */
  function monthKeys(startKey, count) {
    const out = [];
    const d = keyToDate(startKey);
    if (!d) return out;
    for (let i = 0; i < count; i++) {
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }

  /** Mês atual como chave "2026-10". */
  function currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  return {
    parseBRL, brl, num, pct,
    mesAno, monthKey, monthKeyFromISO, monthLabel, monthLabelLong,
    parseISO, toISO, toBR, keyToDate, monthKeys, currentMonthKey,
    MONTHS_ABBR, MONTHS_FULL
  };
})();
