/* =====================================================================
 * ui.js — toasts, modais, confirmacao e pequenos helpers de interface
 * ===================================================================== */
import { esc, icone } from './utils.js';

/* ---------------------------------------------------------------------
 * Toasts
 * ------------------------------------------------------------------- */
export function toast(mensagem, tipo = 'info', duracao = 3600) {
  const cx = document.getElementById('toasts');
  if (!cx) return;

  const el = document.createElement('div');
  const ico = tipo === 'sucesso' ? 'ok' : tipo === 'erro' ? 'alerta' : 'info';
  el.className = `toast ${tipo}`;
  el.innerHTML = `<span class="ico">${icone(ico)}</span><span>${esc(mensagem)}</span>`;
  cx.appendChild(el);

  const sair = () => {
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 220);
  };
  el.addEventListener('click', sair);
  setTimeout(sair, duracao);
}

/* ---------------------------------------------------------------------
 * Modal
 * ------------------------------------------------------------------- */
export function abrirModal({ titulo, corpo, rodape = '', aoAbrir = null, largura = '' }) {
  const dlg = document.getElementById('modal');
  dlg.innerHTML = `
    <div class="modal-box" ${largura ? `style="width:${largura}"` : ''}>
      <div class="modal-cabecalho">
        <h3>${esc(titulo)}</h3>
        <button type="button" class="btn-icone" data-fechar aria-label="Fechar">✕</button>
      </div>
      <div class="modal-corpo">${corpo}</div>
      ${rodape ? `<div class="modal-acoes">${rodape}</div>` : ''}
    </div>`;

  dlg.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharModal));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) fecharModal(); });

  if (!dlg.open) dlg.showModal();
  if (aoAbrir) aoAbrir(dlg);

  const primeiro = dlg.querySelector('input:not([type=hidden]), select, textarea');
  if (primeiro) setTimeout(() => primeiro.focus(), 60);

  return dlg;
}

export function fecharModal() {
  const dlg = document.getElementById('modal');
  if (dlg && dlg.open) dlg.close();
  if (dlg) dlg.innerHTML = '';
}

/* ---------------------------------------------------------------------
 * Confirmacao
 * ------------------------------------------------------------------- */
export function confirmar({ titulo = 'Confirmar', mensagem = '', textoOk = 'Confirmar', textoCancelar = 'Cancelar', perigo = false }) {
  return new Promise((resolve) => {
    const dlg = abrirModal({
      titulo,
      corpo: `<p style="color:var(--text-dim);font-size:14px;line-height:1.55">${esc(mensagem)}</p>`,
      rodape: `
        <button type="button" class="btn" data-cancelar>${esc(textoCancelar)}</button>
        <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-primario'}" data-confirmar>${esc(textoOk)}</button>`
    });

    dlg.querySelector('[data-cancelar]').addEventListener('click', () => { fecharModal(); resolve(false); });
    dlg.querySelector('[data-confirmar]').addEventListener('click', () => { fecharModal(); resolve(true); });
    dlg.addEventListener('close', () => resolve(false), { once: true });
  });
}

/* ---------------------------------------------------------------------
 * Botao com estado de carregamento
 * ------------------------------------------------------------------- */
export async function comBotao(botao, fn, texto = 'Salvando…') {
  if (!botao) return fn();
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = texto;
  try {
    return await fn();
  } finally {
    botao.disabled = false;
    botao.innerHTML = original;
  }
}

/* ---------------------------------------------------------------------
 * Abas internas (filtros por tipo)
 * ------------------------------------------------------------------- */
export function grupoAbas(opcoes, atual, attr = 'data-aba') {
  return `<div class="chips">${opcoes.map((o) => `
    <button type="button" class="chip ${o.valor === atual ? 'ativo' : ''}" ${attr}="${esc(o.valor)}">${esc(o.rotulo)}</button>
  `).join('')}</div>`;
}
