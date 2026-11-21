'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularProgresso, diaIdx, idxParaISO } = require('../src/progresso.js');

const DIA = 86400000;
const AGORA = Date.UTC(2026, 10, 20, 15, 0, 0);   // 20/11/2026 12:00 em Brasília
const PROVA = Date.UTC(2027, 2, 14, 17, 0, 0);    // 14/03/2027 14:00 em Brasília (data ainda não confirmada no edital)
const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

function evs(topicId, n, o = {}) {
  const { inicio = AGORA - 30 * DIA, passoDias = 1, correct = true, conf = 'seguro', distintas = true } = o;
  return Array.from({ length: n }, (_, i) => ({
    topicId, questionId: distintas ? `${topicId}-q${i}` : `${topicId}-q0`,
    ts: inicio + i * passoDias * DIA, correct: typeof correct === 'function' ? correct(i) : correct, conf,
  }));
}
const dominado = (id) => ({ estudados: [id], eventos: evs(id, 10) });
function entrada(topicos, extra = {}) {
  return Object.assign({ topicos, eventos: [], sessoes: [], estudados: [], agora: AGORA, dataProva: PROVA, revisoesVencidas: 0 }, extra);
}
function juntar(topicos, partes, extra = {}) {
  return entrada(topicos, Object.assign({
    eventos: partes.flatMap((p) => p.eventos || []), estudados: partes.flatMap((p) => p.estudados || []),
  }, extra));
}
const T = (id, cx = 3) => ({ id, complexidade: cx });
const estadoDe = (r, id) => r.topicos.find((t) => t.id === id).estado;

test('sem nenhum dado: tudo zerado e NÃO INICIADO', () => {
  const r = calcularProgresso(entrada([T('A'), T('B')]));
  assert.equal(r.percentualGeral, 0);
  assert.equal(r.topicosEmDominio, 0);
  assert.equal(r.contagemPorEstado['NÃO INICIADO'], 2);
  assert.equal(r.alerta, null);
});

test('tópico só estudado, sem questões: EM APRENDIZAGEM (25%)', () => {
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'] }));
  assert.equal(estadoDe(r, 'A'), 'EM APRENDIZAGEM');
  perto(r.topicos[0].progresso, 0.25);
});

test('falso domínio: muitos acertos na MESMA questão não consolidam', () => {
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos: evs('A', 8, { passoDias: 0.001, distintas: false }) }));
  assert.equal(r.topicos[0].questoesDistintas, 1);
  assert.equal(estadoDe(r, 'A'), 'EM APRENDIZAGEM');
  perto(r.topicos[0].progresso, 0.25 + 0.25 * 0.1 + 0.30 * 0.1);   // 0,305
});

test('falso domínio: 10 acertos seguros no MESMO dia não provam retenção', () => {
  const eventos = evs('A', 10, { inicio: AGORA - 3 * 3600000, passoDias: 0.01 });
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos }));
  assert.equal(r.topicos[0].componentes.retencao, 0);
  assert.notEqual(estadoDe(r, 'A'), 'DOMÍNIO PROVISÓRIO');
  perto(r.topicos[0].progresso, 0.8);
});

test('domínio provisório exige estudo + variedade + desempenho + retenção', () => {
  const r = calcularProgresso(juntar([T('A')], [dominado('A')]));
  assert.equal(estadoDe(r, 'A'), 'DOMÍNIO PROVISÓRIO');
  perto(r.topicos[0].progresso, 1);
  const semEstudo = calcularProgresso(entrada([T('A')], { eventos: evs('A', 10) }));
  assert.notEqual(estadoDe(semEstudo, 'A'), 'DOMÍNIO PROVISÓRIO');
});

test('10 acertos, todos com dúvida: progresso parcial e estado FRÁGIL (50% ponderado < 60%)', () => {
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos: evs('A', 10, { conf: 'duvida' }) }));
  assert.equal(estadoDe(r, 'A'), 'FRÁGIL');
  perto(r.topicos[0].desempenhoPonderado, 0.5);
  perto(r.topicos[0].progresso, 0.25 + 0.25 + (0.5 / 0.8) * 0.30 + 0.20);   // 0,8875
});

test('limite exato: 6 acertos seguros + 4 com dúvida (80% ponderado) atingem o critério de desempenho', () => {
  const eventos = evs('A', 10).map((e, i) => (i < 6 ? e : Object.assign({}, e, { conf: 'duvida' })));
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos }));
  perto(r.topicos[0].desempenhoPonderado, 0.8);
  assert.equal(estadoDe(r, 'A'), 'DOMÍNIO PROVISÓRIO');
});

test('acerto sem confiança informada é tratado como acerto com dúvida', () => {
  const semConf = evs('A', 10).map(({ conf, ...resto }) => resto);   // remove o campo conf
  assert.ok(semConf.every((e) => !('conf' in e)));
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos: semConf }));
  perto(r.topicos[0].desempenhoPonderado, 0.5);
});

test('acerto por chute vale menos que acerto seguro', () => {
  const seguro = calcularProgresso(juntar([T('A')], [dominado('A')]));
  const chute = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos: evs('A', 10, { conf: 'chute' }) }));
  assert.ok(chute.topicos[0].progresso < seguro.topicos[0].progresso);
  assert.notEqual(estadoDe(chute, 'A'), 'DOMÍNIO PROVISÓRIO');
  assert.equal(chute.topicos[0].componentes.retencao, 0);   // chute não comprova retenção
});

test('FRÁGIL: erros recorrentes derrubam o estado mesmo com tópico estudado', () => {
  const eventos = evs('A', 6, { correct: (i) => i === 0 });
  const r = calcularProgresso(entrada([T('A')], { estudados: ['A'], eventos }));
  assert.equal(estadoDe(r, 'A'), 'FRÁGIL');
});

test('refazer a mesma questão conta pela tentativa mais recente (acerto antigo não esconde erro novo)', () => {
  const eventos = [
    { topicId: 'A', questionId: 'q1', ts: AGORA - 20 * DIA, correct: true, conf: 'seguro' },
    { topicId: 'A', questionId: 'q1', ts: AGORA - 1 * DIA, correct: false },
  ];
  const r = calcularProgresso(entrada([T('A')], { eventos }));
  assert.equal(r.topicos[0].desempenhoPonderado, 0);
});

test('cálculo à mão: 2 tópicos, 1 dominado (90 min) e 1 intocado (180 min)', () => {
  const r = calcularProgresso(juntar([T('A', 3), T('B', 5)], [dominado('A')]));
  perto(r.percentualGeral, 90 / 270);
  perto(r.carga.restanteMin, 180);
  assert.equal(r.prazo.dataProva, '2027-03-14');
  assert.equal(r.prazo.prazoEstudo, '2027-02-28');
  assert.equal(r.prazo.diasCalendario, 101);
  perto(r.prazo.diasEstudo, 101 * 6 / 7);
  perto(r.meta.necessarioMinDia, 180 / (101 * 6 / 7));
});

test('revisões vencidas aumentam a carga em 1,5 min cada', () => {
  const a = calcularProgresso(entrada([T('A')]));
  const b = calcularProgresso(entrada([T('A')], { revisoesVencidas: 20 }));
  perto(b.carga.restanteMin - a.carga.restanteMin, 30);
});

const cinquenta = Array.from({ length: 50 }, (_, i) => T('T' + i, 3));   // 4500 min

test('capacidade: 60 dentro, 45 apertado, 40 acima (valores calculados à mão)', () => {
  const nec = 4500 / (101 * 6 / 7);
  const r60 = calcularProgresso(entrada(cinquenta), { disponivelMinDia: 60 });
  const r45 = calcularProgresso(entrada(cinquenta), { disponivelMinDia: 45 });
  const r40 = calcularProgresso(entrada(cinquenta), { disponivelMinDia: 40 });
  perto(r60.meta.necessarioMinDia, nec);
  assert.equal(r60.meta.situacao, 'DENTRO DA CAPACIDADE');
  assert.equal(r45.meta.situacao, 'APERTADO');
  assert.equal(r40.meta.situacao, 'ACIMA DA CAPACIDADE');
  perto(r40.meta.faltaMinDia, nec - 40);
  perto(r40.meta.projecaoCoberturaNoTempoDisponivel, (40 * 101 * 6 / 7) / 4500);
  assert.equal(r60.meta.faltaMinDia, 0);
});

test('prazo esgotado: sem divisão por zero, sem Infinity e sem NaN', () => {
  const depois = Date.UTC(2027, 2, 10, 15, 0, 0);
  const r = calcularProgresso(entrada(cinquenta, { agora: depois }));
  assert.equal(r.meta.situacao, 'PRAZO ESGOTADO');
  assert.equal(r.meta.necessarioMinDia, null);
  assert.equal(r.meta.faltaMinDia, null);
  assert.equal(r.prazo.diasCalendario, 0);
});

test('concluído: restante zero => necessário zero', () => {
  const topicos = [T('A'), T('B')];
  const r = calcularProgresso(juntar(topicos, [dominado('A'), dominado('B')]));
  assert.equal(r.meta.situacao, 'CONCLUÍDO');
  assert.equal(r.meta.necessarioMinDia, 0);
  assert.equal(r.percentualGeral, 1);
  assert.equal(r.alerta.nivel, 'CRITÉRIOS CUMPRIDOS');
});

function sessoesDias(n, min) { return Array.from({ length: n }, (_, i) => ({ ts: AGORA - i * DIA, min })); }

test('ritmo: adiantada, no ritmo, atrasada e sem histórico', () => {
  const nec = 4500 / (101 * 6 / 7);   // ~51,98 min por dia de estudo
  const adi = calcularProgresso(entrada(cinquenta, { sessoes: sessoesDias(7, 60) }));
  assert.equal(adi.ritmo.status, 'ADIANTADA');
  perto(adi.ritmo.observadoMinDia, 70);
  assert.equal(adi.ritmo.dentroDoPrazo, true);
  assert.ok(adi.ritmo.conclusaoProjetada >= '2027-02-02' && adi.ritmo.conclusaoProjetada <= '2027-02-03', adi.ritmo.conclusaoProjetada);
  const no = calcularProgresso(entrada(cinquenta, { sessoes: sessoesDias(6, 52) }));
  assert.equal(no.ritmo.status, 'NO RITMO');
  assert.ok(Math.abs(no.ritmo.razao - 52 / nec) < 1e-9);
  const atr = calcularProgresso(entrada(cinquenta, { sessoes: sessoesDias(3, 20) }));
  assert.equal(atr.ritmo.status, 'ATRASADA');
  assert.equal(atr.ritmo.dentroDoPrazo, false);
  const sem = calcularProgresso(entrada(cinquenta, { sessoes: sessoesDias(2, 200) }));
  assert.equal(sem.ritmo.status, 'SEM HISTÓRICO');
  assert.equal(sem.ritmo.observadoMinDia, null);
});

test('sessões fora da janela de 7 dias não contam para o ritmo', () => {
  const velhas = Array.from({ length: 10 }, (_, i) => ({ ts: AGORA - (10 + i) * DIA, min: 120 }));
  const r = calcularProgresso(entrada(cinquenta, { sessoes: velhas }));
  assert.equal(r.ritmo.status, 'SEM HISTÓRICO');
});

test('alerta RETA FINAL aos 90% (9 de 10 tópicos) com aviso de que não garante resultado', () => {
  const topicos = Array.from({ length: 10 }, (_, i) => T('T' + i));
  const partes = topicos.slice(0, 9).map((t) => dominado(t.id));
  const r = calcularProgresso(juntar(topicos, partes));
  assert.equal(r.alerta.nivel, 'RETA FINAL');
  assert.equal(r.pendentes.length, 1);
  assert.equal(r.pendentes[0].id, 'T9');
  assert.match(r.alerta.mensagem, /não garante o resultado na prova/);
});

test('alerta QUASE LÁ aos 98% (49 de 50) e nenhum alerta abaixo de 90%', () => {
  const partes = cinquenta.slice(0, 49).map((t) => dominado(t.id));
  assert.equal(calcularProgresso(juntar(cinquenta, partes)).alerta.nivel, 'QUASE LÁ');
  const poucas = cinquenta.slice(0, 40).map((t) => dominado(t.id));   // 80%
  assert.equal(calcularProgresso(juntar(cinquenta, poucas)).alerta, null);
});

test('calibração: tempo real dobra a estimativa => multiplicador 2 e carga restante dobra', () => {
  const topicos = [T('A'), T('B'), T('C'), T('D')];
  const partes = ['A', 'B', 'C'].map(dominado);
  const sess = (min) => ['A', 'B', 'C'].map((id) => ({ ts: AGORA - DIA, min, topicId: id }));
  const base = calcularProgresso(juntar(topicos, partes));
  const dobro = calcularProgresso(juntar(topicos, partes, { sessoes: sess(180) }));
  const exagero = calcularProgresso(juntar(topicos, partes, { sessoes: sess(450) }));
  assert.equal(base.carga.multiplicadorCalibracao, 1);
  assert.equal(dobro.carga.calibrado, true);
  perto(dobro.carga.multiplicadorCalibracao, 2);
  perto(dobro.carga.restanteMin, 2 * base.carga.restanteMin);
  perto(exagero.carga.multiplicadorCalibracao, 2);   // limitado ao máximo
  const metade = calcularProgresso(juntar(topicos, partes, { sessoes: sess(10) }));
  perto(metade.carga.multiplicadorCalibracao, 0.5);  // limitado ao mínimo
});

test('calibração só liga com 3 ou mais tópicos medidos', () => {
  const topicos = [T('A'), T('B'), T('C')];
  const partes = ['A', 'B'].map(dominado);
  const sessoes = ['A', 'B'].map((id) => ({ ts: AGORA - DIA, min: 400, topicId: id }));
  const r = calcularProgresso(juntar(topicos, partes, { sessoes }));
  assert.equal(r.carga.calibrado, false);
  assert.equal(r.carga.multiplicadorCalibracao, 1);
});

test('fuso: 23h30 e 00h30 de Brasília caem em dias diferentes', () => {
  const a = Date.UTC(2026, 10, 20, 2, 30);   // 19/11 23:30 BRT
  const b = Date.UTC(2026, 10, 20, 3, 30);   // 20/11 00:30 BRT
  assert.equal(diaIdx(b, -180) - diaIdx(a, -180), 1);
  assert.equal(idxParaISO(diaIdx(a, -180)), '2026-11-19');
  assert.equal(idxParaISO(diaIdx(b, -180)), '2026-11-20');
});

test('retenção conta dias de calendário locais, não 168 horas', () => {
  // 1º contato 19/11 23:30 BRT e acerto 26/11 00:30 BRT: 7 dias de calendário, só 145 h
  const ini = Date.UTC(2026, 10, 20, 2, 30);
  const fim = Date.UTC(2026, 10, 26, 3, 30);
  const eventos = [
    { topicId: 'A', questionId: 'q0', ts: ini, correct: true, conf: 'seguro' },
    { topicId: 'A', questionId: 'q1', ts: fim, correct: true, conf: 'seguro' },
  ];
  const r = calcularProgresso(entrada([T('A')], { eventos, agora: fim + DIA }));
  assert.equal(r.topicos[0].componentes.retencao, 1);
});

test('entradas inválidas e futuras são descartadas e contadas, nunca quebram o cálculo', () => {
  const eventos = [
    { topicId: 'X', questionId: 'q', ts: AGORA - DIA, correct: true },            // tópico desconhecido
    { topicId: 'A', ts: AGORA - DIA, correct: true },                              // sem questionId
    { topicId: 'A', questionId: 'q', ts: NaN, correct: true },                     // ts inválido
    { topicId: 'A', questionId: 'q', ts: AGORA - DIA, correct: 'sim' },            // correct não booleano
    { topicId: 'A', questionId: 'q9', ts: AGORA + DIA, correct: true },            // futuro
    null,
  ];
  const sessoes = [{ ts: AGORA, min: -5 }, { ts: AGORA, min: NaN }, { ts: AGORA + DIA, min: 30 }, null];
  const r = calcularProgresso(entrada([T('A')], { eventos, sessoes }));
  assert.equal(r.descartes.eventosInvalidos, 5);
  assert.equal(r.descartes.eventosFuturos, 1);
  assert.equal(r.descartes.sessoesInvalidas, 4);
  assert.equal(r.topicos[0].questoesDistintas, 0);
});

test('validação: entradas estruturalmente erradas lançam TypeError', () => {
  assert.throws(() => calcularProgresso(entrada([])), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A')], { agora: NaN })), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A')], { dataProva: undefined })), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A'), T('A')])), TypeError);
  assert.throws(() => calcularProgresso(entrada([{ id: 'A' }])), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A')]), { pesosEtapas: { estudo: 0.5 } }), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A')]), { diasPorSemana: 8 }), TypeError);
  assert.throws(() => calcularProgresso(entrada([T('A')], { revisoesVencidas: -1 })), TypeError);
  assert.throws(() => calcularProgresso(null), TypeError);
});

function congelar(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); }
  return o;
}

test('pureza: não altera a entrada e é determinístico', () => {
  const e = congelar(juntar([T('A'), T('B', 5)], [dominado('A')], { sessoes: sessoesDias(5, 45) }));
  const r1 = calcularProgresso(e);
  const r2 = calcularProgresso(e);
  assert.deepEqual(r1, r2);
});

// ---- Teste de propriedades com gerador pseudoaleatório fixo (reprodutível) ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todosFinitos(o, caminho = '') {
  if (typeof o === 'number') assert.ok(Number.isFinite(o), 'número não finito em ' + caminho);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) todosFinitos(v, caminho + '.' + k);
}

test('propriedades: 500 cenários aleatórios respeitam todos os invariantes', () => {
  const rnd = mulberry32(20261120);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const confs = ['seguro', 'duvida', 'chute', undefined];
  for (let it = 0; it < 500; it++) {
    const nt = ri(1, 8);
    const topicos = Array.from({ length: nt }, (_, i) => T('T' + i, ri(1, 5)));
    const agora = AGORA + ri(-20, 120) * DIA;
    const eventos = Array.from({ length: ri(0, 200) }, () => ({
      topicId: rnd() < 0.05 ? 'DESCONHECIDO' : 'T' + ri(0, nt - 1),
      questionId: 'q' + ri(0, 30),
      ts: AGORA + ri(-60, 2) * DIA + ri(0, 86399) * 1000,
      correct: rnd() < 0.6, conf: confs[ri(0, 3)],
    }));
    const sessoes = Array.from({ length: ri(0, 40) }, () => ({
      ts: AGORA + ri(-30, 1) * DIA, min: ri(-5, 180), topicId: rnd() < 0.5 ? 'T' + ri(0, nt - 1) : undefined,
    }));
    const estudados = topicos.filter(() => rnd() < 0.5).map((t) => t.id);
    const e = { topicos, eventos, sessoes, estudados, agora, dataProva: PROVA, revisoesVencidas: ri(0, 80) };
    const antes = JSON.stringify(e);
    const opc = { disponivelMinDia: ri(15, 240), diasPorSemana: ri(1, 7), reservaFinalDias: ri(0, 30) };
    const r = calcularProgresso(e, opc);

    assert.equal(JSON.stringify(e), antes, 'a entrada foi alterada');
    todosFinitos(r);
    assert.ok(r.percentualGeral >= 0 && r.percentualGeral <= 1);
    for (const t of r.topicos) assert.ok(t.progresso >= 0 && t.progresso <= 1);
    assert.equal(Object.values(r.contagemPorEstado).reduce((a, b) => a + b, 0), nt);
    assert.ok(r.carga.restanteMin >= 0);
    assert.ok(r.meta.necessarioMinDia === null || r.meta.necessarioMinDia >= 0);
    assert.ok(r.meta.faltaMinDia === null || r.meta.faltaMinDia >= 0);
    assert.ok(r.meta.projecaoCoberturaNoTempoDisponivel >= 0 && r.meta.projecaoCoberturaNoTempoDisponivel <= 1);
    if (r.topicosEmDominio === nt) assert.equal(r.alerta.nivel, 'CRITÉRIOS CUMPRIDOS');
    if (r.alerta) assert.match(r.alerta.mensagem, /não garante/);
    if (r.meta.situacao === 'PRAZO ESGOTADO') assert.equal(r.meta.necessarioMinDia, null);
    assert.deepEqual(calcularProgresso(e, opc), r, 'resultado não determinístico');
  }
});
