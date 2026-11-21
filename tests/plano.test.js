'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const P = require('../src/plano.js');
const { derivar } = require('../src/store.js');
const { diaIdx } = require('../src/progresso.js');
const { mulberry32 } = require('./fakes.js');

const matriz = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/matriz-edital.json'), 'utf8'));
const topicos = matriz.topicos;
const TZ = -180;
const DIA = 86400000;
const T0 = Date.UTC(2026, 11, 1, 15, 0, 0);          // 01/12/2026 12:00 em Brasília
const hoje = diaIdx(T0, TZ);
const vazio = () => derivar({ sessoes: [], marcacoes: [], revisoes: [], cancelamentos: [], eventos: [] });
const dados = (x) => derivar(Object.assign({ sessoes: [], marcacoes: [], revisoes: [], cancelamentos: [], eventos: [] }, x));
const mar = (id, topicId, ts, estudado = true) => ({ id, topicId, ts, estudado });

test('revisões de teoria: vencem 1, 7 e 30 dias depois de marcar como estudado', () => {
  const d = dados({ marcacoes: [mar('m1', 'OJ26-LP-01', T0)] });
  const em = (dias) => P.revisoesDevidas({ derivado: d, hojeIdx: hoje + dias });
  assert.equal(em(0).length, 0, 'no próprio dia não há revisão');
  assert.deepEqual(em(1).map((r) => r.etapa), [1]);
  assert.deepEqual(em(7).map((r) => r.etapa), [1, 2]);
  assert.deepEqual(em(30).map((r) => r.etapa), [1, 2, 3]);
  assert.equal(em(30)[0].atrasoDias, 29);
  assert.equal(em(1)[0].atrasoDias, 0);
});

test('revisão feita sai da lista; revisão cancelada volta; revisão de outra etapa não conta', () => {
  const base = { marcacoes: [mar('m1', 'OJ26-LP-01', T0)] };
  const feita = dados(Object.assign({ revisoes: [{ id: 'r1', ts: T0 + DIA, topicId: 'OJ26-LP-01', etapa: 1 }] }, base));
  assert.equal(P.revisoesDevidas({ derivado: feita, hojeIdx: hoje + 1 }).length, 0);
  const cancelada = dados(Object.assign({ revisoes: [{ id: 'r1', ts: T0 + DIA, topicId: 'OJ26-LP-01', etapa: 1 }], cancelamentos: [{ id: 'c1', ts: T0 + DIA, ref: 'r1' }] }, base));
  assert.equal(P.revisoesDevidas({ derivado: cancelada, hojeIdx: hoje + 1 }).length, 1);
  const outraEtapa = dados(Object.assign({ revisoes: [{ id: 'r1', ts: T0 + DIA, topicId: 'OJ26-LP-01', etapa: 2 }] }, base));
  assert.equal(P.revisoesDevidas({ derivado: outraEtapa, hojeIdx: hoje + 1 }).length, 1);
});

test('desmarcar o tópico apaga as revisões; marcar de novo recomeça o calendário e ignora revisões antigas', () => {
  const desmarcado = dados({ marcacoes: [mar('m1', 'T', T0), mar('m2', 'T', T0 + DIA, false)] });
  assert.equal(P.revisoesDevidas({ derivado: desmarcado, hojeIdx: hoje + 40 }).length, 0);
  const remarcado = dados({
    marcacoes: [mar('m1', 'T', T0), mar('m2', 'T', T0 + 2 * DIA, false), mar('m3', 'T', T0 + 10 * DIA)],
    revisoes: [{ id: 'r1', ts: T0 + DIA, topicId: 'T', etapa: 1 }],
  });
  const r = P.revisoesDevidas({ derivado: remarcado, hojeIdx: hoje + 11 });
  assert.deepEqual(r.map((x) => x.etapa), [1], 'a revisão antiga (antes da nova marcação) não vale');
  assert.equal(r[0].devidaIdx, hoje + 11);
});

test('revisões vencidas são ordenadas da mais antiga para a mais nova; as próximas trazem "em dias"', () => {
  const d = dados({ marcacoes: [mar('a', 'B', T0 + 3 * DIA), mar('b', 'A', T0)] });
  const r = P.revisoesDevidas({ derivado: d, hojeIdx: hoje + 8 });
  assert.deepEqual(r.map((x) => x.topicId + x.etapa), ['A1', 'B1', 'A2'], 'por data de vencimento: A1 (dia 1), B1 (dia 4), A2 (dia 7)');
  const prox = P.proximasRevisoes({ derivado: d, hojeIdx: hoje + 8 });
  assert.ok(prox.every((x) => x.emDias > 0));
  assert.equal(prox[0].topicId, 'B');
});

test('fuso: marcar às 23h30 de Brasília conta para o dia local, não para o dia UTC', () => {
  const tarde = Date.UTC(2026, 11, 2, 2, 30);          // 01/12 23:30 em Brasília = 02/12 02:30 UTC
  const d = dados({ marcacoes: [mar('m', 'T', tarde)] });
  const dia1 = diaIdx(Date.UTC(2026, 11, 1, 15), TZ);  // 01/12 local
  assert.equal(P.revisoesDevidas({ derivado: d, hojeIdx: dia1 + 1 }).length, 1, 'vence em 02/12 (local)');
  assert.equal(P.revisoesDevidas({ derivado: d, hojeIdx: dia1 }).length, 0);
});

test('minutos do dia e série diária somam só o dia certo', () => {
  const s = [{ ts: T0, min: 30 }, { ts: T0 + 3600000, min: 20 }, { ts: T0 - DIA, min: 45 }, { ts: T0 - 5 * DIA, min: 60 }];
  assert.equal(P.minutosNoDia(s, hoje), 50);
  const serie = P.serieDiaria(s, hoje, 7);
  assert.equal(serie.length, 7);
  assert.equal(serie[6].min, 50);
  assert.equal(serie[5].min, 45);
  assert.equal(serie[1].min, 60);
  assert.equal(serie.reduce((x, y) => x + y.min, 0), 155);
  assert.equal(serie[6].iso, '2026-12-01');
});

const plano = (extra) => P.sugerirHoje(Object.assign({ topicos, derivado: vazio(), disponivelMin: 60, minutosHoje: 0, revisoes: [] }, extra));

test('começo do zero com 60 min: 40 min na trilha de Específicos (CPC) e 20 min na trilha Base (Português)', () => {
  const r = plano();
  assert.equal(r.orcamentoMin, 60);
  assert.deepEqual(r.itens.map((i) => [i.topicId, i.minutos, i.trilha]), [['OJ26-DPCI-CPC-01', 40, 'especificos'], ['OJ26-LP-01', 20, 'base']]);
  assert.equal(r.minutosPlanejados, 60);
});

test('já estudou hoje: o orçamento é o que falta; chegou à meta: nada a sugerir', () => {
  assert.equal(plano({ minutosHoje: 25 }).orcamentoMin, 35);
  assert.equal(plano({ minutosHoje: 25 }).minutosPlanejados, 35);
  assert.equal(plano({ minutosHoje: 60 }).itens.length, 0);
  assert.equal(plano({ minutosHoje: 90 }).orcamentoMin, 0);
  assert.equal(plano({ disponivelMin: 0 }).itens.length, 0);
});

test('tópico iniciado vem primeiro e só pede o que falta; tópico estudado nunca é sugerido', () => {
  const d = dados({ sessoes: [{ id: 's', ts: T0, min: 30, topicId: 'OJ26-DPCI-CPC-02' }], marcacoes: [mar('m', 'OJ26-DPCI-CPC-01', T0)] });
  const r = plano({ derivado: d });
  assert.equal(r.itens[0].topicId, 'OJ26-DPCI-CPC-02');
  assert.equal(r.itens[0].continuacao, true);
  assert.ok(!r.itens.some((i) => i.topicId === 'OJ26-DPCI-CPC-01'));
  const t = topicos.find((x) => x.id === 'OJ26-DPCI-CPC-02');
  const faltam = t.esforco_min - 30;
  assert.equal(r.itens[0].minutos, Math.min(40, Math.floor(faltam / 5) * 5));
});

test('tópico iniciado passa na frente de tópicos novos que vêm antes na sequência', () => {
  const d = dados({ sessoes: [{ id: 's', ts: T0, min: 25, topicId: 'OJ26-DPCI-CPC-05' }, { id: 's2', ts: T0, min: 10, topicId: 'OJ26-INFO-03' }] });
  const r = plano({ derivado: d });
  const esp = r.itens.filter((i) => i.trilha === 'especificos');
  const base = r.itens.filter((i) => i.trilha === 'base');
  assert.equal(esp[0].topicId, 'OJ26-DPCI-CPC-05', 'o já iniciado vem antes do CPC-01 ainda não iniciado');
  assert.equal(esp[0].continuacao, true);
  assert.equal(base[0].topicId, 'OJ26-INFO-03', 'o mesmo vale na trilha Base');
});

test('quando uma trilha acaba, todo o orçamento vai para a outra', () => {
  const base = topicos.filter((t) => ['LP', 'RLOG', 'INFO', 'MAT', 'ATUA'].includes(t.disciplina));
  const d = dados({ marcacoes: base.map((t, i) => mar('m' + i, t.id, T0)) });
  const r = plano({ derivado: d });
  assert.ok(r.itens.every((i) => i.trilha === 'especificos'));
  assert.equal(r.minutosPlanejados, 60);
  const espec = topicos.filter((t) => t.bloco === 'B2');
  const d2 = dados({ marcacoes: espec.map((t, i) => mar('m' + i, t.id, T0)) });
  const r2 = plano({ derivado: d2 });
  assert.ok(r2.itens.every((i) => i.trilha === 'base'));
  assert.equal(r2.minutosPlanejados, 60);
});

test('tudo estudado: não há o que sugerir de estudo novo', () => {
  const d = dados({ marcacoes: topicos.map((t, i) => mar('m' + i, t.id, T0 - 100 * DIA)) });
  const r = plano({ derivado: d });
  assert.equal(r.itens.filter((i) => i.tipo === 'estudo').length, 0);
});

test('revisões ocupam no máximo 30% do orçamento; as demais ficam pendentes para os próximos dias', () => {
  const rev = Array.from({ length: 5 }, (_, i) => ({ topicId: 'OJ26-LP-0' + (i + 1), etapa: 1, atrasoDias: i }));
  const r = plano({ revisoes: rev });
  const nRev = r.itens.filter((i) => i.tipo === 'revisao');
  assert.equal(nRev.length, 1, '30% de 60 = 18 -> 15 min -> 1 revisão de 10 min');
  assert.equal(r.revisoesIncluidas, 1);
  assert.equal(r.revisoesPendentes, 4);
  assert.equal(r.minutosPlanejados <= 60, true);
  assert.equal(plano({ revisoes: rev, disponivelMin: 120 }).revisoesIncluidas, 3);
});

test('propriedades (500 sorteios): nunca passa do orçamento, minutos múltiplos de 5, sem repetir tópico nem sugerir estudado', () => {
  const rnd = mulberry32(777);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let it = 0; it < 500; it++) {
    const marcados = topicos.filter(() => rnd() < ri(0, 90) / 100);
    const andamento = topicos.filter(() => rnd() < 0.05);
    const d = dados({
      marcacoes: marcados.map((t, i) => mar('m' + i, t.id, T0 - ri(0, 60) * DIA)),
      sessoes: andamento.map((t, i) => ({ id: 's' + i, ts: T0, min: ri(5, 400), topicId: t.id })),
    });
    const revisoes = P.revisoesDevidas({ derivado: d, hojeIdx: hoje });
    const disp = ri(0, 240);
    const hojeMin = ri(0, 300);
    const r = P.sugerirHoje({ topicos, derivado: d, disponivelMin: disp, minutosHoje: hojeMin, revisoes });
    assert.ok(r.minutosPlanejados <= r.orcamentoMin, 'passou do orçamento');
    assert.ok(r.orcamentoMin <= Math.max(0, disp - hojeMin));
    const ids = new Set();
    for (const i of r.itens) {
      assert.ok(i.minutos > 0 && i.minutos % 5 === 0);
      if (i.tipo === 'estudo') {
        assert.ok(!ids.has(i.topicId), 'tópico repetido');
        ids.add(i.topicId);
        assert.ok(!d.estudados.has(i.topicId), 'sugeriu tópico já estudado');
      }
    }
    for (const i of r.itens.filter((x) => x.tipo === 'revisao')) assert.ok(revisoes.some((v) => v.topicId === i.topicId && v.etapa === i.etapa));
    assert.equal(r.revisoesIncluidas + r.revisoesPendentes, revisoes.length);
  }
});

test('determinismo e pureza: mesma entrada, mesma saída, e a entrada não é alterada', () => {
  const d = dados({ marcacoes: [mar('m', 'OJ26-LP-01', T0)], sessoes: [{ id: 's', ts: T0, min: 20, topicId: 'OJ26-DPCI-CPC-01' }] });
  const antes = JSON.stringify([topicos.slice(0, 20), Array.from(d.estudados)]);
  const a = P.sugerirHoje({ topicos, derivado: d, disponivelMin: 60, minutosHoje: 10, revisoes: [] });
  const b = P.sugerirHoje({ topicos, derivado: d, disponivelMin: 60, minutosHoje: 10, revisoes: [] });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify([topicos.slice(0, 20), Array.from(d.estudados)]), antes);
});
