'use strict';
/*
 * Modelos de Raciocínio Lógico (Bloco III, 4 questões na prova; tópico OJ26-RLOG-01).
 * Sequências, relações entre conjuntos (diagramas) e ordenação. A unicidade do gabarito é verificada
 * por enumeração exaustiva, e o "segundo método" usa uma semântica diferente da usada para gerar.
 */
const Q = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;
const { fmt, NOMES } = Q;

const E = (valor, texto, porque) => ({ valor, texto, porque });
const num = (v, porque) => E(v, fmt(v), porque);
const lista = (t) => t.map((x) => fmt(x)).join(', ');
const fat = (n) => (n <= 1 ? 1 : n * fat(n - 1));

// ---------- RLOG: sequências ----------
Q.CATALOGO.push({
  id: 'RLOG-01-SEQUENCIAS', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: sequências',
  gerar(r, n) {
    let termos = []; let ok; let erros; let expl; let pega; let params; let enunciado;
    if (n === 1) {
      const a = r.int(-5, 20); const d = r.pick([3, 4, 5, 6, 7, 8, 9, -3, -4]);
      termos = [0, 1, 2, 3, 4].map((i) => a + i * d); ok = a + 5 * d; const last = termos[4];
      enunciado = `Observe a sequência: ${lista(termos)}, ... Qual é o próximo termo?`;
      expl = `A diferença entre termos consecutivos é sempre ${fmt(d)} (${fmt(termos[1])} − ${fmt(termos[0])} = ${fmt(d)}). Então o próximo é ${fmt(last)} ${d >= 0 ? '+' : '−'} ${fmt(Math.abs(d))} = ${fmt(ok)}.`;
      pega = 'Confira a diferença em TODOS os pares de termos vizinhos antes de afirmar que é uma progressão aritmética.';
      erros = [num(last + d + 1, 'somou uma unidade a mais que a diferença'), num(last + d - 1, 'somou uma unidade a menos que a diferença'), num(last + 2 * d, 'pulou um termo da sequência'), num(last * 2, 'dobrou o último termo'), num(last, 'repetiu o último termo')];
      params = { f: 1, a, d };
    } else if (n === 2) {
      const a = r.pick([1, 2, 3, 4, 5]); const q = r.pick([2, 3]);
      termos = [0, 1, 2, 3, 4].map((i) => a * q ** i); ok = a * q ** 5; const last = termos[4];
      enunciado = `Observe a sequência: ${lista(termos)}, ... Qual é o próximo termo?`;
      expl = `Cada termo é o anterior multiplicado por ${q} (${fmt(termos[1])} ÷ ${fmt(termos[0])} = ${q}). O próximo é ${fmt(last)} × ${q} = ${fmt(ok)}.`;
      pega = 'Quando os termos crescem cada vez mais depressa, a regra é multiplicação (razão), não soma de uma diferença fixa.';
      erros = [num(last + q, `somou ${q} em vez de multiplicar`), num(last * (q + 1), `multiplicou por ${q + 1} em vez de ${q}`), num(last + (last - termos[3]), 'repetiu a última diferença (tratou como soma)'), num(last * q * q, 'pulou um termo'), num(last * q + q, 'multiplicou e somou')];
      params = { f: 2, a, q };
    } else if (n === 3) {
      const a = r.int(1, 10); const b = r.int(20, 40); const d1 = r.int(2, 6); const d2 = r.pick([-2, -3, -4, 5, 7]);
      termos = [a, b, a + d1, b + d2, a + 2 * d1, b + 2 * d2]; ok = a + 3 * d1;
      enunciado = `Observe a sequência: ${lista(termos)}, ... Qual é o sétimo termo?`;
      expl = `Há duas sequências intercaladas. Nas posições ímpares (1.ª, 3.ª, 5.ª): ${fmt(a)}, ${fmt(a + d1)}, ${fmt(a + 2 * d1)}, que aumentam ${fmt(d1)} a cada passo. Nas pares: ${fmt(b)}, ${fmt(b + d2)}, ${fmt(b + 2 * d2)}. O 7.º termo é o próximo das ímpares: ${fmt(a + 2 * d1)} + ${fmt(d1)} = ${fmt(ok)}.`;
      pega = 'Quando os termos vizinhos não seguem uma regra única, separe as posições ímpares e pares: são duas sequências misturadas.';
      erros = [num(a + 2 * d1 + d2, 'aplicou a variação das posições pares a uma posição ímpar'), num(b + 2 * d2 + d1, 'continuou a sequência das pares com a regra das ímpares'), num(b + 3 * d2, 'respondeu o próximo termo das posições pares (o 8.º)'), num(a + 2 * d1 + d1 + d2, 'somou as duas variações'), num(a + 4 * d1, 'pulou um termo das ímpares')];
      params = { f: 3, a, d1 };
    } else if (n === 4) {
      const a = r.int(1, 10); const d = r.int(1, 4); const c = r.int(1, 3);
      termos = [a]; for (let i = 1; i <= 4; i++) termos.push(termos[i - 1] + d + (i - 1) * c);
      ok = termos[4] + d + 4 * c;
      enunciado = `Observe a sequência: ${lista(termos)}, ... Qual é o próximo termo?`;
      const difs = termos.slice(1).map((t, i) => t - termos[i]);
      expl = `As diferenças entre termos vizinhos são ${lista(difs)}: elas mesmas aumentam ${c} a cada passo. A próxima diferença é ${fmt(difs[3] + c)}, e o próximo termo é ${fmt(termos[4])} + ${fmt(difs[3] + c)} = ${fmt(ok)}.`;
      pega = 'Se as diferenças não são constantes, calcule as diferenças das diferenças: a regra pode estar no crescimento delas.';
      erros = [num(termos[4] + difs[3], 'repetiu a última diferença'), num(termos[4] + difs[3] + 2 * c, 'aumentou a diferença duas vezes'), num(termos[4] + d, 'usou a primeira diferença'), num(termos[4] * 2 - termos[3], 'repetiu a última diferença (por reflexo)'), num(termos[4] + difs[3] + c + 1, 'somou uma unidade a mais')];
      params = { f: 4, a, d, c };
    } else {
      const m = r.pick([2, 3]); const c = r.pick([-2, -1, 1, 2, 3]); const a = r.int(1, 5);
      termos = [a]; for (let i = 1; i < 5; i++) termos.push(m * termos[i - 1] + c);
      ok = m * termos[4] + c;
      enunciado = `Observe a sequência: ${lista(termos)}, ... Qual é o próximo termo?`;
      expl = `Cada termo é o anterior multiplicado por ${m} ${c >= 0 ? 'mais' : 'menos'} ${fmt(Math.abs(c))}: ${fmt(termos[0])} × ${m} ${c >= 0 ? '+' : '−'} ${fmt(Math.abs(c))} = ${fmt(termos[1])}, e assim por diante. O próximo é ${fmt(termos[4])} × ${m} ${c >= 0 ? '+' : '−'} ${fmt(Math.abs(c))} = ${fmt(ok)}.`;
      pega = 'Algumas sequências combinam duas operações (multiplicar e depois somar). Teste a regra em todos os pares, não só no primeiro.';
      erros = [num(termos[4] + (termos[4] - termos[3]), 'tratou como soma de uma diferença fixa'), num(m * termos[4], 'esqueceu de somar a constante'), num(m * termos[4] - c, 'trocou o sinal da constante'), num(termos[4] + c, `somou só a constante (${fmt(c)})`), num((m + 1) * termos[4] + c, 'usou o multiplicador errado')];
      params = { f: 5, a, m, c };
    }
    return { enunciado, correta: { texto: fmt(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Próximo termo: ' + fmt(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) return p.a + 5 * p.d;
    if (p.f === 2) return p.a * Math.pow(p.q, 5);
    if (p.f === 3) return p.a + 3 * p.d1;
    if (p.f === 4) return p.a + 5 * p.d + p.c * 10;
    const k = p.c / (p.m - 1);
    return Math.pow(p.m, 5) * (p.a + k) - k;
  },
});

// ---------- RLOG: relações entre conjuntos (diagramas) ----------
const REGIOES = [1, 2, 3, 4, 5, 6, 7];            // bit i da região = pertence ao conjunto i
const MODELOS = 128;                              // cada modelo: quais regiões 1..7 têm elementos
const PARES = []; for (let s = 0; s < 3; s++) for (let p = 0; p < 3; p++) if (s !== p) PARES.push([s, p]);
const TIPOS = ['A', 'E', 'I', 'O'];
const todasAfirmacoes = () => { const l = []; for (const t of TIPOS) for (const [s, p] of PARES) l.push({ t, s, p }); return l; };
const mesma = (x, y) => x.t === y.t && x.s === y.s && x.p === y.p;
function satisfaz(model, st) {
  const tem = (reg) => ((model >> (reg - 1)) & 1) === 1;
  const noS = (reg) => ((reg >> st.s) & 1) === 1; const noP = (reg) => ((reg >> st.p) & 1) === 1;
  if (st.t === 'A') return !REGIOES.some((g) => tem(g) && noS(g) && !noP(g));
  if (st.t === 'E') return !REGIOES.some((g) => tem(g) && noS(g) && noP(g));
  if (st.t === 'I') return REGIOES.some((g) => tem(g) && noS(g) && noP(g));
  return REGIOES.some((g) => tem(g) && noS(g) && !noP(g));
}
const frase = (nomes, st) => (st.t === 'A' ? `Todo ${nomes[st.s]} é ${nomes[st.p]}.` : st.t === 'E' ? `Nenhum ${nomes[st.s]} é ${nomes[st.p]}.`
  : st.t === 'I' ? `Algum ${nomes[st.s]} é ${nomes[st.p]}.` : `Algum ${nomes[st.s]} não é ${nomes[st.p]}.`);
// Substantivos e adjetivos no masculino SINGULAR: as frases usam "Todo/Algum/Nenhum X é Y".
const GRUPOS = [['engenheiro', 'pontual', 'corredor'], ['professor', 'paciente', 'músico'], ['servidor', 'atento', 'leitor'],
  ['advogado', 'organizado', 'viajante'], ['médico', 'atleta', 'estudioso'], ['jardineiro', 'cozinheiro', 'colecionador']];

Q.CATALOGO.push({
  id: 'RLOG-02-CONJUNTOS', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: relações entre conjuntos',
  aposentado: 'RLOG-05-DIAGRAMAS',   // aceitava premissas que forçam conjunto vazio; mantido só para reproduzir o histórico (gerador intocado)
  gerar(r, n) {
    const nomes = r.pick(GRUPOS);
    const np = n <= 2 ? 2 : 3;
    for (let tent = 0; tent < 400; tent++) {
      const premissas = [];
      for (let i = 0; i < np; i++) {
        const [s, p] = r.pick(PARES);
        const st = { t: r.pick(n <= 2 ? ['A', 'A', 'E', 'I'] : TIPOS), s, p };
        if (!premissas.some((x) => mesma(x, st))) premissas.push(st);
      }
      if (premissas.length < np) continue;
      const modelos = []; for (let m = 0; m < MODELOS; m++) if (premissas.every((p) => satisfaz(m, p))) modelos.push(m);
      if (modelos.length === 0 || modelos.length === MODELOS) continue;
      const pool = todasAfirmacoes();
      const equivAPremissa = (c) => premissas.some((p) => { for (let m = 0; m < MODELOS; m++) if (satisfaz(m, p) !== satisfaz(m, c)) return false; return true; });
      const decorre = (c) => modelos.every((m) => satisfaz(m, c));
      const entailed = pool.filter((c) => decorre(c) && !equivAPremissa(c));
      const naoDecorre = pool.filter((c) => !decorre(c));
      if (entailed.length === 0 || naoDecorre.length < 4) continue;
      const correta = r.pick(entailed);
      const erros = naoDecorre.map((c) => {
        const algum = modelos.some((m) => satisfaz(m, c));
        return E(frase(nomes, c), frase(nomes, c), algum ? 'pode ser verdadeira, mas não é obrigatória: existe uma configuração compatível com as premissas em que ela é falsa' : 'contradiz as premissas: é falsa em todas as configurações compatíveis com elas');
      });
      const enunciado = `Considere as premissas:\n${premissas.map((p, i) => `${i + 1}) ${frase(nomes, p)}`).join('\n')}\nQual das afirmações abaixo decorre NECESSARIAMENTE dessas premissas?`;
      return {
        enunciado,
        correta: { texto: frase(nomes, correta), valor: frase(nomes, correta) },
        erros,
        explicacao: `Uma afirmação decorre das premissas só se for verdadeira em TODAS as formas de desenhar os diagramas compatíveis com elas. "Todo A é B" apaga a parte de A fora de B; "Nenhum A é B" apaga a interseção; "Algum A é B" garante pelo menos um elemento ali. Testadas as ${modelos.length} configurações possíveis, só "${frase(nomes, correta)}" vale em todas.`,
        pegadinha: 'Ser possível não é ser obrigatório: três das opções podem até ocorrer em algum diagrama, mas só a correta vale em todos os diagramas compatíveis com as premissas.',
        params: { nomes, premissas, correta, candidatas: naoDecorre }, comentarioCorreta: 'Vale em todas as ' + modelos.length + ' configurações compatíveis com as premissas.',
      };
    }
    throw new Error('não foi possível montar premissas com exatamente uma conclusão necessária');
  },
  resolver(p) {
    // Segundo método: modelos com 5 indivíduos, cada um em uma das 8 regiões (semântica por elementos).
    const holds = (ind, st) => {
      const noS = (g) => ((g >> st.s) & 1) === 1; const noP = (g) => ((g >> st.p) & 1) === 1;
      if (st.t === 'A') return ind.every((g) => !noS(g) || noP(g));
      if (st.t === 'E') return ind.every((g) => !(noS(g) && noP(g)));
      if (st.t === 'I') return ind.some((g) => noS(g) && noP(g));
      return ind.some((g) => noS(g) && !noP(g));
    };
    const total = Math.pow(8, 5);
    const modelosOk = [];
    for (let i = 0; i < total; i++) {
      const ind = []; let x = i; for (let k = 0; k < 5; k++) { ind.push(x % 8); x = Math.floor(x / 8); }
      if (p.premissas.every((pr) => holds(ind, pr))) modelosOk.push(ind);
    }
    if (modelosOk.length === 0) throw new Error('premissas insatisfatíveis');
    const decorre = (c) => modelosOk.every((ind) => holds(ind, c));
    if (!decorre(p.correta)) throw new Error('a correta não decorre das premissas (segundo método)');
    for (const c of p.candidatas) if (decorre(c)) throw new Error('uma alternativa errada também decorre das premissas (gabarito ambíguo)');
    return frase(p.nomes, p.correta);
  },
});

// ---------- RLOG: ordenação em fila ----------
function permutar(l) {
  if (l.length <= 1) return [l.slice()];
  const out = [];
  l.forEach((x, i) => { const resto = l.slice(0, i).concat(l.slice(i + 1)); for (const p of permutar(resto)) out.push([x].concat(p)); });
  return out;
}
function verdadeira(posDe, c) {
  switch (c.t) {
    case 'antes': return posDe[c.a] < posDe[c.b];
    case 'logoAtras': return posDe[c.b] === posDe[c.a] + 1;
    case 'naoPos': return posDe[c.a] !== c.p;
    case 'pos': return posDe[c.a] === c.p;
    case 'entre': return (posDe[c.a] < posDe[c.b] && posDe[c.b] < posDe[c.c]) || (posDe[c.c] < posDe[c.b] && posDe[c.b] < posDe[c.a]);
    default: return Math.abs(posDe[c.a] - posDe[c.b]) !== 1;
  }
}
const textoPista = (nomes, c) => {
  if (c.t === 'antes') return `${nomes[c.a]} está na fila antes de ${nomes[c.b]}.`;
  if (c.t === 'logoAtras') return `${nomes[c.b]} está imediatamente atrás de ${nomes[c.a]}.`;
  if (c.t === 'naoPos') return `${nomes[c.a]} não é o ${c.p + 1}º da fila.`;
  if (c.t === 'pos') return `${nomes[c.a]} é o ${c.p + 1}º da fila.`;
  if (c.t === 'entre') return `${nomes[c.b]} está entre ${nomes[c.a]} e ${nomes[c.c]} (não necessariamente juntos).`;
  return `${nomes[c.a]} e ${nomes[c.b]} não estão lado a lado.`;
};

Q.CATALOGO.push({
  id: 'RLOG-03-ORDENACAO', topicId: 'OJ26-RLOG-01', disciplina: 'RLOG', titulo: 'Raciocínio lógico: ordenação em fila',
  gerar(r, n) {
    const m = n <= 2 ? 4 : 5;
    const nomes = r.embaralhar(NOMES).slice(0, m);
    const idx = [...Array(m).keys()];
    const perms = permutar(idx);                       // perms[k][pos] = pessoa
    const posDeDe = (ordem) => { const pd = []; ordem.forEach((pessoa, pos) => { pd[pessoa] = pos; }); return pd; };
    const permsPosDe = perms.map(posDeDe);
    const tipos = n <= 2 ? ['antes', 'logoAtras', 'pos', 'naoPos'] : ['antes', 'logoAtras', 'pos', 'naoPos', 'entre', 'naoAdj'];
    const limite = m === 4 ? 5 : 7;
    for (let tent = 0; tent < 400; tent++) {
      const alvo = r.pick(perms); const pd = posDeDe(alvo);
      const pool = [];
      for (const t of tipos) {
        if (t === 'antes' || t === 'logoAtras' || t === 'naoAdj') { for (const a of idx) for (const b of idx) if (a !== b) { const c = { t, a, b }; if (verdadeira(pd, c)) pool.push(c); } }
        else if (t === 'pos' || t === 'naoPos') { for (const a of idx) for (let p = 0; p < m; p++) { const c = { t, a, p }; if (verdadeira(pd, c)) pool.push(c); } }
        else { for (const a of idx) for (const b of idx) for (const c3 of idx) if (a !== b && b !== c3 && a !== c3 && a < c3) { const c = { t, a, b, c: c3 }; if (verdadeira(pd, c)) pool.push(c); } }
      }
      const emb = r.embaralhar(pool);
      const pistas = []; let vivos = permsPosDe.slice();
      for (const c of emb) {
        if (pistas.length >= limite) break;
        const novos = vivos.filter((x) => verdadeira(x, c));
        if (novos.length === vivos.length) continue;      // pista que não elimina nada
        pistas.push(c); vivos = novos;
        if (vivos.length === 1) break;
      }
      if (vivos.length !== 1) continue;
      const livres = idx.map((i) => i).filter((p) => !pistas.some((c) => c.t === 'pos' && c.p === p));
      if (!livres.length) continue;
      const p = r.pick(livres);
      const ok = nomes[alvo[p]];
      const enunciado = `${m} pessoas estão em uma fila, da 1ª à ${m}ª posição. Pistas:\n${pistas.map((c, i) => `${i + 1}) ${textoPista(nomes, c)}`).join('\n')}\nQuem ocupa a ${p + 1}ª posição?`;
      const erros = nomes.filter((x) => x !== ok).map((x) => E(x, x, `com ${x} na ${p + 1}ª posição, nenhuma ordem satisfaz todas as pistas (conferido testando as ${fat(m)} ordens possíveis)`));
      erros.push(E('Não é possível determinar', 'Não é possível determinar', 'as pistas determinam uma única ordem, então é possível descobrir quem ocupa essa posição'));
      return {
        enunciado, correta: { texto: ok, valor: ok }, erros,
        explicacao: `Testando as ${fat(m)} ordens possíveis, só uma satisfaz todas as pistas: ${alvo.map((q) => nomes[q]).join(' → ')} (da 1ª à ${m}ª posição). Logo, ${ok} ocupa a ${p + 1}ª posição.`,
        pegadinha: 'Pistas do tipo "antes de" ou "não é o" só ELIMINAM possibilidades: é preciso combinar todas até sobrar uma única ordem, e não parar na primeira que parece resolver.',
        params: { nomes, pistas, p, m }, comentarioCorreta: ok + ' ocupa a ' + (p + 1) + 'ª posição.',
      };
    }
    throw new Error('não foi possível montar pistas com solução única');
  },
  resolver(pr) {
    // Segundo método: busca com retrocesso, posição a posição, com outra codificação das pistas.
    const { nomes, pistas, m } = pr;
    const ord = new Array(m).fill(-1);
    let achadas = 0; let resposta = null;
    const checa = (c, lugar) => {
      const L = (x) => lugar[x];
      if (c.t === 'antes') return L(c.b) - L(c.a) > 0;
      if (c.t === 'logoAtras') return L(c.b) - L(c.a) === 1;
      if (c.t === 'naoPos') return L(c.a) !== c.p;
      if (c.t === 'pos') return L(c.a) === c.p;
      if (c.t === 'entre') return (L(c.b) - L(c.a)) * (L(c.c) - L(c.b)) > 0;
      return Math.abs(L(c.a) - L(c.b)) > 1;
    };
    const usado = new Array(m).fill(false);
    (function busca(pos) {
      if (pos === m) {
        const lugar = []; ord.forEach((pessoa, i) => { lugar[pessoa] = i; });
        if (pistas.every((c) => checa(c, lugar))) { achadas++; resposta = nomes[ord[pr.p]]; }
        return;
      }
      for (let pessoa = 0; pessoa < m; pessoa++) { if (usado[pessoa]) continue; usado[pessoa] = true; ord[pos] = pessoa; busca(pos + 1); usado[pessoa] = false; }
    })(0);
    if (achadas !== 1) throw new Error('as pistas não determinam uma única ordem (' + achadas + ')');
    return resposta;
  },
});
