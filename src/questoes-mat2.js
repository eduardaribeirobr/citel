'use strict';
/* Modelos de Matemática, parte 2: tabelas e gráficos, medidas, geometria e situações-problema (OJ26-MAT-10 a 13). */
const Q = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;
const { fmt, brl, F, fval, mdc, NOMES } = Q;

const E = (valor, texto, porque) => ({ valor, texto, porque });
const num = (v, porque, f) => E(v, (f || fmt)(v), porque);
const pctTxt = (v) => fmt(v) + '%';

// ---------- MAT-10: relação entre grandezas, tabelas e gráficos ----------
Q.CATALOGO.push({
  id: 'MAT-10-TABELAS', topicId: 'OJ26-MAT-10', disciplina: 'MAT', titulo: 'Relação entre grandezas: tabelas e gráficos',
  gerar(r, n) {
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const k = n === 5 ? 6 : r.int(5, 6);
    const ini = r.int(0, 12 - k);
    const meses = MESES.slice(ini, ini + k);
    const vals = meses.map(() => r.int(5, 40) * 20);
    let enunciado; let ok; let erros; let expl; let pega; let params; let fm = fmt; let valorTxt = null;
    const tabela = () => 'Vendas por mês, em unidades: ' + meses.map((m, j) => m + ': ' + vals[j]).join('; ') + '.';
    const soma = () => vals.reduce((a, b) => a + b, 0);
    if (n === 1) {
      ok = soma();
      enunciado = `${tabela()} Qual foi o total de vendas no período?`;
      expl = `Some todos os meses: ${vals.join(' + ')} = ${fmt(ok)}.`;
      pega = 'Total é a soma de todos os valores da tabela; conferir se nenhum mês ficou de fora.';
      erros = [num(ok - vals[0], `esqueceu o primeiro mês (${meses[0]})`), num(ok - vals[k - 1], `esqueceu o último mês (${meses[k - 1]})`), num(ok / k, 'calculou a média em vez do total'), num(Math.max(...vals), 'respondeu o maior valor'), num(ok - Math.min(...vals), 'deixou de fora o menor valor')];
      params = { f: 1, vals };
    } else if (n === 2) {
      while ((soma() / 20) % 3 !== 0 && k === 6) vals[k - 1] += 20;
      ok = soma() / k;
      enunciado = `${tabela()} Qual foi a média mensal de vendas?`;
      expl = `Total: ${fmt(soma())}. Média = ${fmt(soma())} ÷ ${k} meses = ${fmt(ok)}.`;
      pega = 'A média divide o total pelo NÚMERO DE MESES da tabela (conte os meses listados).';
      const ord = [...vals].sort((a, b) => a - b); const med = k % 2 ? ord[(k - 1) / 2] : (ord[k / 2 - 1] + ord[k / 2]) / 2;
      erros = [num(soma(), 'respondeu o total, sem dividir'), num(med, 'respondeu a mediana'), num((Math.max(...vals) + Math.min(...vals)) / 2, 'tirou a média apenas do maior e do menor valor'), num(soma() / (k - 1), `dividiu por ${k - 1} em vez de ${k}`), num(soma() / (k + 1), `dividiu por ${k + 1} em vez de ${k}`)];
      params = { f: 2, vals };
    } else if (n === 3) {
      ok = Math.max(...vals) - Math.min(...vals);
      enunciado = `${tabela()} Qual é a diferença entre o maior e o menor valor mensal?`;
      expl = `Maior: ${fmt(Math.max(...vals))}. Menor: ${fmt(Math.min(...vals))}. Diferença: ${fmt(Math.max(...vals))} − ${fmt(Math.min(...vals))} = ${fmt(ok)}.`;
      pega = 'Identifique primeiro o maior e o menor valor de TODA a tabela (não só de meses vizinhos) antes de subtrair.';
      erros = [num(Math.max(...vals), 'respondeu o maior valor'), num(Math.min(...vals), 'respondeu o menor valor'), num(Math.max(...vals) + Math.min(...vals), 'somou o maior e o menor'), num(ok / 2, 'dividiu a diferença por 2'), num(Math.abs(vals[k - 1] - vals[0]), 'subtraiu o último mês do primeiro')];
      params = { f: 3, vals };
    } else if (n === 4) {
      const i = r.int(0, k - 2); const p = r.pick([10, 20, 25, 50]);
      vals[i] = r.int(5, 20) * 20; vals[i + 1] = vals[i] * (100 + p) / 100;
      ok = p; fm = pctTxt;
      const v1 = vals[i]; const v2 = vals[i + 1];
      enunciado = `${tabela()} Qual foi a variação percentual das vendas de ${meses[i]} para ${meses[i + 1]}?`;
      expl = `Variação = (${v2} − ${v1}) ÷ ${v1} = ${fmt(v2 - v1)} ÷ ${v1} = ${fmt((v2 - v1) / v1)}, ou seja, ${fmt(p)}% de aumento sobre ${meses[i]}.`;
      pega = 'A variação percentual usa como base o valor INICIAL (o do mês anterior), não o final.';
      erros = [num(v2 - v1, 'respondeu a diferença em unidades, sem converter em percentual', fmt), num(v2 / v1 * 100, 'calculou quanto o novo valor representa do antigo (sem subtrair 100%)', pctTxt), num((v2 - v1) / v2 * 100, 'usou o valor final como base', pctTxt), num(100 - p, 'calculou o complemento', pctTxt), num(p * 2, 'dobrou o percentual', pctTxt)];
      params = { f: 4, v1, v2 };
    } else {
      for (let t = 0; t < 40; t++) {
        for (let j = 0; j < k; j++) vals[j] = r.int(5, 40) * 20;
        const d = []; for (let j = 1; j < k; j++) d.push(vals[j] - vals[j - 1]);
        const mx = Math.max(...d); if (d.filter((x) => x === mx).length === 1) break;
      }
      const d = []; for (let j = 1; j < k; j++) d.push(vals[j] - vals[j - 1]);
      const mx = Math.max(...d); const jm = d.indexOf(mx) + 1;
      ok = meses[jm]; valorTxt = ok;
      enunciado = `${tabela()} Em qual mês houve o maior aumento absoluto de vendas em relação ao mês anterior?`;
      expl = `Calcule a variação mês a mês: ${meses.slice(1).map((m, j) => `${m}: ${d[j] >= 0 ? '+' : '−'}${Math.abs(d[j])}`).join('; ')}. O maior aumento foi ${fmt(mx)}, em ${ok}.`;
      pega = 'A pergunta é sobre a VARIAÇÃO em relação ao mês anterior, não sobre o mês de maior venda.';
      erros = [];
      meses.slice(1).forEach((m, j) => { if (m !== ok) erros.push(E(m, m, `em ${m} a variação foi ${d[j] >= 0 ? '+' : '−'}${Math.abs(d[j])}, menor que o maior aumento (+${fmt(mx)} em ${ok})`)); });
      erros.push(E(meses[0], meses[0], `${meses[0]} é o primeiro mês da tabela e não tem mês anterior para comparar`));
      params = { f: 5, meses, vals };
    }
    return { enunciado, correta: { texto: valorTxt !== null ? valorTxt : fm(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resposta: ' + (valorTxt !== null ? valorTxt : fm(ok)) + '.' };
  },
  resolver(p) {
    if (p.f === 1) { let s = 0; for (const v of p.vals) s += v; return s; }
    if (p.f === 2) { let s = 0; for (const v of p.vals) s += v; return fval(F(s, p.vals.length)); }
    if (p.f === 3) { let mx = -Infinity; let mn = Infinity; for (const v of p.vals) { if (v > mx) mx = v; if (v < mn) mn = v; } return mx - mn; }
    if (p.f === 4) { for (let pp = 1; pp <= 300; pp++) if (p.v1 * (100 + pp) === p.v2 * 100) return pp; throw new Error('sem variação inteira'); }
    let melhor = null; let valor = -Infinity; let empates = 0;
    for (let j = 1; j < p.vals.length; j++) { const dd = p.vals[j] - p.vals[j - 1]; if (dd > valor) { valor = dd; melhor = p.meses[j]; empates = 1; } else if (dd === valor) empates++; }
    if (empates !== 1) throw new Error('maior aumento não é único');
    return melhor;
  },
});

// ---------- MAT-11: sistemas de medidas usuais ----------
Q.CATALOGO.push({
  id: 'MAT-11-MEDIDAS', topicId: 'OJ26-MAT-11', disciplina: 'MAT', titulo: 'Sistemas de medidas usuais',
  gerar(r, n) {
    const CONV = [['km', 'm', 1000], ['m', 'cm', 100], ['L', 'mL', 1000], ['kg', 'g', 1000], ['h', 'min', 60], ['min', 's', 60], ['t', 'kg', 1000], ['cm', 'mm', 10], ['m³', 'L', 1000]];
    let enunciado; let ok; let erros; let expl; let pega; let params; let un = '';
    if (n === 1 || n === 2) {
      const [de, para, f] = r.pick(CONV); const v10 = r.int(11, 99); const v = v10 / 10;
      if (n === 1) {
        ok = v10 * f / 10; un = ' ' + para;
        enunciado = `Quantos ${para === 's' ? 'segundos' : para === 'min' ? 'minutos' : para} correspondem a ${fmt(v)} ${de}?`;
        expl = `1 ${de} = ${fmt(f)} ${para}. Então ${fmt(v)} ${de} = ${fmt(v)} × ${fmt(f)} = ${fmt(ok)} ${para}.`;
        pega = de === 'h' || de === 'min' ? 'Horas e minutos usam base 60, não 100.' : 'Ao passar para uma unidade MENOR, o número fica maior: multiplique pelo fator.';
        erros = [num(ok * 10, 'errou uma casa decimal para mais'), num(ok / 10, 'errou uma casa decimal para menos'), num(v / f, 'dividiu em vez de multiplicar'), num(v * (f === 60 ? 100 : f * 10), f === 60 ? 'usou base 100 em vez de 60' : 'multiplicou por uma potência de 10 a mais'), num(v * f / 100, 'errou duas casas decimais')];
        params = { f: 1, v10, fator: f };
      } else {
        const S = v10 * f / 10; ok = v; un = ' ' + de;
        enunciado = `${fmt(S)} ${para} equivalem a quantos ${de === 'h' ? 'horas' : de === 'min' ? 'minutos' : de}?`;
        expl = `1 ${de} = ${fmt(f)} ${para}. Então ${fmt(S)} ${para} ÷ ${fmt(f)} = ${fmt(ok)} ${de}.`;
        pega = 'Ao passar para uma unidade MAIOR, o número fica menor: divida pelo fator.';
        erros = [num(ok * 10, 'errou uma casa decimal para mais'), num(ok / 10, 'errou uma casa decimal para menos'), num(S * f, 'multiplicou em vez de dividir'), num(S / (f === 60 ? 100 : f * 10), f === 60 ? 'usou base 100 em vez de 60' : 'dividiu por uma potência de 10 a mais'), num(S / f * 100, 'errou duas casas decimais')];
        params = { f: 2, S, fator: f };
      }
    } else if (n === 3) {
      const v10 = r.int(11, 49); ok = v10 * 360; un = ' s';
      enunciado = `Quantos segundos há em ${fmt(v10 / 10)} hora(s)?`;
      expl = `1 hora = 60 minutos e 1 minuto = 60 segundos, então 1 hora = 3.600 s. ${fmt(v10 / 10)} × 3.600 = ${fmt(ok)} s.`;
      pega = 'Duas conversões em sequência: horas → minutos → segundos, ambas de base 60 (1 hora = 3.600 s, e não 6.000).';
      erros = [num(v10 / 10 * 6000, 'usou 100 em vez de 60 nas duas conversões'), num(v10 / 10 * 60, 'converteu só para minutos'), num(v10 / 10 * 360, 'usou 360 segundos por hora'), num(v10 / 10 * 3600 / 10, 'errou uma casa decimal'), num(v10 / 10 * 3600 * 10, 'errou uma casa decimal para mais')];
      params = { f: 3, v10 };
    } else if (n === 4) {
      const k = r.int(2, 10); const kmh = 18 * k; ok = 5 * k; un = ' m/s';
      enunciado = `Um carro viaja a ${fmt(kmh)} km/h. Qual é a sua velocidade em m/s?`;
      expl = `1 km/h = 1.000 m ÷ 3.600 s = 1 ÷ 3,6 m/s. Então ${fmt(kmh)} ÷ 3,6 = ${fmt(ok)} m/s.`;
      pega = 'De km/h para m/s DIVIDE-SE por 3,6 (e de m/s para km/h multiplica-se). Fazer o contrário é o erro típico.';
      erros = [num(kmh * 3.6, 'multiplicou por 3,6 em vez de dividir'), num(kmh * 1000 / 60, 'dividiu por 60 em vez de 3.600'), num(kmh / 36, 'dividiu por 36'), num(kmh / 1000 * 3600, 'inverteu a conversão'), num(kmh / 6, 'dividiu por 6')];
      params = { f: 4, kmh };
    } else {
      const a10 = r.int(10, 40); const b10 = r.int(5, 25); const c10 = r.int(4, 12);
      ok = a10 * b10 * c10; un = ' L';
      enunciado = `Um reservatório em forma de paralelepípedo mede ${fmt(a10 / 10)} m de comprimento, ${fmt(b10 / 10)} m de largura e ${fmt(c10 / 10)} m de altura. Qual é a sua capacidade em litros? (1 m³ = 1.000 litros)`;
      const vol = a10 * b10 * c10 / 1000;
      expl = `Volume = ${fmt(a10 / 10)} × ${fmt(b10 / 10)} × ${fmt(c10 / 10)} = ${fmt(vol)} m³. Como 1 m³ = 1.000 L, a capacidade é ${fmt(vol)} × 1.000 = ${fmt(ok)} L.`;
      pega = 'O volume sai em m³; para litros multiplica-se por 1.000 (não por 100, como em metros para centímetros).';
      erros = [num(vol, 'deu o volume em m³, sem converter para litros'), num(vol * 100, 'multiplicou por 100 em vez de 1.000'), num(vol * 10000, 'multiplicou por 10.000'), num(a10 * b10 * c10 / 10, 'errou duas casas decimais'), num((a10 + b10 + c10) / 10 * 1000, 'somou as dimensões em vez de multiplicar')];
      params = { f: 5, a10, b10, c10 };
    }
    return { enunciado, correta: { texto: fmt(ok) + un, valor: ok }, erros: erros.map((e) => ({ valor: e.valor, texto: e.texto + un, porque: e.porque })), explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fmt(ok) + un + '.' };
  },
  resolver(p) {
    if (p.f === 1) return fval(F(p.v10 * p.fator, 10));
    if (p.f === 2) return fval(F(p.S, p.fator));
    if (p.f === 3) return fval(F(p.v10 * 60 * 60, 10));
    if (p.f === 4) return fval(F(p.kmh * 1000, 3600));
    return fval(F(p.a10 * p.b10 * p.c10 * 1000, 1000));
  },
});

// ---------- MAT-12: noções de geometria ----------
Q.CATALOGO.push({
  id: 'MAT-12-GEOMETRIA', topicId: 'OJ26-MAT-12', disciplina: 'MAT', titulo: 'Noções de geometria',
  gerar(r, n) {
    const TRI = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10]];
    let enunciado; let ok; let erros; let expl; let pega; let params; let un = ''; let casas;
    if (n === 1) {
      const a = r.int(3, 20); const b = r.int(2, 18); const quer = r.pick(['área', 'perímetro']);
      ok = quer === 'área' ? a * b : 2 * (a + b); un = quer === 'área' ? ' cm²' : ' cm';
      enunciado = `Um retângulo tem ${a} cm de comprimento e ${b} cm de largura. Qual é o seu ${quer}?`;
      expl = quer === 'área' ? `Área = comprimento × largura = ${a} × ${b} = ${ok} cm².` : `Perímetro = soma dos quatro lados = 2 × (${a} + ${b}) = ${ok} cm.`;
      pega = 'Área mede a superfície (em unidade ao quadrado); perímetro mede o contorno (em unidade linear). A pergunta define qual calcular.';
      erros = quer === 'área'
        ? [num(2 * (a + b), 'calculou o perímetro'), num(a + b, 'somou os lados'), num(a * b * 2, 'dobrou a área'), num(a * a, 'elevou ao quadrado só o comprimento'), num((a * b) / 2, 'dividiu por 2 (fórmula do triângulo)')]
        : [num(a * b, 'calculou a área'), num(a + b, 'somou só dois lados'), num(2 * a * b, 'dobrou a área'), num(4 * a, 'tratou como quadrado de lado igual ao comprimento'), num(a + 2 * b, 'somou três lados')];
      params = { f: 1, a, b, quer };
    } else if (n === 2) {
      const [x, y, z] = r.pick(TRI); const k = r.int(1, 3); const c1 = x * k; const c2 = y * k;
      ok = c1 * c2 / 2; un = ' cm²';
      enunciado = `Um triângulo retângulo tem catetos de ${c1} cm e ${c2} cm. Qual é a sua área?`;
      expl = `Em um triângulo retângulo, a base e a altura são os catetos. Área = (base × altura) ÷ 2 = (${c1} × ${c2}) ÷ 2 = ${fmt(ok)} cm².`;
      pega = 'A área do triângulo é METADE de base × altura; esquecer o ÷ 2 dá a área do retângulo.';
      erros = [num(c1 * c2, 'esqueceu de dividir por 2'), num(c1 + c2, 'somou os catetos'), num(c1 * c2 / 3, 'dividiu por 3'), num(c1 + c2 + z * k, 'calculou o perímetro'), num(z * k * c1 / 2, 'usou a hipotenusa como altura')];
      params = { f: 2, c1, c2, h: z * k };
    } else if (n === 3) {
      const [x, y, z] = r.pick(TRI); const k = r.int(1, 4); const a = x * k; const b = y * k;
      ok = z * k; un = ' cm';
      enunciado = `Os catetos de um triângulo retângulo medem ${a} cm e ${b} cm. Quanto mede a hipotenusa?`;
      expl = `Teorema de Pitágoras: hipotenusa² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}. A raiz quadrada de ${a * a + b * b} é ${ok}. Hipotenusa = ${ok} cm.`;
      pega = 'No teorema de Pitágoras somam-se os QUADRADOS dos catetos e extrai-se a raiz; somar os catetos direto ou esquecer a raiz são os erros típicos.';
      erros = [num(a + b, 'somou os catetos'), num(a * a + b * b, 'esqueceu de extrair a raiz quadrada'), num(Math.abs(b - a), 'subtraiu os catetos'), num(a * b, 'multiplicou os catetos'), num(Math.round(Math.sqrt(a * a + b * b)) + 1 + k, 'estimou a raiz por aproximação errada')];
      params = { f: 3, a, b };
    } else if (n === 4) {
      const a = r.int(2, 12); const b = r.int(2, 10); const c = r.int(2, 9);
      ok = a * b * c; un = ' cm³';
      enunciado = `Um bloco em forma de paralelepípedo mede ${a} cm de comprimento, ${b} cm de largura e ${c} cm de altura. Qual é o seu volume?`;
      expl = `Volume = comprimento × largura × altura = ${a} × ${b} × ${c} = ${ok} cm³.`;
      pega = 'Volume multiplica as TRÊS dimensões e se mede em unidade ao cubo; somar as dimensões ou calcular a área de uma face não dá o volume.';
      erros = [num(2 * (a * b + a * c + b * c), 'calculou a área total da superfície', fmt), num(a + b + c, 'somou as dimensões'), num(a * b, 'calculou só a área da base'), num(a * b + b * c + a * c, 'somou as áreas das três faces distintas'), num(a * b * c * 2, 'dobrou o volume')];
      params = { f: 4, a, b, c };
    } else {
      const rr = r.int(2, 14);
      ok = 3.14 * rr * rr; un = ' cm²'; casas = 2;
      enunciado = `Um círculo tem raio de ${rr} cm. Usando π = 3,14, qual é a sua área?`;
      expl = `Área = π × raio² = 3,14 × ${rr}² = 3,14 × ${rr * rr} = ${fmt(ok, 2)} cm².`;
      pega = 'A área usa o raio ELEVADO AO QUADRADO; calcular 2πr é o comprimento da circunferência, e usar o diâmetro como raio quadruplica a área.';
      erros = [num(2 * 3.14 * rr, 'calculou o comprimento da circunferência (2πr)', (v) => fmt(v, 2)), num(3.14 * rr, 'não elevou o raio ao quadrado', (v) => fmt(v, 2)), num(3.14 * (2 * rr) * (2 * rr), 'usou o diâmetro no lugar do raio', (v) => fmt(v, 2)), num(rr * rr, 'esqueceu de multiplicar por π', (v) => fmt(v, 2)), num(3.14 * rr * rr / 2, 'dividiu a área por 2', (v) => fmt(v, 2))];
      params = { f: 5, rr };
    }
    const f2 = (v) => (casas ? fmt(v, casas) : fmt(v)) + un;
    return { enunciado, correta: { texto: f2(ok), valor: ok }, erros: erros.map((e) => ({ valor: e.valor, texto: (casas ? fmt(e.valor, casas) : e.texto) + un, porque: e.porque })), explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + f2(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) { let cel = 0; for (let i = 0; i < p.a; i++) for (let j = 0; j < p.b; j++) cel++; return p.quer === 'área' ? cel : 2 * (p.a + p.b); }
    if (p.f === 2) { const s = (p.c1 + p.c2 + p.h) / 2; return Math.sqrt(s * (s - p.c1) * (s - p.c2) * (s - p.h)); }
    if (p.f === 3) { for (let c = 1; c <= 500; c++) if (c * c === p.a * p.a + p.b * p.b) return c; throw new Error('sem hipotenusa inteira'); }
    if (p.f === 4) { let cubos = 0; for (let i = 0; i < p.a; i++) for (let j = 0; j < p.b; j++) for (let k = 0; k < p.c; k++) cubos++; return cubos; }
    const circ = 2 * 3.14 * p.rr; return circ * p.rr / 2;
  },
});

// ---------- MAT-13: resolução de situações-problema ----------
Q.CATALOGO.push({
  id: 'MAT-13-SITUACOES', topicId: 'OJ26-MAT-13', disciplina: 'MAT', titulo: 'Resolução de situações-problema',
  gerar(r, n) {
    let enunciado; let ok; let erros; let expl; let pega; let params; let fm = fmt;
    if (n === 1) {
      const n1 = r.int(2, 6); const p1 = r.int(8, 25); const n2 = r.int(2, 8); const p2 = r.int(2, 9);
      const total = n1 * p1 + n2 * p2; const N = Math.ceil((total + 1) / 50) * 50;
      ok = N - total; fm = brl;
      enunciado = `Maria comprou ${n1} cadernos de ${brl(p1)} cada e ${n2} canetas de ${brl(p2)} cada. Pagou com uma nota de ${brl(N)}. Quanto recebeu de troco?`;
      expl = `Cadernos: ${n1} × ${brl(p1)} = ${brl(n1 * p1)}. Canetas: ${n2} × ${brl(p2)} = ${brl(n2 * p2)}. Total: ${brl(total)}. Troco: ${brl(N)} − ${brl(total)} = ${brl(ok)}.`;
      pega = 'Troco é o valor pago MENOS o total da compra; conferir se todos os itens entraram na soma.';
      erros = [num(N - n1 * p1, 'esqueceu de contar as canetas', brl), num(N - n2 * p2, 'esqueceu de contar os cadernos', brl), num(total, 'respondeu o total da compra, e não o troco', brl), num(N - (n1 + n2) * p1, 'usou o preço do caderno para todos os itens', brl), num(N - (total - p2), 'contou uma caneta a menos', brl)];
      params = { f: 1, itens: [[n1, p1], [n2, p2]], N };
    } else if (n === 2) {
      const f = r.int(5, 18); const k = r.int(2, 5); const S = f * (1 + k);
      ok = f;
      enunciado = `A soma das idades de um pai e de seu filho é ${S} anos, e o pai tem ${k} vezes a idade do filho. Qual é a idade do filho?`;
      expl = `Seja f a idade do filho; o pai tem ${k}f. Então f + ${k}f = ${S}, ou seja, ${k + 1}f = ${S}, e f = ${S} ÷ ${k + 1} = ${f}. (O pai tem ${k * f}.)`;
      pega = 'Monte a equação com uma só incógnita (a idade do filho) e confira se a pergunta pede a idade do filho ou do pai.';
      erros = [num(k * f, 'respondeu a idade do pai'), num(S / 2, 'dividiu a soma por 2 (idades iguais)'), num(S / k, 'dividiu a soma por k, esquecendo que o filho também entra na soma'), num(S / (k - 1), 'dividiu pela diferença de partes'), num(S - k, 'subtraiu a razão da soma')];
      params = { f: 2, S, k };
    } else if (n === 3) {
      const d = r.pick([3, 4, 5, 6, 8]); const m = r.int(1, d - 1); const t = r.int(2, 8); const hom = t * (d - m); ok = t * d;
      enunciado = `Em uma turma, ${m}/${d} dos alunos são mulheres, e os outros ${hom} alunos são homens. Quantos alunos tem a turma?`;
      expl = `Se as mulheres são ${m}/${d}, os homens são ${d - m}/${d} da turma. Então ${d - m}/${d} do total = ${hom}, e o total é ${hom} ÷ ${d - m}/${d} = ${hom} × ${d}/${d - m} = ${ok}.`;
      pega = 'O dado conhecido (homens) corresponde à fração COMPLEMENTAR (d − m)/d, não à fração das mulheres.';
      erros = [num(hom * d / m, 'usou a fração das mulheres para os homens'), num(hom * d, 'tratou os homens como 1/' + d + ' da turma'), num(hom * (d - m), 'multiplicou os homens pelo numerador complementar'), num(hom + m, 'somou os homens ao numerador da fração'), num(t, 'respondeu o valor de uma parte (1/' + d + ' da turma)')];
      params = { f: 3, d, m, hom };
    } else if (n === 4) {
      const [a, b, c] = r.pick([[6, 3, 2], [12, 6, 4], [10, 15, 6], [20, 30, 12], [4, 12, 3], [12, 4, 3], [30, 20, 12], [15, 10, 6], [6, 12, 4], [24, 8, 6], [18, 9, 6], [20, 5, 4]]);
      ok = c;
      enunciado = `Uma torneira enche um tanque sozinha em ${a} horas e outra, sozinha, em ${b} horas. Com as duas abertas ao mesmo tempo, em quantas horas o tanque fica cheio?`;
      expl = `Em 1 hora, a primeira enche 1/${a} do tanque e a segunda, 1/${b}. Juntas: 1/${a} + 1/${b} = ${a + b}/${a * b} do tanque por hora. O tempo é o inverso: ${a * b}/${a + b} = ${c} horas.`;
      pega = 'Somam-se as TAXAS (parte do tanque por hora), não os tempos, e depois se inverte para obter o tempo.';
      erros = [num((a + b) / 2, 'tirou a média dos dois tempos'), num(a + b, 'somou os tempos'), num(Math.abs(a - b), 'subtraiu os tempos'), num(Math.min(a, b), 'considerou só a torneira mais rápida'), num(a * b, 'multiplicou os tempos')];
      params = { f: 4, a, b };
    } else {
      const B = r.int(6, 20); const x = r.int(2, 10); const S = 3 * B + x; ok = 2 * B + x;
      enunciado = `A soma das idades atuais de Ana e Bia é ${S} anos. Daqui a ${x} anos, Ana terá o dobro da idade que Bia terá. Qual é a idade atual de Ana?`;
      expl = `Seja b a idade de Bia hoje; Ana tem ${S} − b. Daqui a ${x} anos: (${S} − b) + ${x} = 2(b + ${x}). Então ${S + x} − b = 2b + ${2 * x}, logo 3b = ${S + x - 2 * x} e b = ${B}. Ana tem ${S} − ${B} = ${ok}.`;
      pega = 'A condição "o dobro" vale daqui a x anos, e não hoje; é preciso somar x às DUAS idades antes de aplicar o dobro.';
      erros = [num(S / 2, 'supôs idades iguais'), num(2 * B, 'esqueceu de somar os anos futuros'), num(B, 'respondeu a idade de Bia'), num(2 * (B + x), 'respondeu a idade futura de Ana'), num(ok + x, 'respondeu a idade de Ana daqui a ' + x + ' anos')];
      params = { f: 5, S, x };
    }
    return { enunciado, correta: { texto: fm(ok), valor: ok }, erros, explicacao: expl, pegadinha: pega, params, comentarioCorreta: 'Resultado: ' + fm(ok) + '.' };
  },
  resolver(p) {
    if (p.f === 1) { let tot = 0; for (const [q, pr] of p.itens) for (let i = 0; i < q; i++) tot += pr; return p.N - tot; }
    if (p.f === 2) { const s = []; for (let f = 1; f <= 120; f++) if (f + p.k * f === p.S) s.push(f); if (s.length !== 1) throw new Error('idade não única'); return s[0]; }
    if (p.f === 3) { const s = []; for (let T = 1; T <= 2000; T++) if ((T * p.m) % p.d === 0 && T - (T * p.m) / p.d === p.hom) s.push(T); if (s.length !== 1) throw new Error('total não único'); return s[0]; }
    if (p.f === 4) { for (let h = 1; h <= 200; h++) if (h * (p.a + p.b) === p.a * p.b) return h; throw new Error('sem tempo inteiro'); }
    const s = []; for (let A = 1; A < p.S; A++) { const B = p.S - A; if (A + p.x === 2 * (B + p.x)) s.push(A); }
    if (s.length !== 1) throw new Error('idade não única'); return s[0];
  },
});
void mdc; void NOMES; void pctTxt;
