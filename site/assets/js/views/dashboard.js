/* =====================================================================
 * views/dashboard.js — painel principal
 * ===================================================================== */
import { esc, icone, moeda, mesExtenso, mesBR, dataBR, porcento, diasAte } from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import * as graficos from '../charts.js';

const CORES = ['#22c55e', '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

function kpi(rotulo, valor, classe = '', rodape = '', cor = '') {
  return `
    <div class="kpi" ${cor ? `style="--kpi-cor:${cor}"` : ''}>
      <div class="kpi-rotulo">${esc(rotulo)}</div>
      <div class="kpi-valor ${classe}">${valor}</div>
      ${rodape ? `<div class="kpi-rodape">${rodape}</div>` : ''}
    </div>`;
}

export default {
  titulo: 'Painel',

  render(ctx) {
    const { estado, mes } = ctx;
    const l = estado.lancamentos;
    const resumoMes = calc.resumoMes(l, mes);
    const proj = calc.projecaoMes(l, mes);
    const serie = calc.serieMensal(l, 12, mes);
    const categorias = calc.porCategoria(l, mes, 'Despesa');
    const topo = categorias.slice(0, 6);

    const totalCaixinhas = estado.caixinhas.reduce((s, c) => s + calc.saldoCaixinha(c, estado.movimentacoes, estado.lancamentos), 0);
    const metaCaixinhas = estado.caixinhas.reduce((s, c) => s + (Number(c.Meta) || 0), 0);
    const taxaPoupanca = resumoMes.receitas > 0 ? (resumoMes.saldo / resumoMes.receitas) * 100 : 0;

    const proximos = calc.proximos(l, 30).slice(0, 8);
    const fixos = proj.fixos;

    // meses que tem dados (para avisar quando o mes selecionado esta vazio)
    const mesesComDados = [...new Set(l.map((x) => calc.competencia(x)).filter(Boolean))].sort().reverse();
    const mesSemDados = mesesComDados.length > 0 && !mesesComDados.includes(mes);

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Painel</h1>
            <p>Resumo de ${esc(mesExtenso(mes))} · atualizado ${esc(estado.ultimoSync ? estado.ultimoSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—')}</p>
          </div>
          <div class="pagina-acoes">
            <button class="btn btn-pequeno" data-action="atualizar">${icone('atualizar')} Atualizar</button>
          </div>
        </div>

        ${mesSemDados ? `
        <div class="card card-pad" style="border-color:color-mix(in srgb, var(--warning) 45%, transparent)">
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
            <span style="color:var(--warning);font-size:18px">${icone('alerta')}</span>
            <div style="flex:1;min-width:200px">
              <div style="font-weight:600;font-size:14px">Nenhum lancamento em ${esc(mesExtenso(mes))}</div>
              <div class="num-pequeno">Seus lancamentos estao em outros meses. Use as setas ao lado do logo para mudar o mes.</div>
            </div>
            <div class="chips">
              ${mesesComDados.slice(0, 6).map((m) => `
                <button class="chip" data-action="ir-mes" data-valor="${m}">${esc(mesBR(m))}</button>`).join('')}
            </div>
          </div>
        </div>` : ''}

        <div class="kpis">
          ${kpi('Receitas do mes', moeda(resumoMes.receitas), 'receita', '', '#22c55e')}
          ${kpi('Despesas do mes', moeda(resumoMes.despesas), 'despesa', '', '#f43f5e')}
          ${kpi('Saldo do mes', moeda(resumoMes.saldo), resumoMes.saldo >= 0 ? 'receita' : 'despesa',
            `Taxa de poupanca ${porcento(taxaPoupanca)}`, resumoMes.saldo >= 0 ? '#22c55e' : '#f43f5e')}
          ${kpi('Gastos fixos', moeda(proj.fixosValor), '', `${fixos.length} item(ns)`, '#38bdf8')}
          ${kpi('Total nas caixinhas', moeda(totalCaixinhas), '', `Meta ${moeda(metaCaixinhas)}`, '#a855f7')}
          ${kpi('A pagar (pendente)', moeda(resumoMes.pendentes), 'despesa', '', '#f59e0b')}
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho">
              <h3>Receitas x Despesas</h3>
              <span class="sub">12 meses</span>
            </div>
            <div class="card-corpo">
              <div class="grafico">
                ${graficos.barras({
                  labels: serie.map((s) => mesBR(s.mes)),
                  series: [
                    { nome: 'Receitas', cor: '#22c55e', valores: serie.map((s) => s.receitas) },
                    { nome: 'Despesas', cor: '#f43f5e', valores: serie.map((s) => s.despesas) }
                  ],
                  formatador: (v) => moeda(v)
                })}
              </div>
              <div class="grafico-legenda">
                <span class="item"><span class="ponto" style="background:#22c55e"></span>Receitas</span>
                <span class="item"><span class="ponto" style="background:#f43f5e"></span>Despesas</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho">
              <h3>Despesas por categoria</h3>
              <span class="sub">${esc(mesBR(mes))}</span>
            </div>
            <div class="card-corpo">
              ${categorias.length ? `
                <div class="grafico">${graficos.rosca({
                  valores: categorias.map((c) => c.valor),
                  cores: CORES,
                  formato: (v) => moeda(v)
                })}</div>
                <div class="grafico-legenda">
                  ${categorias.slice(0, 8).map((c, i) => `
                    <span class="item">
                      <span class="ponto" style="background:${CORES[i % CORES.length]}"></span>
                      ${esc(c.rotulo)} <b>${moeda(c.valor, { compacto: true })}</b>
                    </span>`).join('')}
                </div>` : '<div class="vazio"><p>Nenhuma despesa neste mes.</p></div>'}
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho"><h3>Onde o dinheiro foi</h3><span class="sub">Top categorias</span></div>
            <div class="card-corpo">
              ${topo.length ? `
                <div class="grafico">${graficos.hbarras({
                  itens: topo.map((c, i) => ({
                    rotulo: c.rotulo,
                    valor: c.valor,
                    cor: (store.categoriaPorId(c.chave)?.Cor) || CORES[i % CORES.length]
                  })),
                  formatador: (v) => moeda(v, { compacto: true })
                })}</div>` : '<div class="vazio"><p>Sem dados no periodo.</p></div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho">
              <h3>Projecao do mes</h3>
              <span class="sub">realizado + fixos e recorrentes</span>
            </div>
            <div class="card-corpo">
              <div class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr))">
                ${kpi('Receitas realizadas', moeda(proj.realizado.receitas), 'receita')}
                ${kpi('Despesas realizadas', moeda(proj.realizado.despesas), 'despesa')}
                ${kpi('Receitas projetadas', moeda(proj.projetado.receitas), 'receita')}
                ${kpi('Despesas projetadas', moeda(proj.projetado.despesas), 'despesa')}
              </div>
              <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-soft)">
                <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim)">
                  <span>Saldo projetado do mes</span>
                  <b style="color:${proj.projetado.saldo >= 0 ? 'var(--receita)' : 'var(--despesa)'}">
                    ${moeda(proj.projetado.saldo)}
                  </b>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim);margin-top:6px">
                  <span>Faltam para projetado</span>
                  <b>${moeda(Math.max(0, proj.projetado.despesas - proj.realizado.despesas))}</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho"><h3>Proximos vencimentos</h3><span class="sub">30 dias</span></div>
            <div class="card-corpo">
              ${proximos.length ? `<div class="lista">${proximos.map((l2) => {
                const dias = diasAte(l2.Data);
                const cat = store.categoriaPorId(l2.CategoriaID);
                return `
                  <div class="lista-item">
                    <span class="ponto" style="background:${cat?.Cor || '#64748b'}"></span>
                    <div class="principal">
                      <div class="titulo">${esc(l2.Descricao)}</div>
                      <div class="meta">${esc(dataBR(l2.Data))} · ${dias === 0 ? 'hoje' : dias === 1 ? 'amanha' : `em ${dias} dias`} · ${esc(store.nomeCategoria(l2.CategoriaID))}</div>
                    </div>
                    <span class="valor ${l2.Tipo === 'Receita' ? 'valor-receita' : 'valor-despesa'}">
                      ${l2.Tipo === 'Receita' ? '+' : '-'}${moeda(l2.Valor).replace('-', '')}
                    </span>
                  </div>`;
              }).join('')}</div>` : '<div class="vazio"><p>Nada vencendo nos proximos 30 dias.</p></div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho"><h3>Gastos fixos do mes</h3><span class="sub">se repetem todo mes</span></div>
            <div class="card-corpo">
              ${fixos.length ? `<div class="lista">${fixos.map((f) => {
                const cat = store.categoriaPorId(f.CategoriaID);
                return `
                  <div class="lista-item">
                    <span class="ponto" style="background:${cat?.Cor || '#64748b'}"></span>
                    <div class="principal">
                      <div class="titulo">${esc(f.Descricao)}</div>
                      <div class="meta">${esc(dataBR(f.Data))} · ${esc(store.nomeCategoria(f.CategoriaID))}${f.Recorrente === 'SIM' ? ' · recorrente' : ''}</div>
                    </div>
                    <span class="valor valor-despesa">${moeda(f.Valor)}</span>
                  </div>`;
              }).join('')}</div>` : '<div class="vazio"><p>Nenhum gasto fixo marcado neste mes.</p></div>'}
            </div>
          </div>
        </div>

        ${estado.caixinhas.length ? `
        <div class="card">
          <div class="card-cabecalho">
            <h3>Caixinhas</h3>
            <span class="sub">controle e projecao</span>
            <div class="acoes"><a class="btn btn-pequeno" href="#/caixinhas">Ver todas</a></div>
          </div>
          <div class="card-corpo">
            <div class="grid grid-auto">
              ${estado.caixinhas.slice(0, 6).map((c) => {
                const p = calc.projecaoCaixinha(c, estado.movimentacoes, { lancamentos: estado.lancamentos });
                return `
                  <div class="caixinha">
                    <div class="caixinha-topo">
                      <div class="caixinha-icone" style="background:${(c.Cor || '#22c55e')}22;color:${c.Cor || '#22c55e'}">$</div>
                      <div style="flex:1;min-width:0">
                        <div class="caixinha-nome">${esc(c.Nome)}</div>
                        <div class="caixinha-desc">${esc(c.Descricao || '')}</div>
                      </div>
                    </div>
                    <div class="caixinha-saldo" style="color:${p.saldo >= 0 ? 'var(--text)' : 'var(--despesa)'}">${moeda(p.saldo)}</div>
                    <div class="barra-progresso"><div class="barra" style="width:${p.percentual.toFixed(1)}%;background:${c.Cor || '#22c55e'}"></div></div>
                    <div class="caixinha-info">
                      <span>Meta <b>${moeda(p.meta, { compacto: true })}</b></span>
                      <span>${p.atingida ? 'Meta atingida' : `Faltam ${moeda(p.restante, { compacto: true })}`}</span>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>` : ''}
      </div>`;
  },

  actions: {
    'ir-mes'(el) {
      window.dispatchEvent(new CustomEvent('app:mes', { detail: el.dataset.valor }));
    }
  }
};
