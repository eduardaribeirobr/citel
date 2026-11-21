'use strict';
/*
 * Raciocínio Lógico, parte 2 (tópico OJ26-RLOG-01). O edital (p. 62) diz que as questões podem tratar de
 * "estruturas lógicas, lógicas de argumentação, diagramas lógicos, sequências". Aqui entram:
 *   RLOG-04-SEQUENCIAS-B  novas regras de sequência (quadrados, soma dos dois anteriores, primos, divisão, ...)
 *   RLOG-05-DIAGRAMAS     substitui RLOG-02-CONJUNTOS (aposentado): sem premissas que forcem conjunto vazio
 *   RLOG-06-ESTRUTURAS    negação, equivalência da condicional e valor lógico de proposições compostas
 *   RLOG-07-ARGUMENTOS    validade de argumentos: conclusão necessária e premissa que falta
 * Tudo é conferido por tabela-verdade. O gerador avalia por recursão; o "segundo método" (resolver) avalia por
 * máscaras de bits, outro caminho de cálculo. Os testes ainda usam um terceiro avaliador, independente dos dois.
 */
const Q = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;
if (typeof require === 'function') require('./questoes-rl.js');
const { fmt } = Q;

const E = (valor, texto, porque) => ({ valor, texto, porque });
const num = (v, porque) => E(v, fmt(v), porque);
const lista = (t) => t.map((x) => fmt(x)).join(', ');

// =====================================================================================================
// RLOG-04: sequências, outras regras
// =====================================================================================================
const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
const ehPrimo = (n) => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const proximoPrimo = (n) => { let x = n + 1; while (!ehPrimo(x)) x++; return x; };
const menorDivisor = (n) => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return d; return n; };

/** Extrapolação por diferenças finitas (Newton): só usa os termos visíveis; exata para polinômios de grau até 4. */
function extrapolar(t) {
  let linha = t.slice(); let soma = 0;
  while (linha.length) {
    soma += linha[linha.length - 1];
    const nova = []; for (let i = 1; i < linha.length; i++) nova.push(linha[i] - linha[i - 1]);
    linha = nova;
  }
  return soma;
}
const mulMat = (A, B) => [[A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]], [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]];
function potMat(M, e) { let r = [[1, 0], [0, 1]]; let b = M; while (e > 0) { if (e & 1) r = mulMat(r, b); b = mulMat(b, b); e >>= 1; } return r; }
/** t_n da sequência t0=a, t1=b, t_k=t_(k-1)+t_(k-2), por potência de matriz: t_n = a·F(n-1) + b·F(n). */
function termoSoma2(a, b, n) { const M = potMat([[1, 1], [1, 0]], n); return a * M[1][1] + b * M[1][0]; }

const FORMAS_SEQ = { 1: [6], 2: [7, 10], 3: [9, 16], 4: [8, 14], 5: [15] };

Q.CATALOGO.push({
  id: 'RLOG-04-SEQUENCIAS-B', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: sequências (outras regras)',
  gerar(r, n) {
    const f = r.pick(FORMAS_SEQ[n]);
    let termos; let ok; let expl; let pega; let erros; let params; let mostrados;
    if (f === 6) {
      const s = r.int(1, 6); const k = r.int(-3, 5);
      termos = [0, 1, 2, 3, 4].map((i) => (s + i) ** 2 + k); ok = (s + 5) ** 2 + k;
      const t = termos; const d4 = t[4] - t[3];
      const difs = t.slice(1).map((x, i) => x - t[i]);
      expl = `As diferenças entre termos vizinhos são ${lista(difs)}: crescem 2 a cada passo (são números ímpares seguidos). A próxima diferença é ${fmt(difs[3] + 2)}, então o próximo termo é ${fmt(t[4])} + ${fmt(difs[3] + 2)} = ${fmt(ok)}. ${k === 0 ? `Os termos são os quadrados de ${s}, ${s + 1}, ${s + 2}...; o próximo é ${s + 5}² = ${fmt(ok)}.` : `Cada termo é um quadrado ${k > 0 ? 'mais' : 'menos'} ${Math.abs(k)}: o próximo é ${s + 5}² ${k > 0 ? '+' : '−'} ${Math.abs(k)} = ${fmt(ok)}.`}`;
      pega = 'Se a diferença entre termos vizinhos não é fixa, mas cresce de modo regular, procure quadrados perfeitos (ou calcule as diferenças das diferenças).';
      erros = [num(t[4] + d4, 'repetiu a última diferença (tratou como soma de constante)'), num(t[4] + d4 + 1, 'somou 1 à última diferença em vez de 2'), num(t[4] + d4 + 4, 'somou 4 à última diferença em vez de 2'),
        num((s + 5) ** 2, 'esqueceu a constante somada aos quadrados'), num(2 * t[4], 'dobrou o último termo'), num(t[4] + 2 * (s + 4), 'esqueceu o +1 da diferença (usou 2 × a base)')];
      params = { f, termos, s, k };
    } else if (f === 7) {
      const a = r.int(1, 5); const b = r.int(1, 5);
      termos = [a, b]; for (let i = 2; i < 5; i++) termos.push(termos[i - 1] + termos[i - 2]);
      const t = termos; ok = t[3] + t[4];
      expl = `Cada termo é a soma dos dois anteriores (${a} + ${b} = ${t[2]}; ${b} + ${t[2]} = ${t[3]}; ${t[2]} + ${t[3]} = ${t[4]}). O próximo é ${t[3]} + ${t[4]} = ${fmt(ok)}.`;
      pega = 'Quando os termos crescem sem diferença fixa nem razão fixa, teste se cada termo é a soma dos dois anteriores.';
      erros = [num(t[4] + (t[4] - t[3]), 'repetiu a última diferença'), num(2 * t[4], 'dobrou o último termo'), num(t[4] + t[2], 'somou o último termo ao antepenúltimo (pulou um)'),
        num(t[4] + t[3] + 1, 'somou uma unidade a mais'), num(t[4] + t[3] - 1, 'somou uma unidade a menos'), num(t[4] * t[4], 'elevou o último termo ao quadrado')];
      params = { f, termos, a, b };
    } else if (f === 10) {
      const q = r.pick([2, 3]); const m = r.int(1, 6);
      termos = [5, 4, 3, 2, 1].map((e) => m * q ** e); ok = m;
      const t = termos;
      expl = `Cada termo é o anterior dividido por ${q} (${fmt(t[0])} ÷ ${q} = ${fmt(t[1])}). O próximo é ${fmt(t[4])} ÷ ${q} = ${fmt(ok)}.`;
      pega = 'Termos que diminuem cada vez menos em valor absoluto sugerem divisão (razão menor que 1), e não subtração de uma constante.';
      erros = [num(t[4] + (t[4] - t[3]), 'repetiu a última diferença (tratou como subtração constante)'), num(t[4] / (q + 1), `dividiu por ${q + 1} em vez de ${q}`), num(t[4] - q, `subtraiu ${q}`),
        num(t[4] * q, 'multiplicou em vez de dividir'), num(t[4] / (q * q), `dividiu por ${q * q} (pulou um termo)`)];
      params = { f, termos, q, m };
    } else if (f === 9) {
      const i0 = r.int(0, 8);
      termos = PRIMOS.slice(i0, i0 + 5); ok = PRIMOS[i0 + 5];
      const t = termos; const entre = []; for (let x = t[4] + 1; x < ok; x++) entre.push(`${x} = ${menorDivisor(x)} × ${x / menorDivisor(x)}`);
      expl = `São números primos consecutivos (só têm dois divisores: 1 e eles mesmos). Depois de ${t[4]}, os números ${entre.join('; ')} não são primos. O próximo primo é ${ok}.`;
      pega = 'Quando os termos não seguem regra de soma, diferença ou multiplicação, confira se são números primos: cada um só tem dois divisores.';
      erros = [num(t[4] + 2, 'somou 2 (supôs primos gêmeos)'), num(t[4] + 1, 'somou 1'), num(proximoPrimo(ok), 'pulou um primo'), num(t[4] + (t[4] - t[3]), 'repetiu a última diferença'), num(t[4] + 4, 'somou 4')];
      params = { f, termos, i0 };
    } else if (f === 16) {
      const m = r.pick([2, 3]); const c = r.int(1, 3); const a = r.int(2, 6);
      const x1 = a * m; const x2 = x1 - c; const x3 = x2 * m; const x4 = x3 - c; const x5 = x4 * m;
      termos = [a, x1, x2, x3, x4, x5]; ok = x5 - c;
      expl = `A regra alterna duas operações: multiplicar por ${m} e subtrair ${c} (${a} × ${m} = ${x1}; ${x1} − ${c} = ${x2}; ${x2} × ${m} = ${x3}; ${x3} − ${c} = ${x4}; ${x4} × ${m} = ${x5}). Depois da multiplicação vem a subtração: ${x5} − ${c} = ${fmt(ok)}.`;
      pega = 'Quando os termos sobem e descem em vezes alternadas, uma regra possível é alternar duas operações: descubra a ordem delas olhando dois passos seguidos.';
      erros = [num(x5 * m, 'repetiu a multiplicação (a operação seguinte é a subtração)'), num(x5 + c, 'somou em vez de subtrair'), num(x5 - 2 * c, 'subtraiu duas vezes'), num(x5 + (x5 - x4), 'repetiu a última diferença'), num(x5 - c * m, `subtraiu ${c * m} em vez de ${c}`)];
      params = { f, termos, a, m, c };
    } else if (f === 8) {
      const a = r.pick([1, 2, 3]);
      termos = [1, 2, 6, 24, 120].map((x) => a * x); ok = a * 720;
      const t = termos;
      expl = `Cada termo é o anterior multiplicado pela sua posição: ${t[1]} = ${t[0]} × 2; ${t[2]} = ${t[1]} × 3; ${t[3]} = ${t[2]} × 4; ${t[4]} = ${t[3]} × 5. O 6.º termo é ${t[4]} × 6 = ${fmt(ok)}.`;
      pega = 'Quando a razão entre termos vizinhos não é fixa, mas cresce (×2, ×3, ×4...), a regra é multiplicar pela posição do termo.';
      erros = [num(t[4] * 5, 'repetiu o último multiplicador (× 5)'), num(t[4] * 7, 'pulou um multiplicador (× 7)'), num(t[4] + (t[4] - t[3]), 'repetiu a última diferença'), num(t[4] * 2, 'dobrou o último termo'), num(t[4] * 4, 'voltou a um multiplicador anterior (× 4)')];
      params = { f, termos, a };
    } else if (f === 14) {
      const s = r.int(1, 4); const k = r.int(-2, 4);
      termos = [0, 1, 2, 3, 4].map((i) => (s + i) ** 3 + k); ok = (s + 5) ** 3 + k;
      const t = termos; const d1 = t.slice(1).map((x, i) => x - t[i]); const d2 = d1.slice(1).map((x, i) => x - d1[i]);
      const suf = k === 0 ? '' : ` ${k > 0 ? '+' : '−'} ${Math.abs(k)}`;
      expl = `Cada termo é um cubo perfeito${k === 0 ? '' : ` ${k > 0 ? 'mais' : 'menos'} ${Math.abs(k)}`}: ${[0, 1, 2, 3, 4].map((i) => `${s + i}³${suf} = ${fmt(t[i])}`).join('; ')}. As diferenças (${lista(d1)}) e as diferenças delas (${lista(d2)}) continuam variando, sinal de uma potência maior que 2. O próximo é ${s + 5}³${suf} = ${fmt(ok)}.`;
      pega = 'Termos que crescem cada vez mais depressa e cujas diferenças também crescem sugerem potências: teste quadrados e cubos.';
      const d3 = d2[d2.length - 1] + (d2[d2.length - 1] - d2[d2.length - 2]);
      erros = [num((s + 5) ** 2 + k, 'usou o quadrado em vez do cubo'), num(t[4] + d1[3], 'repetiu a última diferença'), num((s + 5) ** 3, 'esqueceu a constante somada aos cubos'),
        num(t[4] + d1[3] + d2[2], 'repetiu a última diferença das diferenças (tratou como quadrados)'), num(2 * t[4], 'dobrou o último termo'), num(t[4] + d1[3] + d3, 'aumentou a diferença das diferenças em vez de manter o acréscimo constante da terceira diferença')];
      params = { f, termos, s, k };
    } else {
      const a = r.int(0, 9);
      termos = [0, 1, 5, 14, 30].map((x) => a + x); ok = a + 55;
      const t = termos;
      expl = `As diferenças entre termos vizinhos são 1, 4, 9, 16: são quadrados perfeitos consecutivos (1², 2², 3², 4²). A próxima diferença é 5² = 25, então o próximo termo é ${fmt(t[4])} + 25 = ${fmt(ok)}.`;
      pega = 'Se as diferenças formam outra sequência, descubra a regra dela: aqui, são quadrados perfeitos consecutivos.';
      erros = [num(t[4] + 16, 'repetiu a última diferença'), num(t[4] + 23, 'repetiu o aumento anterior da diferença (7) em vez de aumentá-lo'), num(t[4] + 21, 'somou 5 à última diferença (usou a posição, não o quadrado)'), num(2 * t[4], 'dobrou o último termo'), num(t[4] + 36, 'usou 6² (pulou um quadrado)')];
      params = { f, termos, a };
    }
    mostrados = params.termos;
    const enunciado = `Observe a sequência: ${lista(mostrados)}, ... Qual é o próximo termo?`;
    return { enunciado, correta: { texto: fmt(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Próximo termo: ' + fmt(ok) + '.' };
  },
  resolver(p) {
    const t = p.termos;
    switch (p.f) {
      case 6: case 14: case 15: return extrapolar(t);
      case 7: {
        for (let i = 0; i < t.length; i++) if (termoSoma2(p.a, p.b, i) !== t[i]) throw new Error('termos exibidos diferem da regra');
        return termoSoma2(p.a, p.b, t.length);
      }
      case 10: {
        const razao = t[0] / t[1];
        for (let i = 1; i < t.length; i++) if (t[i - 1] / t[i] !== razao) throw new Error('razão não é constante');
        return t[t.length - 1] / razao;
      }
      case 9: {
        for (const x of t) if (!ehPrimo(x)) throw new Error('termo não é primo');
        for (let i = 1; i < t.length; i++) if (proximoPrimo(t[i - 1]) !== t[i]) throw new Error('primos não são consecutivos');
        return proximoPrimo(t[t.length - 1]);
      }
      case 8: {
        for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1] * (i + 1)) throw new Error('multiplicadores não são 2, 3, 4, 5');
        return t[t.length - 1] * (t.length + 1);
      }
      case 16: {
        // x_(k+1) = m·x_k − c nos termos de posição par; forma fechada exata (divisão inteira conferida)
        const { a, m, c } = p;
        const fechado = (k) => { const num_ = Math.pow(m, k) * (a * (m - 1) - c) + c; if (num_ % (m - 1) !== 0) throw new Error('forma fechada não inteira'); return num_ / (m - 1); };
        if (t[0] !== fechado(0) || t[2] !== fechado(1) || t[4] !== fechado(2)) throw new Error('termos exibidos diferem da forma fechada');
        return fechado(3);
      }
      default: throw new Error('forma desconhecida');
    }
  },
});

// =====================================================================================================
// RLOG-05: diagramas lógicos (substitui RLOG-02-CONJUNTOS, aposentado)
// =====================================================================================================
// RLOG-02 aceitava premissas que obrigam um conjunto a ser VAZIO (ex.: "Nenhum A é B" e "Todo B é A"), e a resposta
// decorria só "por vazio". Aqui exige-se que existam configurações em que os TRÊS conjuntos tenham elementos e que a
// resposta certa e a não decorrência das erradas valham também nelas.
const antigoConjuntos = Q.CATALOGO.find((t) => t.id === 'RLOG-02-CONJUNTOS');
const regiaoTem = (m, g) => ((m >> (g - 1)) & 1) === 1;
function valeRegioes(m, st) {
  let sp = false; let snp = false;
  for (let g = 1; g <= 7; g++) if (regiaoTem(m, g)) { const noS = (g >> st.s) & 1; const noP = (g >> st.p) & 1; if (noS && noP) sp = true; if (noS && !noP) snp = true; }
  if (st.t === 'A') return !snp; if (st.t === 'E') return !sp; if (st.t === 'I') return sp;
  return snp;
}
const tresNaoVazios = (m) => [0, 1, 2].every((s) => { for (let g = 1; g <= 7; g++) if (regiaoTem(m, g) && ((g >> s) & 1)) return true; return false; });

Q.CATALOGO.push({
  id: 'RLOG-05-DIAGRAMAS', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: diagramas lógicos (conjuntos)',
  gerar(r, n) {
    for (let tent = 0; tent < 80; tent++) {
      const sub = Q.criarRng(r.int(1, 2147483646));
      let q; try { q = antigoConjuntos.gerar(sub, n); } catch (e) { continue; }
      const { premissas, correta, candidatas } = q.params;
      const todos = []; const nv = [];
      for (let m = 0; m < 128; m++) if (premissas.every((p) => valeRegioes(m, p))) { todos.push(m); if (tresNaoVazios(m)) nv.push(m); }
      if (!nv.length) continue;
      if (!nv.every((m) => valeRegioes(m, correta))) continue;
      if (!candidatas.every((c) => nv.some((m) => !valeRegioes(m, c)))) continue;
      const troca = (t) => t.split(`${todos.length} configurações`).join(`${nv.length} configurações`);
      q.explicacao = troca(q.explicacao) + ' Só se consideram configurações em que os três conjuntos têm elementos.'; q.comentarioCorreta = troca(q.comentarioCorreta);
      q.params = Object.assign({}, q.params, { naoVazio: true });
      return q;
    }
    throw new Error('não foi possível montar premissas com conjuntos não vazios e uma única conclusão necessária');
  },
  resolver(p) {
    const valor = antigoConjuntos.resolver(p);       // 5 indivíduos, semântica por elementos
    const vale = (ind, st) => {
      const noS = (g) => ((g >> st.s) & 1) === 1; const noP = (g) => ((g >> st.p) & 1) === 1;
      if (st.t === 'A') return ind.every((g) => !noS(g) || noP(g));
      if (st.t === 'E') return ind.every((g) => !(noS(g) && noP(g)));
      if (st.t === 'I') return ind.some((g) => noS(g) && noP(g));
      return ind.some((g) => noS(g) && !noP(g));
    };
    const nv = [];
    for (let i = 0; i < 8 ** 5; i++) {
      const ind = []; let x = i; for (let k = 0; k < 5; k++) { ind.push(x % 8); x = Math.floor(x / 8); }
      if (![0, 1, 2].every((s) => ind.some((g) => ((g >> s) & 1) === 1))) continue;
      if (p.premissas.every((pr) => vale(ind, pr))) nv.push(ind);
    }
    if (!nv.length) throw new Error('as premissas obrigam algum conjunto a ser vazio');
    if (!nv.every((ind) => vale(ind, p.correta))) throw new Error('a correta não decorre com os conjuntos não vazios');
    for (const c of p.candidatas) if (nv.every((ind) => vale(ind, c))) throw new Error('uma errada decorre quando os conjuntos não são vazios (ambíguo)');
    return valor;
  },
});

// =====================================================================================================
// Lógica proposicional: linguagem restrita, sem ambiguidade em português
//   literal            "O prazo terminou" / "O prazo não terminou"
//   cláusula           literal | literal e literal (e literal) | literal ou literal (ou literal)   (conectivo único)
//   fórmula            cláusula | Se cláusula, então cláusula
// =====================================================================================================
const ATOMOS = [
  ['O prazo terminou', 'O prazo não terminou'], ['O réu foi citado', 'O réu não foi citado'],
  ['A audiência foi realizada', 'A audiência não foi realizada'], ['O mandado foi cumprido', 'O mandado não foi cumprido'],
  ['A sentença foi publicada', 'A sentença não foi publicada'], ['O processo está concluso', 'O processo não está concluso'],
  ['Há testemunhas presentes', 'Não há testemunhas presentes'], ['O oficial chegou cedo', 'O oficial não chegou cedo'],
  ['A porta estava aberta', 'A porta não estava aberta'], ['O documento foi assinado', 'O documento não foi assinado'],
];
const lit = (i, neg) => ({ k: 'lit', i, neg: !!neg });
const nao = (l) => lit(l.i, !l.neg);
const E_ = (...xs) => ({ k: 'and', xs });
const OU = (...xs) => ({ k: 'or', xs });
const SE = (a, b) => ({ k: 'imp', a, b });

function ev(f, v) {
  switch (f.k) {
    case 'lit': return f.neg ? !v[f.i] : v[f.i];
    case 'and': return f.xs.every((x) => ev(x, v));
    case 'or': return f.xs.some((x) => ev(x, v));
    default: return !ev(f.a, v) || ev(f.b, v);
  }
}
const linhasVF = (k) => { const L = []; for (let r = 0; r < (1 << k); r++) { const v = []; for (let i = 0; i < k; i++) v.push(((r >> (k - 1 - i)) & 1) === 0); L.push(v); } return L; };
const assinatura = (f, k) => linhasVF(k).map((v) => (ev(f, v) ? '1' : '0')).join('');
const complemento = (s) => s.split('').map((c) => (c === '1' ? '0' : '1')).join('');

/** Segundo método: cada fórmula vira uma máscara de bits (um bit por linha da tabela-verdade) e usa operações de bit. */
function mascara(f, k) {
  const n = 1 << k; const cheio = (1 << n) - 1;
  const base = (i) => { let m = 0; for (let r = 0; r < n; r++) if (((r >> (k - 1 - i)) & 1) === 0) m |= (1 << r); return m; };
  const go = (g) => {
    if (g.k === 'lit') return g.neg ? (~base(g.i) & cheio) : base(g.i);
    if (g.k === 'and') return g.xs.map(go).reduce((a, b) => a & b, cheio);
    if (g.k === 'or') return g.xs.map(go).reduce((a, b) => a | b, 0);
    return (~go(g.a) | go(g.b)) & cheio;
  };
  return go(f);
}
const assinaturaMascara = (m, k) => { let s = ''; for (let r = 0; r < (1 << k); r++) s += ((m >> r) & 1) ? '1' : '0'; return s; };

const baixa = (s) => s.charAt(0).toLowerCase() + s.slice(1);
function textoLit(l, at) { return at[l.i][l.neg ? 1 : 0]; }
function textoClausula(c, at) {
  if (c.k === 'lit') return textoLit(c, at);
  return c.xs.map((x, j) => (j === 0 ? textoLit(x, at) : baixa(textoLit(x, at)))).join(c.k === 'and' ? ' e ' : ' ou ');
}
function texto(f, at) {
  if (f.k === 'imp') return `Se ${baixa(textoClausula(f.a, at))}, então ${baixa(textoClausula(f.b, at))}.`;
  return textoClausula(f, at) + '.';
}
const aspas = (s) => `“${s}”`;
const juntar = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);
/** "“O prazo terminou” é verdadeira e “O réu foi citado” é falsa" */
function descrever(v, at) { return juntar(v.map((x, i) => `${aspas(at[i][0])} é ${x ? 'verdadeira' : 'falsa'}`)); }
/** Por que a fórmula tem esse valor na situação v (sempre derivado da avaliação, nunca escrito à mão). */
function porque(f, v, at) {
  const val = ev(f, v);
  const nomeLit = (l) => aspas(textoLit(l, at));
  if (f.k === 'lit') return `${nomeLit(f)} é ${val ? 'verdadeira' : 'falsa'}`;
  if (f.k === 'and') return val ? 'todas as partes são verdadeiras' : `a parte ${nomeLit(f.xs.find((x) => !ev(x, v)))} é falsa`;
  if (f.k === 'or') return val ? `a parte ${nomeLit(f.xs.find((x) => ev(x, v)))} é verdadeira` : 'todas as partes são falsas';
  const A = ev(f.a, v); const C = ev(f.b, v);
  if (!val) return 'o antecedente é verdadeiro e o consequente é falso, único caso em que uma condicional é falsa';
  return A ? 'antecedente e consequente são verdadeiros' : 'o antecedente é falso, e uma condicional com antecedente falso é verdadeira' + (C ? '' : ' (mesmo com consequente falso)');
}
function primeiraDiferenca(a, b, k) {  // primeira linha em que duas assinaturas diferem
  for (let r = 0; r < a.length; r++) if (a[r] !== b[r]) return { r, v: linhasVF(k)[r], a: a[r] === '1', b: b[r] === '1' };
  return null;
}

/** Todas as fórmulas "curtas" sobre k átomos: literais, e/ou de dois literais, condicionais entre dois literais. */
function universo(k) {
  const L = []; for (let i = 0; i < k; i++) { L.push(lit(i, false)); L.push(lit(i, true)); }
  const out = L.slice();
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    if (i === j) continue;
    for (const nb of [false, true]) for (const na of [false, true]) {
      const a = lit(i, na); const b = lit(j, nb);
      out.push(SE(a, b));
      if (i < j) { out.push(E_(a, b)); out.push(OU(a, b)); }
    }
  }
  return out;
}

function formulaAleatoria(r, k) {
  // legibilidade: no máximo 2 literais por lado da condicional e átomos distintos entre antecedente e consequente
  const clausula = (ids) => {
    const ls = ids.map((i) => lit(i, r.int(0, 1) === 1));
    if (ls.length === 1) return ls[0];
    return r.int(0, 1) === 1 ? E_(...ls) : OU(...ls);
  };
  const embaralhados = r.embaralhar([...Array(k).keys()]);
  if (r.int(0, 2) === 0) return clausula(embaralhados.slice(0, r.int(2, k)));
  const tamA = r.int(1, 2); const tamB = r.int(1, Math.min(2, k - tamA));
  return SE(clausula(embaralhados.slice(0, tamA)), clausula(embaralhados.slice(tamA, tamA + tamB)));
}

// =====================================================================================================
// RLOG-06: estruturas lógicas
// =====================================================================================================
function sortearAtomos(r, k) { return r.embaralhar(ATOMOS).slice(0, k); }
const trocarConectivo = (S) => (S.k === 'and' ? OU(...S.xs) : E_(...S.xs));

function gerarNegacao(r, n) {
  const at = sortearAtomos(r, 2);
  const sinal = n === 1 ? [false, false] : [r.int(0, 1) === 1, r.int(0, 1) === 1];
  const a = lit(0, sinal[0]); const b = lit(1, sinal[1]);
  const tipo = n === 1 ? r.pick(['and', 'or']) : r.pick(['and', 'or', 'imp']);
  const S = tipo === 'and' ? E_(a, b) : tipo === 'or' ? OU(a, b) : SE(a, b);
  const correta = tipo === 'and' ? OU(nao(a), nao(b)) : tipo === 'or' ? E_(nao(a), nao(b)) : E_(a, nao(b));
  const k = 2; const sigS = assinatura(S, k); const alvo = complemento(sigS);
  if (assinatura(correta, k) !== alvo) throw new Error('negação canônica inconsistente');
  const todas = universo(k).filter((f) => f.k !== 'lit');
  const cands = todas.filter((f) => assinatura(f, k) !== alvo);
  const rotulo = (c) => {
    const s = assinatura(c, k);
    if (s === sigS) return 'equivale à própria proposição, e não à sua negação';
    if (tipo !== 'imp') {
      const mesmoConectivoNegado = tipo === 'and' ? E_(nao(a), nao(b)) : OU(nao(a), nao(b));
      if (s === assinatura(mesmoConectivoNegado, k)) return `equivale a negar cada parte mantendo o conectivo "${tipo === 'and' ? 'e' : 'ou'}", o que não é a negação (a negação também troca "e" por "ou" e vice-versa)`;
      if (s === assinatura(trocarConectivo(S), k)) return `equivale a trocar "${tipo === 'and' ? 'e' : 'ou'}" por "${tipo === 'and' ? 'ou' : 'e'}" sem negar as partes, o que não é a negação`;
    } else {
      // a inversa (¬A → ¬B) é equivalente à recíproca (B → A): um único rótulo cobre as duas
      if (s === assinatura(SE(b, a), k)) return 'equivale à recíproca (antecedente e consequente trocados) e à inversa (as duas partes negadas), que não são a negação da condicional';
    }
    return null;
  };
  const dif = (c) => { const d = primeiraDiferenca(assinatura(c, k), alvo, k); return `na situação em que ${descrever(d.v, at)}, a negação é ${d.b ? 'verdadeira' : 'falsa'} e esta alternativa é ${d.a ? 'verdadeira' : 'falsa'}`; };
  const comRotulo = cands.filter((c) => rotulo(c)); const semRotulo = r.embaralhar(cands.filter((c) => !rotulo(c)));
  const escolhidos = comRotulo.concat(semRotulo).slice(0, 7);
  const erros = escolhidos.map((c) => E(assinatura(c, k), texto(c, at), rotulo(c) ? `${rotulo(c)}` : `não é equivalente à negação: ${dif(c)}`));
  const regra = tipo === 'and' ? `Negar uma conjunção (“e”) exige que pelo menos uma das partes seja falsa: troca-se “e” por “ou” e nega-se cada parte (lei de De Morgan).`
    : tipo === 'or' ? `Negar uma disjunção (“ou”) exige que as duas partes sejam falsas: troca-se “ou” por “e” e nega-se cada parte (lei de De Morgan).`
      : 'Uma condicional só é falsa quando o antecedente é verdadeiro e o consequente é falso; logo, sua negação é “antecedente e não consequente”.';
  const linhasTxt = linhasVF(k).map((v, i) => `${v.map((x) => (x ? 'V' : 'F')).join(' ')} → ${sigS[i] === '1' ? 'V' : 'F'}`).join('; ');
  return {
    enunciado: `Qual das alternativas é a negação da proposição ${aspas(texto(S, at).replace(/\.$/, ''))}?`,
    correta: { texto: texto(correta, at), valor: alvo }, erros,
    explicacao: `${regra} Conferido pela tabela-verdade (valores de ${aspas(at[0][0])} e ${aspas(at[1][0])}, nessa ordem → valor da proposição original): ${linhasTxt}. A negação tem os valores contrários em todas as linhas, e só “${texto(correta, at).replace(/\.$/, '')}” os tem.`,
    pegadinha: tipo === 'imp' ? 'Negar “Se A, então B” não é dar outra condicional: a condicional só falha no caso A verdadeira e B falsa.' : 'Ao negar “e” ou “ou”, o conectivo troca (e ↔ ou) E cada parte é negada. Fazer só uma das duas coisas não nega a proposição.',
    params: { forma: 'negacao', at, S, correta, candidatas: cands, k }, comentarioCorreta: 'É a negação: tem sempre o valor contrário ao da proposição original.',
  };
}

function gerarEquivalencia(r, n) {
  const at = sortearAtomos(r, 2);
  const sinal = n === 2 ? [false, false] : [r.int(0, 1) === 1, r.int(0, 1) === 1];
  const a = lit(0, sinal[0]); const b = lit(1, sinal[1]);
  const S = SE(a, b); const k = 2; const sigS = assinatura(S, k);
  const contra = SE(nao(b), nao(a)); const ouForma = OU(nao(a), b);
  const usaContra = r.int(0, 1) === 1;
  const correta = usaContra ? contra : ouForma;
  if (assinatura(correta, k) !== sigS) throw new Error('equivalência canônica inconsistente');
  const cands = universo(k).filter((f) => f.k !== 'lit' && assinatura(f, k) !== sigS);
  const rotulo = (c) => {
    const s = assinatura(c, k);
    if (s === assinatura(SE(b, a), k)) return 'equivale à recíproca (antecedente e consequente trocados) e à inversa (as duas partes negadas), que não são equivalentes à condicional';
    if (s === complemento(sigS)) return 'equivale à negação da condicional, e não à própria condicional';
    return null;
  };
  const dif = (c) => { const d = primeiraDiferenca(assinatura(c, k), sigS, k); return `na situação em que ${descrever(d.v, at)}, a condicional é ${d.b ? 'verdadeira' : 'falsa'} e esta alternativa é ${d.a ? 'verdadeira' : 'falsa'}`; };
  const comRotulo = cands.filter((c) => rotulo(c)); const semRotulo = r.embaralhar(cands.filter((c) => !rotulo(c)));
  const erros = comRotulo.concat(semRotulo).slice(0, 7).map((c) => E(assinatura(c, k), texto(c, at), rotulo(c) || `não é equivalente: ${dif(c)}`));
  const linhasTxt = linhasVF(k).map((v, i) => `${v.map((x) => (x ? 'V' : 'F')).join(' ')} → ${sigS[i] === '1' ? 'V' : 'F'}`).join('; ');
  return {
    enunciado: `Qual das alternativas é logicamente equivalente à proposição ${aspas(texto(S, at).replace(/\.$/, ''))}?`,
    correta: { texto: texto(correta, at), valor: sigS }, erros,
    explicacao: `${usaContra ? 'Uma condicional equivale à sua contrapositiva: “Se A, então B” ≡ “Se não B, então não A”.' : 'Uma condicional “Se A, então B” equivale a “não A ou B”: só é falsa quando A é verdadeiro e B é falso.'} Tabela-verdade da condicional original (valores de ${aspas(at[0][0])} e ${aspas(at[1][0])}, nessa ordem → valor): ${linhasTxt}. A alternativa correta tem exatamente a mesma coluna.`,
    pegadinha: 'A recíproca (“Se B, então A”) e a inversa (“Se não A, então não B”) parecem equivalentes, mas não são: só a contrapositiva (e “não A ou B”) preservam a tabela-verdade.',
    params: { forma: 'equivalencia', at, S, correta, candidatas: cands, k }, comentarioCorreta: 'Tem a mesma tabela-verdade da proposição original.',
  };
}

function gerarValorLogico(r, n) {
  const k = n <= 3 ? 2 : 3;
  for (let tent = 0; tent < 300; tent++) {
    const at = sortearAtomos(r, k);
    const v = []; for (let i = 0; i < k; i++) v.push(r.int(0, 1) === 1);
    const pool = k === 2 ? universo(2).filter((f) => f.k !== 'lit') : Array.from({ length: 60 }, () => formulaAleatoria(r, 3));
    const unicas = []; const vistos = new Set();
    for (const f of pool) { const t = texto(f, at); if (!vistos.has(t)) { vistos.add(t); unicas.push(f); } }
    const verd = unicas.filter((f) => ev(f, v)); const fal = unicas.filter((f) => !ev(f, v));
    if (!verd.length || fal.length < 4) continue;
    const certa = r.pick(verd); const erradas = r.embaralhar(fal).slice(0, 6);
    const erros = erradas.map((f) => E(texto(f, at), texto(f, at), `é falsa: ${porque(f, v, at)}`));
    return {
      enunciado: `Sabendo que ${descrever(v, at)}, qual das proposições abaixo é verdadeira?`,
      correta: { texto: texto(certa, at), valor: texto(certa, at) }, erros,
      explicacao: `Quando ${descrever(v, at)}, avalia-se cada alternativa. A correta é verdadeira porque ${porque(certa, v, at)}. As outras são falsas: ${erradas.slice(0, 4).map((f) => `“${texto(f, at).replace(/\.$/, '')}” (${porque(f, v, at)})`).join('; ')}.`,
      pegadinha: 'Em uma condicional, só o caso “antecedente verdadeiro e consequente falso” a torna falsa; em “e”, basta uma parte falsa para falsificar; em “ou”, basta uma parte verdadeira para tornar verdadeira.',
      params: { forma: 'valor', at, v, correta: certa, candidatas: erradas, k }, comentarioCorreta: 'Avaliada com os valores dados, é a única verdadeira.',
    };
  }
  throw new Error('não foi possível montar uma questão de valor lógico com uma única verdadeira');
}

Q.CATALOGO.push({
  id: 'RLOG-06-ESTRUTURAS', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: estruturas lógicas (negação, equivalência, valor lógico)',
  gerar(r, n) {
    const opc = { 1: ['neg'], 2: ['neg', 'eq'], 3: ['eq', 'val'], 4: ['val', 'eq'], 5: ['val'] }[n];
    const t = r.pick(opc);
    return t === 'neg' ? gerarNegacao(r, n) : t === 'eq' ? gerarEquivalencia(r, n) : gerarValorLogico(r, n);
  },
  resolver(p) {
    const { k } = p;
    if (p.forma === 'valor') {
      const n = 1 << k; const cheio = (1 << n) - 1;
      let linha = 0; for (let i = 0; i < k; i++) if (p.v[i]) linha |= (1 << (k - 1 - i));
      linha = (n - 1) - linha;                                  // linha 0 = tudo verdadeiro
      const vale = (f) => ((mascara(f, k) & cheio) >> linha) & 1;
      if (!vale(p.correta)) throw new Error('a correta não é verdadeira');
      for (const c of p.candidatas) if (vale(c)) throw new Error('uma errada também é verdadeira');
      return texto(p.correta, p.at);
    }
    const mS = mascara(p.S, k); const cheio = (1 << (1 << k)) - 1;
    const alvo = p.forma === 'negacao' ? (~mS & cheio) : mS;
    if (mascara(p.correta, k) !== alvo) throw new Error('a correta não tem a tabela-verdade esperada');
    for (const c of p.candidatas) if (mascara(c, k) === alvo) throw new Error('uma errada é equivalente à correta (ambíguo)');
    return assinaturaMascara(alvo, k);
  },
});

// =====================================================================================================
// RLOG-07: lógicas de argumentação
// =====================================================================================================
function entende(prems, c, k) {      // gerador: por linhas da tabela-verdade
  let satisfeita = false;
  for (const v of linhasVF(k)) if (prems.every((p) => ev(p, v))) { satisfeita = true; if (!ev(c, v)) return false; }
  return satisfeita;
}
function contraexemplo(prems, c, k) {
  for (const v of linhasVF(k)) if (prems.every((p) => ev(p, v)) && !ev(c, v)) return v;
  return null;
}
function rotuloConclusao(prems, c, k) {
  const s = assinatura(c, k);
  for (const p of prems) {
    if (p.k === 'imp') {
      if (s === assinatura(SE(p.b, p.a), k)) return 'equivale à recíproca de uma das premissas, e a recíproca não decorre da condicional';
    }
  }
  return null;
}
function construirArgumento(r, n) {
  // modos: 'concl' = qual conclusão decorre; 'falta' = qual premissa falta
  const modo = n <= 2 || n === 4 ? 'concl' : 'falta';
  const sinais = [0, 1, 2].map(() => r.int(0, 1) === 1);
  const a = lit(0, sinais[0]); const b = lit(1, sinais[1]); const c = lit(2, sinais[2]);
  let prems; let concl; let regra; let k; let p1; let falta;
  if (modo === 'concl') {
    const opcoes = {
      1: [{ regra: 'modus ponens', k: 2, prems: [SE(a, b), a], concl: b }, { regra: 'modus tollens', k: 2, prems: [SE(a, b), nao(b)], concl: nao(a) }],
      2: [{ regra: 'silogismo disjuntivo', k: 2, prems: [OU(a, b), nao(a)], concl: b }, { regra: 'silogismo hipotético', k: 3, prems: [SE(a, b), SE(b, c)], concl: SE(a, c) }],
      4: [{ regra: 'encadeamento de condicionais (modus ponens duas vezes)', k: 3, prems: [SE(a, b), SE(b, c), a], concl: c },
        { regra: 'encadeamento de condicionais (modus tollens duas vezes)', k: 3, prems: [SE(a, b), SE(b, c), nao(c)], concl: nao(a) },
        { regra: 'silogismo disjuntivo depois de modus tollens', k: 3, prems: [OU(a, b), SE(a, c), nao(c)], concl: b }],
    }[n];
    const o = r.pick(opcoes); ({ regra, k, prems, concl } = o);
  } else {
    const opcoes = {
      3: [{ k: 2, p1: SE(a, b), concl: b, falta: a, regra: 'modus ponens' }, { k: 2, p1: OU(a, b), concl: b, falta: nao(a), regra: 'silogismo disjuntivo' }, { k: 2, p1: SE(a, b), concl: nao(a), falta: nao(b), regra: 'modus tollens' }],
      5: [{ k: 3, p1: SE(a, E_(b, c)), concl: nao(a), falta: nao(b), regra: 'modus tollens com conjunção no consequente' }, { k: 3, p1: SE(OU(a, b), c), concl: nao(a), falta: nao(c), regra: 'modus tollens com disjunção no antecedente' }],
    }[n];
    const o = r.pick(opcoes); ({ k, p1, concl, falta, regra } = o);
  }
  const at = sortearAtomos(r, k);
  const universoK = universo(k);
  const cheio = (1 << (1 << k)) - 1;
  if (modo === 'concl') {
    if (!entende(prems, concl, k)) throw new Error('conclusão canônica não decorre');
    const naoDecorre = universoK.filter((f) => !entende(prems, f, k) && contraexemplo(prems, f, k) !== null);
    const rot = (f) => rotuloConclusao(prems, f, k);
    const comRot = naoDecorre.filter((f) => rot(f)); const sem = r.embaralhar(naoDecorre.filter((f) => !rot(f)));
    const escolhidos = comRot.concat(sem).slice(0, 7);
    const erros = escolhidos.map((f) => { const v = contraexemplo(prems, f, k); return E(assinatura(f, k), texto(f, at), `${rot(f) ? rot(f) + '; ' : ''}não decorre: na situação em que ${descrever(v, at)}, todas as premissas são verdadeiras e esta conclusão é falsa`); });
    const verdadeiras = linhasVF(k).filter((v) => prems.every((pm) => ev(pm, v)));
    const resumo = verdadeiras.length === 1 ? `Há uma única situação em que todas as premissas são verdadeiras: ${descrever(verdadeiras[0], at)}. Nela,`
      : verdadeiras.length <= 3 ? `As premissas são todas verdadeiras só em ${verdadeiras.length} situações (${verdadeiras.map((v) => descrever(v, at)).join('; ou ')}). Em todas elas,`
        : `As premissas são todas verdadeiras em ${verdadeiras.length} das ${1 << k} situações. Em todas elas,`;
    return {
      enunciado: `Considere as premissas:\n${prems.map((pm, i) => `${i + 1}) ${texto(pm, at)}`).join('\n')}\nQual das conclusões abaixo decorre NECESSARIAMENTE dessas premissas?`,
      correta: { texto: texto(concl, at), valor: assinatura(concl, k) }, erros,
      explicacao: `Um argumento é válido quando a conclusão é verdadeira sempre que todas as premissas são verdadeiras. Aqui vale o ${regra}. ${resumo} “${texto(concl, at).replace(/\.$/, '')}” é verdadeira.`,
      pegadinha: 'Não basta a conclusão parecer razoável: ela precisa ser verdadeira em TODAS as situações em que as premissas são verdadeiras. Inverter ou negar uma condicional (recíproca e inversa) não preserva a tabela-verdade.',
      params: { modo, at, premissas: prems, correta: concl, candidatas: naoDecorre, k, regra }, comentarioCorreta: `Decorre das premissas (${regra}).`,
    };
  }
  // modo 'falta': qual proposição, como segunda premissa, torna o argumento válido
  const baseM = mascara(p1, k);
  const valida = (m) => { const pm = baseM & mascara(m, k); return pm !== 0 && (pm & ~mascara(concl, k) & cheio) === 0; };
  const insatisf = (m) => (baseM & mascara(m, k)) === 0;
  if (!valida(falta)) throw new Error('premissa canônica não valida o argumento');
  const eqConcl = assinatura(concl, k);
  const candidatas = universoK.filter((f) => assinatura(f, k) !== eqConcl && !valida(f) && !insatisf(f));
  const rotulo = (f) => {
    const s = assinatura(f, k);
    if (p1.k === 'imp' && s === assinatura(SE(p1.b, p1.a), k)) return 'equivale à recíproca da premissa 1, e ela não leva à conclusão';
    return null;
  };
  const comRot = candidatas.filter((f) => rotulo(f)); const sem = r.embaralhar(candidatas.filter((f) => !rotulo(f)));
  const erros = comRot.concat(sem).slice(0, 7).map((f) => {
    const pm = linhasVF(k).find((v) => ev(p1, v) && ev(f, v) && !ev(concl, v));
    return E(assinatura(f, k), texto(f, at), `${rotulo(f) ? rotulo(f) + '; ' : ''}com ela, o argumento ainda falha: na situação em que ${descrever(pm, at)}, as duas premissas são verdadeiras e a conclusão é falsa`);
  });
  return {
    enunciado: `Considere o argumento:\nPremissa 1: ${texto(p1, at)}\nPremissa 2: ( ? )\nConclusão: ${texto(concl, at)}\nQual das proposições abaixo, colocada como Premissa 2, torna o argumento válido?`,
    correta: { texto: texto(falta, at), valor: assinatura(falta, k) }, erros,
    explicacao: `Um argumento é válido quando a conclusão é verdadeira sempre que todas as premissas são verdadeiras. Com “${texto(falta, at).replace(/\.$/, '')}” como Premissa 2 vale o ${regra}: nas situações em que as duas premissas são verdadeiras, a conclusão também é (conferido pela tabela-verdade).`,
    pegadinha: 'Teste cada alternativa procurando uma situação em que as duas premissas sejam verdadeiras e a conclusão falsa: se existir, o argumento não é válido.',
    params: { modo, at, p1, conclusao: concl, correta: falta, candidatas, k, regra }, comentarioCorreta: `Com ela, o argumento é válido (${regra}).`,
  };
}

Q.CATALOGO.push({
  id: 'RLOG-07-ARGUMENTOS', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: lógicas de argumentação',
  gerar(r, n) { return construirArgumento(r, n); },
  resolver(p) {
    const { k } = p; const cheio = (1 << (1 << k)) - 1;
    if (p.modo === 'concl') {
      const pm = p.premissas.map((f) => mascara(f, k)).reduce((x, y) => x & y, cheio);
      if (pm === 0) throw new Error('premissas inconsistentes');
      const decorre = (c) => (pm & ~mascara(c, k) & cheio) === 0;
      if (!decorre(p.correta)) throw new Error('a correta não decorre das premissas');
      for (const c of p.candidatas) if (decorre(c)) throw new Error('uma errada também decorre (ambíguo)');
      return assinaturaMascara(mascara(p.correta, k), k);
    }
    const base = mascara(p.p1, k); const C = mascara(p.conclusao, k);
    const pm = (m) => base & mascara(m, k);
    if (pm(p.correta) === 0 || (pm(p.correta) & ~C & cheio) !== 0) throw new Error('a correta não valida o argumento');
    for (const c of p.candidatas) {
      if (pm(c) === 0) throw new Error('alternativa que torna as premissas inconsistentes');
      if ((pm(c) & ~C & cheio) === 0) throw new Error('uma errada também valida o argumento (ambíguo)');
    }
    return assinaturaMascara(mascara(p.correta, k), k);
  },
});

// exportado só para os testes e ferramentas
if (typeof module !== 'undefined' && module.exports) module.exports = { ATOMOS, ev, linhasVF, assinatura, mascara, texto, extrapolar, termoSoma2, FORMAS_SEQ };
