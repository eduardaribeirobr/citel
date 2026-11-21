'use strict';
/*
 * Motor de progresso, domínio e ritmo diário.
 *
 * Funções puras: não alteram a entrada, não leem relógio nem armazenamento.
 * Tudo o que é critério pedagógico está em PADRAO e pode ser ajustado.
 * Nada aqui prevê resultado de prova: mede o cumprimento dos critérios do plano.
 *
 * Entrada de calcularProgresso(entrada, opcoes):
 *   topicos:  [{ id, complexidade (1-5) | esforcoMin, peso? }]   (da matriz do edital)
 *   eventos:  [{ topicId, questionId, ts, correct, conf? }]      (respostas; conf: seguro|duvida|chute)
 *   sessoes:  [{ ts, min, topicId? }]                             (tempo de estudo)
 *   estudados:[topicId]                                           (teoria marcada como estudada)
 *   agora, dataProva: milissegundos (epoch)
 *   revisoesVencidas: número de revisões em atraso
 */

const PADRAO = Object.freeze({
  tzOffsetMin: -180,            // America/Sao_Paulo (sem horário de verão desde 2019)
  minQuestoesDistintas: 10,     // variedade mínima para considerar o tópico exercitado
  janelaDesempenho: 10,         // últimas N questões distintas entram no desempenho
  metaDesempenho: 0.8,          // critério pedagógico ajustável, não é previsão
  minParaFragil: 5,             // questões distintas mínimas para classificar como frágil
  limiteFragil: 0.6,            // desempenho ponderado abaixo disso = frágil
  diasRetencao: 7,              // acerto confiável N dias depois do 1º contato com o tópico
  pesosEtapas: Object.freeze({ estudo: 0.25, exercicio: 0.25, desempenho: 0.30, retencao: 0.20 }),
  credito: Object.freeze({ seguro: 1, duvida: 0.5, chute: 0.25 }),
  esforcoBaseMin: Object.freeze({ 1: 30, 2: 60, 3: 90, 4: 130, 5: 180 }), // estimativa inicial, recalibrada
  minPorRevisao: 1.5,
  reservaFinalDias: 14,         // últimos dias reservados a simulados e revisão final
  diasPorSemana: 6,             // um dia de descanso por semana
  disponivelMinDia: 60,
  limiteApertado: 1.25,
  janelaRitmoDias: 7,
  minDiasParaRitmo: 3,
  minTopicosParaCalibrar: 3,
  multiplicadorMin: 0.5,
  multiplicadorMax: 2,
});

const MS_DIA = 86400000;
const EPS = 1e-9;
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function diaIdx(ts, tz) { return Math.floor((ts + tz * 60000) / MS_DIA); }
function idxParaISO(idx) { return new Date(idx * MS_DIA).toISOString().slice(0, 10); }

function montarConfig(opcoes) {
  const o = opcoes || {};
  const cfg = Object.assign({}, PADRAO, o, {
    pesosEtapas: Object.assign({}, PADRAO.pesosEtapas, o.pesosEtapas),
    credito: Object.assign({}, PADRAO.credito, o.credito),
    esforcoBaseMin: Object.assign({}, PADRAO.esforcoBaseMin, o.esforcoBaseMin),
  });
  const soma = Object.values(cfg.pesosEtapas).reduce((a, b) => a + b, 0);
  if (Math.abs(soma - 1) > 1e-6) throw new TypeError('pesosEtapas deve somar 1 (soma atual: ' + soma + ')');
  for (const k of ['diasPorSemana', 'disponivelMinDia', 'janelaRitmoDias', 'minQuestoesDistintas', 'janelaDesempenho']) {
    if (!num(cfg[k]) || cfg[k] <= 0) throw new TypeError('opção inválida: ' + k);
  }
  if (cfg.diasPorSemana > 7) throw new TypeError('diasPorSemana não pode passar de 7');
  return cfg;
}

function creditoResposta(e, cfg) {
  if (!e.correct) return 0;
  const c = cfg.credito[e.conf];
  return num(c) ? c : cfg.credito.duvida; // acerto sem confiança informada não vale como acerto seguro
}

function avaliarTopico(estudado, evs, cfg) {
  const porQuestao = new Map();
  let primeiroDia = Infinity;
  for (const e of evs) {
    const atual = porQuestao.get(e.questionId);
    if (!atual || e.ts > atual.ts) porQuestao.set(e.questionId, e);
    const d = diaIdx(e.ts, cfg.tzOffsetMin);
    if (d < primeiroDia) primeiroDia = d;
  }
  const n = porQuestao.size;
  const janela = Array.from(porQuestao.values()).sort((a, b) => b.ts - a.ts).slice(0, cfg.janelaDesempenho);
  const acc = janela.length ? janela.reduce((s, e) => s + creditoResposta(e, cfg), 0) / janela.length : 0;
  const retencao = evs.some((e) => e.correct && creditoResposta(e, cfg) >= 0.5
    && diaIdx(e.ts, cfg.tzOffsetMin) - primeiroDia >= cfg.diasRetencao) ? 1 : 0;
  const comp = {
    estudo: estudado ? 1 : 0,
    exercicio: clamp01(n / cfg.minQuestoesDistintas),
    desempenho: n ? clamp01(acc / cfg.metaDesempenho) * clamp01(janela.length / cfg.janelaDesempenho) : 0,
    retencao,
  };
  const w = cfg.pesosEtapas;
  const progresso = clamp01(w.estudo * comp.estudo + w.exercicio * comp.exercicio
    + w.desempenho * comp.desempenho + w.retencao * comp.retencao);
  const dominio = comp.estudo >= 1 - EPS && comp.exercicio >= 1 - EPS
    && comp.desempenho >= 1 - EPS && comp.retencao >= 1 - EPS;
  let estado;
  if (n === 0 && !estudado) estado = 'NÃO INICIADO';
  else if (n >= cfg.minParaFragil && acc < cfg.limiteFragil) estado = 'FRÁGIL';
  else if (dominio) estado = 'DOMÍNIO PROVISÓRIO';
  else if (progresso >= 0.5) estado = 'EM CONSOLIDAÇÃO';
  else estado = 'EM APRENDIZAGEM';
  return { progresso, estado, componentes: comp, questoesDistintas: n, desempenhoPonderado: acc };
}

function validar(entrada) {
  if (!entrada || typeof entrada !== 'object') throw new TypeError('entrada ausente');
  if (!Array.isArray(entrada.topicos) || entrada.topicos.length === 0) throw new TypeError('topicos deve ser uma lista não vazia');
  if (!num(entrada.agora)) throw new TypeError('agora inválido');
  if (!num(entrada.dataProva)) throw new TypeError('dataProva inválida');
  const ids = new Set();
  for (const t of entrada.topicos) {
    if (!t || typeof t.id !== 'string' || !t.id) throw new TypeError('tópico sem id');
    if (ids.has(t.id)) throw new TypeError('id de tópico repetido: ' + t.id);
    ids.add(t.id);
  }
  const r = entrada.revisoesVencidas;
  if (r !== undefined && (!num(r) || r < 0)) throw new TypeError('revisoesVencidas inválido');
}

function mediana(v) {
  const s = v.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function calcularProgresso(entrada, opcoes) {
  const cfg = montarConfig(opcoes);
  validar(entrada);
  const { topicos, agora, dataProva } = entrada;
  const eventos = entrada.eventos || [];
  const sessoes = entrada.sessoes || [];
  const estudados = new Set(entrada.estudados || []);
  const revisoesVencidas = entrada.revisoesVencidas || 0;

  const conhecidos = new Map(topicos.map((t) => [t.id, t]));
  const evPorTopico = new Map(topicos.map((t) => [t.id, []]));
  const descartes = { eventosInvalidos: 0, eventosFuturos: 0, sessoesInvalidas: 0 };

  for (const e of eventos) {
    const ok = e && conhecidos.has(e.topicId) && typeof e.questionId === 'string' && e.questionId
      && num(e.ts) && typeof e.correct === 'boolean';
    if (!ok) { descartes.eventosInvalidos++; continue; }
    if (e.ts > agora) { descartes.eventosFuturos++; continue; }
    evPorTopico.get(e.topicId).push(e);
  }
  const sessoesValidas = [];
  const minPorTopico = new Map();
  for (const s of sessoes) {
    if (!s || !num(s.ts) || !num(s.min) || s.min <= 0 || s.ts > agora) { descartes.sessoesInvalidas++; continue; }
    sessoesValidas.push(s);
    if (s.topicId && conhecidos.has(s.topicId)) minPorTopico.set(s.topicId, (minPorTopico.get(s.topicId) || 0) + s.min);
  }

  const porTopico = [];
  for (const t of topicos) {
    const base = num(t.esforcoMin) && t.esforcoMin > 0 ? t.esforcoMin : cfg.esforcoBaseMin[t.complexidade];
    if (!num(base)) throw new TypeError('tópico ' + t.id + ' sem complexidade (1-5) nem esforcoMin');
    const a = avaliarTopico(estudados.has(t.id), evPorTopico.get(t.id), cfg);
    porTopico.push(Object.assign({ id: t.id, esforcoBaseMin: base }, a));
  }

  // Calibração: compara o tempo real dos tópicos já dominados com a estimativa.
  const razoes = porTopico
    .filter((t) => t.estado === 'DOMÍNIO PROVISÓRIO' && (minPorTopico.get(t.id) || 0) > 0)
    .map((t) => minPorTopico.get(t.id) / t.esforcoBaseMin);
  const calibrado = razoes.length >= cfg.minTopicosParaCalibrar;
  const multiplicador = calibrado
    ? Math.max(cfg.multiplicadorMin, Math.min(cfg.multiplicadorMax, mediana(razoes))) : 1;

  const somaBase = porTopico.reduce((s, t) => s + t.esforcoBaseMin, 0);
  const feitoBase = porTopico.reduce((s, t) => s + t.progresso * t.esforcoBaseMin, 0);
  const percentualGeral = clamp01(feitoBase / somaBase);
  const totalMin = somaBase * multiplicador;
  const feitoMin = feitoBase * multiplicador;
  const revisaoMin = revisoesVencidas * cfg.minPorRevisao;
  const restanteMin = Math.max(0, totalMin - feitoMin) + revisaoMin;

  const contagem = { 'NÃO INICIADO': 0, 'EM APRENDIZAGEM': 0, 'FRÁGIL': 0, 'EM CONSOLIDAÇÃO': 0, 'DOMÍNIO PROVISÓRIO': 0 };
  for (const t of porTopico) contagem[t.estado]++;
  const dominados = contagem['DOMÍNIO PROVISÓRIO'];

  // Prazo
  const hojeIdx = diaIdx(agora, cfg.tzOffsetMin);
  const provaIdx = diaIdx(dataProva, cfg.tzOffsetMin);
  const prazoIdx = provaIdx - cfg.reservaFinalDias;
  const diasCalendario = Math.max(0, prazoIdx - hojeIdx + 1);
  const diasEstudo = diasCalendario * cfg.diasPorSemana / 7;

  let situacao, necessarioMinDia;
  if (restanteMin <= EPS) { situacao = 'CONCLUÍDO'; necessarioMinDia = 0; }
  else if (diasEstudo <= 0) { situacao = 'PRAZO ESGOTADO'; necessarioMinDia = null; }
  else {
    necessarioMinDia = restanteMin / diasEstudo;
    const r = necessarioMinDia / cfg.disponivelMinDia;
    situacao = r <= 1 + EPS ? 'DENTRO DA CAPACIDADE' : r <= cfg.limiteApertado + EPS ? 'APERTADO' : 'ACIMA DA CAPACIDADE';
  }
  const faltaMinDia = necessarioMinDia === null ? null : Math.max(0, necessarioMinDia - cfg.disponivelMinDia);

  // Projeção se você mantiver exatamente o tempo disponível informado
  const minDisponiveis = cfg.disponivelMinDia * diasEstudo;
  const projecaoCobertura = totalMin > 0
    ? clamp01((feitoMin + Math.max(0, minDisponiveis - revisaoMin)) / totalMin) : 1;

  // Ritmo observado nos últimos N dias
  const dias = new Set();
  let min7 = 0;
  for (const s of sessoesValidas) {
    const d = diaIdx(s.ts, cfg.tzOffsetMin);
    if (d > hojeIdx - cfg.janelaRitmoDias && d <= hojeIdx) { min7 += s.min; dias.add(d); }
  }
  let ritmo = { status: 'SEM HISTÓRICO', observadoMinDia: null, razao: null, conclusaoProjetada: null, dentroDoPrazo: null };
  if (dias.size >= cfg.minDiasParaRitmo) {
    const observado = min7 / (cfg.janelaRitmoDias * cfg.diasPorSemana / 7);
    ritmo = { status: null, observadoMinDia: observado, razao: null, conclusaoProjetada: null, dentroDoPrazo: null };
    if (necessarioMinDia === 0) ritmo.status = 'CONCLUÍDO';
    else if (necessarioMinDia === null) ritmo.status = 'PRAZO ESGOTADO';
    else {
      ritmo.razao = observado / necessarioMinDia;
      ritmo.status = ritmo.razao >= 1.1 ? 'ADIANTADA' : ritmo.razao >= 0.9 ? 'NO RITMO' : 'ATRASADA';
    }
    if (observado > 0 && restanteMin > EPS) {
      const diasCal = Math.ceil((restanteMin / observado) * 7 / cfg.diasPorSemana);
      const fimIdx = hojeIdx + diasCal - 1;
      ritmo.conclusaoProjetada = idxParaISO(fimIdx);
      ritmo.dentroDoPrazo = fimIdx <= prazoIdx;
    }
  }

  // Alerta de proximidade dos 100%
  const pendentes = porTopico
    .filter((t) => t.estado !== 'DOMÍNIO PROVISÓRIO')
    .map((t) => ({ id: t.id, estado: t.estado, restanteMin: (1 - t.progresso) * t.esforcoBaseMin * multiplicador }))
    .sort((a, b) => b.restanteMin - a.restanteMin);
  const pct = Math.round(percentualGeral * 1000) / 10;
  const aviso = ' Isto mede o cumprimento dos critérios do plano e não garante o resultado na prova.';
  let alerta = null;
  if (dominados === porTopico.length) {
    alerta = { nivel: 'CRITÉRIOS CUMPRIDOS', mensagem: 'Todos os tópicos atingiram o domínio provisório. Mantenha as revisões em dia: o domínio não é permanente.' + aviso };
  } else if (percentualGeral >= 0.98 - EPS) {
    alerta = { nivel: 'QUASE LÁ', mensagem: 'Você está em ' + pct + '%. Faltam ' + pendentes.length + ' tópico(s) para o domínio provisório.' + aviso };
  } else if (percentualGeral >= 0.9 - EPS) {
    alerta = { nivel: 'RETA FINAL', mensagem: 'Você está em ' + pct + '%. Faltam ' + pendentes.length + ' tópico(s) para o domínio provisório.' + aviso };
  }

  return {
    percentualGeral,
    topicosEmDominio: dominados,
    totalTopicos: porTopico.length,
    contagemPorEstado: contagem,
    topicos: porTopico,
    carga: {
      restanteMin, revisaoMin, totalMin, multiplicadorCalibracao: multiplicador, calibrado,
    },
    prazo: {
      prazoEstudo: idxParaISO(prazoIdx), dataProva: idxParaISO(provaIdx),
      diasCalendario, diasEstudo, reservaFinalDias: cfg.reservaFinalDias,
    },
    meta: {
      situacao, necessarioMinDia, disponivelMinDia: cfg.disponivelMinDia, faltaMinDia,
      projecaoCoberturaNoTempoDisponivel: projecaoCobertura,
    },
    ritmo,
    alerta,
    pendentes,
    descartes,
  };
}

const API = { PADRAO, calcularProgresso, avaliarTopico, diaIdx, idxParaISO, montarConfig };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Progresso = API;
