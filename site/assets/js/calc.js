/* =====================================================================
 * calc.js — calculos financeiros (resumo, projecao, caixinhas)
 * Todos os valores sao feitos aqui para o painel nao ter logica espalhada.
 * ===================================================================== */
import { isoParaMes, addMeses, diffMeses, mesAtual, hojeISO, diasAte, paraData } from './utils.js';

const RECORRENTE = (l) => String(l.Recorrente || '').toUpperCase() === 'SIM';
const FIXO = (l) => String(l.Fixo || '').toUpperCase() === 'SIM';
const RECEB = (l) => String(l.Tipo || '').toLowerCase() === 'receita';

/** Competencia do lancamento (usa a coluna, com fallback na data). */
export function competencia(l) {
  return String(l.Competencia || isoParaMes(l.Data) || '');
}

export function valorTotal(l) {
  return Number(l.Valor) || 0;
}

/* ---------------------------------------------------------------------
 * Filtros e listas
 * ------------------------------------------------------------------- */
export function filtrar(lancamentos, f = {}) {
  const busca = String(f.busca || '').trim().toLowerCase();
  return (lancamentos || []).filter((l) => {
    if (f.mes && competencia(l) !== f.mes) return false;
    if (f.tipo && String(l.Tipo) !== f.tipo) return false;
    if (f.categoriaId && l.CategoriaID !== f.categoriaId) return false;
    if (f.contaId && l.ContaID !== f.contaId) return false;
    if (f.status && l.Status !== f.status) return false;
    if (f.forma && l.FormaPagamento !== f.forma) return false;
    if (f.caixinhaId && l.CaixinhaID !== f.caixinhaId) return false;
    if (f.somenteFixos && !FIXO(l)) return false;
    if (f.somenteRecorrentes && !RECORRENTE(l)) return false;
    if (busca) {
      const alvo = [l.Descricao, l.Obs, l.Status, l.FormaPagamento].join(' ').toLowerCase();
      if (!alvo.includes(busca)) return false;
    }
    return true;
  });
}

export function ordenar(lancamentos, modo = 'data-desc') {
  const arr = [...(lancamentos || [])];
  const porValor = (a, b) => valorTotal(b) - valorTotal(a);
  const porData = (a, b) => String(a.Data).localeCompare(String(b.Data));
  switch (modo) {
    case 'data-asc': return arr.sort((a, b) => porData(a, b));
    case 'valor-desc': return arr.sort(porValor);
    case 'valor-asc': return arr.sort((a, b) => valorTotal(a) - valorTotal(b));
    case 'descricao': return arr.sort((a, b) => String(a.Descricao).localeCompare(String(b.Descricao)));
    default: return arr.sort((a, b) => porData(b, a));
  }
}

/* ---------------------------------------------------------------------
 * Resumos
 * ------------------------------------------------------------------- */
export function resumo(lancamentos) {
  let receitas = 0, despesas = 0, pendentes = 0;
  for (const l of lancamentos || []) {
    const v = valorTotal(l);
    if (RECEB(l)) receitas += v; else despesas += v;
    if (String(l.Status) === 'Pendente' || String(l.Status) === 'Aguardando') pendentes += v;
  }
  return { receitas, despesas, saldo: receitas - despesas, pendentes };
}

export function resumoMes(lancamentos, mes) {
  return resumo(filtrar(lancamentos, { mes }));
}

/** Serie mensal (receitas x despesas) dos N ultimos meses terminando em `ate`. */
export function serieMensal(lancamentos, meses = 12, ate = mesAtual()) {
  const mapa = new Map();
  for (let i = meses - 1; i >= 0; i--) {
    const m = addMeses(ate, -i);
    mapa.set(m, { mes: m, receitas: 0, despesas: 0, saldo: 0 });
  }
  for (const l of lancamentos || []) {
    const c = competencia(l);
    const linha = mapa.get(c);
    if (!linha) continue;
    const v = valorTotal(l);
    if (RECEB(l)) linha.receitas += v; else linha.despesas += v;
  }
  return [...mapa.values()].map((x) => ({ ...x, saldo: x.receitas - x.despesas }));
}

/* ---------------------------------------------------------------------
 * Projecao
 * ------------------------------------------------------------------- */
/**
 * Chave de SERIE: agrupa os lancamentos recorrentes que sao o mesmo
 * compromisso (ex.: "Aluguel" de 2500 em todos os meses) numa unica serie.
 * Ignora o valor, porque ele pode mudar (ex.: salario reajustado).
 */
function chaveSerie(l) {
  return `${String(l.Tipo || '')}|${String(l.CategoriaID || '')}|${String(l.Descricao || '').trim().toLowerCase()}`;
}

/** Move uma data (yyyy-MM-dd) para outro mes (yyyy-MM), ajustando o dia. */
function deslocarParaMes(dataISO, mes) {
  const d = paraData(dataISO);
  if (!d) return dataISO;
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  const dia = Math.min(d.getDate(), ultimo);
  return `${ano}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Lancamentos que "valem" para um mes.
 * modo 'realizado' -> somente o que foi lancrado naquele mes.
 * modo 'projetado' -> inclui a projecao das SERIES recorrentes/fixas que ainda
 *                     nao foram lancradas no mes (sem duplicar o que ja existe).
 */
export function lancamentosDoMes(lancamentos, mes, modo = 'realizado') {
  const todos = lancamentos || [];
  const doMes = todos.filter((l) => competencia(l) === mes);

  if (modo === 'realizado') return doMes;

  const chavesDoMes = new Set(doMes.map(chaveSerie));

  // series: inicio = menor competencia, modelo = lancamento mais recente
  const series = new Map();
  for (const l of todos) {
    if (!RECORRENTE(l)) continue;
    const inicio = competencia(l);
    if (!inicio) continue;
    const k = chaveSerie(l);
    const atual = series.get(k);
    if (!atual) {
      series.set(k, { inicio, modelo: l, data: l.Data });
    } else {
      if (inicio < atual.inicio) atual.inicio = inicio;
      if (String(l.Data) >= String(atual.data)) {   // mais recente
        atual.modelo = l;
        atual.data = l.Data;
      }
    }
  }

  const extras = [];
  for (const s of series.values()) {
    if (diffMeses(s.inicio, mes) < 0) continue;            // a serie ainda nao comecou
    if (chavesDoMes.has(chaveSerie(s.modelo))) continue;    // ja lancrado neste mes
    extras.push({
      ...s.modelo,
      ID: `projecao-${chaveSerie(s.modelo)}-${mes}`,
      Data: deslocarParaMes(s.modelo.Data, mes),
      Competencia: mes,
      projetado: true
    });
  }

  return [...doMes, ...extras];
}

export function projecaoMes(lancamentos, mes) {
  const realizado = resumo(lancamentosDoMes(lancamentos, mes, 'realizado'));
  const projetado = resumo(lancamentosDoMes(lancamentos, mes, 'projetado'));
  const fixos = lancamentosDoMes(lancamentos, mes, 'projetado').filter((l) => FIXO(l));
  const fixosValor = fixos.reduce((s, l) => s + valorTotal(l), 0);
  return { realizado, projetado, fixos, fixosValor };
}

/* ---------------------------------------------------------------------
 * Quebras (categoria / conta / forma de pagamento)
 * ------------------------------------------------------------------- */
export function agrupar(lancamentos, chave, rotulo) {
  const mapa = new Map();
  for (const l of lancamentos || []) {
    const k = l[chave] || '';
    const r = rotulo ? rotulo(l) : k;
    const atual = mapa.get(r) || { chave: k, rotulo: r, valor: 0, quantidade: 0 };
    atual.valor += valorTotal(l);
    atual.quantidade += 1;
    mapa.set(r, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export function porCategoria(lancamentos, mes, tipo) {
  return agrupar(
    filtrar(lancamentos, { mes, tipo }),
    'CategoriaID',
    (l) => l.CategoriaID || 'Sem categoria'
  );
}

export function porConta(lancamentos, mes, tipo) {
  return agrupar(filtrar(lancamentos, { mes, tipo }), 'ContaID', (l) => l.ContaID || 'Sem conta');
}

export function porForma(lancamentos, mes) {
  return agrupar(filtrar(lancamentos, { mes }), 'FormaPagamento', (l) => l.FormaPagamento || 'Outro');
}

/* ---------------------------------------------------------------------
 * Proximos vencimentos
 * ------------------------------------------------------------------- */
export function proximos(lancamentos, dias = 30) {
  const limite = diasAte(hojeISO()) + dias;
  return (lancamentos || [])
    .filter((l) => String(l.Status) !== 'Pago' && String(l.Status) !== 'Cancelado')
    .filter((l) => {
      const d = diasAte(l.Data);
      return d !== null && d >= 0 && d <= limite;
    })
    .sort((a, b) => String(a.Data).localeCompare(String(b.Data)));
}

/* ---------------------------------------------------------------------
 * Caixinhas
 * ------------------------------------------------------------------- */
export function movimentosDe(caixinhaId, movimentos) {
  return (movimentos || [])
    .filter((m) => m.CaixinhaID === caixinhaId)
    .sort((a, b) => String(b.Data).localeCompare(String(a.Data)));
}

export function saldoCaixinha(caixinha, movimentos) {
  const inicial = Number(caixinha?.SaldoInicial) || 0;
  let saldo = inicial;
  for (const m of movimentosDe(caixinha?.ID, movimentos)) {
    const v = Number(m.Valor) || 0;
    saldo += String(m.Tipo).toLowerCase().startsWith('sai') ? -v : v;
  }
  return saldo;
}

/** Media mensal de aportes nos ultimos N meses (meses sem aporte contam como zero). */
export function mediaMensal(caixinhaId, movimentos, meses = 3, ate = mesAtual()) {
  const janela = new Set();
  for (let i = 0; i < meses; i++) janela.add(addMeses(ate, -i));
  let total = 0;
  for (const m of movimentosDe(caixinhaId, movimentos)) {
    const c = isoParaMes(m.Data);
    if (!janela.has(c)) continue;
    if (String(m.Tipo).toLowerCase().startsWith('sai')) continue;
    total += Number(m.Valor) || 0;
  }
  return total / meses;
}

export function projecaoCaixinha(caixinha, movimentos, { mesesProjecao = 6 } = {}) {
  const saldo = saldoCaixinha(caixinha, movimentos);
  const meta = Number(caixinha?.Meta) || 0;
  const restante = Math.max(0, meta - saldo);
  const media = mediaMensal(caixinha?.ID, movimentos, 3);
  const prazo = String(caixinha?.Prazo || '');
  const mesesAtePrazo = prazo ? Math.max(0, diffMeses(mesAtual(), prazo)) : null;
  const aporteNecessario = (prazo && mesesAtePrazo > 0) ? restante / mesesAtePrazo : null;
  const mesesAteMeta = media > 0 ? Math.ceil(restante / media) : null;

  const serie = [];
  let s = saldo;
  for (let i = 0; i < mesesProjecao; i++) {
    s += media;
    serie.push({ mes: addMeses(mesAtual(), i), saldo: s });
  }

  return {
    saldo,
    meta,
    restante,
    percentual: meta > 0 ? Math.min(100, (saldo / meta) * 100) : 0,
    media,
    prazo,
    mesesAtePrazo,
    aporteNecessario,
    mesesAteMeta,
    serie,
    atingida: meta > 0 && saldo >= meta
  };
}
