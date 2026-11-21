'use strict';
/*
 * Plano do dia: revisões de teoria e sugestão de estudo dentro do orçamento de minutos.
 *
 * ESTIMATIVA PEDAGÓGICA (não é regra do edital): a sequência abaixo e os intervalos de
 * revisão (1, 7 e 30 dias) são pontos de partida ajustáveis. Funções puras.
 */
const Progresso = (typeof require === 'function') ? require('./progresso.js') : globalThis.Progresso;

const TZ = -180; // America/Sao_Paulo

const ORDEM_PADRAO = Object.freeze({
  // Específicos (Bloco II): começa pelo que mais se liga às diligências do cargo e ao CPC.
  especificos: Object.freeze(['DPCI', 'DPPE', 'DPEN', 'DCIV', 'DCON', 'DADM', 'LESP']),
  // Base (Blocos I e III): habilidades que rendem em pouco tempo e não dependem de decorar leis.
  base: Object.freeze(['LP', 'RLOG', 'INFO', 'MAT', 'ATUA']),
});
const OFFSETS_REVISAO = Object.freeze([1, 7, 30]);

/** Revisões de teoria vencidas: 1, 7 e 30 dias depois da última marcação "estudado" de cada tópico. */
function revisoesDevidas({ derivado, hojeIdx, tz, offsets }) {
  const fuso = tz === undefined ? TZ : tz;
  const offs = offsets || OFFSETS_REVISAO;
  const saida = [];
  for (const [topicId, m] of derivado.ultimaMarcacao) {
    if (!m.estudado) continue;
    const base = Progresso.diaIdx(m.ts, fuso);
    offs.forEach((off, k) => {
      const etapa = k + 1;
      const devida = base + off;
      if (devida > hojeIdx) return;
      const feita = derivado.revisoes.some((r) => r.topicId === topicId && r.etapa === etapa && r.ts >= m.ts);
      if (!feita) saida.push({ topicId, etapa, devidaIdx: devida, atrasoDias: hojeIdx - devida });
    });
  }
  return saida.sort((a, b) => (a.devidaIdx - b.devidaIdx) || (a.topicId < b.topicId ? -1 : a.topicId > b.topicId ? 1 : 0) || (a.etapa - b.etapa));
}

/** Próximas revisões (ainda não vencidas), para mostrar o que vem a seguir. */
function proximasRevisoes({ derivado, hojeIdx, tz, offsets, limite }) {
  const fuso = tz === undefined ? TZ : tz;
  const offs = offsets || OFFSETS_REVISAO;
  const saida = [];
  for (const [topicId, m] of derivado.ultimaMarcacao) {
    if (!m.estudado) continue;
    const base = Progresso.diaIdx(m.ts, fuso);
    offs.forEach((off, k) => {
      const etapa = k + 1;
      const devida = base + off;
      if (devida <= hojeIdx) return;
      const feita = derivado.revisoes.some((r) => r.topicId === topicId && r.etapa === etapa && r.ts >= m.ts);
      if (!feita) saida.push({ topicId, etapa, devidaIdx: devida, emDias: devida - hojeIdx });
    });
  }
  saida.sort((a, b) => (a.devidaIdx - b.devidaIdx) || (a.topicId < b.topicId ? -1 : 1));
  return limite ? saida.slice(0, limite) : saida;
}

function minutosNoDia(sessoes, idx, tz) {
  const fuso = tz === undefined ? TZ : tz;
  return sessoes.reduce((s, x) => s + (Progresso.diaIdx(x.ts, fuso) === idx ? x.min : 0), 0);
}

/** Minutos estudados por dia nos últimos `dias` dias (o último é hoje). */
function serieDiaria(sessoes, hojeIdx, dias, tz) {
  const fuso = tz === undefined ? TZ : tz;
  const porDia = new Map();
  for (const s of sessoes) {
    const d = Progresso.diaIdx(s.ts, fuso);
    porDia.set(d, (porDia.get(d) || 0) + s.min);
  }
  const out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const idx = hojeIdx - i;
    out.push({ idx, iso: Progresso.idxParaISO(idx), min: porDia.get(idx) || 0 });
  }
  return out;
}

/**
 * Sugestão do dia. Reservam-se até `fracRevisoes` do orçamento para revisões vencidas; o resto vai
 * 2/3 para a trilha de Específicos e 1/3 para a trilha Base. Tópicos já iniciados vêm primeiro.
 */
function sugerirHoje(p) {
  const o = Object.assign({ ordem: ORDEM_PADRAO, minRevisao: 10, fracRevisoes: 0.3, passo: 5, minimoItem: 10, revisoes: [] }, p);
  const orc = Math.max(0, Math.floor((o.disponivelMin - o.minutosHoje) / o.passo) * o.passo);
  const itens = [];

  const teto = Math.floor((orc * o.fracRevisoes) / o.passo) * o.passo;
  let usadoRev = 0;
  let incluidas = 0;
  for (const r of o.revisoes) {
    if (usadoRev + o.minRevisao > teto) break;
    itens.push({ tipo: 'revisao', topicId: r.topicId, etapa: r.etapa, minutos: o.minRevisao, atrasoDias: r.atrasoDias });
    usadoRev += o.minRevisao;
    incluidas += 1;
  }
  const sobra = orc - usadoRev;

  const estudados = o.derivado.estudados;
  const minTop = o.derivado.minutosPorTopico;
  const fila = (cods) => {
    const lista = [];
    for (const c of cods) for (const t of o.topicos) if (t.disciplina === c && !estudados.has(t.id)) lista.push(t);
    const andamento = lista.filter((t) => (minTop.get(t.id) || 0) > 0);
    const novos = lista.filter((t) => !(minTop.get(t.id) || 0));
    return andamento.concat(novos);
  };
  const filaA = fila(o.ordem.especificos);
  const filaB = fila(o.ordem.base);
  let a = Math.round((sobra * 2) / 3 / o.passo) * o.passo;
  if (a > sobra) a = sobra;
  let b = sobra - a;
  if (!filaB.length) { a = sobra; b = 0; }
  if (!filaA.length) { b = sobra; a = 0; }

  const alocar = (f, orcamento, trilha) => {
    let resto = orcamento;
    for (const t of f) {
      if (resto < o.minimoItem) break;
      const feito = minTop.get(t.id) || 0;
      const faltam = Math.max(o.minimoItem, t.esforco_min - feito);
      let dar = Math.floor(Math.min(faltam, resto) / o.passo) * o.passo;
      if (dar < o.minimoItem) break;
      itens.push({ tipo: 'estudo', topicId: t.id, minutos: dar, trilha, continuacao: feito > 0 });
      resto -= dar;
    }
    return resto;
  };
  alocar(filaA, a, 'especificos');
  alocar(filaB, b, 'base');

  return {
    orcamentoMin: orc,
    itens,
    minutosPlanejados: itens.reduce((s, i) => s + i.minutos, 0),
    revisoesIncluidas: incluidas,
    revisoesPendentes: o.revisoes.length - incluidas,
  };
}

const API = { ORDEM_PADRAO, OFFSETS_REVISAO, revisoesDevidas, proximasRevisoes, minutosNoDia, serieDiaria, sugerirHoje };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Plano = API;
