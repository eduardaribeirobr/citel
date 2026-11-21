'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { validarCatalogo } = require('../tools/validar-questoes.js');
const Q = require('../src/questoes.js');

test('relatório de validação: nenhuma questão rejeitada e contagens batem', () => {
  const r = validarCatalogo({ sementes: 25 });
  assert.equal(r.modelos.length, Q.CATALOGO.length);
  assert.equal(r.total.geradas, Q.CATALOGO.length * 5 * 25);
  assert.equal(r.total.validas, r.total.geradas);
  assert.equal(r.total.rejeitadas, 0);
  assert.equal(r.total.naoGeradas, 0);
  for (const m of r.modelos) {
    assert.equal(Object.keys(m.niveis).length, 5);
    assert.equal(Object.values(m.gabaritos).reduce((a, b) => a + b, 0), m.validas, 'cada questão válida tem um gabarito contado');
    assert.deepEqual(m.problemas, {});
  }
});

test('variação: cada modelo informa quantos enunciados distintos tem por nível, e os de variação baixa são listados', () => {
  const r = validarCatalogo({ sementes: 3 });
  assert.equal(r.variacoes_max, 400);
  for (const m of r.modelos) for (let n = 1; n <= 5; n++) { assert.ok(m.variacoes[n] >= 1 && m.variacoes[n] <= 400, m.id + ' n' + n); }
  const esperado = []; for (const m of r.modelos) if (!m.aposentado) for (let n = 1; n <= 5; n++) if (m.variacoes[n] < r.limite_variacao_baixa) esperado.push(m.id + '#' + n);
  assert.deepEqual(r.variacao_baixa.map((x) => x.modelo + '#' + x.nivel), esperado);
  assert.ok(r.variacao_baixa.length > 0, 'o relatório precisa expor os pontos fracos conhecidos');
});

test('cobertura do edital: Matemática, Raciocínio Lógico e 12 diplomas de Direito têm questões; o resto fica declarado como sem questões', () => {
  const r = validarCatalogo({ sementes: 3 });
  const por = Object.fromEntries(r.cobertura.map((c) => [c.cod, c]));
  assert.equal(por.MAT.topicosComQuestoes, 13); assert.equal(por.MAT.topicos, 13);
  assert.equal(por.RLOG.topicosComQuestoes, 1);
  const esperado = { DPEN: 15, DPPE: 7, DPCI: 16, DCON: 3, DADM: 5, DCIV: 6, LESP: 8, ATUA: 1 };
  for (const [cod, n] of Object.entries(esperado)) assert.equal(por[cod].topicosComQuestoes, n, cod);
  const zero = r.cobertura.filter((c) => !['MAT', 'RLOG', ...Object.keys(esperado)].includes(c.cod));
  assert.ok(zero.length >= 2, 'as demais disciplinas aparecem na cobertura');
  for (const c of zero) { assert.equal(c.topicosComQuestoes, 0, c.cod + ' não pode aparecer com questões'); assert.equal(c.modelos, 0); }
  const total = r.cobertura.reduce((s, c) => s + c.topicosComQuestoes, 0); assert.equal(total, 75, 'tópicos com questões no total');
  assert.ok(r.limites.some((l) => /Sem questões/.test(l) && /Não vou inventar/.test(l)));
  assert.ok(r.limites.some((l) => /leitura precisa da lei/.test(l) && /jurisprudência/.test(l)), 'o relatório declara o que as questões de Direito NÃO testam');
});

test('o arquivo publicado (data/validacao-questoes.json) corresponde ao catálogo atual', () => {
  const arq = path.join(__dirname, '../data/validacao-questoes.json');
  assert.ok(fs.existsSync(arq), 'rode: node tools/validar-questoes.js');
  const pub = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.deepEqual(pub.modelos.map((m) => m.id), Q.CATALOGO.map((t) => t.id), 'catálogo mudou: regenere o relatório');
  assert.equal(pub.versao_motor, Q.VERSAO);
  assert.equal(pub.total.rejeitadas, 0);
  assert.equal(pub.total.naoGeradas, 0);
  assert.equal(pub.total.validas, pub.total.geradas);
});
