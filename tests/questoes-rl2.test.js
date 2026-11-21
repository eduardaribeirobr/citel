'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js'); require('../src/questoes-mat2.js'); require('../src/questoes-rl.js');
const RL2 = require('../src/questoes-rl2.js');
const { impressao } = require('../tools/golden-questoes.js');

const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-questoes.json'), 'utf8'));
const { ATOMOS } = RL2;

// ---------------------------------------------------------------------------------------------------
// Terceiro avaliador (independente do recursivo e do de máscaras): expressão JavaScript montada a partir da fórmula
// ---------------------------------------------------------------------------------------------------
const expr = (f) => {
  if (f.k === 'lit') return (f.neg ? '!' : '') + 'v[' + f.i + ']';
  if (f.k === 'and') return '(' + f.xs.map(expr).join(' && ') + ')';
  if (f.k === 'or') return '(' + f.xs.map(expr).join(' || ') + ')';
  return '(!' + expr(f.a) + ' || ' + expr(f.b) + ')';
};
const compila = (f) => new Function('v', 'return ' + expr(f) + ';');
const todasLinhas = (k) => { const out = []; for (let r = 0; r < (1 << k); r++) out.push(Array.from({ length: k }, (_, i) => ((r >> i) & 1) === 1)); return out; };
const col = (f, k) => { const fn = compila(f); return todasLinhas(k).map((v) => fn(v)).join(''); };
const complemento = (c) => c.split('').map((x) => (x === 'true' ? 'false' : x)).join('');
const colNeg = (f, k) => { const fn = compila(f); return todasLinhas(k).map((v) => !fn(v)).join(''); };
const equivalentes = (f, g, k) => col(f, k) === col(g, k);
const nao = (l) => ({ k: 'lit', i: l.i, neg: !l.neg });
const E_ = (...xs) => ({ k: 'and', xs }); const OU = (...xs) => ({ k: 'or', xs }); const SE = (a, b) => ({ k: 'imp', a, b });

// ---------------------------------------------------------------------------------------------------
// Analisador independente: lê de volta, do PORTUGUÊS escrito, a fórmula que a alternativa expressa
// ---------------------------------------------------------------------------------------------------
const minus = (x) => x.charAt(0).toLowerCase() + x.slice(1);
function parseLit(s, at) {
  const t = minus(s.trim());
  for (let i = 0; i < at.length; i++) for (const neg of [0, 1]) if (minus(at[i][neg]) === t) return { k: 'lit', i, neg: neg === 1 };
  throw new Error('literal desconhecido: ' + s);
}
function parseClausula(s, at) {
  const temE = s.includes(' e '); const temOu = s.includes(' ou ');
  assert.ok(!(temE && temOu), 'cláusula ambígua misturando "e" e "ou": ' + s);
  if (temE) return { k: 'and', xs: s.split(' e ').map((x) => parseLit(x, at)) };
  if (temOu) return { k: 'or', xs: s.split(' ou ').map((x) => parseLit(x, at)) };
  return parseLit(s, at);
}
function parseTexto(txt, at) {
  const s = txt.replace(/\.$/, '');
  if (/^Se /.test(s)) {
    const partes = s.slice(3).split(', então ');
    assert.equal(partes.length, 2, 'condicional malformada: ' + txt);
    return { k: 'imp', a: parseClausula(partes[0], at), b: parseClausula(partes[1], at) };
  }
  return parseClausula(s, at);
}
/** "“A” é verdadeira, “B” é falsa e “C” é verdadeira" → vetor de valores na ordem dos átomos */
function lerSituacao(txt, at) {
  const v = new Array(at.length).fill(null);
  for (const m of txt.matchAll(/“([^”]+)” é (verdadeira|falsa)/g)) {
    const i = at.findIndex((a) => a[0] === m[1]); assert.ok(i >= 0, 'átomo desconhecido na situação: ' + m[1]);
    v[i] = m[2] === 'verdadeira';
  }
  assert.ok(v.every((x) => x !== null), 'situação incompleta: ' + txt);
  return v;
}
const vale = (f, v) => compila(f)(v);

test('estruturas lógicas: o português de cada alternativa, lido de volta, confere com a tabela-verdade (negação, equivalência, valor lógico)', () => {
  const visto = { negacao: 0, equivalencia: 0, valor: 0 };
  for (let n = 1; n <= 5; n++) for (let s = 1; s <= 120; s++) {
    const q = Q.gerarQuestao('RLOG-06-ESTRUTURAS', s, n); const p = q.params; const { at, k } = p;
    visto[p.forma]++;
    const alts = q.alternativas.map((a) => ({ a, f: parseTexto(a.texto, at) }));
    const certa = alts.find((x) => x.a.correta);
    if (p.forma === 'valor') {
      assert.ok(vale(certa.f, p.v), 'a correta tem de ser verdadeira: ' + certa.a.texto);
      for (const x of alts.filter((y) => !y.a.correta)) assert.ok(!vale(x.f, p.v), 'alternativa errada é verdadeira: ' + x.a.texto);
      const lido = lerSituacao(q.enunciado, at); assert.deepEqual(lido, p.v, 'situação do enunciado difere da usada na conta');
      continue;
    }
    const citada = /proposição “(.+)”\?$/.exec(q.enunciado); assert.ok(citada, q.enunciado);
    const S = parseTexto(citada[1], at);
    assert.equal(col(S, k), col(p.S, k), 'a proposição do enunciado não é a usada na conta');
    const alvo = p.forma === 'negacao' ? colNeg(S, k) : col(S, k);
    assert.equal(col(certa.f, k), alvo, 'a correta não tem a tabela esperada: ' + certa.a.texto);
    for (const x of alts.filter((y) => !y.a.correta)) {
      assert.notEqual(col(x.f, k), alvo, 'alternativa errada equivale à correta: ' + x.a.texto);
      // as afirmações do comentário são verdadeiras
      const c = x.a.comentario; const [a, b] = p.forma === 'negacao' ? [S.xs ? S.xs[0] : S.a, S.xs ? S.xs[1] : S.b] : [S.a, S.b];
      const igual = (g) => equivalentes(x.f, g, k);
      if (/^Errada: equivale à própria proposição/.test(c)) assert.ok(igual(S), c);
      else if (/^Errada: equivale a negar cada parte mantendo o conectivo/.test(c)) assert.ok(igual(S.k === 'and' ? E_(nao(a), nao(b)) : OU(nao(a), nao(b))), c);
      else if (/^Errada: equivale a trocar/.test(c)) assert.ok(igual(S.k === 'and' ? OU(a, b) : E_(a, b)), c);
      else if (/equivale à recíproca/.test(c)) { assert.ok(igual(SE(b, a)) && igual(SE(nao(a), nao(b))), 'a recíproca e a inversa são equivalentes entre si: ' + c); }
      else if (/equivale à negação da condicional/.test(c)) assert.ok(igual({ k: 'and', xs: [a, nao(b)] }), c);
      else {
        const sit = /na situação em que (.+?), (?:a negação|a condicional) é (verdadeira|falsa) e esta alternativa é (verdadeira|falsa)/.exec(c);
        assert.ok(sit, 'comentário sem justificativa verificável: ' + c);
        const v = lerSituacao(sit[1], at);
        assert.equal(vale(x.f, v), sit[3] === 'verdadeira', 'valor da alternativa na situação citada: ' + c);
        const refVal = p.forma === 'negacao' ? !vale(S, v) : vale(S, v);
        assert.equal(refVal, sit[2] === 'verdadeira', 'valor da referência na situação citada: ' + c);
      }
    }
  }
  assert.ok(visto.negacao >= 40 && visto.equivalencia >= 40 && visto.valor >= 40, JSON.stringify(visto));
});

test('argumentos: premissas e conclusões lidas do português conferem com a validade por tabela-verdade', () => {
  let nConcl = 0; let nFalta = 0;
  for (let n = 1; n <= 5; n++) for (let s = 1; s <= 120; s++) {
    const q = Q.gerarQuestao('RLOG-07-ARGUMENTOS', s, n); const p = q.params; const { at, k } = p;
    const alts = q.alternativas.map((a) => ({ a, f: parseTexto(a.texto, at) }));
    const certa = alts.find((x) => x.a.correta);
    const linhas = todasLinhas(k);
    if (p.modo === 'concl') {
      nConcl++;
      const prem = [...q.enunciado.matchAll(/^\d\) (.+)$/gm)].map((m) => parseTexto(m[1], at));
      assert.ok(prem.length >= 2);
      const premsOk = (v) => prem.every((f) => vale(f, v));
      assert.ok(linhas.some(premsOk), 'premissas insatisfatíveis (decorrência vazia)');
      assert.ok(linhas.filter(premsOk).every((v) => vale(certa.f, v)), 'a correta não decorre: ' + certa.a.texto);
      for (const x of alts.filter((y) => !y.a.correta)) {
        assert.ok(linhas.filter(premsOk).some((v) => !vale(x.f, v)), 'a errada decorre das premissas: ' + x.a.texto);
        const c = x.a.comentario; const m = /na situação em que (.+?), todas as premissas são verdadeiras e esta conclusão é falsa/.exec(c);
        assert.ok(m, c);
        const v = lerSituacao(m[1], at); assert.ok(premsOk(v) && !vale(x.f, v), 'contraexemplo citado não funciona: ' + c);
        if (/equivale à recíproca/.test(c)) assert.ok(prem.some((pr) => pr.k === 'imp' && equivalentes(x.f, SE(pr.b, pr.a), k)), c);
      }
    } else {
      nFalta++;
      const p1 = parseTexto(/Premissa 1: (.+)/.exec(q.enunciado)[1], at); const C = parseTexto(/Conclusão: (.+)/.exec(q.enunciado)[1], at);
      const valida = (f) => { const ok = linhas.filter((v) => vale(p1, v) && vale(f, v)); return ok.length > 0 && ok.every((v) => vale(C, v)); };
      assert.ok(valida(certa.f), 'a correta não valida o argumento: ' + certa.a.texto);
      for (const x of alts.filter((y) => !y.a.correta)) {
        assert.ok(!valida(x.f), 'a errada também valida: ' + x.a.texto);
        assert.ok(linhas.some((v) => vale(p1, v) && vale(x.f, v)), 'a errada torna as premissas inconsistentes (validade vazia): ' + x.a.texto);
        const c = x.a.comentario; const m = /na situação em que (.+?), as duas premissas são verdadeiras e a conclusão é falsa/.exec(c); assert.ok(m, c);
        const v = lerSituacao(m[1], at); assert.ok(vale(p1, v) && vale(x.f, v) && !vale(C, v), 'contraexemplo citado não funciona: ' + c);
        if (/equivale à recíproca da premissa 1/.test(c)) assert.ok(p1.k === 'imp' && equivalentes(x.f, SE(p1.b, p1.a), k), c);
      }
    }
  }
  assert.ok(nConcl >= 150 && nFalta >= 150, nConcl + ' / ' + nFalta);
});

test('diagramas lógicos novos: nenhuma premissa força conjunto vazio, e a decorrência vale com os três conjuntos não vazios (semântica própria, 4 indivíduos)', () => {
  const REG = 8; let checadas = 0;
  const vale4 = (ind, st) => {
    const noS = (g) => ((g >> st.s) & 1) === 1; const noP = (g) => ((g >> st.p) & 1) === 1;
    if (st.t === 'A') return ind.every((g) => !noS(g) || noP(g));
    if (st.t === 'E') return ind.every((g) => !(noS(g) && noP(g)));
    if (st.t === 'I') return ind.some((g) => noS(g) && noP(g));
    return ind.some((g) => noS(g) && !noP(g));
  };
  const modelos = []; for (let i = 0; i < REG ** 4; i++) { const ind = []; let x = i; for (let j = 0; j < 4; j++) { ind.push(x % REG); x = Math.floor(x / REG); } if ([0, 1, 2].every((s) => ind.some((g) => ((g >> s) & 1) === 1))) modelos.push(ind); }
  for (let n = 1; n <= 5; n++) for (let s = 1; s <= 80; s++) {
    const q = Q.gerarQuestao('RLOG-05-DIAGRAMAS', s, n); const p = q.params;
    assert.equal(p.naoVazio, true);
    const ok = modelos.filter((ind) => p.premissas.every((pr) => vale4(ind, pr)));
    assert.ok(ok.length > 0, 'premissas obrigam conjunto vazio');
    assert.ok(ok.every((ind) => vale4(ind, p.correta)), 'a correta não decorre');
    for (const c of p.candidatas) assert.ok(ok.some((ind) => !vale4(ind, c)), 'uma errada decorre');
    // cada um dos três conjuntos pode ser não vazio individualmente também por construção
    for (const set of [0, 1, 2]) assert.ok(ok.some((ind) => ind.some((g) => ((g >> set) & 1) === 1)));
    checadas++;
  }
  assert.equal(checadas, 400);
});

test('o modelo antigo de conjuntos (aposentado) produzia premissas que forçam conjunto vazio, e por isso foi trocado', () => {
  // prova de que a troca era necessária: acha ao menos uma questão antiga em que algum conjunto é obrigatoriamente vazio
  const vale4 = (ind, st) => {
    const noS = (g) => ((g >> st.s) & 1) === 1; const noP = (g) => ((g >> st.p) & 1) === 1;
    if (st.t === 'A') return ind.every((g) => !noS(g) || noP(g)); if (st.t === 'E') return ind.every((g) => !(noS(g) && noP(g)));
    if (st.t === 'I') return ind.some((g) => noS(g) && noP(g)); return ind.some((g) => noS(g) && !noP(g));
  };
  const todos = []; for (let i = 0; i < 8 ** 4; i++) { const ind = []; let x = i; for (let j = 0; j < 4; j++) { ind.push(x % 8); x = Math.floor(x / 8); } todos.push(ind); }
  let degeneradas = 0;
  for (let s = 1; s <= 200; s++) {
    const q = Q.gerarQuestao('RLOG-02-CONJUNTOS', s, 1 + (s % 5)); const ok = todos.filter((ind) => q.params.premissas.every((pr) => vale4(ind, pr)));
    if (![0, 1, 2].every((set) => ok.some((ind) => ind.some((g) => ((g >> set) & 1) === 1)))) degeneradas++;
  }
  assert.ok(degeneradas > 0, 'o defeito que motivou a troca desapareceu do modelo antigo? então o histórico mudou');
});

test('modelo aposentado: reproduz o histórico, não entra em sessões novas e o histórico vai para o sucessor', () => {
  const t = Q.modelo('RLOG-02-CONJUNTOS');
  assert.equal(t.aposentado, 'RLOG-05-DIAGRAMAS');
  assert.equal(Q.sucessorDe('RLOG-02-CONJUNTOS'), 'RLOG-05-DIAGRAMAS');
  assert.equal(Q.sucessorDe('RLOG-05-DIAGRAMAS'), 'RLOG-05-DIAGRAMAS');
  assert.equal(Q.sucessorDe('MAT-01-FRACOES'), 'MAT-01-FRACOES');
  assert.equal(Q.sucessorDe('NAO-EXISTE'), 'NAO-EXISTE');
  assert.ok(!Q.ativos().some((x) => x.id === 'RLOG-02-CONJUNTOS'));
  assert.ok(Q.ativos().length === Q.CATALOGO.length - 1);
  const q = Q.gerarQuestao('RLOG-02-CONJUNTOS', 299468901, 1);      // questão real que já foi respondida
  assert.equal(Q.validarQuestao(q).ok, true);
});

test('IDS IMUTÁVEIS: cada id do arquivo dourado reproduz exatamente a mesma questão (enunciado, alternativas e gabarito)', () => {
  const diverge = [];
  for (const [id, h] of Object.entries(gold.ids)) {
    const x = Q.lerId(id); const q = Q.gerarQuestao(x.templateId, x.semente, x.nivel);
    if (impressao(q) !== h) diverge.push(id);
  }
  assert.deepEqual(diverge, [], 'Estes ids passaram a gerar OUTRA questão. O histórico de quem já usou o app guarda só o id, então o caderno de erros ficaria errado. NÃO atualize o arquivo dourado: crie um modelo novo e aposente o antigo.');
  const ids = new Set(Object.keys(gold.ids));
  for (const t of Q.CATALOGO) assert.ok(ids.has(Q.idQuestao(t.id, 1, 1)), 'modelo sem entrada dourada (rode: node tools/golden-questoes.js --acrescentar): ' + t.id);
});

test('as questões REAIS já respondidas continuam reproduzindo o mesmo gabarito e a mesma correção', () => {
  assert.ok(gold.reais.length >= 10);
  for (const e of gold.reais) {
    const x = Q.lerId(e.id); const q = Q.gerarQuestao(x.templateId, x.semente, x.nivel);
    assert.equal(q.gabarito, e.gabarito, e.id);
    assert.equal(q.alternativas.find((a) => a.letra === e.resposta).correta, e.correct, e.id);
  }
});

test('concordância: nenhum modelo escreve "1" seguido de unidade no plural (todos os modelos, níveis e muitas sementes)', () => {
  const re = /(^|[^\d,.\-−])1 \p{L}{3,}s(?!\p{L})/gu; const ruins = {}; let textos = 0;
  for (const t of Q.CATALOGO) for (let n = 1; n <= 5; n++) for (let s = 1; s <= 250; s++) {
    let q; try { q = Q.gerarQuestao(t.id, s, n); } catch (e) { continue; }
    for (const x of [q.enunciado, q.explicacao, q.pegadinha].concat(q.alternativas.flatMap((a) => [a.texto, a.comentario]))) {
      textos++; const m = x.match(re); if (m) ruins[t.id + ' | ' + m.join(',').trim()] = x.slice(0, 90);
    }
  }
  assert.deepEqual(ruins, {}, 'adicione a palavra a SINGULAR em questoes.js');
  assert.ok(textos > 50000);
});

test('corrigirPlural: só troca "1 + plural"; não mexe em 11, 1,5, −1, nem em palavras desconhecidas', () => {
  const c = Q.corrigirPlural;
  assert.equal(c('1 cadernos'), '1 caderno'); assert.equal(c('1 meses e 1 dias'), '1 mês e 1 dia'); assert.equal(c('1 operários'), '1 operário');
  assert.equal(c('11 partes'), '11 partes'); assert.equal(c('21 dias'), '21 dias'); assert.equal(c('1,5 horas'), '1,5 horas'); assert.equal(c('R$ 1.000 reais'), 'R$ 1.000 reais');
  assert.equal(c('−1 anos'), '−1 anos'); assert.equal(c('1 xyzs'), '1 xyzs'); assert.equal(c('3 cadernos'), '3 cadernos');
  assert.equal(c('início: 1 partes'), 'início: 1 parte');
});

test('sequências B: a resposta bate com uma recomputação própria de cada regra, e as regras variam por nível', () => {
  const primos = (n) => { const l = []; for (let x = 2; l.length < n; x++) { let p = true; for (let d = 2; d * d <= x; d++) if (x % d === 0) p = false; if (p) l.push(x); } return l; };
  const formasPorNivel = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set() };
  for (let n = 1; n <= 5; n++) for (let s = 1; s <= 200; s++) {
    const q = Q.gerarQuestao('RLOG-04-SEQUENCIAS-B', s, n); const p = q.params; formasPorNivel[n].add(p.f);
    let esperado;
    if (p.f === 6) esperado = (p.s + 5) ** 2 + p.k;
    else if (p.f === 14) esperado = (p.s + 5) ** 3 + p.k;
    else if (p.f === 15) esperado = p.a + 55;
    else if (p.f === 7) { const t = [p.a, p.b]; while (t.length < 6) t.push(t[t.length - 1] + t[t.length - 2]); esperado = t[5]; }
    else if (p.f === 10) esperado = p.m;
    else if (p.f === 9) esperado = primos(14)[p.i0 + 5];
    else if (p.f === 8) esperado = p.a * 720;
    else { let x = p.a; for (let i = 0; i < 6; i++) x = (i % 2 === 0) ? x * p.m : x - p.c; esperado = x; }
    assert.equal(q.valor, esperado, 'forma ' + p.f + ' nível ' + n);
    const mostrados = q.enunciado.replace('Observe a sequência: ', '').replace(', ... Qual é o próximo termo?', '').split(', ').map((x) => Number(x.replace(/\./g, '').replace('−', '-')));
    assert.deepEqual(mostrados, p.termos, 'termos mostrados diferem dos usados');
  }
  assert.deepEqual([...formasPorNivel[1]].sort(), [6]); assert.deepEqual([...formasPorNivel[2]].sort((a, b) => a - b), [7, 10]);
  assert.deepEqual([...formasPorNivel[3]].sort((a, b) => a - b), [9, 16]); assert.deepEqual([...formasPorNivel[4]].sort((a, b) => a - b), [8, 14]); assert.deepEqual([...formasPorNivel[5]], [15]);
  assert.equal(RL2.extrapolar([1, 4, 9, 16, 25]), 36);
});

test('variedade de Raciocínio Lógico: seis modelos ativos, vários formatos por nível e variação mínima de enunciados em 200 sementes', () => {
  const ativos = Q.ativos().filter((t) => t.topicId === 'OJ26-RLOG-01').map((t) => t.id).sort();
  assert.deepEqual(ativos, ['RLOG-01-SEQUENCIAS', 'RLOG-03-ORDENACAO', 'RLOG-04-SEQUENCIAS-B', 'RLOG-05-DIAGRAMAS', 'RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS']);
  for (const id of ['RLOG-05-DIAGRAMAS', 'RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS']) for (let n = 1; n <= 5; n++) {
    const enun = new Set(); for (let s = 1; s <= 200; s++) enun.add(Q.gerarQuestao(id, s, n).enunciado);
    assert.ok(enun.size >= 90, id + ' nível ' + n + ': só ' + enun.size + ' enunciados distintos em 200');
  }
  const formas = (id, n) => { const f = new Set(); for (let s = 1; s <= 120; s++) f.add(Q.gerarQuestao(id, s, n).params.forma); return [...f].sort(); };
  assert.deepEqual(formas('RLOG-06-ESTRUTURAS', 1), ['negacao']);
  assert.deepEqual(formas('RLOG-06-ESTRUTURAS', 2), ['equivalencia', 'negacao']);
  assert.deepEqual(formas('RLOG-06-ESTRUTURAS', 3), ['equivalencia', 'valor']);
  assert.deepEqual(formas('RLOG-06-ESTRUTURAS', 5), ['valor']);
  const modos = (n) => { const f = new Set(); for (let s = 1; s <= 60; s++) f.add(Q.gerarQuestao('RLOG-07-ARGUMENTOS', s, n).params.modo); return [...f]; };
  assert.deepEqual(modos(1), ['concl']); assert.deepEqual(modos(3), ['falta']); assert.deepEqual(modos(4), ['concl']); assert.deepEqual(modos(5), ['falta']);
});

test('legibilidade: nenhuma alternativa de lógica proposicional passa de 140 caracteres e não repete frases simples dos dois lados de uma condicional', () => {
  let maior = 0;
  for (const id of ['RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS']) for (let n = 1; n <= 5; n++) for (let s = 1; s <= 150; s++) {
    const q = Q.gerarQuestao(id, s, n);
    for (const a of q.alternativas) {
      maior = Math.max(maior, a.texto.length); assert.ok(a.texto.length <= 140, id + ' n' + n + ': ' + a.texto);
      const f = parseTexto(a.texto, q.params.at);
      if (id === 'RLOG-06-ESTRUTURAS' && q.params.forma === 'valor' && f.k === 'imp') {
        const ids = (c) => (c.k === 'lit' ? [c.i] : c.xs.map((x) => x.i));
        const comuns = ids(f.a).filter((i) => ids(f.b).includes(i));
        assert.equal(comuns.length, 0, 'átomo repetido nos dois lados da condicional: ' + a.texto);
      }
    }
  }
  assert.ok(maior > 20);
});

test('valor lógico: cada justificativa escrita ("a parte X é falsa", "antecedente verdadeiro e consequente falso"...) é verdadeira na situação dada', () => {
  let checadas = 0;
  for (let n = 3; n <= 5; n++) for (let s = 1; s <= 150; s++) {
    const q = Q.gerarQuestao('RLOG-06-ESTRUTURAS', s, n); const p = q.params; if (p.forma !== 'valor') continue;
    const { at, v } = p;
    const litTxt = (txt) => parseLit(txt, at);
    const confere = (f, claim, ctx) => {
      let m;
      if ((m = /^“(.+)” é (verdadeira|falsa)$/.exec(claim))) { assert.equal(f.k, 'lit', ctx); assert.equal(vale(parseLit(m[1], at), v), m[2] === 'verdadeira', ctx); assert.equal(vale(f, v), m[2] === 'verdadeira', ctx); }
      else if (claim === 'todas as partes são verdadeiras') { assert.equal(f.k, 'and', ctx); assert.ok(f.xs.every((x) => vale(x, v)), ctx); }
      else if ((m = /^a parte “(.+)” é falsa$/.exec(claim))) { assert.equal(f.k, 'and', ctx); const l = litTxt(m[1]); assert.ok(f.xs.some((x) => x.i === l.i && x.neg === l.neg), ctx); assert.ok(!vale(l, v), ctx); }
      else if ((m = /^a parte “(.+)” é verdadeira$/.exec(claim))) { assert.equal(f.k, 'or', ctx); const l = litTxt(m[1]); assert.ok(f.xs.some((x) => x.i === l.i && x.neg === l.neg), ctx); assert.ok(vale(l, v), ctx); }
      else if (claim === 'todas as partes são falsas') { assert.equal(f.k, 'or', ctx); assert.ok(f.xs.every((x) => !vale(x, v)), ctx); }
      else if (claim.startsWith('o antecedente é verdadeiro e o consequente é falso')) { assert.equal(f.k, 'imp', ctx); assert.ok(vale(f.a, v) && !vale(f.b, v), ctx); }
      else if (claim === 'antecedente e consequente são verdadeiros') { assert.equal(f.k, 'imp', ctx); assert.ok(vale(f.a, v) && vale(f.b, v), ctx); }
      else if (claim.startsWith('o antecedente é falso, e uma condicional com antecedente falso é verdadeira')) {
        assert.equal(f.k, 'imp', ctx); assert.ok(!vale(f.a, v), ctx);
        assert.equal(/\(mesmo com consequente falso\)$/.test(claim), !vale(f.b, v), 'o parêntese sobre o consequente tem de refletir o valor real: ' + ctx);
      } else assert.fail('justificativa sem verificação: ' + claim + ' | ' + ctx);
      checadas++;
    };
    for (const a of q.alternativas.filter((x) => !x.correta)) { const m = /^Errada: é falsa: (.+)\.$/.exec(a.comentario); assert.ok(m, a.comentario); confere(parseTexto(a.texto, at), m[1], a.comentario); }
    const certa = q.alternativas.find((x) => x.correta); const mc = /A correta é verdadeira porque (.+?)\. As outras são falsas/.exec(q.explicacao); assert.ok(mc, q.explicacao);
    confere(parseTexto(certa.texto, at), mc[1], q.explicacao);
  }
  assert.ok(checadas >= 600, 'poucas justificativas conferidas: ' + checadas);
});

test('valor lógico: a situação do enunciado e as 4 alternativas erradas citadas na explicação são consistentes com a avaliação', () => {
  for (let n = 3; n <= 5; n++) for (let s = 1; s <= 100; s++) {
    const q = Q.gerarQuestao('RLOG-06-ESTRUTURAS', s, n); const p = q.params; if (p.forma !== 'valor') continue;
    const citadas = [...q.explicacao.split('As outras são falsas: ')[1].matchAll(/“([^”]+)”/g)].map((m) => m[1]);
    for (const c of citadas) { const f = parseTexto(c + '.', p.at); assert.ok(!vale(f, p.v), 'citada como falsa mas é verdadeira: ' + c); }
    assert.ok(citadas.length >= 1);
  }
});

test('sequências B e diagramas: não deixam sobrar 1 + plural nem frases com "ele(s)" soltos nos textos novos', () => {
  for (const id of ['RLOG-04-SEQUENCIAS-B', 'RLOG-05-DIAGRAMAS', 'RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS']) for (let n = 1; n <= 5; n++) for (let s = 1; s <= 60; s++) {
    const q = Q.gerarQuestao(id, s, n);
    for (const x of [q.enunciado, q.explicacao, q.pegadinha].concat(q.alternativas.flatMap((a) => [a.texto, a.comentario]))) {
      assert.ok(!/undefined|NaN|\[object|null/.test(x), id + ': texto com defeito: ' + x.slice(0, 120));
      assert.ok(!/  /.test(x.replace(/\n/g, ' ')), id + ': espaço duplo: ' + x.slice(0, 120));
    }
  }
});

test('o segundo método (resolver) de diagramas REJEITA premissas que forçam um conjunto vazio, e a validação da questão falha', () => {
  const t = Q.modelo('RLOG-05-DIAGRAMAS');
  // "Nenhum A é B" e "Todo B é A" obrigam B a ser vazio; "Nenhum B é C" vale então só "por vazio"
  const params = { nomes: ['a', 'b', 'c'], premissas: [{ t: 'E', s: 0, p: 1 }, { t: 'A', s: 1, p: 0 }], correta: { t: 'E', s: 1, p: 2 }, candidatas: [{ t: 'I', s: 0, p: 2 }], naoVazio: true };
  assert.doesNotThrow(() => Q.modelo('RLOG-02-CONJUNTOS').resolver(params), 'premissa: o resolver do modelo antigo aceitava este caso');
  assert.throws(() => t.resolver(params), /vazio/);
  const q = Q.gerarQuestao('RLOG-05-DIAGRAMAS', 1, 1);
  const ruim = Object.assign({}, q, { params });
  const v = Q.validarQuestao(ruim);
  assert.equal(v.ok, false);
  assert.ok(v.erros.some((e) => /segundo método falhou/.test(e)), v.erros.join(' | '));
});

test('rótulos de erro estão COMPLETOS: se a alternativa equivale à recíproca (= inversa) ou à própria proposição, o comentário diz isso', () => {
  let rec = 0; let prop = 0;
  for (let s = 1; s <= 300; s++) {
    const q = Q.gerarQuestao('RLOG-06-ESTRUTURAS', s, 2 + (s % 2)); const p = q.params; if (p.forma === 'valor') continue;
    const { at, k } = p; const S = parseTexto(/proposição “(.+)”\?$/.exec(q.enunciado)[1], at);
    // fato lógico que justifica um único rótulo: a inversa equivale à recíproca
    if (S.k === 'imp') assert.ok(equivalentes(SE(S.b, S.a), SE(nao(S.a), nao(S.b)), k));
    for (const a of q.alternativas.filter((x) => !x.correta)) {
      const f = parseTexto(a.texto, at); const c = a.comentario;
      if (p.forma === 'negacao' && equivalentes(f, S, k)) { assert.match(c, /equivale à própria proposição/); prop++; }
      else if (S.k === 'imp' && equivalentes(f, SE(S.b, S.a), k)) { assert.match(c, /equivale à recíproca.*e à inversa/); rec++; }
    }
  }
  assert.ok(rec >= 30 && prop >= 5, `recíproca ${rec}, própria ${prop}`);
});

test('condicionais de valor lógico (3 átomos): antecedente e consequente nunca compartilham átomos (legibilidade verificada de outro modo)', () => {
  for (let s = 1; s <= 200; s++) for (const n of [4, 5]) {
    const q = Q.gerarQuestao('RLOG-06-ESTRUTURAS', s, n); if (q.params.forma !== 'valor') continue;
    for (const c of [q.params.correta].concat(q.params.candidatas)) if (c.k === 'imp') {
      const ids = (x) => (x.k === 'lit' ? [x.i] : x.xs.map((y) => y.i));
      assert.equal(ids(c.a).filter((i) => ids(c.b).includes(i)).length, 0);
      assert.ok(ids(c.a).length <= 2 && ids(c.b).length <= 2);
    }
  }
});

void ATOMOS;


