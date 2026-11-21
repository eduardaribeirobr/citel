'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/aprendizagem.js');
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js');
require('../src/questoes-mat2.js');
require('../src/questoes-rl.js'); require('../src/questoes-rl2.js');
const Backup = require('../src/backup.js');
const { calcularProgresso, diaIdx } = require('../src/progresso.js');
const { derivar } = require('../src/store.js');
const { mulberry32 } = require('./fakes.js');

const DIA = 86400000;
const BASE = Date.UTC(2026, 11, 1, 15, 0, 0);       // 01/12/2026 12:00 em Brasília
const TZ = -180;
const idxDe = (offDias) => diaIdx(BASE + offDias * DIA, TZ);
let contador = 0;
function ev(templateId, offDias, correct, conf, extra) {
  contador += 1;
  const nivel = (extra && extra.nivel) || 1;
  const seed = (extra && extra.semente) || 1000 + contador;
  const t = Q.modelo(templateId);
  return Object.assign({ id: 'e' + contador, ts: BASE + offDias * DIA + contador * 1000, topicId: t.topicId, questionId: Q.idQuestao(templateId, seed, nivel), correct, conf: conf || 'seguro', nivel, ms: 30000 }, extra && { resposta: extra.resposta, gabarito: extra.gabarito });
}
const T = 'MAT-02-MMC-MDC';

test('revisão espaçada: acertos seguros sucessivos, feitos NO PRAZO, sobem 1 → 7 → 15 → 30 dias', () => {
  const eventos = [ev(T, 0, true), ev(T, 1, true), ev(T, 8, true), ev(T, 23, true), ev(T, 53, true), ev(T, 83, true)];
  const passos = []; const proximas = [];
  for (let k = 1; k <= eventos.length; k++) { const c = A.cartoes(eventos.slice(0, k), idxDe(200)).get(T); passos.push(c.passo); proximas.push(c.proximaIdx - c.ultimoIdx); }
  assert.deepEqual(passos, [0, 1, 2, 3, 3, 3]);
  assert.deepEqual(proximas, [1, 7, 15, 30, 30, 30]);
});

test('erro volta para 1 dia; acerto com dúvida ou chute não avança; antecipar a prática não avança', () => {
  const erro = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 8, false)], idxDe(100)).get(T);
  assert.equal(erro.passo, 0);
  assert.equal(erro.proximaIdx - erro.ultimoIdx, 1);
  // dúvida no prazo: mantém o passo (já estava em 7 dias) e reagenda por esse mesmo intervalo
  const duvida = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 8, true, 'duvida')], idxDe(100)).get(T);
  assert.equal(duvida.passo, 1);
  assert.equal(duvida.proximaIdx - duvida.ultimoIdx, 7);
  const duvidaCedo = A.cartoes([ev(T, 0, true), ev(T, 1, true, 'duvida')], idxDe(100)).get(T);
  assert.equal(duvidaCedo.passo, 0, 'dúvida logo no início não sobe');
  const chute = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 8, true, 'chute')], idxDe(100)).get(T);
  assert.equal(chute.passo, 1, 'chute no prazo não avança');
  assert.equal(A.cartoes([ev(T, 0, true, 'chute')], idxDe(100)).get(T).passo, 0);
  // prática antecipada (antes do vencimento): não sobe de passo
  const cedo = A.cartoes([ev(T, 0, true), ev(T, 0.1, true)], idxDe(100)).get(T);   // 14:24 do mesmo dia
  assert.equal(cedo.passo, 0, 'dois acertos no mesmo dia contam como um resultado');
  const viraDia = A.cartoes([ev(T, 0, true), ev(T, 0.5, true)], idxDe(100)).get(T);   // 00:00 do dia seguinte = vencimento
  assert.equal(viraDia.passo, 1, 'o dia seguinte já é a data de vencimento: avança');
  const dia2cedo = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 2, true)], idxDe(100)).get(T);
  assert.equal(dia2cedo.passo, 1, 'o acerto do dia 2 veio antes do vencimento (dia 8): não avança');
});

test('várias respostas no mesmo dia viram UM resultado: um erro entre acertos conta como erro do dia', () => {
  const c = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 8, true), ev(T, 8, false), ev(T, 8, true)], idxDe(100)).get(T);
  assert.equal(c.passo, 0);
  assert.equal(c.respostas, 5);
});

test('vencimento e atraso; ordenação das revisões vencidas (mais atrasadas primeiro); dúvida mantém o intervalo', () => {
  const T2 = 'MAT-07-JUROS-SIMPLES'; const T3 = 'MAT-12-GEOMETRIA';
  const eventos = [ev(T, 0, true), ev(T2, 0, true), ev(T3, 5, true)];
  const cart = A.cartoes(eventos, idxDe(3));
  assert.equal(cart.get(T).devida, true);
  assert.equal(cart.get(T).atrasoDias, 2);
  assert.equal(cart.get(T3).devida, false);
  assert.deepEqual(A.revisoesVencidas(cart).map((c) => c.templateId), [T, T2].sort());
  const mais = A.cartoes([ev(T, 0, true), ev(T2, -4, true)], idxDe(3));
  assert.deepEqual(A.revisoesVencidas(mais).map((c) => c.templateId), [T2, T], 'a mais atrasada vem primeiro');
});

test('eventos de motivo e ids que não são de questões geradas não entram nos cálculos', () => {
  const resp = ev(T, 0, false);
  const motivo = A.eventoMotivo(resp, 'calculo'); motivo.id = 'm1'; motivo.ts = resp.ts + 1000;
  const lixo = { id: 'x', ts: BASE, topicId: 'T', questionId: 'qualquer-coisa', correct: true, conf: 'seguro' };
  assert.equal(A.soRespostas([resp, motivo, lixo]).length, 1);
  assert.equal(A.cartoes([resp, motivo, lixo], idxDe(1)).size, 1);
});

test('nível sugerido: começa em 1, sobe com 80% ponderado (mín. 3 no nível), desce abaixo de 50%, e chute vale pouco', () => {
  const topic = Q.modelo(T).topicId;
  assert.equal(A.nivelSugerido([], topic), 1);
  const dois = [ev(T, 0, true), ev(T, 0, true)];
  assert.equal(A.nivelSugerido(dois, topic), 1, 'poucas respostas: mantém');
  const tres = [ev(T, 0, true), ev(T, 0, true), ev(T, 0, true)];
  assert.equal(A.nivelSugerido(tres, topic), 2);
  const nivel3 = [1, 2, 3].map(() => ev(T, 0, true, 'seguro', { nivel: 3 }));
  assert.equal(A.nivelSugerido(nivel3, topic), 4);
  const topo = [1, 2, 3].map(() => ev(T, 0, true, 'seguro', { nivel: 5 }));
  assert.equal(A.nivelSugerido(topo, topic), 5, 'teto 5');
  const chutes = [1, 2, 3].map(() => ev(T, 0, true, 'chute', { nivel: 3 }));
  assert.equal(A.nivelSugerido(chutes, topic), 2, 'acertos por chute valem 25%: desce');
  const erros = [1, 2, 3].map(() => ev(T, 0, false, 'seguro', { nivel: 1 }));
  assert.equal(A.nivelSugerido(erros, topic), 1, 'piso 1');
  const mistura = [ev(T, 0, true, 'seguro', { nivel: 2 }), ev(T, 0, false, 'seguro', { nivel: 2 }), ev(T, 0, true, 'duvida', { nivel: 2 }), ev(T, 0, true, 'seguro', { nivel: 2 })];
  assert.equal(A.nivelSugerido(mistura, topic), 2, '(1+0+0,5+1)/4 = 62,5%: mantém');
  const so1 = [ev(T, 0, false, 'seguro', { nivel: 1 }), ev(T, 0, false, 'seguro', { nivel: 1 }), ev(T, 0, true, 'seguro', { nivel: 2 })];
  assert.equal(A.nivelSugerido(so1, topic), 2, 'só conta o nível atual (o da última resposta)');
});

test('sessão: n itens, sem repetir questão, determinística, respeita filtro e nível fixo', () => {
  const base = { n: 14, eventos: [], hojeIdx: idxDe(0), semente: 99 };
  const s = A.montarSessao(base);
  assert.equal(s.length, 14);
  assert.equal(new Set(s.map((i) => Q.idQuestao(i.templateId, i.semente, i.nivel))).size, 14);
  assert.deepEqual(A.montarSessao(base), s);
  assert.notDeepEqual(A.montarSessao(Object.assign({}, base, { semente: 100 })), s);
  const soMat = A.montarSessao(Object.assign({}, base, { n: 5, topicIds: ['OJ26-MAT-04', 'OJ26-MAT-07'] }));
  assert.equal(soMat.length, 5);
  assert.ok(soMat.every((i) => ['OJ26-MAT-04', 'OJ26-MAT-07'].includes(i.topicId)));
  const fixo = A.montarSessao(Object.assign({}, base, { n: 6, nivel: 4 }));
  assert.ok(fixo.every((i) => i.nivel === 4));
  assert.deepEqual(A.montarSessao(Object.assign({}, base, { topicIds: ['NAO-EXISTE'] })), []);
});

test('sessão intercalada: com todos os modelos novos, cada um aparece uma vez antes de repetir', () => {
  const s = A.montarSessao({ n: 16, eventos: [], hojeIdx: idxDe(0), semente: 7 });
  assert.equal(new Set(s.map((i) => i.templateId)).size, 16);
  const s2 = A.montarSessao({ n: 20, eventos: [], hojeIdx: idxDe(0), semente: 7 });
  const cont = {}; for (const i of s2) cont[i.templateId] = (cont[i.templateId] || 0) + 1;
  assert.ok(Object.values(cont).every((v) => v <= 2));
});

test('sessão: revisões vencidas vêm primeiro (até 40%), os modelos menos praticados depois, e nunca repete questão já respondida', () => {
  const eventos = [ev('MAT-04-PORCENTAGEM', -10, true), ev('MAT-05-REGRA-DE-TRES', -9, true), ev('MAT-06-MEDIA', -8, true)];
  const s = A.montarSessao({ n: 10, eventos, hojeIdx: idxDe(0), semente: 3 });
  assert.deepEqual(s.slice(0, 3).map((i) => i.tipo), ['revisao', 'revisao', 'revisao']);
  assert.deepEqual(s.slice(0, 3).map((i) => i.templateId), ['MAT-04-PORCENTAGEM', 'MAT-05-REGRA-DE-TRES', 'MAT-06-MEDIA']);
  assert.ok(s.slice(3).every((i) => i.tipo === 'nova'));
  const poucas = A.montarSessao({ n: 5, eventos, hojeIdx: idxDe(0), semente: 3 });
  assert.equal(poucas.filter((i) => i.tipo === 'revisao').length, 2, '40% de 5 = 2');
  // nunca repete uma questão já respondida (mesmo se a semente coincidir)
  const resp = A.montarSessao({ n: 8, eventos: [], hojeIdx: idxDe(0), semente: 11 });
  const feitas = resp.map((i, k) => ({ id: 'z' + k, ts: BASE, topicId: i.topicId, questionId: Q.idQuestao(i.templateId, i.semente, i.nivel), correct: true, conf: 'seguro', nivel: i.nivel }));
  const nova = A.montarSessao({ n: 8, eventos: feitas, hojeIdx: idxDe(0), semente: 11 });
  const jaFeitas = new Set(feitas.map((e) => e.questionId));
  for (const i of nova) assert.ok(!jaFeitas.has(Q.idQuestao(i.templateId, i.semente, i.nivel)), 'repetiu uma questão já respondida');
});

test('sessão: o nível automático acompanha o desempenho em cada assunto', () => {
  const eventos = [1, 2, 3].map(() => ev('MAT-04-PORCENTAGEM', -1, true, 'seguro', { nivel: 1 }));
  const s = A.montarSessao({ n: 16, eventos, hojeIdx: idxDe(0), semente: 5 });
  assert.ok(s.filter((i) => i.templateId === 'MAT-04-PORCENTAGEM').every((i) => i.nivel === 2));
  assert.ok(s.filter((i) => i.templateId === 'MAT-02-MMC-MDC').every((i) => i.nivel === 1));
});

test('caderno de erros: só erros, com motivo, reincidência do assunto e próxima revisão', () => {
  const e1 = ev(T, 0, false, 'seguro', { resposta: 'B', gabarito: 'D' });
  const e2 = ev(T, 1, false, 'duvida', { resposta: 'A', gabarito: 'C' });
  const ok = ev('MAT-07-JUROS-SIMPLES', 1, true);
  const mot = A.eventoMotivo(e1, 'desatencao'); mot.id = 'mot1'; mot.ts = e1.ts + 500;
  const lista = A.cadernoErros([e1, e2, ok, mot], idxDe(2));
  assert.equal(lista.length, 2);
  assert.equal(lista[0].eventId, e2.id, 'mais recente primeiro');
  assert.equal(lista[1].motivo, 'desatencao');
  assert.equal(lista[0].motivo, null);
  assert.equal(lista[0].reincidencias, 2);
  assert.equal(lista[0].proximaRevisaoIdx, idxDe(1) + 1);
  assert.equal(lista[1].resposta, 'B');
  assert.equal(lista[1].gabarito, 'D');
  assert.deepEqual(A.cadernoErros([], idxDe(0)), []);
});

test('resumo: acertos, tempo médio, acertos com dúvida (falsos acertos) e erros com certeza (confiança mal calibrada)', () => {
  const r = A.resumo([ev(T, 0, true, 'seguro'), ev(T, 0, true, 'duvida'), ev(T, 0, true, 'chute'), ev(T, 0, false, 'seguro'), ev('MAT-07-JUROS-SIMPLES', 0, false, 'duvida')]);
  assert.equal(r.n, 5);
  assert.equal(r.acertos, 3);
  assert.equal(r.erros, 2);
  assert.equal(r.aproveitamento, 0.6);
  assert.equal(r.acertosComDuvida, 2);
  assert.equal(r.errosComCerteza, 1);
  assert.equal(r.tempoMedioMs, 30000);
  assert.deepEqual(r.porTopico['OJ26-MAT-02'], { n: 4, acertos: 3 });
  const vazio = A.resumo([]);
  assert.equal(vazio.n, 0); assert.equal(vazio.aproveitamento, 0); assert.equal(vazio.tempoMedioMs, null);
});

test('estatísticas do dia usam o dia local de Brasília', () => {
  const tarde = { id: 'a', ts: Date.UTC(2026, 11, 2, 2, 30), topicId: Q.modelo(T).topicId, questionId: Q.idQuestao(T, 1, 1), correct: true, conf: 'seguro' };   // 01/12 23:30 em Brasília
  const hoje = A.estatisticas([tarde], diaIdx(Date.UTC(2026, 11, 1, 15), TZ));
  assert.equal(hoje.hoje.n, 1);
  const amanha = A.estatisticas([tarde], diaIdx(Date.UTC(2026, 11, 2, 15), TZ));
  assert.equal(amanha.hoje.n, 0);
  assert.equal(amanha.total.n, 1);
});

test('eventos de resposta e de motivo passam na validação do backup e guardam o que o caderno precisa', () => {
  const q = Q.gerarQuestao(T, 77, 2);
  const certaIdx = q.gabaritoIdx; const erradaIdx = (certaIdx + 1) % 5;
  const e = A.eventoResposta(q, erradaIdx, 'duvida', 41234.6);
  assert.equal(e.correct, false);
  assert.equal(e.resposta, q.alternativas[erradaIdx].letra);
  assert.equal(e.gabarito, q.gabarito);
  assert.equal(e.ms, 41235);
  assert.equal(e.nivel, 2);
  assert.equal(e.questionId, q.id);
  assert.equal(A.eventoResposta(q, certaIdx, 'seguro', 1000).correct, true);
  const completo = Object.assign({ id: 'e1', ts: BASE }, e);
  assert.equal(Backup.VALIDADORES.eventos(completo), true);
  const m = Object.assign({ id: 'm1', ts: BASE }, A.eventoMotivo(completo, 'interpretacao'));
  assert.equal(Backup.VALIDADORES.eventos(m), true);
  assert.equal(m.ref, 'e1');
  assert.equal(m.tipo, 'motivo');
});

test('a questão é reproduzida a partir do id guardado no caderno (refazer)', () => {
  const q = Q.gerarQuestao('MAT-08-EQUACOES', 31337, 3);
  const e = A.eventoResposta(q, 0, 'seguro', 1000);
  const { templateId, semente, nivel } = Q.lerId(e.questionId);
  assert.deepEqual(Q.gerarQuestao(templateId, semente, nivel), q);
});

test('INTEGRAÇÃO com o motor de progresso: um tópico de Matemática chega ao domínio provisório só com variedade, desempenho e retenção', () => {
  const topicos = [{ id: 'OJ26-MAT-02', esforcoMin: 45 }];
  const evs = []; let n = 0;
  const resp = (off, correct, conf) => { n += 1; const q = Q.gerarQuestao('MAT-02-MMC-MDC', 5000 + n, 2); evs.push({ id: 'r' + n, ts: BASE + off * DIA + n * 1000, topicId: q.topicId, questionId: q.id, correct, conf, nivel: 2 }); };
  for (let i = 0; i < 10; i++) resp(0, true, 'seguro');
  const base = { topicos, estudados: ['OJ26-MAT-02'], sessoes: [], agora: BASE + 20 * DIA, dataProva: Date.UTC(2027, 2, 14, 17), revisoesVencidas: 0 };
  const mesmoDia = calcularProgresso(Object.assign({ eventos: evs.slice() }, base));
  assert.notEqual(mesmoDia.topicos[0].estado, 'DOMÍNIO PROVISÓRIO', 'sem retenção de 7 dias ainda não é domínio');
  resp(8, true, 'seguro');
  const comRetencao = calcularProgresso(Object.assign({ eventos: evs.slice() }, base));
  assert.equal(comRetencao.topicos[0].estado, 'DOMÍNIO PROVISÓRIO');
  const soChutes = [];
  for (let i = 0; i < 11; i++) soChutes.push({ id: 'c' + i, ts: BASE + (i < 10 ? 0 : 8) * DIA + i * 1000, topicId: 'OJ26-MAT-02', questionId: Q.idQuestao('MAT-02-MMC-MDC', 9000 + i, 2), correct: true, conf: 'chute', nivel: 2 });
  const chutes = calcularProgresso(Object.assign({ eventos: soChutes }, base));
  assert.notEqual(chutes.topicos[0].estado, 'DOMÍNIO PROVISÓRIO', 'acertar por chute não é domínio');
  // o caderno de erros e os cartões leem os mesmos eventos que o motor
  assert.equal(A.cartoes(evs, diaIdx(BASE + 20 * DIA, TZ)).get('MAT-02-MMC-MDC').respostas, 11);
});

test('nível: limiares exatos (80% sobe, 70% mantém, 50% mantém, 40% desce), crédito de dúvida e janela das últimas 10', () => {
  const topic = Q.modelo(T).topicId;
  const mk = (corretas, total, conf, nivel) => Array.from({ length: total }, (_, i) => ev(T, 0, i < corretas, conf || 'seguro', { nivel: nivel || 2 }));
  assert.equal(A.nivelSugerido(mk(4, 5), topic), 3, '80% exato sobe');
  assert.equal(A.nivelSugerido(mk(7, 10), topic), 2, '70% mantém');
  assert.equal(A.nivelSugerido(mk(5, 10), topic), 2, '50% exato mantém');
  assert.equal(A.nivelSugerido(mk(4, 10), topic), 1, '40% desce');
  assert.equal(A.nivelSugerido(mk(4, 4, 'duvida', 3), topic), 3, 'quatro acertos com dúvida = 50%: mantém (dúvida vale meio acerto)');
  const antigosRuins = mk(0, 5, 'seguro', 2).concat(mk(10, 10, 'seguro', 2));
  assert.equal(A.nivelSugerido(antigosRuins, topic), 3, 'só as últimas 10 respostas do nível contam');
});

test('revisão espaçada: erro depois de passo alto volta a 1 dia (não só um passo para trás)', () => {
  const c = A.cartoes([ev(T, 0, true), ev(T, 1, true), ev(T, 8, true), ev(T, 23, true), ev(T, 53, false)], idxDe(100)).get(T);
  assert.equal(c.passo, 0);
  assert.equal(c.proximaIdx - c.ultimoIdx, 1);
});

test('revisão espaçada usa o dia de Brasília: resposta às 22h conta no mesmo dia, não no seguinte', () => {
  const noite = ev(T, 10 / 24, true);                       // 22:00 em Brasília = 01:00 UTC do dia seguinte
  const c = A.cartoes([noite], idxDe(5)).get(T);
  assert.equal(c.ultimoIdx, idxDe(0));
  assert.equal(c.proximaIdx, idxDe(1));
  const antesDaMeiaNoite = A.cartoes([ev(T, 0, true), ev(T, 10 / 24, true)], idxDe(5)).get(T);
  assert.equal(antesDaMeiaNoite.passo, 0, 'meio-dia e 22h do mesmo dia local são UM resultado');
  const madrugada = A.cartoes([ev(T, 0, true), ev(T, 14 / 24 + 0.01, true)], idxDe(5)).get(T);   // 02:xx do dia seguinte em Brasília
  assert.equal(madrugada.passo, 1, '02h do dia seguinte já é outro dia local');
});

test('sessão: 40% de revisões arredonda para cima (n=1 ou 3 ainda inclui revisão) e prioriza os assuntos menos praticados', () => {
  const eventos = [ev('MAT-04-PORCENTAGEM', -10, true), ev('MAT-05-REGRA-DE-TRES', -9, true), ev('MAT-06-MEDIA', -8, true)];
  const tres = A.montarSessao({ n: 3, eventos, hojeIdx: idxDe(0), semente: 2 });
  assert.equal(tres.filter((i) => i.tipo === 'revisao').length, 2, 'ceil(1,2) = 2');
  const um = A.montarSessao({ n: 1, eventos, hojeIdx: idxDe(0), semente: 2 });
  assert.equal(um[0].tipo, 'revisao');
  // menos praticado primeiro (respostas de hoje: nada vence)
  const praticados = [1, 2, 3].map(() => ev('MAT-04-PORCENTAGEM', 0, true));
  const f = ['OJ26-MAT-04', 'OJ26-MAT-07'];
  const proximo = A.montarSessao({ n: 1, eventos: praticados, hojeIdx: idxDe(0), semente: 4, topicIds: f, nivel: 1 });
  assert.equal(proximo[0].templateId, 'MAT-07-JUROS-SIMPLES');
  const proximo2 = A.montarSessao({ n: 2, eventos: praticados, hojeIdx: idxDe(0), semente: 4, topicIds: f, nivel: 1 });
  assert.deepEqual(proximo2.map((i) => i.templateId), ['MAT-07-JUROS-SIMPLES', 'MAT-04-PORCENTAGEM']);
});

test('sessão: colisão de sementes é resolvida (nunca repete questão respondida nem repete dentro da própria sessão)', () => {
  const original = Q.criarRng;
  try {
    // gerador "quebrado": sempre devolve o mesmo valor, forçando colisão em toda tentativa
    Q.criarRng = () => ({ int: () => 123456, f: () => 0.5, pick: (a) => a[0], shuffle: (a) => a.slice() });
    const f = ['OJ26-MAT-04'];
    const s = A.montarSessao({ n: 6, eventos: [], hojeIdx: idxDe(0), semente: 1, topicIds: f, nivel: 1 });
    const ids = s.map((i) => Q.idQuestao(i.templateId, i.semente, i.nivel));
    assert.equal(new Set(ids).size, 6, 'repetiu questão dentro da mesma sessão');
    const feitas = ids.slice(0, 3).map((id, k) => ({ id: 'w' + k, ts: BASE, topicId: 'OJ26-MAT-04', questionId: id, correct: true, conf: 'seguro', nivel: 1 }));
    const s2 = A.montarSessao({ n: 4, eventos: feitas, hojeIdx: idxDe(0), semente: 1, topicIds: f, nivel: 1 });
    const ids2 = s2.map((i) => Q.idQuestao(i.templateId, i.semente, i.nivel));
    assert.equal(new Set(ids2).size, 4);
    for (const id of ids2) assert.ok(!ids.slice(0, 3).includes(id), 'repetiu questão já respondida');
  } finally { Q.criarRng = original; }
});

test('resumo: erros com certeza só contam o erro com confiança "seguro"; tempo médio ignora respostas sem tempo', () => {
  const r = A.resumo([ev(T, 0, false, 'seguro'), ev(T, 0, false, 'duvida'), ev(T, 0, false, 'chute'), Object.assign(ev(T, 0, true, 'seguro'), { ms: undefined })]);
  assert.equal(r.errosComCerteza, 1);
  assert.equal(r.tempoMedioMs, 30000, 'média só entre as 3 respostas com tempo');
});

test('caderno de erros: se o motivo for trocado, vale o mais recente, qualquer que seja a ordem dos registros', () => {
  const e1 = ev(T, 0, false, 'seguro', { resposta: 'A', gabarito: 'B' });
  const m1 = Object.assign(A.eventoMotivo(e1, 'calculo'), { id: 'm-a', ts: e1.ts + 1000 });
  const m2 = Object.assign(A.eventoMotivo(e1, 'confusao'), { id: 'm-b', ts: e1.ts + 5000 });
  for (const ordem of [[e1, m1, m2], [m2, m1, e1], [m1, e1, m2]]) assert.equal(A.cadernoErros(ordem, idxDe(1))[0].motivo, 'confusao');
  const empate = [e1, Object.assign({}, m1, { id: 'm-1', ts: e1.ts + 7 }), Object.assign({}, m2, { id: 'm-2', ts: e1.ts + 7 })];
  assert.equal(A.cadernoErros(empate, idxDe(1))[0].motivo, 'confusao', 'empate de data: desempata pelo id, de forma estável');
  assert.equal(A.cadernoErros(empate.slice().reverse(), idxDe(1))[0].motivo, 'confusao');
});

test('o motivo anotado DEPOIS de um acerto na refação nunca vira resposta para o motor (paraMotor)', () => {
  const topicos = [{ id: 'OJ26-MAT-02', esforcoMin: 45 }];
  const q = Q.gerarQuestao(T, 5000, 2);
  const base = { topicId: q.topicId, questionId: q.id, conf: 'seguro', nivel: 2 };
  const errou = Object.assign({ id: 'a', ts: BASE, correct: false }, base);
  const refez = Object.assign({ id: 'b', ts: BASE + 1000, correct: true }, base);
  const motivoTardio = Object.assign(A.eventoMotivo(errou, 'calculo'), { id: 'm', ts: BASE + 2000 });
  const todos = [errou, refez, motivoTardio];
  const motor = (evs) => calcularProgresso({ topicos, eventos: evs, sessoes: [], estudados: [], agora: BASE + DIA, dataProva: Date.UTC(2027, 2, 14, 17), revisoesVencidas: 0 }).topicos[0];
  assert.equal(motor(todos).desempenhoPonderado, 0, 'sem o filtro, o motivo (correct:false) viraria a última resposta da questão');
  assert.equal(motor(A.paraMotor(todos)).desempenhoPonderado, 1, 'com o filtro, vale o acerto da refação');
  assert.deepEqual(A.paraMotor(todos).map((e) => e.id), ['a', 'b']);
  const legado = { id: 'L', ts: BASE, topicId: 'T', questionId: 'qualquer-coisa', correct: true, conf: 'seguro' };
  assert.deepEqual(A.paraMotor([legado, motivoTardio]).map((e) => e.id), ['L'], 'eventos antigos (ids que não são de questões geradas) continuam indo para o motor');
});

test('sessões seguidas não repetem o ENUNCIADO de questões já vistas (ids diferentes, mesma pergunta) enquanto houver variações', () => {
  const eventos = []; const textos = new Set(); let repetidos = 0; let total = 0;
  for (let sessao = 0; sessao < 5; sessao++) {
    const itens = A.montarSessao({ n: 15, topicIds: ['OJ26-MAT-02'], nivel: 1, eventos, hojeIdx: idxDe(sessao), semente: 100 + sessao });
    for (const it of itens) {
      const q = Q.gerarQuestao(it.templateId, it.semente, it.nivel); total++;
      if (textos.has(q.enunciado)) repetidos++;
      textos.add(q.enunciado);
      eventos.push({ id: 'd' + total, ts: BASE + sessao * DIA + total, topicId: q.topicId, questionId: q.id, correct: true, conf: 'seguro', nivel: q.nivel });
    }
  }
  assert.equal(total, 75);
  assert.equal(repetidos, 0, 'enunciados repetidos entre sessões');
});

test('se o nível automático esgotou as variações novas do modelo, usa o nível vizinho em vez de repetir; com nível fixo, repete mas nunca o mesmo id', () => {
  const T12 = 'MAT-12-GEOMETRIA'; const vistos = new Map();
  for (let s = 1; s < 3000 && vistos.size < 14; s++) { const q = Q.gerarQuestao(T12, s, 2); if (!vistos.has(q.enunciado)) vistos.set(q.enunciado, s); }
  assert.equal(vistos.size, 14, 'premissa: o nível 2 de geometria tem 14 variações');
  // todas as 14 variações já respondidas; 7 acertos em 10 mantêm o nível sugerido em 2
  const eventos = [...vistos.values()].map((sem, i) => ({ id: 'g' + i, ts: BASE + i * 1000, topicId: 'OJ26-MAT-12', questionId: Q.idQuestao(T12, sem, 2), correct: i % 10 < 7 || i >= 10, conf: 'seguro', nivel: 2 }));
  assert.equal(A.nivelSugerido(eventos, 'OJ26-MAT-12'), 2);
  const textosVistos = new Set(eventos.map((e) => { const x = Q.lerId(e.questionId); return Q.gerarQuestao(x.templateId, x.semente, x.nivel).enunciado; }));
  const auto = A.montarSessao({ n: 3, topicIds: ['OJ26-MAT-12'], eventos, hojeIdx: idxDe(0), semente: 5 });
  for (const it of auto) { assert.equal(it.nivel, 3, 'o primeiro vizinho tentado é o nível acima'); assert.notEqual(it.nivel, 2, 'repetiria uma variação já vista no nível 2'); assert.ok(!textosVistos.has(Q.gerarQuestao(it.templateId, it.semente, it.nivel).enunciado)); }
  const fixo = A.montarSessao({ n: 3, topicIds: ['OJ26-MAT-12'], nivel: 2, eventos, hojeIdx: idxDe(0), semente: 5 });
  const idsFeitos = new Set(eventos.map((e) => e.questionId));
  for (const it of fixo) { assert.equal(it.nivel, 2); assert.ok(!idsFeitos.has(Q.idQuestao(it.templateId, it.semente, it.nivel)), 'repetiu o mesmo id'); }
});

test('histórico de um modelo aposentado conta para o sucessor: cartão de revisão, sessão e caderno', () => {
  const real = 'RLOG-02-CONJUNTOS:923394728:1';   // questão antiga real (erro com dúvida)
  const e = { id: 'r1', ts: BASE, topicId: 'OJ26-RLOG-01', questionId: real, correct: false, conf: 'duvida', nivel: 1, resposta: 'C', gabarito: 'D' };   // valores reais do histórico
  const cart = A.cartoes([e], idxDe(5));
  assert.ok(cart.has('RLOG-05-DIAGRAMAS') && !cart.has('RLOG-02-CONJUNTOS'));
  assert.equal(cart.get('RLOG-05-DIAGRAMAS').devida, true);
  const sessao = A.montarSessao({ n: 5, topicIds: ['OJ26-RLOG-01'], eventos: [e], hojeIdx: idxDe(5), semente: 1 });
  assert.equal(sessao[0].tipo, 'revisao'); assert.equal(sessao[0].templateId, 'RLOG-05-DIAGRAMAS');
  assert.ok(sessao.every((i) => i.templateId !== 'RLOG-02-CONJUNTOS'), 'modelo aposentado voltou a ser sorteado');
  const caderno = A.cadernoErros([e], idxDe(5));
  assert.equal(caderno[0].questionId, real, 'o caderno guarda o id original para reproduzir a questão antiga');
  assert.equal(Q.gerarQuestao('RLOG-02-CONJUNTOS', 923394728, 1).gabarito, 'D');
});

test('sessão só de Raciocínio Lógico mistura os seis modelos ativos', () => {
  const s = A.montarSessao({ n: 12, topicIds: ['OJ26-RLOG-01'], eventos: [], hojeIdx: idxDe(0), semente: 3 });
  const por = {}; for (const i of s) por[i.templateId] = (por[i.templateId] || 0) + 1;
  assert.equal(Object.keys(por).length, 6, JSON.stringify(por));
  assert.ok(Object.values(por).every((v) => v === 2), JSON.stringify(por));
  assert.ok(!('RLOG-02-CONJUNTOS' in por));
});

test('com as variações do nível esgotadas e nível fixo, o guarda de id continua valendo mesmo se o sorteio cair em uma semente já respondida', () => {
  const T12 = 'MAT-12-GEOMETRIA'; const vistos = new Map();
  for (let s = 1; s < 3000 && vistos.size < 14; s++) { const q = Q.gerarQuestao(T12, s, 2); if (!vistos.has(q.enunciado)) vistos.set(q.enunciado, s); }
  const sementes = [...vistos.values()];
  const eventos = sementes.map((sem, i) => ({ id: 'g' + i, ts: BASE + i * 1000, topicId: 'OJ26-MAT-12', questionId: Q.idQuestao(T12, sem, 2), correct: true, conf: 'seguro', nivel: 2 }));
  const original = Q.criarRng;
  try {
    Q.criarRng = () => ({ int: () => sementes[0] });             // o sorteio sempre devolve uma semente JÁ respondida
    const s = A.montarSessao({ n: 4, topicIds: ['OJ26-MAT-12'], nivel: 2, eventos, hojeIdx: idxDe(0), semente: 1 });
    const feitos = new Set(eventos.map((e) => e.questionId)); const nesta = new Set();
    for (const it of s) { const id = Q.idQuestao(it.templateId, it.semente, it.nivel); assert.ok(!feitos.has(id), 'repetiu id já respondido'); assert.ok(!nesta.has(id), 'repetiu id dentro da sessão'); nesta.add(id); }
    assert.equal(s.length, 4);
  } finally { Q.criarRng = original; }
});

test('aviso de problema: é registro auxiliar válido, fica fora do motor, das estatísticas, das revisões e do caderno', () => {
  const q = Q.gerarQuestao(T, 41, 1);
  const resp = Object.assign({ id: 'e-p1', ts: BASE }, A.eventoResposta(q, (q.gabaritoIdx + 1) % 5, 'seguro', 3000));
  const aviso = Object.assign({ id: 'p-1', ts: BASE + 5000 }, A.eventoProblema(resp, 'gabarito', 'x'.repeat(500)));
  assert.equal(Backup.VALIDADORES.eventos(aviso), true);
  assert.equal(aviso.tipo, 'problema'); assert.equal(aviso.ref, 'e-p1'); assert.equal(aviso.categoria, 'gabarito'); assert.equal(aviso.nota.length, 300, 'nota limitada a 300 caracteres');
  assert.equal(A.eventoProblema(resp, 'inventada', '').categoria, 'outro');
  const todos = [resp, aviso];
  assert.deepEqual(A.paraMotor(todos).map((e) => e.id), ['e-p1']);
  assert.equal(A.soRespostas(todos).length, 1);
  assert.equal(A.estatisticas(todos, idxDe(0)).total.n, 1);
  assert.equal(A.cadernoErros(todos, idxDe(1)).length, 1);
  assert.equal(A.cartoes(todos, idxDe(1)).get(T).respostas, 1);
  assert.equal(A.problemasReportados(todos).length, 1);
  const mais = Object.assign({}, aviso, { id: 'p-2', ts: aviso.ts + 100 });
  assert.deepEqual(A.problemasReportados([aviso, mais]).map((e) => e.id), ['p-2', 'p-1'], 'mais recente primeiro');
  const topicos = [{ id: q.topicId, esforcoMin: 45 }];
  const motor = (evs) => calcularProgresso({ topicos, eventos: evs, sessoes: [], estudados: [], agora: BASE + DIA, dataProva: Date.UTC(2027, 2, 14, 17), revisoesVencidas: 0 }).topicos[0];
  const certa = Object.assign({ id: 'e-p2', ts: BASE + 9000 }, A.eventoResposta(q, q.gabaritoIdx, 'seguro', 3000));
  const avisoTardio = Object.assign({ id: 'p-3', ts: BASE + 20000 }, A.eventoProblema(certa, 'enunciado', ''));
  assert.equal(motor(A.paraMotor([resp, certa, avisoTardio])).desempenhoPonderado, 1, 'um aviso depois do acerto não pode virar erro');
  assert.equal(motor([resp, certa, avisoTardio]).desempenhoPonderado, 0, 'sem o filtro viraria erro (premissa do teste)');
});

test('propriedades (300 sorteios): sessões e cartões respeitam os invariantes', () => {
  const rnd = mulberry32(2026);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const ids = Q.CATALOGO.map((t) => t.id);
  for (let it = 0; it < 300; it++) {
    const eventos = []; const nEv = ri(0, 60);
    for (let k = 0; k < nEv; k++) {
      const tid = ids[ri(0, ids.length - 1)]; const nivel = ri(1, 5);
      eventos.push({ id: 'p' + it + '-' + k, ts: BASE + ri(-30, 0) * DIA + ri(0, 80000) * 1000, topicId: Q.modelo(tid).topicId, questionId: Q.idQuestao(tid, ri(1, 40), nivel), correct: rnd() < 0.6, conf: ['seguro', 'duvida', 'chute'][ri(0, 2)], nivel });
    }
    const hoje = idxDe(ri(0, 5));
    const cart = A.cartoes(eventos, hoje);
    for (const c of cart.values()) {
      assert.ok(c.passo >= 0 && c.passo < A.INTERVALOS.length);
      assert.ok(c.proximaIdx > c.ultimoIdx);
      assert.equal(c.devida, c.proximaIdx <= hoje);
      assert.ok(c.atrasoDias >= 0);
    }
    const n = ri(1, 25);
    const sessao = A.montarSessao({ n, eventos, hojeIdx: hoje, semente: ri(1, 1e6) });
    assert.equal(sessao.length, n);
    const respondidas = new Set(eventos.map((e) => e.questionId));
    const vistos = new Set();
    for (const i of sessao) {
      const id = Q.idQuestao(i.templateId, i.semente, i.nivel);
      assert.ok(!respondidas.has(id) && !vistos.has(id), 'questão repetida');
      vistos.add(id);
      assert.ok(i.nivel >= 1 && i.nivel <= 5);
      assert.equal(Q.validarQuestao(Q.gerarValida(i.templateId, i.semente, i.nivel)).ok, true);
    }
    assert.ok(sessao.filter((i) => i.tipo === 'revisao').length <= Math.ceil(n * 0.4));
    const caderno = A.cadernoErros(eventos, hoje);
    assert.equal(caderno.length, eventos.filter((e) => !e.correct).length);
  }
});

void derivar;
