/* =====================================================================
 * views/relatorios.js — relatorios consolidados e exportacao
 * ===================================================================== */
import { esc, icone, moeda, mesBR, mesExtenso, hojeISO, porcento } from '../utils.js';
import { store } from '../store.js';
import * as calc from '../calc.js';
import * as graficos from '../charts.js';
import { toast } from '../ui.js';

const CORES = ['#22c55e', '#0ea5e9', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6',
  '#ec4899', '#84cc16', '#f97316', '#6366f1'];

let ano = String(new Date().getFullYear());

export default {
  titulo: 'Relatorios',

  render(ctx) {
    const l = store.estado.lancamentos;
    const doAno = l.filter((x) => String(calc.competencia(x)).startsWith(ano));
    const r = calc.resumo(doAno);

    const meses = [];
    for (let i = 1; i <= 12; i++) meses.push(`${ano}-${String(i).padStart(2, '0')}`);
    const serie = calc.serieMensal(l, 12, `${ano}-12`);

    const resolverCat = (id) => store.nomeCategoria(id);
    const catDespesa = calc.porCategoria(doAno, '', 'Despesa', resolverCat);
    const catReceita = calc.porCategoria(doAno, '', 'Receita', resolverCat);
    const contas = calc.porConta(doAno, '', 'Despesa', (id) => store.nomeConta(id));
    const formas = calc.porForma(doAno, '', 'Despesa');

    // APENAS despesas (receitas nao entram nesta tabela)
    const maiores = calc.maiores(doAno, 10, 'Despesa');
    const taxa = r.receitas > 0 ? (r.saldo / r.receitas) * 100 : 0;

    const anos = [...new Set(l.map((x) => String(calc.competencia(x)).slice(0, 4)).filter(Boolean))].sort().reverse();
    if (!anos.includes(String(new Date().getFullYear()))) anos.unshift(String(new Date().getFullYear()));

    return `
      <div class="pagina">
        <div class="pagina-cabecalho">
          <div class="titulos">
            <h1>Relatorios</h1>
            <p>Consolidado de ${esc(ano)} · ${doAno.length} lancamento(s)</p>
          </div>
          <div class="pagina-acoes">
            <select class="select" id="r-ano" style="width:auto">
              ${anos.map((a) => `<option value="${a}" ${a === ano ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
            <button class="btn btn-pequeno" data-action="exportar">${icone('baixar')} Exportar</button>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi" style="--kpi-cor:#22c55e">
            <div class="kpi-rotulo">Receitas no ano</div>
            <div class="kpi-valor valor-receita">${moeda(r.receitas)}</div>
          </div>
          <div class="kpi" style="--kpi-cor:#f43f5e">
            <div class="kpi-rotulo">Despesas no ano</div>
            <div class="kpi-valor valor-despesa">${moeda(r.despesas)}</div>
          </div>
          <div class="kpi" style="--kpi-cor:${r.saldo >= 0 ? '#22c55e' : '#f43f5e'}">
            <div class="kpi-rotulo">Saldo do ano</div>
            <div class="kpi-valor ${r.saldo >= 0 ? 'valor-receita' : 'valor-despesa'}">${moeda(r.saldo)}</div>
          </div>
          <div class="kpi" style="--kpi-cor:#38bdf8">
            <div class="kpi-rotulo">Taxa de poupanca</div>
            <div class="kpi-valor">${porcento(taxa)}</div>
            <div class="kpi-rodape">media de ${moeda(r.receitas / 12)}/mes</div>
          </div>
        </div>

        <div class="card">
          <div class="card-cabecalho"><h3>Evolucao mensal</h3><span class="sub">${esc(ano)}</span></div>
          <div class="card-corpo">
            <div class="grafico">${graficos.barras({
              labels: serie.map((s) => mesBR(s.mes)),
              series: [
                { nome: 'Receitas', cor: '#22c55e', valores: serie.map((s) => s.receitas) },
                { nome: 'Despesas', cor: '#f43f5e', valores: serie.map((s) => s.despesas) }
              ],
              formatador: (v) => moeda(v)
            })}</div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho"><h3>Despesas por categoria</h3></div>
            <div class="card-corpo">
              ${catDespesa.length ? `
                <div class="grafico">${graficos.rosca({
                  valores: catDespesa.map((c) => c.valor), cores: CORES, formato: (v) => moeda(v)
                })}</div>
                <div class="grafico-legenda">
                  ${catDespesa.slice(0, 10).map((c, i) => `
                    <span class="item"><span class="ponto" style="background:${CORES[i % CORES.length]}"></span>
                    ${esc(c.rotulo)} <b>${moeda(c.valor, { compacto: true })}</b></span>`).join('')}
                </div>` : '<div class="vazio"><p>Sem despesas no ano.</p></div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho"><h3>Receitas por categoria</h3></div>
            <div class="card-corpo">
              ${catReceita.length ? `
                <div class="grafico">${graficos.rosca({
                  valores: catReceita.map((c) => c.valor), cores: CORES, formato: (v) => moeda(v)
                })}</div>
                <div class="grafico-legenda">
                  ${catReceita.map((c, i) => `
                    <span class="item"><span class="ponto" style="background:${CORES[i % CORES.length]}"></span>
                    ${esc(c.rotulo)} <b>${moeda(c.valor, { compacto: true })}</b></span>`).join('')}
                </div>` : '<div class="vazio"><p>Sem receitas no ano.</p></div>'}
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho"><h3>Despesas por forma de pagamento</h3></div>
            <div class="card-corpo">
              ${formas.length ? `<div class="grafico">${graficos.hbarras({
                itens: formas.map((f, i) => ({ rotulo: f.rotulo, valor: f.valor, cor: CORES[i % CORES.length] })),
                formatador: (v) => moeda(v, { compacto: true })
              })}</div>` : '<div class="vazio"><p>Sem dados.</p></div>'}
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho"><h3>Despesas por conta / cartao</h3></div>
            <div class="card-corpo">
              ${contas.length ? `<div class="grafico">${graficos.hbarras({
                itens: contas.map((c) => ({
                  rotulo: store.nomeConta(c.chave),
                  valor: c.valor,
                  cor: store.contaPorId(c.chave)?.Cor || CORES[0]
                })),
                formatador: (v) => moeda(v, { compacto: true })
              })}</div>` : '<div class="vazio"><p>Sem dados.</p></div>'}
            </div>
          </div>
        </div>

        <div class="grid grid-2">
          <div class="card">
            <div class="card-cabecalho"><h3>Fechamento mes a mes</h3></div>
            <div class="card-corpo sem-pad">
              <div class="tabela-wrap">
                <table class="tabela">
                  <thead><tr>
                    <th>Mes</th><th class="num">Receitas</th><th class="num">Despesas</th><th class="num">Saldo</th><th class="num">Acumulado</th>
                  </tr></thead>
                  <tbody>
                    ${(() => {
                      let acc = 0;
                      return serie.map((s) => {
                        acc += s.saldo;
                        return `<tr>
                          <td>${esc(mesExtenso(s.mes))}</td>
                          <td class="num valor-receita">${moeda(s.receitas)}</td>
                          <td class="num valor-despesa">${moeda(s.despesas)}</td>
                          <td class="num" style="color:${s.saldo >= 0 ? 'var(--receita)' : 'var(--despesa)'}">${moeda(s.saldo)}</td>
                          <td class="num">${moeda(acc)}</td>
                        </tr>`;
                      }).join('');
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-cabecalho">
              <h3>Maiores despesas do ano</h3>
              <span class="sub">${maiores.length} lancamento(s) · apenas despesas</span>
            </div>
            <div class="card-corpo sem-pad">
              ${maiores.length ? `
              <div class="tabela-wrap">
                <table class="tabela">
                  <thead><tr><th>Descricao</th><th>Data</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
                  <tbody>
                    ${maiores.map((m) => `<tr>
                      <td class="desc">${esc(m.Descricao)}</td>
                      <td class="num-pequeno">${esc(String(m.Data).split('-').reverse().join('/'))}</td>
                      <td class="num-pequeno">${esc(store.nomeCategoria(m.CategoriaID))}</td>
                      <td class="num valor-despesa">${moeda(m.Valor)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>` : '<div class="vazio"><p>Sem dados.</p></div>'}
            </div>
          </div>
        </div>
      </div>`;
  },

  afterRender() {
    const sel = document.getElementById('r-ano');
    if (sel) sel.addEventListener('change', () => {
      ano = sel.value;
      window.dispatchEvent(new CustomEvent('app:repintar'));
    });
  },

  actions: {
    exportar() {
      const l = store.estado.lancamentos.filter((x) => String(calc.competencia(x)).startsWith(ano));
      if (!l.length) return toast('Nada para exportar.', 'info');
      const linhas = [['Data', 'Tipo', 'Valor', 'Descricao', 'Categoria', 'Conta', 'FormaPagamento', 'Status', 'Competencia']
        .join(';')];
      l.forEach((x) => {
        linhas.push([x.Data, x.Tipo, String(x.Valor).replace('.', ','), x.Descricao,
          store.nomeCategoria(x.CategoriaID), store.nomeConta(x.ContaID), x.FormaPagamento, x.Status,
          calc.competencia(x)].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'));
      });
      const blob = new Blob(['\uFEFF' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio-${ano}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Relatorio exportado.', 'sucesso');
    }
  }
};
