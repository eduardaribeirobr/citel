'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js');
require('../src/questoes-mat2.js');
require('../src/questoes-rl.js'); require('../src/questoes-rl2.js');

const matriz = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/matriz-edital.json'), 'utf8'));
const NIVEIS = [1, 2, 3, 4, 5];
const lento = (id) => id === 'RLOG-02-CONJUNTOS';
const sementes = (id) => (lento(id) ? 25 : id === 'RLOG-03-ORDENACAO' ? 60 : 150);

test('formatação numérica no padrão brasileiro', () => {
  assert.equal(Q.fmt(1234.5), '1.234,5');
  assert.equal(Q.fmt(1234567), '1.234.567');
  assert.equal(Q.fmt(-3), '−3');
  assert.equal(Q.fmt(0.75), '0,75');
  assert.equal(Q.fmt(2), '2');
  assert.equal(Q.fmt(3.14 * 25, 2), '78,50');
  assert.equal(Q.fmt(100, 2), '100,00');
  assert.equal(Q.brl(1234.5), 'R$ 1.234,50');
  assert.equal(Q.fmt(0.1 + 0.2), '0,3');
});

test('frações e aritmética auxiliar', () => {
  assert.deepEqual(Q.F(6, 8), { p: 3, q: 4 });
  assert.deepEqual(Q.F(2, -4), { p: -1, q: 2 });
  assert.deepEqual(Q.fadd(Q.F(1, 2), Q.F(1, 3)), { p: 5, q: 6 });
  assert.deepEqual(Q.fsub(Q.F(1, 2), Q.F(1, 3)), { p: 1, q: 6 });
  assert.deepEqual(Q.fmul(Q.F(2, 3), Q.F(3, 4)), { p: 1, q: 2 });
  assert.deepEqual(Q.fdiv(Q.F(1, 2), Q.F(1, 4)), { p: 2, q: 1 });
  assert.equal(Q.ftxt(Q.F(-3, 4)), '−3/4');
  assert.equal(Q.ftxt(Q.F(8, 4)), '2');
  assert.equal(Q.mdc(12, 18), 6);
  assert.equal(Q.mmc(4, 6), 12);
});

test('catálogo: 13 modelos de Matemática (um por tópico do edital) e 7 de Raciocínio Lógico (1 aposentado), todos ligados à matriz', () => {
  assert.equal(Q.CATALOGO.length, 20);
  assert.equal(new Set(Q.CATALOGO.map((t) => t.id)).size, 20);
  assert.equal(Q.ativos().length, 19);
  const topicos = new Map(matriz.topicos.map((t) => [t.id, t]));
  for (let i = 1; i <= 13; i++) {
    const id = 'OJ26-MAT-' + String(i).padStart(2, '0');
    assert.equal(Q.templatesDoTopico(id).length, 1, id);
  }
  assert.equal(Q.templatesDoTopico('OJ26-RLOG-01').length, 7);
  assert.deepEqual(Q.CATALOGO.filter((t) => t.aposentado).map((t) => [t.id, t.aposentado]), [['RLOG-02-CONJUNTOS', 'RLOG-05-DIAGRAMAS']]);
  for (const t of Q.CATALOGO) {
    const tp = topicos.get(t.topicId);
    assert.ok(tp, t.id + ': tópico inexistente na matriz');
    assert.equal(tp.disciplina, t.disciplina, t.id);
    assert.equal(typeof t.gerar, 'function');
    assert.equal(typeof t.resolver, 'function');
  }
  assert.throws(() => Q.modelo('NAO-EXISTE'), /desconhecido/);
});

test('id da questão: ida e volta e recusa de formatos inválidos', () => {
  assert.equal(Q.idQuestao('MAT-02-MMC-MDC', 12345, 3), 'MAT-02-MMC-MDC:12345:3');
  assert.deepEqual(Q.lerId('MAT-02-MMC-MDC:12345:3'), { templateId: 'MAT-02-MMC-MDC', semente: 12345, nivel: 3 });
  for (const ruim of ['', 'x', 'MAT-02:1', 'MAT-02:1:9', 'MAT-02:a:1', 'mat-02:1:1', null, undefined]) assert.equal(Q.lerId(ruim), null, String(ruim));
});

test('PROPRIEDADE: todo modelo, em todos os níveis e muitas sementes, gera questão que passa em TODAS as verificações', () => {
  let total = 0;
  for (const t of Q.CATALOGO) {
    for (const nivel of NIVEIS) {
      for (let s = 1; s <= sementes(t.id); s++) {
        const q = Q.gerarQuestao(t.id, s, nivel);
        const v = Q.validarQuestao(q);
        assert.ok(v.ok, `${t.id} nível ${nivel} semente ${s}: ${v.erros.join('; ')}`);
        total++;
      }
    }
  }
  assert.ok(total > 8000, 'foram verificadas ' + total + ' questões');
});

test('determinismo: o mesmo id gera exatamente a mesma questão (necessário para refazer e para o caderno de erros)', () => {
  for (const t of Q.CATALOGO) for (const nivel of NIVEIS) {
    const a = Q.gerarQuestao(t.id, 4242, nivel); const b = Q.gerarQuestao(t.id, 4242, nivel);
    assert.deepEqual(a, b, t.id);
    const c = Q.gerarQuestao(t.id, 4243, nivel);
    assert.notEqual(c.enunciado + JSON.stringify(c.alternativas), a.enunciado + JSON.stringify(a.alternativas), t.id + ': sementes diferentes deveriam variar');
  }
});

test('texto sem defeitos: nada de NaN, undefined, Infinity ou [object]; tamanhos razoáveis; comentários coerentes', () => {
  const ruim = /NaN|undefined|Infinity|\[object|null/;
  for (const t of Q.CATALOGO) for (const nivel of NIVEIS) for (let s = 1; s <= 40; s++) {
    const q = Q.gerarQuestao(t.id, s, nivel);
    const todos = [q.enunciado, q.explicacao, q.pegadinha].concat(q.alternativas.map((a) => a.texto + ' ' + a.comentario));
    for (const x of todos) assert.ok(!ruim.test(x), `${q.id}: texto com defeito: ${x.slice(0, 120)}`);
    for (const a of q.alternativas) { assert.ok(a.texto.length >= 1 && a.texto.length <= 140, q.id + ' alternativa ' + a.letra); }
    assert.equal(q.alternativas.filter((a) => /^Correta\./.test(a.comentario)).length, 1, q.id);
    assert.equal(q.alternativas.filter((a) => /^Errada:/.test(a.comentario)).length, 4, q.id);
    assert.deepEqual(q.alternativas.map((a) => a.letra), ['A', 'B', 'C', 'D', 'E']);
    assert.equal(q.origem, 'inédita');
    assert.ok(/computacional/.test(q.fonte));
  }
});

test('o gabarito não é previsível: a letra correta se distribui entre A e E', () => {
  for (const id of ['MAT-02-MMC-MDC', 'MAT-04-PORCENTAGEM', 'RLOG-01-SEQUENCIAS']) {
    const cont = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    for (let s = 1; s <= 1000; s++) cont[Q.gerarQuestao(id, s, 1 + (s % 5)).gabarito]++;
    for (const [l, n] of Object.entries(cont)) assert.ok(n >= 120 && n <= 290, `${id}: letra ${l} apareceu ${n} vezes em 1000`);
  }
});

test('o nível muda a dificuldade: níveis diferentes geram formas diferentes de problema', () => {
  for (const id of ['MAT-01-FRACOES', 'MAT-05-REGRA-DE-TRES', 'MAT-07-JUROS-SIMPLES', 'RLOG-01-SEQUENCIAS']) {
    const formas = new Set(NIVEIS.map((n) => { const p = Q.gerarQuestao(id, 77, n).params; return p.f !== undefined ? p.f : p.op; }));
    assert.ok(formas.size >= 3, id + ' deveria variar a forma com o nível: ' + Array.from(formas));
  }
});

// ---------------- o validador precisa BARRAR questões defeituosas ----------------
const boa = () => Q.gerarQuestao('MAT-02-MMC-MDC', 31, 2);
const clonar = (q) => JSON.parse(JSON.stringify(q));

test('validador: questão boa passa; defeitos estruturais são barrados', () => {
  assert.equal(Q.validarQuestao(boa()).ok, true);
  const d1 = clonar(boa()); d1.alternativas[(d1.gabaritoIdx + 1) % 5].correta = true;
  assert.match(Q.validarQuestao(d1).erros.join('|'), /exatamente uma alternativa correta/);
  const d2 = clonar(boa()); d2.gabaritoIdx = (d2.gabaritoIdx + 1) % 5; d2.gabarito = Q.LETRAS[d2.gabaritoIdx];
  assert.match(Q.validarQuestao(d2).erros.join('|'), /gabarito não aponta/);
  const d3 = clonar(boa()); d3.gabarito = d3.gabarito === 'A' ? 'B' : 'A';
  assert.match(Q.validarQuestao(d3).erros.join('|'), /letra do gabarito/);
  const d4 = clonar(boa()); d4.alternativas[0].texto = d4.alternativas[1].texto;
  assert.match(Q.validarQuestao(d4).erros.join('|'), /alternativas repetidas/);
  const d5 = clonar(boa()); d5.alternativas[0].comentario = '';
  assert.match(Q.validarQuestao(d5).erros.join('|'), /sem comentário/);
  const d6 = clonar(boa()); d6.alternativas.pop();
  assert.match(Q.validarQuestao(d6).erros.join('|'), /5 alternativas/);
  const d7 = clonar(boa()); d7.explicacao = '';
  assert.match(Q.validarQuestao(d7).erros.join('|'), /explicação/);
  const d8 = clonar(boa()); d8.pegadinha = '';
  assert.match(Q.validarQuestao(d8).erros.join('|'), /pegadinha/);
  const d9 = clonar(boa()); d9.enunciado = '';
  assert.match(Q.validarQuestao(d9).erros.join('|'), /enunciado/);
  assert.equal(Q.validarQuestao({ templateId: 'NAO-EXISTE' }).ok, false);
});

test('validador: resposta errada (segundo método discorda) e gabarito ambíguo são barrados', () => {
  // o gerador "errou" a conta: o valor da correta não é o do segundo método
  const q1 = clonar(boa()); q1.valor += 1; q1.alternativas[q1.gabaritoIdx].valor += 1;
  assert.match(Q.validarQuestao(q1).erros.join('|'), /segundo método discorda/);
  // os parâmetros foram adulterados: o segundo método calcula outra coisa
  const q2 = clonar(boa()); q2.params.xs = q2.params.xs.map((x) => x + 2);
  assert.equal(Q.validarQuestao(q2).ok, false);
  // uma alternativa errada tem o mesmo valor da correta (duas respostas certas disfarçadas)
  const q3 = clonar(boa()); const errada = q3.alternativas.find((a) => !a.correta); errada.valor = q3.valor;
  assert.match(Q.validarQuestao(q3).erros.join('|'), /ambíguo/);
  // a alternativa marcada como correta não tem o valor certo
  const q4 = clonar(boa()); q4.alternativas[q4.gabaritoIdx].valor = q4.valor + 5;
  assert.match(Q.validarQuestao(q4).erros.join('|'), /não tem o valor do segundo método/);
});

test('validador em Raciocínio Lógico: uma segunda conclusão necessária (gabarito ambíguo) é barrada', () => {
  const q = Q.gerarQuestao('RLOG-02-CONJUNTOS', 5, 3);
  assert.equal(Q.validarQuestao(q).ok, true);
  // troca uma candidata errada por uma afirmação que na verdade decorre das premissas: o segundo método recusa
  const ruim = clonar(q);
  ruim.params.candidatas = ruim.params.candidatas.concat([ruim.params.correta]);
  assert.match(Q.validarQuestao(ruim).erros.join('|'), /segundo método falhou|ambíguo/);
  // premissas adulteradas: a correta deixa de decorrer
  const ruim2 = clonar(q);
  ruim2.params.premissas = ruim2.params.premissas.map((p) => Object.assign({}, p, { t: p.t === 'A' ? 'I' : 'A' }));
  assert.equal(Q.validarQuestao(ruim2).ok, false);
});

test('gerarValida devolve questão válida e é determinística', () => {
  for (const t of Q.CATALOGO) {
    const q = Q.gerarValida(t.id, 1000, 3);
    assert.equal(Q.validarQuestao(q).ok, true, t.id);
    assert.deepEqual(Q.gerarValida(t.id, 1000, 3), q);
  }
});

// ---------------- verificações independentes feitas AQUI no teste (terceiro cálculo) ----------------
const mmc3 = (xs) => { let t = Math.max(...xs); while (!xs.every((x) => t % x === 0)) t++; return t; };
const mdc3 = (xs) => { let d = Math.min(...xs); while (!xs.every((x) => x % d === 0)) d--; return d; };

test('conferência por cálculo próprio do teste: MMC/MDC, juros simples, Pitágoras e porcentagem', () => {
  for (let s = 1; s <= 120; s++) {
    for (const nivel of [1, 3, 4, 5]) {
      const q = Q.gerarQuestao('MAT-02-MMC-MDC', s, nivel);
      assert.equal(q.valor, q.params.quer === 'mmc' ? mmc3(q.params.xs) : mdc3(q.params.xs), q.id);
    }
    const j = Q.gerarQuestao('MAT-07-JUROS-SIMPLES', s, 1);
    assert.equal(j.valor, j.params.C * j.params.i * j.params.t / 100, j.id);
    const g = Q.gerarQuestao('MAT-12-GEOMETRIA', s, 3);
    assert.equal(g.valor, Math.hypot(g.params.a, g.params.b), g.id);
    const p = Q.gerarQuestao('MAT-04-PORCENTAGEM', s, 3);
    assert.ok(Math.abs(p.valor - p.params.P * (1 + p.params.p / 100) * (1 - p.params.q / 100)) < 1e-9, p.id);
  }
});

test('conferência por cálculo próprio: ordenação em fila tem exatamente uma solução e a alternativa certa a reflete', () => {
  const sat = (lugar, c) => {
    if (c.t === 'antes') return lugar[c.a] < lugar[c.b];
    if (c.t === 'logoAtras') return lugar[c.b] === lugar[c.a] + 1;
    if (c.t === 'naoPos') return lugar[c.a] !== c.p;
    if (c.t === 'pos') return lugar[c.a] === c.p;
    if (c.t === 'entre') return Math.min(lugar[c.a], lugar[c.c]) < lugar[c.b] && lugar[c.b] < Math.max(lugar[c.a], lugar[c.c]);
    return Math.abs(lugar[c.a] - lugar[c.b]) >= 2;
  };
  for (let s = 1; s <= 60; s++) for (const nivel of [1, 3, 5]) {
    const q = Q.gerarQuestao('RLOG-03-ORDENACAO', s, nivel);
    const { nomes, pistas, p, m } = q.params;
    let solucoes = []; const cur = [];
    const usados = new Set();
    (function rec() {
      if (cur.length === m) { const lugar = []; cur.forEach((pessoa, pos) => { lugar[pessoa] = pos; }); if (pistas.every((c) => sat(lugar, c))) solucoes.push(cur.slice()); return; }
      for (let x = 0; x < m; x++) { if (usados.has(x)) continue; usados.add(x); cur.push(x); rec(); cur.pop(); usados.delete(x); }
    })();
    assert.equal(solucoes.length, 1, q.id + ': deveria haver uma única ordem');
    assert.equal(nomes[solucoes[0][p]], q.alternativas[q.gabaritoIdx].texto, q.id);
  }
});

test('conferência por cálculo próprio: nos diagramas, exatamente a alternativa correta decorre das premissas', () => {
  // semântica própria do teste: 4 indivíduos, cada um em uma das 8 regiões de Venn de 3 conjuntos
  const vale = (ind, st) => {
    const S = (g) => ((g >> st.s) & 1) === 1; const P = (g) => ((g >> st.p) & 1) === 1;
    if (st.t === 'A') return ind.every((g) => !S(g) || P(g));
    if (st.t === 'E') return !ind.some((g) => S(g) && P(g));
    if (st.t === 'I') return ind.some((g) => S(g) && P(g));
    return ind.some((g) => S(g) && !P(g));
  };
  for (let s = 1; s <= 20; s++) for (const nivel of [1, 3, 5]) {
    const q = Q.gerarQuestao('RLOG-02-CONJUNTOS', s, nivel);
    const { premissas, correta, candidatas } = q.params;
    const modelos = [];
    for (let i = 0; i < 8 ** 4; i++) { const ind = []; let x = i; for (let k = 0; k < 4; k++) { ind.push(x % 8); x = Math.floor(x / 8); } if (premissas.every((p) => vale(ind, p))) modelos.push(ind); }
    assert.ok(modelos.length > 0, q.id);
    assert.ok(modelos.every((ind) => vale(ind, correta)), q.id + ': a correta deveria decorrer');
    for (const c of candidatas) assert.ok(!modelos.every((ind) => vale(ind, c)), q.id + ': uma candidata errada decorre das premissas');
    assert.equal(q.enunciado.split('\n').filter((l) => /^\d\)/.test(l)).length, nivel <= 2 ? 2 : 3);
  }
});

test('cada alternativa errada explica um erro real: o valor mostrado é o que o erro descrito produziria (amostras)', () => {
  // MAT-02: "calculou o MDC em vez do MMC" deve mostrar de fato o MDC; "multiplicou os números" o produto
  for (let s = 1; s <= 80; s++) {
    const q = Q.gerarQuestao('MAT-02-MMC-MDC', s, 1);
    const xs = q.params.xs;
    for (const a of q.alternativas.filter((x) => !x.correta)) {
      if (/calculou o MDC em vez do MMC/.test(a.comentario)) assert.equal(a.valor, mdc3(xs), q.id);
      if (/multiplicou os números/.test(a.comentario)) assert.equal(a.valor, xs.reduce((x, y) => x * y, 1), q.id);
      if (/somou os números/.test(a.comentario)) assert.equal(a.valor, xs.reduce((x, y) => x + y, 0), q.id);
    }
  }
});

test('português dos enunciados de conjuntos: quantificador no singular concorda com o substantivo e não há plural depois de "Todo/Algum/Nenhum"', () => {
  const ruim = /\b(Todo|Algum|Nenhum) [\p{L}]+s (é|não é)\b/u;
  const ruim2 = /\b(Todo|Algum|Nenhum) pessoas?\b/u;
  let n = 0;
  for (let nivel = 1; nivel <= 5; nivel++) for (let sem = 1; sem <= 120; sem++) {
    const q = Q.gerarValida('RLOG-02-CONJUNTOS', sem, nivel);
    const textos = [q.enunciado, q.explicacao].concat(q.alternativas.map((a) => a.texto));
    for (const x of textos) { assert.ok(!ruim.test(x) && !ruim2.test(x), 'concordância: ' + x); n++; }
  }
  assert.ok(n > 1000);
});

// ---------------- nenhuma afirmação sem fundamento nos textos gerados ----------------
// O texto de explicação/pegadinha só pode dizer o que se verifica na fonte ou no cálculo. Afirmações sobre frequência, banca,
// "o que cai na prova" ou "o erro mais comum" não têm fonte e não podem aparecer.
test('explicações e pegadinhas de todos os modelos não fazem afirmações sem fonte (banca, frequência, "mais comum")', () => {
  const proibido = /mais cobrad|costuma|\bna prova\b|\bbanca\b|geralmente|normalmente|mais comum|cl[aá]ssic[ao]|armadilha mais|mais f[aá]cei|frequente|cai muito|mais perigos|pegadinha da/i;
  let n = 0;
  for (const t of Q.CATALOGO) {
    for (let s = 1; s <= 60; s++) {
      for (const nivel of [1, 2, 3, 4, 5]) {
        let q; try { q = Q.gerarQuestao(t.id, t.ajustarSemente ? t.ajustarSemente(Q.topicosDe(t)[s % Q.topicosDe(t).length], s * t.modulo + 1) : s, nivel); } catch (e) { continue; }
        if (!q) continue; n++;
        for (const campo of ['explicacao', 'pegadinha']) {
          const m = proibido.exec(q[campo] || '');
          assert.ok(!m, t.id + ' ' + campo + ' contém "' + (m && m[0]) + '": ' + q[campo]);
        }
      }
    }
  }
  assert.ok(n > 1000, 'amostra pequena demais: ' + n);
});
