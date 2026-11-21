'use strict';
/*
 * Aprendizagem com questões: revisão espaçada, nível adaptativo, sessão intercalada, caderno de erros e resumo.
 * Tudo é DERIVADO do histórico de respostas (eventos): não há outro estado a salvar. Funções puras.
 *
 * ESTIMATIVA PEDAGÓGICA (ajustável): intervalos de 1, 7, 15 e 30 dias; 40% da sessão para revisões vencidas.
 */
const Progresso = (typeof require === 'function') ? require('./progresso.js') : globalThis.Progresso;
const Questoes = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;

const TZ = -180;
const INTERVALOS = Object.freeze([1, 7, 15, 30]);
const CREDITO = Object.freeze({ seguro: 1, duvida: 0.5, chute: 0.25 });
const MOTIVOS = Object.freeze({ desconhecimento: 'Não sabia a regra', desatencao: 'Desatenção', interpretacao: 'Interpretei mal o enunciado', calculo: 'Erro de cálculo', confusao: 'Confundi conceitos' });

/**
 * Eventos que o motor de progresso deve receber: tudo, EXCETO os registros de "motivo do erro" (não são respostas).
 * O motor guarda só o último evento de cada questão; um motivo anotado depois de um acerto na refação
 * (correct:false, mesmo questionId) viraria "erro" e derrubaria o desempenho do tópico.
 */
const TIPOS_AUXILIARES = ['motivo', 'problema'];
const paraMotor = (eventos) => eventos.filter((e) => !TIPOS_AUXILIARES.includes(e.tipo));
/** Respostas válidas (ignora os registros de motivo e ids que não são de questões geradas). */
const soRespostas = (eventos) => paraMotor(eventos).filter((e) => Questoes.lerId(e.questionId));
/** Modelo ATIVO ao qual a questão pertence (um modelo aposentado entrega seu histórico ao sucessor). */
const templateDe = (questionId) => { const x = Questoes.lerId(questionId); return x ? Questoes.sucessorDe(x.templateId) : null; };

/** Estado da revisão espaçada de cada modelo de questão. Uma sessão por dia conta como UM resultado. */
function cartoes(eventos, hojeIdx, tz) {
  const fuso = tz === undefined ? TZ : tz;
  const porModelo = new Map();
  for (const e of soRespostas(eventos)) {
    const t = templateDe(e.questionId);
    if (!porModelo.has(t)) porModelo.set(t, []);
    porModelo.get(t).push(e);
  }
  const saida = new Map();
  for (const [templateId, lista] of porModelo) {
    lista.sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
    const dias = new Map();
    for (const e of lista) {
      const idx = Progresso.diaIdx(e.ts, fuso);
      if (!dias.has(idx)) dias.set(idx, []);
      dias.get(idx).push(e);
    }
    let passo = -1; let ultimo = null; let proxima = null;
    for (const idx of Array.from(dias.keys()).sort((a, b) => a - b)) {
      const d = dias.get(idx);
      const errou = d.some((e) => !e.correct);
      const seguro = !errou && d.every((e) => e.conf === 'seguro');
      if (errou) passo = 0;
      else if (seguro) {
        if (passo === -1) passo = 0;
        else if (idx >= proxima) passo = Math.min(passo + 1, INTERVALOS.length - 1);   // só avança em revisão no prazo
      } else passo = Math.max(passo, 0);
      ultimo = idx;
      proxima = idx + INTERVALOS[passo];
    }
    const t = Questoes.modelo(templateId);
    saida.set(templateId, {
      templateId, topicId: t.topicId, passo, ultimoIdx: ultimo, proximaIdx: proxima,
      devida: proxima <= hojeIdx, atrasoDias: Math.max(0, hojeIdx - proxima), respostas: lista.length,
    });
  }
  return saida;
}

const revisoesVencidas = (cart) => Array.from(cart.values()).filter((c) => c.devida)
  .sort((a, b) => (b.atrasoDias - a.atrasoDias) || (a.templateId < b.templateId ? -1 : 1));

/** Nível sugerido: sobe com 80% de aproveitamento ponderado, desce abaixo de 50% (mín. 3 respostas no nível atual). */
function nivelSugerido(eventos, topicId) {
  const resp = soRespostas(eventos).filter((e) => e.topicId === topicId).sort((a, b) => a.ts - b.ts);
  if (!resp.length) return 1;
  const atual = resp[resp.length - 1].nivel || 1;
  const noNivel = resp.filter((e) => (e.nivel || 1) === atual).slice(-10);
  if (noNivel.length < 3) return atual;
  const acc = noNivel.reduce((s, e) => s + (e.correct ? (CREDITO[e.conf] === undefined ? 0.5 : CREDITO[e.conf]) : 0), 0) / noNivel.length;
  if (acc >= 0.8) return Math.min(5, atual + 1);
  if (acc < 0.5) return Math.max(1, atual - 1);
  return atual;
}

// Texto do enunciado de uma questão (memorizado): serve para não mostrar de novo uma questão IGUAL com outro id.
const cacheEnunciado = new Map();
function enunciadoDe(templateId, semente, nivel) {
  const id = Questoes.idQuestao(templateId, semente, nivel);
  if (cacheEnunciado.has(id)) return cacheEnunciado.get(id);
  let t = null;
  try { t = Questoes.gerarQuestao(templateId, semente, nivel).enunciado; } catch (e) { t = null; }
  if (cacheEnunciado.size > 20000) cacheEnunciado.clear();
  cacheEnunciado.set(id, t);
  return t;
}
const ENUNCIADOS_LEMBRADOS = 400;

/**
 * Monta a sessão: revisões vencidas primeiro (até 40%), depois os modelos menos praticados, intercalando assuntos.
 * Determinística para a mesma `semente`. Nunca repete uma questão já respondida.
 */
function montarSessao(p) {
  const o = Object.assign({ n: 10, topicIds: null, nivel: 'auto', fracRevisoes: 0.4 }, p);
  const candidatos = Questoes.ativos().filter((t) => !o.topicIds || Questoes.topicosDe(t).some((x) => o.topicIds.includes(x)));
  if (!candidatos.length) return [];
  const resp = soRespostas(o.eventos);
  const respondidas = new Set(resp.map((e) => e.questionId));
  // enunciados já vistos (os mais recentes): evita mostrar de novo a MESMA questão com outro id
  const vistos = new Set(resp.slice().sort((a, b) => b.ts - a.ts).slice(0, ENUNCIADOS_LEMBRADOS)
    .map((e) => { const x = Questoes.lerId(e.questionId); return x ? enunciadoDe(x.templateId, x.semente, x.nivel) : null; }).filter(Boolean));
  const cart = cartoes(o.eventos, o.hojeIdx);
  const vencidas = revisoesVencidas(cart).filter((c) => candidatos.some((t) => t.id === c.templateId));
  const itens = [];
  // 1ª tentativa: id novo E enunciado nunca visto; 2ª: só id novo (quando o espaço de variações acabou)
  const procura = (templateId, nivel, base, exigeNovoTexto) => {
    let sem = base; const passo = 7919 * (Questoes.modelo(templateId).modulo || 1);      // modelos de Direito: o tópico sai de semente % módulo, então o passo preserva o tópico
    for (let i = 0; i < (exigeNovoTexto ? 60 : 200); i++, sem += passo) {
      if (respondidas.has(Questoes.idQuestao(templateId, sem, nivel))) continue;
      if (exigeNovoTexto) { const t = enunciadoDe(templateId, sem, nivel); if (t && vistos.has(t)) continue; }
      return sem;
    }
    return null;
  };
  const vizinhos = (nivel) => [nivel, nivel + 1, nivel - 1, nivel + 2, nivel - 2].filter((x) => x >= 1 && x <= 5);
  const escolhe = (t, nivelPref, base) => {
    // nível automático: se acabaram as variações novas deste nível, usa o vizinho antes de repetir
    for (const nv of (o.nivel === 'auto' ? vizinhos(nivelPref) : [nivelPref])) { const sem = procura(t.id, nv, base, true); if (sem !== null) return { semente: sem, nivel: nv }; }
    const sem = procura(t.id, nivelPref, base, false);
    return { semente: sem === null ? base : sem, nivel: nivelPref };
  };
  const nivelDe = (t, topicId) => (o.nivel === 'auto' ? nivelSugerido(o.eventos, topicId || t.topicId) : o.nivel);
  const rng = Questoes.criarRng(o.semente >>> 0);
  const addItem = (t, tipo) => {
    let base = (rng.int(1, 1e9) >>> 0); let topico = t.topicId;
    if (t.ajustarSemente) {                                   // Direito: escolhe o tópico (entre os pedidos e geráveis) e ajusta a semente para cair nele
      const alvos = Questoes.topicosDe(t).filter((x) => !o.topicIds || o.topicIds.includes(x));
      topico = alvos[rng.int(0, alvos.length - 1)]; base = t.ajustarSemente(topico, base);
    }
    const { semente, nivel } = escolhe(t, nivelDe(t, topico), base);
    respondidas.add(Questoes.idQuestao(t.id, semente, nivel));
    const texto = enunciadoDe(t.id, semente, nivel); if (texto) vistos.add(texto);
    itens.push({ templateId: t.id, topicId: topico, nivel, semente, tipo });
  };
  const maxRev = Math.ceil(o.n * o.fracRevisoes);
  for (const c of vencidas) { if (itens.length >= maxRev) break; addItem(Questoes.modelo(c.templateId), 'revisao'); }
  const praticadas = (t) => (cart.get(t.id) ? cart.get(t.id).respostas : 0);
  const ordem = candidatos.slice().sort((a, b) => (praticadas(a) - praticadas(b)) || (a.id < b.id ? -1 : 1));
  let i = 0;
  while (itens.length < o.n) { addItem(ordem[i % ordem.length], 'nova'); i++; }
  return itens;
}

/** Caderno de erros: respostas erradas, com motivo, reincidência do assunto e próxima revisão. */
function cadernoErros(eventos, hojeIdx) {
  const cart = cartoes(eventos, hojeIdx);
  const motivos = new Map();
  // o último motivo (por data e id) vence, qualquer que seja a ordem em que os blocos foram lidos
  eventos.filter((e) => e.tipo === 'motivo' && e.ref).sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .forEach((e) => motivos.set(e.ref, e.motivo));
  const resp = soRespostas(eventos);
  const erradasPorModelo = new Map();
  for (const e of resp) if (!e.correct) { const t = templateDe(e.questionId); erradasPorModelo.set(t, (erradasPorModelo.get(t) || 0) + 1); }
  return resp.filter((e) => !e.correct).sort((a, b) => b.ts - a.ts).map((e) => {
    const t = templateDe(e.questionId);
    const c = cart.get(t);
    return {
      eventId: e.id, ts: e.ts, questionId: e.questionId, templateId: t, topicId: e.topicId, nivel: e.nivel || 1,
      resposta: e.resposta || null, gabarito: e.gabarito || null, motivo: motivos.get(e.id) || null,
      reincidencias: erradasPorModelo.get(t), proximaRevisaoIdx: c ? c.proximaIdx : null,
    };
  });
}

/** Resumo de um conjunto de respostas (sessão ou período). */
function resumo(respostas) {
  const n = respostas.length;
  const acertos = respostas.filter((e) => e.correct).length;
  const comTempo = respostas.filter((e) => Number.isFinite(e.ms));
  const porTopico = {};
  for (const e of respostas) { const t = (porTopico[e.topicId] = porTopico[e.topicId] || { n: 0, acertos: 0 }); t.n++; if (e.correct) t.acertos++; }
  return {
    n, acertos, erros: n - acertos, aproveitamento: n ? acertos / n : 0,
    tempoMedioMs: comTempo.length ? comTempo.reduce((s, e) => s + e.ms, 0) / comTempo.length : null,
    acertosComDuvida: respostas.filter((e) => e.correct && e.conf !== 'seguro').length,
    errosComCerteza: respostas.filter((e) => !e.correct && e.conf === 'seguro').length,
    porTopico,
  };
}

function estatisticas(eventos, hojeIdx, tz) {
  const fuso = tz === undefined ? TZ : tz;
  const resp = soRespostas(eventos);
  const hoje = resp.filter((e) => Progresso.diaIdx(e.ts, fuso) === hojeIdx);
  return { total: resumo(resp), hoje: resumo(hoje) };
}

/** Evento de resposta no formato do histórico. */
function eventoResposta(q, indiceEscolhido, conf, ms) {
  const escolhida = q.alternativas[indiceEscolhido];
  return {
    topicId: q.topicId, questionId: q.id, correct: !!escolhida.correta, conf,
    resposta: escolhida.letra, gabarito: q.gabarito, ms: Math.max(0, Math.round(ms)), nivel: q.nivel, templateId: q.templateId,
  };
}
const eventoMotivo = (eventoResp, motivo) => ({ tipo: 'motivo', ref: eventoResp.id, topicId: eventoResp.topicId, questionId: eventoResp.questionId, correct: false, motivo });

const CATEGORIAS_PROBLEMA = Object.freeze({ enunciado: 'Enunciado errado ou confuso', gabarito: 'O gabarito parece errado', explicacao: 'A explicação está errada', outro: 'Outro problema' });
/** Aviso da aluna sobre uma questão. Não é resposta: fica fora do motor de progresso, das revisões e do caderno. */
const eventoProblema = (eventoResp, categoria, nota) => ({ tipo: 'problema', ref: eventoResp.id, topicId: eventoResp.topicId, questionId: eventoResp.questionId, correct: false,
  categoria: CATEGORIAS_PROBLEMA[categoria] ? categoria : 'outro', nota: String(nota || '').slice(0, 300) });
const problemasReportados = (eventos) => eventos.filter((e) => e.tipo === 'problema').sort((a, b) => b.ts - a.ts);

const API = { CATEGORIAS_PROBLEMA, eventoProblema, problemasReportados, TIPOS_AUXILIARES, INTERVALOS, CREDITO, MOTIVOS, paraMotor, soRespostas, templateDe, cartoes, revisoesVencidas, nivelSugerido, montarSessao, cadernoErros, resumo, estatisticas, eventoResposta, eventoMotivo };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Aprendizagem = API;
