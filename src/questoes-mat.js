'use strict';
/*
 * Modelos de questões de Matemática (Bloco III, 3 questões na prova). Um modelo por tópico do edital (OJ26-MAT-01 a 13).
 * Cada modelo: gerar(rng, nível) devolve enunciado, resposta, erros comuns (valor + motivo calculado), explicação e pegadinha;
 * resolver(params) recalcula a resposta por OUTRO método (busca, laço, outra fórmula) para conferência.
 */
const Q = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;
const { fmt, brl, F, fadd, fsub, fmul, fdiv, fval, ftxt, mdc, mmc, NOMES } = Q;

const E = (valor, texto, porque) => ({ valor, texto, porque });
const num = (v, porque, f) => E(v, (f || fmt)(v), porque);
const pctTxt = (v) => fmt(v) + '%';
const div = (n) => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };
function fatores(n) {
  const out = []; let x = n;
  for (let p = 2; p * p <= x; p++) { let e = 0; while (x % p === 0) { x /= p; e++; } if (e) out.push(p + (e > 1 ? '^' + e : '')); }
  if (x > 1) out.push(String(x));
  return out.join(' × ');
}

// ---------- MAT-01: operações com números reais (frações) ----------
Q.CATALOGO.push({
  id: 'MAT-01-FRACOES', topicId: 'OJ26-MAT-01', disciplina: 'MAT', titulo: 'Operações com números reais (frações)',
  gerar(r, n) {
    const mk = () => F(r.int(1, 2 + n), r.int(2, 4 + n));
    let a = mk(); let b = mk(); const c = mk(); const k = r.int(2, 6);
    const ef = (x, porque) => E(fval(x), ftxt(x), porque);
    let enunciado; let ok; let erros; let expl; let pega; let params;
    if (n === 1) {
      ok = fadd(a, b);
      const m = mmc(a.q, b.q);
      enunciado = `Calcule ${ftxt(a)} + ${ftxt(b)}.`;
      expl = `Iguale os denominadores: MMC(${a.q}, ${b.q}) = ${m}. Então ${ftxt(a)} = ${a.p * m / a.q}/${m} e ${ftxt(b)} = ${b.p * m / b.q}/${m}. Somando os numeradores: ${a.p * m / a.q + b.p * m / b.q}/${m}, que simplificado dá ${ftxt(ok)}.`;
      pega = 'Somar numerador com numerador e denominador com denominador não é o procedimento correto: só se somam os numeradores depois de igualar os denominadores.';
      erros = [ef(F(a.p + b.p, a.q + b.q), 'somou numeradores com numeradores e denominadores com denominadores'), ef(fmul(a, b), 'multiplicou as frações em vez de somá-las'),
        ef(fsub(a, b), 'subtraiu em vez de somar'), ef(F(a.p + b.p, a.q * b.q), 'somou os numeradores e multiplicou os denominadores sem igualar as frações'),
        ef(F(a.p + b.p, Math.max(a.q, b.q)), 'somou os numeradores e manteve o maior denominador sem igualar as frações')];
      params = { op: '+', a: [a.p, a.q], b: [b.p, b.q] };
    } else if (n === 2) {
      if (fval(a) < fval(b)) { const t = a; a = b; b = t; }
      ok = fsub(a, b);
      const m = mmc(a.q, b.q);
      enunciado = `Calcule ${ftxt(a)} − ${ftxt(b)}.`;
      expl = `Com denominador comum ${m}: ${ftxt(a)} = ${a.p * m / a.q}/${m} e ${ftxt(b)} = ${b.p * m / b.q}/${m}. Subtraindo os numeradores: ${a.p * m / a.q - b.p * m / b.q}/${m} = ${ftxt(ok)}.`;
      pega = 'Subtrair numeradores e denominadores separadamente (a−c)/(b−d) está errado; é preciso igualar os denominadores primeiro.';
      erros = [ef(F(a.p - b.p, a.q - b.q === 0 ? 1 : a.q - b.q), 'subtraiu numeradores e denominadores separadamente'), ef(fadd(a, b), 'somou em vez de subtrair'),
        ef(fmul(a, b), 'multiplicou em vez de subtrair'), ef(fsub(b, a), 'inverteu a ordem da subtração'), ef(F(a.p - b.p, Math.max(a.q, b.q)), 'subtraiu os numeradores e manteve o maior denominador')];
      params = { op: '-', a: [a.p, a.q], b: [b.p, b.q] };
    } else if (n === 3) {
      ok = fdiv(a, b);
      enunciado = `Calcule ${ftxt(a)} ÷ ${ftxt(b)}.`;
      expl = `Dividir por uma fração é multiplicar pelo inverso dela: ${ftxt(a)} ÷ ${ftxt(b)} = ${ftxt(a)} × ${b.q}/${b.p} = ${a.p * b.q}/${a.q * b.p}, que simplificado é ${ftxt(ok)}.`;
      pega = 'É a segunda fração (o divisor) que se inverte. Inverter a primeira, ou não inverter nenhuma, dá outro resultado.';
      erros = [ef(fmul(a, b), 'multiplicou sem inverter o divisor'), ef(fdiv(b, a), 'dividiu na ordem trocada (b ÷ a)'), ef(fmul(F(a.q, a.p), b), 'inverteu a primeira fração em vez do divisor'),
        ef(fadd(a, b), 'somou as frações'), ef(fsub(a, b), 'subtraiu as frações')];
      params = { op: '/', a: [a.p, a.q], b: [b.p, b.q] };
    } else if (n === 4) {
      ok = fmul(fadd(a, b), F(k, 1));
      enunciado = `Calcule (${ftxt(a)} + ${ftxt(b)}) × ${k}.`;
      expl = `Primeiro o parêntese: ${ftxt(a)} + ${ftxt(b)} = ${ftxt(fadd(a, b))}. Depois multiplique por ${k}: ${ftxt(fadd(a, b))} × ${k} = ${ftxt(ok)}.`;
      pega = 'Os parênteses mandam: a soma é feita antes da multiplicação. Multiplicar só a segunda fração por k muda o resultado.';
      erros = [ef(fadd(a, fmul(b, F(k, 1))), `multiplicou só a segunda fração por ${k}, ignorando o parêntese`), ef(fadd(fadd(a, b), F(k, 1)), `somou ${k} em vez de multiplicar`),
        ef(fadd(fmul(a, F(k, 1)), b), `multiplicou só a primeira fração por ${k}`), ef(fdiv(fadd(a, b), F(k, 1)), `dividiu por ${k} em vez de multiplicar`),
        ef(fmul(F(a.p + b.p, a.q + b.q), F(k, 1)), 'somou numeradores e denominadores separadamente antes de multiplicar')];
      params = { op: 'pk', a: [a.p, a.q], b: [b.p, b.q], k };
    } else {
      if (fval(a) < fval(b)) { const t = a; a = b; b = t; }
      ok = fadd(fdiv(fsub(a, b), c), F(k, 1));
      enunciado = `Calcule (${ftxt(a)} − ${ftxt(b)}) ÷ ${ftxt(c)} + ${k}.`;
      expl = `Parêntese: ${ftxt(a)} − ${ftxt(b)} = ${ftxt(fsub(a, b))}. Divisão (multiplicar pelo inverso): ${ftxt(fsub(a, b))} ÷ ${ftxt(c)} = ${ftxt(fdiv(fsub(a, b), c))}. Soma final com ${k}: ${ftxt(ok)}.`;
      pega = 'Ordem das operações: parênteses, depois divisão, e só no fim a soma. Somar o inteiro antes de dividir muda o resultado.';
      erros = [ef(fsub(fadd(a, F(k, 1)), fdiv(b, c)), 'ignorou o parêntese e a precedência da divisão'), ef(fadd(fmul(fsub(a, b), c), F(k, 1)), 'multiplicou em vez de dividir'),
        ef(fsub(fdiv(fsub(a, b), c), F(k, 1)), `subtraiu ${k} em vez de somar`), ef(fdiv(fadd(fsub(a, b), F(k, 1)), c), `somou ${k} antes de dividir`),
        ef(fadd(fdiv(fsub(a, b), F(c.q, c.p)), F(k, 1)), 'dividiu pelo inverso de c (multiplicou) em vez de dividir por c')];
      params = { op: 'dk', a: [a.p, a.q], b: [b.p, b.q], c: [c.p, c.q], k };
    }
    return { enunciado, correta: { texto: ftxt(ok), valor: fval(ok) }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + ftxt(ok) + '.' };
  },
  resolver(p) {
    const v = (x) => x[0] / x[1];
    if (p.op === '+') return v(p.a) + v(p.b);
    if (p.op === '-') return v(p.a) - v(p.b);
    if (p.op === '/') return v(p.a) / v(p.b);
    if (p.op === 'pk') return (v(p.a) + v(p.b)) * p.k;
    return (v(p.a) - v(p.b)) / v(p.c) + p.k;
  },
});

// ---------- MAT-02: MMC e MDC ----------
Q.CATALOGO.push({
  id: 'MAT-02-MMC-MDC', topicId: 'OJ26-MAT-02', disciplina: 'MAT', titulo: 'MMC e MDC',
  gerar(r, n) {
    const g = r.int(2, 7);
    const tres = n >= 4;
    const quer = n <= 2 ? 'mmc' : n === 3 ? 'mdc' : r.pick(['mmc', 'mdc']);
    let xs;
    for (let i = 0; i < 12; i++) { xs = [g * r.int(2, 7), g * r.int(2, 7)]; if (tres) xs.push(g * r.int(2, 7)); if (new Set(xs).size === xs.length) break; }
    if (new Set(xs).size !== xs.length) xs = tres ? [g * 3, g * 4, g * 5] : [g * 4, g * 6];
    const rm = xs.reduce((a, b) => mmc(a, b)); const rd = xs.reduce((a, b) => mdc(a, b));
    const lista = xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
    let enunciado; let ok; let erros; let expl; let pega;
    if (quer === 'mmc') {
      ok = rm;
      enunciado = tres ? `Três sinais luminosos piscam a cada ${lista} segundos, respectivamente. Se acabaram de piscar juntos, depois de quantos segundos piscarão juntos novamente pela primeira vez?`
        : `Duas luzes piscam, uma a cada ${xs[0]} segundos e outra a cada ${xs[1]} segundos. Se acabaram de piscar juntas, depois de quantos segundos piscarão juntas novamente pela primeira vez?`;
      expl = `Quando coincidem de novo é o menor múltiplo comum. Fatorando: ${xs.map((x) => x + ' = ' + fatores(x)).join('; ')}. O MMC usa cada fator com o maior expoente e vale ${ok}.`;
      pega = 'Coincidir de novo é MMC (menor múltiplo comum). MDC responde a perguntas de divisão em partes iguais sem sobra.';
      erros = [num(rd, 'calculou o MDC em vez do MMC'), num(xs.reduce((a, b) => a * b, 1), 'multiplicou os números (produto não é o menor múltiplo comum)'), num(xs.reduce((a, b) => a + b, 0), 'somou os números'),
        num(Math.max(...xs), 'tomou o maior dos números'), num(Math.min(...xs), 'tomou o menor dos números')];
      if (tres) erros.push(num(mmc(xs[0], xs[1]), 'calculou o MMC de apenas dois dos números'));
    } else {
      ok = rd;
      enunciado = tres ? `Três cordas medem ${lista} metros e serão cortadas em pedaços de mesmo comprimento, o maior possível, sem sobras. Qual é o comprimento, em metros, de cada pedaço?`
        : `Duas fitas medem ${xs[0]} cm e ${xs[1]} cm e serão cortadas em pedaços de mesmo comprimento, o maior possível, sem sobras. Qual é o comprimento, em cm, de cada pedaço?`;
      expl = `Dividir em partes iguais, a maior possível e sem sobra, é o máximo divisor comum. Fatorando: ${xs.map((x) => x + ' = ' + fatores(x)).join('; ')}. O MDC usa só os fatores comuns, com o menor expoente, e vale ${ok}.`;
      pega = 'Maior pedaço igual e sem sobra é MDC. O MMC cresce (é múltiplo); o MDC divide (é divisor de todos).';
      erros = [num(rm, 'calculou o MMC em vez do MDC'), num(xs.reduce((a, b) => a * b, 1), 'multiplicou os números'), num(xs.reduce((a, b) => a + b, 0), 'somou os números'),
        num(Math.min(...xs), 'tomou o menor dos números (nem sempre divide os outros)'), num(Math.abs(xs[0] - xs[1]), 'usou a diferença entre os dois primeiros números')];
    }
    return { enunciado, correta: { texto: fmt(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params: { quer, xs }, comentarioCorreta: `${quer === 'mmc' ? 'MMC' : 'MDC'} = ${ok}.` };
  },
  resolver(p) {
    if (p.quer === 'mmc') { for (let t = Math.max(...p.xs); t < 2e6; t++) if (p.xs.every((x) => t % x === 0)) return t; throw new Error('sem MMC'); }
    for (let d = Math.min(...p.xs); d >= 1; d--) if (p.xs.every((x) => x % d === 0)) return d;
    throw new Error('sem MDC');
  },
});

// ---------- MAT-03: razão e proporção ----------
Q.CATALOGO.push({
  id: 'MAT-03-PROPORCAO', topicId: 'OJ26-MAT-03', disciplina: 'MAT', titulo: 'Razão e proporção',
  gerar(r, n) {
    const m = n <= 2 ? 2 : 3;
    const partes = m === 2 ? [r.int(1, 5), r.int(2, 7)] : [r.int(1, 4), r.int(2, 6), r.int(3, 8)];
    const S = partes.reduce((a, b) => a + b, 0);
    const k = r.int(2, 12) * 10;
    const V = k * S;
    const t = r.int(0, m - 1);
    const socios = r.embaralhar(NOMES).slice(0, m);
    const ok = partes[t] * k;
    const enunciado = `${socios.slice(0, -1).join(', ')} e ${socios[m - 1]} abriram uma sociedade com investimentos nas proporções ${partes.join(' : ')}, respectivamente. O lucro foi de ${brl(V)}, dividido na mesma proporção. Quanto coube a ${socios[t]}?`;
    const erros = [num(V / m, 'dividiu o lucro igualmente entre os sócios', brl), num(V / partes[t], 'dividiu o lucro total pela razão do sócio', brl), num(V * partes[t] / (S - partes[t]), 'dividiu pela soma das partes dos OUTROS sócios', brl)];
    partes.forEach((p, j) => { if (j !== t) erros.push(num(p * k, `calculou a parte de ${socios[j]}, e não a de ${socios[t]}`, brl)); });
    return {
      enunciado, correta: { texto: brl(ok), valor: ok }, erros,
      explicacao: `Some as partes da razão: ${partes.join(' + ')} = ${S}. Cada parte vale ${brl(V)} ÷ ${S} = ${brl(k)}. ${socios[t]} tem ${partes[t]} partes: ${partes[t]} × ${brl(k)} = ${brl(ok)}.`,
      pegadinha: 'Em partilha proporcional, divide-se o total pela SOMA das partes (valor de cada parte) e depois multiplica-se pela parte de quem se pergunta.',
      params: { partes, V, t }, comentarioCorreta: `${partes[t]} partes de ${brl(k)}.`,
    };
  },
  resolver(p) {
    const S = p.partes.reduce((a, b) => a + b, 0);
    for (let kk = 1; kk <= p.V; kk++) if (kk * S === p.V) return p.partes[p.t] * kk;
    throw new Error('sem solução');
  },
});

// ---------- MAT-04: porcentagem ----------
Q.CATALOGO.push({
  id: 'MAT-04-PORCENTAGEM', topicId: 'OJ26-MAT-04', disciplina: 'MAT', titulo: 'Porcentagem',
  gerar(r, n) {
    const P = r.int(2, 20) * 100;
    const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50]);
    const q = r.pick([5, 10, 15, 20, 25, 30]);
    let enunciado; let ok; let erros; let expl; let pega; let params; let fm = fmt;
    if (n === 1) {
      const V = r.int(2, 30) * 20;
      ok = V * p / 100;
      enunciado = `Quanto é ${p}% de ${fmt(V)}?`;
      expl = `${p}% é ${p}/100. Então ${p}/100 × ${fmt(V)} = ${fmt(ok)}.`;
      pega = 'Por cento significa "por cem": divida por 100. Deslocar a vírgula duas casas para a esquerda equivale a dividir por 100.';
      erros = [num(V * p / 10, 'dividiu por 10 em vez de por 100 (vírgula na casa errada)'), num(V - ok, `calculou o que sobra depois de tirar ${p}%`), num(V + ok, `somou ${p}% ao valor`),
        num(V * p, 'multiplicou pelo percentual sem dividir por 100'), num(V / p, 'dividiu o valor pelo percentual')];
      params = { f: 1, V, p };
    } else if (n === 2) {
      ok = P * (100 - p) / 100; fm = brl;
      enunciado = `Um produto custa ${brl(P)} e está com ${p}% de desconto. Quanto se paga por ele?`;
      expl = `O desconto é ${p}% de ${brl(P)} = ${brl(P * p / 100)}. Valor a pagar: ${brl(P)} − ${brl(P * p / 100)} = ${brl(ok)}. (Também: pagar ${100 - p}% do preço.)`;
      pega = 'A pergunta é o valor a PAGAR, não o valor do desconto.';
      erros = [num(P * p / 100, 'respondeu o valor do desconto, e não o valor a pagar', brl), num(P + P * p / 100, 'somou o desconto ao preço', brl), num(P - p, `subtraiu ${p} reais em vez de ${p}%`, brl), num(P * (100 - p) / 10, 'errou a casa da vírgula', brl)];
      params = { f: 2, P, p };
    } else if (n === 3) {
      ok = P * (100 + p) * (100 - q) / 10000; fm = brl;
      enunciado = `O preço de um produto, ${brl(P)}, sofreu um aumento de ${p}% e, em seguida, um desconto de ${q}% sobre o novo preço. Qual é o preço final?`;
      expl = `Após o aumento: ${brl(P)} × ${(100 + p) / 100} = ${brl(P * (100 + p) / 100)}. Sobre esse valor, o desconto de ${q}% deixa ${100 - q}%: ${brl(P * (100 + p) / 100)} × ${(100 - q) / 100} = ${brl(ok)}.`;
      pega = 'Aumento e desconto incidem sobre bases diferentes: o desconto é calculado sobre o preço JÁ aumentado, então os percentuais não se somam nem se anulam.';
      erros = [num(P * (100 + p - q) / 100, 'somou e subtraiu os percentuais (+p − q) sobre o preço original', brl), num(P, 'achou que o aumento e o desconto se anulam', brl), num(P * (100 + p) / 100, 'esqueceu o desconto', brl),
        num(P * (100 - q) / 100, 'esqueceu o aumento', brl), num(P * (100 + p) / 100 - P * q / 100, 'calculou o desconto sobre o preço original', brl)];
      params = { f: 3, P, p, q };
    } else if (n === 4) {
      const y = r.int(2, 20) * 20; const pp = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]); const x = y * pp / 100;
      ok = pp; fm = pctTxt;
      enunciado = `${fmt(x)} representa quantos por cento de ${fmt(y)}?`;
      expl = `Parte ÷ todo = ${fmt(x)} ÷ ${fmt(y)} = ${fmt(x / y)}. Multiplicando por 100: ${fmt(pp)}%.`;
      pega = 'A base (o "todo") é o número que vem depois de "de". Inverter parte e todo, ou esquecer de multiplicar por 100, são os erros típicos.';
      erros = [num(y / x * 100, 'dividiu o todo pela parte (inverteu a razão)', pctTxt), num(x / y, 'esqueceu de multiplicar por 100', pctTxt), num(100 - pp, 'calculou o complemento', pctTxt), num(pp / 10, 'errou a casa da vírgula', pctTxt), num(x, 'confundiu o número com o percentual', pctTxt)];
      params = { f: 4, x, y };
    } else {
      const a = r.pick([10, 20, 30, 40]); const b = r.pick([10, 20, 30, 50]);
      ok = a + b - a * b / 100; fm = pctTxt;
      enunciado = `Uma loja dá dois descontos sucessivos: o primeiro de ${a}% e o segundo de ${b}% sobre o preço já reduzido. Esses dois descontos equivalem a um desconto único de quanto?`;
      expl = `Sobre um preço 100: após ${a}% fica ${100 - a}; após ${b}% sobre isso fica ${100 - a} × ${(100 - b) / 100} = ${fmt((100 - a) * (100 - b) / 100)}. O desconto total é 100 − ${fmt((100 - a) * (100 - b) / 100)} = ${fmt(ok)}%.`;
      pega = 'Descontos sucessivos não se somam: o segundo incide sobre um valor menor, então o desconto total é menor que a + b.';
      erros = [num(a + b, 'somou os dois percentuais', pctTxt), num(Math.abs(a - b), 'subtraiu os percentuais', pctTxt), num((a + b) / 2, 'tirou a média dos percentuais', pctTxt), num(a * b / 100, 'calculou apenas o produto dos percentuais', pctTxt), num(Math.max(a, b), 'considerou só o maior desconto', pctTxt)];
      params = { f: 5, a, b };
    }
    return { enunciado, correta: { texto: fm(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fm(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) return fval(F(p.V * p.p, 100));
    if (p.f === 2) { const c = p.P * 100; const d = c * p.p / 100; return (c - d) / 100; }
    if (p.f === 3) { const c1 = p.P * 100 * (100 + p.p) / 100; const c2 = c1 * (100 - p.q) / 100; return c2 / 100; }
    if (p.f === 4) { for (let pp = 1; pp <= 200; pp++) if (p.y * pp === p.x * 100) return pp; throw new Error('sem %'); }
    return 100 - (100 * (100 - p.a) / 100) * (100 - p.b) / 100;
  },
});

// ---------- MAT-05: regra de três simples e composta ----------
Q.CATALOGO.push({
  id: 'MAT-05-REGRA-DE-TRES', topicId: 'OJ26-MAT-05', disciplina: 'MAT', titulo: 'Regra de três simples e composta',
  gerar(r, n) {
    let enunciado; let ok; let erros; let expl; let pega; let params; let fm = fmt;
    if (n <= 2 && r.int(0, 1) === 0) {
      const u = r.int(3, 15); const k1 = r.int(2, 9); const k2 = k1 + r.int(1, 8);
      ok = k2 * u; fm = brl;
      enunciado = `${k1} kg de um produto custam ${brl(k1 * u)}. Quanto custam ${k2} kg do mesmo produto?`;
      expl = `Mais quilos, mais dinheiro: as grandezas são diretamente proporcionais. ${k1} kg → ${brl(k1 * u)}, logo 1 kg → ${brl(u)} e ${k2} kg → ${k2} × ${brl(u)} = ${brl(ok)}.`;
      pega = 'Grandezas diretamente proporcionais crescem juntas: mais produto, mais preço.';
      erros = [num(k1 * u * k1 / k2, 'tratou como inversamente proporcional', brl), num(k1 * u + (k2 - k1), 'somou a diferença de quilos ao preço', brl), num(k2 * k1 * u, 'multiplicou a quantidade pelo preço total', brl),
        num(k1 * u * (k2 - k1), 'multiplicou o preço pela diferença de quilos', brl), num(u * (k2 - k1), 'calculou só o preço da diferença de quilos', brl)];
      params = { f: 1, k1, u, k2 };
    } else if (n <= 2) {
      const w1 = r.int(2, 9); const d1 = r.int(4, 24); const total = w1 * d1;
      const w2 = r.pick(div(total).filter((x) => x !== w1 && x <= 36));
      ok = total / w2;
      enunciado = `${w1} operários fazem um serviço em ${d1} dias. Em quantos dias ${w2} operários, trabalhando no mesmo ritmo, fariam o mesmo serviço?`;
      expl = `Mais operários, menos dias: grandezas inversamente proporcionais. O serviço vale ${w1} × ${d1} = ${total} "operário-dias". Com ${w2} operários: ${total} ÷ ${w2} = ${fmt(ok)} dias.`;
      pega = 'Inversamente proporcional: quando uma grandeza sobe, a outra desce. O produto (operários × dias) é constante.';
      erros = [num(d1 * w2 / w1, 'tratou como diretamente proporcional', fmt), num(d1 + (w2 - w1), 'somou a diferença de operários aos dias', fmt), num(d1 * w2, 'multiplicou os dias pelo novo número de operários', fmt),
        num(d1 - (w2 - w1), 'subtraiu a diferença de operários dos dias', fmt), num(total, 'respondeu o total de operário-dias', fmt)];
      params = { f: 2, w1, d1, w2 };
    } else {
      const q = r.int(2, 9); const m1 = r.int(2, 8); const h1 = r.int(2, 9); const p1 = m1 * q * h1;
      const tipo = n === 3 ? 'pecas' : n === 4 ? 'horas' : 'maquinas';
      if (tipo === 'pecas') {
        const m2 = m1 + r.int(1, 8); const h2 = h1 + r.int(1, 6); ok = m2 * h2 * q;
        enunciado = `${m1} máquinas iguais, funcionando ${h1} horas, produzem ${fmt(p1)} peças. Quantas peças ${m2} dessas máquinas produzem em ${h2} horas?`;
        expl = `Peças aumentam com máquinas e com horas (ambas diretas). Cada máquina produz ${fmt(p1)} ÷ ${m1} ÷ ${h1} = ${q} peças por hora. Então ${m2} × ${h2} × ${q} = ${fmt(ok)}.`;
        pega = 'Na regra de três composta, compare cada grandeza com a incógnita separadamente: máquinas e horas aumentam a produção.';
        erros = [num(p1 * m2 / m1, 'considerou só as máquinas, ignorando as horas'), num(p1 * h2 / h1, 'considerou só as horas, ignorando as máquinas'), num(p1 * (m2 + h2) / (m1 + h1), 'somou as grandezas em vez de multiplicar as razões'),
          num(p1 * m1 * h1 / (m2 * h2), 'inverteu as duas razões'), num(p1 + m2 * h2, 'somou o produto de máquinas e horas à produção inicial')];
        params = { f: 3, m1, h1, p1, m2, h2 };
      } else if (tipo === 'horas') {
        const m2 = m1 + r.int(1, 8); const h2 = r.int(2, 10); const p2 = m2 * h2 * q; ok = h2;
        enunciado = `${m1} máquinas iguais produzem ${fmt(p1)} peças em ${h1} horas. Em quantas horas ${m2} dessas máquinas produzem ${fmt(p2)} peças?`;
        expl = `Cada máquina faz ${q} peças por hora. ${m2} máquinas fazem ${m2 * q} peças por hora. Para ${fmt(p2)} peças: ${fmt(p2)} ÷ ${m2 * q} = ${ok} horas.`;
        pega = 'Mais máquinas, MENOS horas (inversa); mais peças, MAIS horas (direta). Misturar os sentidos é o erro típico.';
        erros = [num(h1 * p2 / p1, 'ignorou o aumento de máquinas', fmt), num(h1 * (m2 / m1) * (p2 / p1), 'tratou máquinas como diretamente proporcionais às horas', fmt), num(h1 * (m1 / m2), 'ignorou a nova quantidade de peças', fmt),
          num(h1 + (p2 - p1) / p1, 'somou valores sem proporção', fmt), num(p2 / m2, 'dividiu peças por máquinas, sem considerar a produtividade', fmt)];
        params = { f: 4, m1, h1, p1, m2, p2 };
      } else {
        const h2 = r.int(2, 10); const m2 = r.int(2, 12); const p2 = m2 * h2 * q; ok = m2;
        enunciado = `${m1} máquinas iguais produzem ${fmt(p1)} peças em ${h1} horas. Quantas dessas máquinas são necessárias para produzir ${fmt(p2)} peças em ${h2} horas?`;
        expl = `Cada máquina faz ${q} peças por hora, ou ${q * h2} em ${h2} horas. Para ${fmt(p2)} peças: ${fmt(p2)} ÷ ${q * h2} = ${ok} máquinas.`;
        pega = 'Mais peças pedem mais máquinas (direta), mas mais horas permitem menos máquinas (inversa).';
        erros = [num(m1 * p2 / p1, 'ignorou a mudança no número de horas', fmt), num(m1 * (p2 / p1) * (h2 / h1), 'tratou horas como diretamente proporcionais às máquinas', fmt), num(m1 * h1 / h2, 'ignorou a nova produção', fmt),
          num(p2 / h2, 'dividiu peças por horas sem considerar a produtividade da máquina', fmt), num(m1 + (p2 - p1) / q, 'somou valores sem proporção', fmt)];
        params = { f: 5, m1, h1, p1, h2, p2 };
      }
    }
    return { enunciado, correta: { texto: fm(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fm(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) return fval(F(p.u * p.k1, p.k1)) * p.k2;
    if (p.f === 2) return fval(F(p.w1 * p.d1, p.w2));
    const taxa = fval(F(p.p1, p.m1 * p.h1));
    if (p.f === 3) return taxa * p.m2 * p.h2;
    if (p.f === 4) return p.p2 / (taxa * p.m2);
    return p.p2 / (taxa * p.h2);
  },
});

// ---------- MAT-06: média aritmética simples e ponderada ----------
Q.CATALOGO.push({
  id: 'MAT-06-MEDIA', topicId: 'OJ26-MAT-06', disciplina: 'MAT', titulo: 'Média aritmética simples e ponderada',
  gerar(r, n) {
    let enunciado; let ok; let erros; let expl; let pega; let params;
    if (n === 1) {
      const m = r.int(8, 40); const xs = [r.int(m - 6, m + 6), r.int(m - 6, m + 6), r.int(m - 6, m + 6), r.int(m - 6, m + 6)];
      xs.push(m * 5 - xs.reduce((a, b) => a + b, 0));
      const s = [...xs].sort((a, b) => a - b);
      ok = m;
      enunciado = `Cinco amigos têm ${xs.join(', ')} anos. Qual é a média de idade do grupo, em anos?`;
      expl = `Some os valores: ${xs.join(' + ')} = ${m * 5}. Divida pela quantidade: ${m * 5} ÷ 5 = ${m}.`;
      pega = 'Média simples é a soma dividida pela QUANTIDADE de valores, não pelo maior ou pelo valor do meio.';
      erros = [num(m * 5, 'respondeu a soma, sem dividir'), num(s[2], 'respondeu a mediana (valor do meio)'), num((s[0] + s[4]) / 2, 'tirou a média apenas dos extremos'), num(m * 5 / 4, 'dividiu por 4 em vez de 5'), num(m * 5 / 6, 'dividiu por 6 em vez de 5')];
      params = { f: 1, xs };
    } else if (n === 2) {
      const m = r.int(10, 40); const xs = [r.int(m - 8, m + 8), r.int(m - 8, m + 8), r.int(m - 8, m + 8), r.int(m - 8, m + 8)];
      const s4 = xs.reduce((a, b) => a + b, 0); ok = m * 5 - s4;
      enunciado = `A média de cinco números é ${m}. Quatro deles são ${xs.join(', ')}. Qual é o quinto número?`;
      expl = `Se a média de 5 números é ${m}, a soma é 5 × ${m} = ${m * 5}. Os quatro conhecidos somam ${s4}. O quinto é ${m * 5} − ${s4} = ${ok}.`;
      pega = 'Conhecendo a média, recupera-se a SOMA multiplicando pela quantidade; a média não é um dos valores.';
      erros = [num(m, 'respondeu a própria média'), num(m * 5, 'respondeu a soma total'), num(s4 / 4, 'calculou a média dos quatro conhecidos'), num(m * 4 - s4, 'usou 4 em vez de 5 ao recuperar a soma'), num(m * 6 - s4, 'usou 6 em vez de 5 ao recuperar a soma')];
      params = { f: 2, m, xs };
    } else {
      const pesos = r.pick([[2, 3, 5], [1, 4, 5], [3, 3, 4], [1, 2, 3, 4], [2, 2, 6]]);
      const gs = pesos.map(() => r.int(4, 10)); const soma = gs.reduce((a, b, i) => a + b * pesos[i], 0); const sp = pesos.reduce((a, b) => a + b, 0);
      ok = soma / sp;
      const rot = ['prova 1', 'prova 2', 'prova 3', 'prova 4'];
      enunciado = `Em um concurso, as notas ${gs.map((g, i) => `${g} (peso ${pesos[i]})`).join(', ')} foram obtidas por um candidato. Qual é a média ponderada?`;
      expl = `Multiplique cada nota pelo peso e some: ${gs.map((g, i) => `${g}×${pesos[i]}`).join(' + ')} = ${soma}. Divida pela soma dos pesos (${sp}): ${soma} ÷ ${sp} = ${fmt(ok)}.`;
      pega = 'Na média ponderada divide-se pela SOMA DOS PESOS, e cada nota conta proporcionalmente ao seu peso.';
      const inv = [...pesos].reverse();
      erros = [num(gs.reduce((a, b) => a + b, 0) / gs.length, 'calculou a média simples, ignorando os pesos'), num(soma, 'não dividiu pela soma dos pesos'), num(gs.reduce((a, b, i) => a + b * inv[i], 0) / sp, 'trocou a ordem dos pesos'),
        num(soma / gs.length, 'dividiu pela quantidade de notas em vez da soma dos pesos'), num(gs.reduce((a, b, i) => a + b * pesos[i], 0) / (sp + 1), 'somou um peso a mais no divisor')];
      void rot;
      params = { f: 3, gs, pesos };
    }
    return { enunciado, correta: { texto: fmt(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Média: ' + fmt(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) return fval(F(p.xs.reduce((a, b) => a + b, 0), p.xs.length));
    if (p.f === 2) return p.m * 5 - p.xs.reduce((a, b) => a + b, 0);
    let num2 = 0; let den = 0; p.gs.forEach((g, i) => { num2 += g * p.pesos[i]; den += p.pesos[i]; });
    return fval(F(num2, den));
  },
});

// ---------- MAT-07: juros simples ----------
Q.CATALOGO.push({
  id: 'MAT-07-JUROS-SIMPLES', topicId: 'OJ26-MAT-07', disciplina: 'MAT', titulo: 'Juros simples',
  gerar(r, n) {
    const C = r.pick([1200, 2400, 3600, 4800, 6000]); const i = r.int(2, 12); const t = r.int(2, 12);
    const J = C * i * t / 100;
    let enunciado; let ok; let erros; let expl; let pega; let params; let fm = brl;
    if (n === 1) {
      ok = J;
      enunciado = `Um capital de ${brl(C)} foi aplicado a juros simples, à taxa de ${i}% ao mês, durante ${t} meses. Qual foi o juro obtido?`;
      expl = `Juros simples: J = C × i × t. J = ${brl(C)} × ${i / 100} × ${t} = ${brl(ok)}.`;
      pega = 'Em juros simples a taxa incide sempre sobre o capital inicial, e o tempo precisa estar na mesma unidade da taxa.';
      erros = [num(C * (Math.pow(1 + i / 100, t) - 1), 'calculou juros compostos', brl), num(C + J, 'respondeu o montante (capital + juros)', brl), num(C * i * t, 'não dividiu a taxa por 100', brl), num(C * i / 100, 'calculou o juro de apenas um mês', brl), num(C * i / 100 * (t - 1), 'contou um mês a menos', brl)];
      params = { f: 1, C, i, t };
    } else if (n === 2) {
      ok = C + J;
      enunciado = `Uma pessoa aplicou ${brl(C)} a juros simples, a ${i}% ao mês, por ${t} meses. Qual é o montante ao final do período?`;
      expl = `O juro é ${brl(C)} × ${i / 100} × ${t} = ${brl(J)}. Montante = capital + juro = ${brl(C)} + ${brl(J)} = ${brl(ok)}.`;
      pega = 'Montante inclui o capital; juro é só o rendimento. A pergunta define qual dos dois responder.';
      erros = [num(J, 'respondeu apenas o juro', brl), num(C * Math.pow(1 + i / 100, t), 'calculou o montante com juros compostos', brl), num(C + C * i * t, 'não dividiu a taxa por 100', brl), num(C + C * i / 100, 'considerou só um mês de juros', brl), num(C - J, 'subtraiu o juro do capital', brl)];
      params = { f: 2, C, i, t };
    } else if (n === 3) {
      ok = i; fm = (v) => fmt(v) + '% ao mês';
      enunciado = `Um capital de ${brl(C)}, aplicado a juros simples por ${t} meses, rendeu ${brl(J)} de juros. Qual foi a taxa mensal?`;
      expl = `De J = C × i × t: i = J ÷ (C × t) = ${brl(J)} ÷ (${brl(C)} × ${t}) = ${fmt(i / 100)}, ou seja, ${fmt(i)}% ao mês.`;
      pega = 'A taxa sai de J ÷ (C × t) e depois se multiplica por 100 para virar percentual.';
      erros = [num(J / (C * t), 'esqueceu de multiplicar por 100', (v) => fmt(v) + '% ao mês'), num(J * 100 / C, 'esqueceu de dividir pelo tempo', (v) => fmt(v) + '% ao mês'), num(J * 100 / (C * (t + 1)), 'dividiu por um mês a mais', (v) => fmt(v) + '% ao mês'),
        num(i * t, 'respondeu a taxa acumulada no período', (v) => fmt(v) + '% ao mês'), num(i * 12, 'converteu para taxa anual', (v) => fmt(v) + '% ao mês')];
      params = { f: 3, C, J, t };
    } else if (n === 4) {
      ok = t; fm = (v) => fmt(v) + (v === 1 ? ' mês' : ' meses');
      enunciado = `Um capital de ${brl(C)}, aplicado a juros simples à taxa de ${i}% ao mês, rendeu ${brl(J)}. Por quantos meses ficou aplicado?`;
      expl = `De J = C × i × t: t = J ÷ (C × i) = ${brl(J)} ÷ (${brl(C)} × ${i / 100}) = ${t} meses.`;
      pega = 'Para achar o tempo, divida o juro pelo rendimento de UM período (C × i).';
      const f2 = (v) => fmt(v) + ' meses';
      erros = [num(J / C, 'dividiu o juro apenas pelo capital', f2), num(J / (C * i), 'esqueceu de transformar a taxa em decimal', f2), num(t * i, 'multiplicou o tempo pela taxa', f2), num(t + 1, 'contou um mês a mais', f2), num(J / (C * i / 100) / 12, 'converteu o resultado para anos', f2)];
      params = { f: 4, C, i, J };
    } else {
      const Cc = r.pick([1200, 2400, 3600, 4800, 6000]); const ia = r.pick([6, 8, 10, 12, 15, 18]); const m = r.pick([6, 12, 18, 24, 30, 36]);
      const Ja = Cc * ia * m / 1200;
      ok = Ja;
      enunciado = `Um capital de ${brl(Cc)} foi aplicado a juros simples, à taxa de ${ia}% ao ano, durante ${m} meses. Qual foi o juro obtido?`;
      expl = `A taxa é anual e o tempo está em meses: converta ${m} meses para ${fmt(m / 12)} ano(s). J = ${brl(Cc)} × ${ia / 100} × ${fmt(m / 12)} = ${brl(ok)}.`;
      pega = 'Taxa e tempo precisam estar na mesma unidade. Taxa ao ano com tempo em meses exige converter os meses em anos (ou a taxa em mensal).';
      erros = [num(Cc * ia * m / 100, 'usou os meses direto com a taxa anual', brl), num(Cc * ia / 100, 'calculou só um ano de juros', brl), num(Cc * ia * m / 12, 'dividiu os meses por 12, mas não a taxa por 100', brl), num(Cc * (ia / 12) * m / 100 * 12, 'dividiu a taxa anual por 12 e depois multiplicou por 12 meses de novo', brl), num(Cc + Ja, 'respondeu o montante', brl)];
      params = { f: 5, C: Cc, ia, m };
    }
    return { enunciado, correta: { texto: fm(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fm(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1 || p.f === 2) { let j = 0; for (let k = 1; k <= p.t; k++) j += p.C * p.i / 100; return p.f === 1 ? j : p.C + j; }
    if (p.f === 3) { for (let i = 1; i <= 100; i++) { let j = 0; for (let k = 1; k <= p.t; k++) j += p.C * i / 100; if (j === p.J) return i; } throw new Error('sem taxa'); }
    if (p.f === 4) { for (let t = 1; t <= 200; t++) { let j = 0; for (let k = 1; k <= t; k++) j += p.C * p.i / 100; if (j === p.J) return t; } throw new Error('sem tempo'); }
    let j = 0; for (let k = 1; k <= p.m; k++) j += p.C * (p.ia / 12) / 100; return Math.round(j * 100) / 100;
  },
});

// ---------- MAT-08: equações do 1.º e 2.º graus ----------
Q.CATALOGO.push({
  id: 'MAT-08-EQUACOES', topicId: 'OJ26-MAT-08', disciplina: 'MAT', titulo: 'Equações do 1.º e 2.º graus',
  gerar(r, n) {
    const sg = (v) => (v >= 0 ? '+ ' + fmt(v) : '− ' + fmt(-v));
    let enunciado; let ok; let erros; let expl; let pega; let params;
    if (n <= 2) {
      const a = r.int(2, 9); const x = r.pick([-9, -7, -5, -4, -3, -2, 2, 3, 4, 5, 6, 8, 10, 12]); const b = r.pick([-15, -12, -9, -7, -5, -3, 3, 5, 7, 9, 11, 14, 18]);
      if (n === 1) {
        const c = a * x + b; ok = x;
        enunciado = `Qual é o valor de x na equação ${a}x ${sg(b)} = ${fmt(c)}?`;
        expl = `Isole o termo com x: ${a}x = ${fmt(c)} ${b >= 0 ? '−' : '+'} ${fmt(Math.abs(b))} = ${fmt(c - b)}. Divida por ${a}: x = ${fmt(c - b)} ÷ ${a} = ${fmt(x)}.`;
        pega = 'Ao passar um termo para o outro lado, ele troca de sinal. Esquecer a troca de sinal leva a outro resultado, como mostram as alternativas erradas.';
        erros = [num((c + b) / a, 'não trocou o sinal de b ao passá-lo para o outro lado'), num((b - c) / a, 'inverteu a ordem da subtração'), num((c - b) * a, 'multiplicou por a em vez de dividir'), num(c / a - b, 'dividiu c por a antes de passar b'), num(c - b, 'esqueceu de dividir por a')];
        params = { f: 1, a, b, c };
      } else {
        const c = a * (x + b); ok = x;
        enunciado = `Qual é o valor de x na equação ${a}(x ${sg(b)}) = ${fmt(c)}?`;
        expl = `Divida os dois lados por ${a}: x ${sg(b)} = ${fmt(c / a)}. Então x = ${fmt(c / a)} ${b >= 0 ? '−' : '+'} ${fmt(Math.abs(b))} = ${fmt(x)}.`;
        pega = 'Com parênteses, ou se distribui o fator ou se divide os dois lados por ele antes de isolar x.';
        erros = [num(c / a + b, 'não trocou o sinal de b'), num((c - b) / a, 'subtraiu b de c antes de dividir (aplicou o fator só a x)'), num((c + b) / a, 'somou b a c antes de dividir'), num(c - a - b, 'subtraiu a e b de c'), num(c / a, 'esqueceu de passar b')];
        params = { f: 2, a, b, c };
      }
    } else {
      let r1 = r.pick([-8, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 9]); let r2 = r.pick([-7, -5, -3, -2, 1, 2, 3, 4, 5, 6, 8, 10]);
      if (r1 === r2) r2 += 1; if (r2 === 0) r2 = 11; if (r1 === 0) r1 = 12;
      const S = r1 + r2; const P = r1 * r2; const mx = Math.max(r1, r2); const mn = Math.min(r1, r2);
      const eq = `x² ${S === 0 ? '' : (S > 0 ? '− ' + fmt(S) + 'x ' : '+ ' + fmt(-S) + 'x ')}${P >= 0 ? '+ ' + fmt(P) : '− ' + fmt(-P)} = 0`.replace('  ', ' ');
      if (n === 3) {
        ok = mx;
        enunciado = `Qual é a maior raiz da equação ${eq}?`;
        erros = [num(mn, 'respondeu a menor raiz'), num(-mx, 'trocou o sinal da raiz'), num(S, 'respondeu a soma das raízes'), num(P, 'respondeu o produto das raízes'), num(-mn, 'trocou o sinal da outra raiz')];
      } else if (n === 4) {
        ok = mn;
        enunciado = `Qual é a menor raiz da equação ${eq}?`;
        erros = [num(mx, 'respondeu a maior raiz'), num(-mn, 'trocou o sinal da raiz'), num(S, 'respondeu a soma das raízes'), num(P, 'respondeu o produto das raízes'), num(-mx, 'trocou o sinal da outra raiz')];
      } else {
        ok = r1 * r1 + r2 * r2;
        enunciado = `Se x₁ e x₂ são as raízes da equação ${eq}, qual é o valor de x₁² + x₂²?`;
        erros = [num(S * S, 'calculou (x₁ + x₂)², sem subtrair 2·x₁·x₂'), num(S, 'respondeu a soma das raízes'), num(P, 'respondeu o produto das raízes'), num(S * S + 2 * P, 'somou 2P em vez de subtrair'), num(S * S - P, 'subtraiu P em vez de 2P')];
      }
      expl = `Procure dois números cuja soma seja ${fmt(S)} e o produto ${fmt(P)}: são ${fmt(r1)} e ${fmt(r2)} (soma = −b/a, produto = c/a). As raízes são ${fmt(mn)} e ${fmt(mx)}. ${n === 5 ? `Então x₁² + x₂² = ${fmt(mn * mn)} + ${fmt(mx * mx)} = ${fmt(ok)}.` : `A resposta é ${fmt(ok)}.`}`;
      pega = 'Na forma x² − Sx + P = 0, S é a soma e P o produto das raízes: o sinal do termo em x é o OPOSTO da soma.';
      params = { f: n, S, P };
    }
    return { enunciado, correta: { texto: fmt(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fmt(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) { for (let x = -200; x <= 200; x++) if (p.a * x + p.b === p.c) return x; throw new Error('sem raiz'); }
    if (p.f === 2) { for (let x = -200; x <= 200; x++) if (p.a * (x + p.b) === p.c) return x; throw new Error('sem raiz'); }
    const raizes = []; for (let x = -100; x <= 100; x++) if (x * x - p.S * x + p.P === 0) raizes.push(x);
    if (raizes.length !== 2) throw new Error('raízes inesperadas');
    if (p.f === 3) return Math.max(...raizes);
    if (p.f === 4) return Math.min(...raizes);
    return raizes[0] * raizes[0] + raizes[1] * raizes[1];
  },
});

// ---------- MAT-09: sistemas de equações do 1.º grau ----------
Q.CATALOGO.push({
  id: 'MAT-09-SISTEMAS', topicId: 'OJ26-MAT-09', disciplina: 'MAT', titulo: 'Sistemas de equações do 1.º grau',
  gerar(r, n) {
    let enunciado; let ok; let erros; let expl; let pega; let params;
    if (n <= 2) {
      const y = r.int(3, 20); const x = y + r.int(2, 15); const S = x + y; const D = x - y;
      const quer = n === 1 ? 'maior' : r.pick(['menor', 'produto']);
      ok = quer === 'maior' ? x : quer === 'menor' ? y : x * y;
      enunciado = `A soma de dois números é ${S} e a diferença entre o maior e o menor é ${D}. ${quer === 'maior' ? 'Qual é o maior número?' : quer === 'menor' ? 'Qual é o menor número?' : 'Qual é o produto desses números?'}`;
      expl = `Somando as duas equações (x + y = ${S} e x − y = ${D}): 2x = ${S + D}, logo x = ${x}. Então y = ${S} − ${x} = ${y}. ${quer === 'produto' ? `Produto: ${x} × ${y} = ${ok}.` : `A resposta é ${ok}.`}`;
      pega = 'Somar as duas equações elimina y; subtrair elimina x. Depois, confira qual número a pergunta pede.';
      erros = quer === 'produto'
        ? [num(S * D, 'multiplicou a soma pela diferença'), num(x + y, 'respondeu a soma'), num((S / 2) * (S / 2), 'multiplicou a média por ela mesma'), num(x * x - y * y === 0 ? 1 : x * x - y * y, 'calculou x² − y²'), num(x, 'respondeu só o maior número')]
        : [num(quer === 'maior' ? y : x, 'respondeu o outro número'), num(S / 2, 'respondeu a média dos dois'), num(D / 2, 'respondeu metade da diferença'), num(S + D, 'não dividiu por 2 ao somar as equações'), num(S - D, 'subtraiu as equações sem dividir por 2')];
      params = { f: 1, S, D, quer };
    } else {
      const pc = r.int(2, 15); const pk = r.int(3, 18);
      let a1; let b1; let a2; let b2;
      for (let i = 0; i < 20; i++) { a1 = r.int(1, 5); b1 = r.int(1, 5); a2 = r.int(1, 5); b2 = r.int(1, 5); if (a1 * b2 - a2 * b1 !== 0) break; }
      if (a1 * b2 - a2 * b1 === 0) { a1 = 2; b1 = 3; a2 = 1; b2 = 2; }
      const c1 = a1 * pc + b1 * pk; const c2 = a2 * pc + b2 * pk;
      const quer = n === 3 ? 'caderno' : n === 4 ? 'caneta' : 'dois';
      ok = quer === 'caderno' ? pk : quer === 'caneta' ? pc : pc + pk;
      const item = quer === 'caderno' ? 'um caderno' : quer === 'caneta' ? 'uma caneta' : 'uma caneta e um caderno juntos';
      enunciado = `${a1} canetas e ${b1} cadernos custam ${brl(c1)}; ${a2} canetas e ${b2} cadernos custam ${brl(c2)}. Quanto custa ${item}?`;
      const det = a1 * b2 - a2 * b1;
      expl = `Seja c o preço da caneta e k o do caderno: ${a1}c + ${b1}k = ${c1} e ${a2}c + ${b2}k = ${c2}. Eliminando uma incógnita (multiplique a 1.ª por ${b2} e a 2.ª por ${b1} e subtraia): ${fmt(det)}c = ${fmt(c1 * b2 - c2 * b1)}, logo c = ${brl(pc)}. Substituindo, k = ${brl(pk)}. ${quer === 'dois' ? `Juntos: ${brl(pc)} + ${brl(pk)} = ${brl(ok)}.` : ''}`;
      pega = 'Dois dados incompletos exigem montar o sistema; dividir o total pela quantidade de itens ignora que os preços são diferentes.';
      erros = [num(quer === 'caderno' ? pc : pk, 'respondeu o preço do outro item', brl), num(c1 / (a1 + b1), 'dividiu o total da 1.ª compra pelo número de itens (preço médio)', brl), num(c2 / (a2 + b2), 'dividiu o total da 2.ª compra pelo número de itens', brl),
        num(Math.abs(c2 - c1), 'subtraiu os dois totais', brl), num((c1 + c2) / (a1 + b1 + a2 + b2), 'calculou o preço médio das duas compras', brl)];
      params = { f: 2, a1, b1, c1, a2, b2, c2, quer };
    }
    return { enunciado, correta: { texto: n <= 2 ? fmt(ok) : brl(ok), valor: ok }, erros: n <= 2 ? erros : erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + (n <= 2 ? fmt(ok) : brl(ok)) + '.' };
  },
  resolver(p) {
    if (p.f === 1) {
      const sols = []; for (let x = 0; x <= 200; x++) for (let y = 0; y <= 200; y++) if (x + y === p.S && x - y === p.D) sols.push([x, y]);
      if (sols.length !== 1) throw new Error('solução não única');
      const [x, y] = sols[0]; return p.quer === 'maior' ? x : p.quer === 'menor' ? y : x * y;
    }
    const sols = []; for (let c = 1; c <= 80; c++) for (let k = 1; k <= 80; k++) if (p.a1 * c + p.b1 * k === p.c1 && p.a2 * c + p.b2 * k === p.c2) sols.push([c, k]);
    if (sols.length !== 1) throw new Error('solução não única');
    const [c, k] = sols[0]; return p.quer === 'caderno' ? k : p.quer === 'caneta' ? c : c + k;
  },
});
