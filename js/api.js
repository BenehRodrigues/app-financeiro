/* ============================================================
 *  api.js — Cliente HTTP do Google Apps Script
 * ------------------------------------------------------------
 *  - Leituras usam GET (requisição CORS "simples").
 *  - Escritas usam POST com Content-Type text/plain (evita
 *    preflight/OPTIONS, que o Apps Script não responde).
 *  - A chave vai como parâmetro de URL, não como header,
 *    para não disparar preflight.
 *  - Se o CORS falhar, tenta fallback via JSONP (somente GET).
 * ============================================================ */

const Api = (() => {

  function buildUrl(params) {
    const u = new URL(CONFIG.APPS_SCRIPT_URL);
    u.searchParams.set('key', CONFIG.APP_KEY);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    });
    return u.toString();
  }

  /** GET -> JSON (com fallback JSONP). */
  async function get(params) {
    const url = buildUrl(params);
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof SyntaxError) throw err; // resposta inválida (provavelmente não-CORS)
      // tenta JSONP
      return jsonp(url);
    }
  }

  /**
   * POST -> JSON (escritas).
   * Se o CORS bloquear o POST, cai para GET (que aceita fallback JSONP).
   */
  async function post(action, payload) {
    const url = buildUrl({ action });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload || {})
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      if (err instanceof SyntaxError) throw err;
      return get({ action, ...(payload || {}) });
    }
  }

  /** Fallback JSONP (cria tag <script>). */
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = '__fin_cb_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const sep = url.includes('?') ? '&' : '?';
      s.src = url + sep + 'callback=' + cb;
      const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[cb]; } catch (e) {}
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[cb] = (data) => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error('jsonp error')); };
      document.head.appendChild(s);
    });
  }

  return {
    get,
    post,
    /** Carrega tudo de uma vez. */
    async list() {
      const data = await get({ action: 'list' });
      if (!data || data.ok === false) throw new Error(data && data.error ? data.error : 'Falha ao carregar dados');
      return data;
    },
    /** Testa a conexão (usado no diagnóstico). */
    async ping() {
      const data = await get({ action: 'ping' });
      return data && data.ok;
    }
  };
})();
