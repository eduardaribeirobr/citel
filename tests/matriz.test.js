'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('../src/matriz.js');
const { calcularProgresso } = require('../src/progresso.js');

const RAIZ = path.join(__dirname, '..');
const TEXTO = fs.readFileSync(path.join(RAIZ, 'data/fonte/edital-2026.txt'), 'utf8');
const matriz = M.construirMatriz(TEXTO);
const porChave = {};
for (const t of matriz.topicos) {
  const k = t.disciplina + '/' + (t.diploma ? t.diploma.cod : '-');
  porChave[k] = (porChave[k] || []).concat(t);
}
const artigos = (k) => porChave[k].reduce((s, t) => s + t.n_dispositivos, 0);

test('proveniência: o texto-fonte guardado tem o SHA-256 registrado', () => {
  const prov = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fonte/proveniencia.json'), 'utf8'));
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, 'data/fonte/edital-2026.txt'))).digest('hex');
  assert.equal(h, prov.arquivos.edital.texto_sha256);
  assert.equal(TEXTO.split('\f').length - 1, prov.arquivos.edital.paginas);
});

test('estrutura: 3 blocos, 12 disciplinas e 198 tópicos', () => {
  assert.equal(matriz.blocos.length, 3);
  assert.equal(matriz.disciplinas.length, 12);
  assert.equal(matriz.topicos.length, 198);
});

test('questões por bloco e por grupo conforme o edital (15 + 40 + 15 = 70)', () => {
  const q = Object.fromEntries(matriz.blocos.map((b) => [b.id, b.questoes]));
  assert.deepEqual(q, { B1: 15, B2: 40, B3: 15 });
  assert.equal(q.B1 + q.B2 + q.B3, 70);
  const d = Object.fromEntries(matriz.disciplinas.map((x) => [x.cod, x.questoes]));
  assert.equal(d.LP, 15);
  assert.equal(d.ATUA, 3);
  assert.equal(d.MAT, 3);
  assert.equal(d.RLOG, 4);
  assert.equal(d.INFO, 5);
  assert.equal(d.ATUA + d.MAT + d.RLOG + d.INFO, 15);
  for (const c of ['DPEN', 'DPPE', 'DPCI', 'DCON', 'DADM', 'DCIV', 'LESP']) {
    assert.equal(d[c], null, c + ': o edital não discrimina questões por disciplina no Bloco II');
  }
});

test('regras de caráter por bloco (Cap. X): I e II eliminatórios com 50%; III só classifica; discursiva sobre o Bloco II', () => {
  const b = Object.fromEntries(matriz.blocos.map((x) => [x.id, x]));
  assert.equal(b.B1.eliminatorio, true);
  assert.equal(b.B2.eliminatorio, true);
  assert.equal(b.B3.eliminatorio, false);
  assert.equal(b.B1.acerto_minimo, 0.5);
  assert.equal(b.B2.na_discursiva, true);
  assert.equal(b.B1.na_discursiva, false);
});

test('contagem MANUAL independente de artigos por diploma (feita antes de rodar o código)', () => {
  const esperado = {
    'DPEN/CP': 87, 'DPPE/CPP': 148, 'DPPE/L9099': 8, 'DPCI/CPC': 232, 'DPCI/L9099': 4, 'DCON/CF': 33,
    'DADM/L10261': 18, 'DADM/L8429': 2, 'DCIV/CC': 186, 'LESP/L6830': 6, 'LESP/CNJ354': 4, 'LESP/NSCGJ': 127, 'ATUA/L13146': 27,
  };
  for (const [k, v] of Object.entries(esperado)) assert.equal(artigos(k), v, k);
  assert.equal(Object.values(esperado).reduce((a, b) => a + b, 0), 882);
  assert.equal(matriz.topicos.reduce((s, t) => s + t.n_dispositivos, 0), 882);
});

test('diplomas integrais não têm artigos listados no edital: Decreto-Lei 4.657/1942 e Lei 11.608/2003', () => {
  for (const id of ['OJ26-DCIV-LINDB-01', 'OJ26-LESP-L11608-01']) {
    const t = matriz.topicos.find((x) => x.id === id);
    assert.ok(t, id);
    assert.equal(t.integral, true);
    assert.equal(t.n_dispositivos, 0);
    assert.equal(t.esforco_min, 120);
  }
});

test('contador independente: nº de tópicos de cada lista = números − intervalos no texto literal', () => {
  let verificados = 0;
  for (const t of matriz.topicos) {
    if (!t.lista_literal_do_diploma) continue;
    const lit = t.lista_literal_do_diploma;
    const numeros = (lit.match(/\d[\d.]*(?:-[A-Z])?/g) || []).length;
    const intervalos = (lit.match(/\ba\b/g) || []).length;
    const k = t.disciplina + '/' + t.diploma.cod;
    assert.equal(porChave[k].length, numeros - intervalos, k);
    verificados++;
  }
  assert.equal(verificados, 12);   // 13 diplomas com lista, menos as Normas da Corregedoria (linhas por capítulo/seção)
});

test('Normas da Corregedoria: um tópico por linha "Tomo I – ..." do edital', () => {
  const linhas = (M.construirMatriz.toString(), TEXTO.split('\f').slice(59, 62).join('\n').match(/Tomo I – /g) || []).length;
  assert.equal(linhas, 13);
  assert.equal(porChave['LESP/NSCGJ'].length, linhas);
  const inciso = porChave['LESP/NSCGJ'].find((t) => t.detalhe && t.detalhe.inciso);
  assert.equal(inciso.detalhe.inciso, 'XX');
  const par = porChave['LESP/NSCGJ'].find((t) => t.detalhe && t.detalhe.paragrafo);
  assert.equal(par.detalhe.paragrafo, '1º');
});

test('fidelidade: a lista interpretada reproduz o texto literal de cada diploma', () => {
  for (const t of matriz.topicos) {
    if (!t.lista_literal_do_diploma) continue;
    const k = t.disciplina + '/' + t.diploma.cod;
    const recomposto = porChave[k].map((x) => x.dispositivos.map((d) => (d.isolado ? d.de : d.de + ' a ' + d.ate)).join('; ')).join('; ');
    assert.equal(recomposto, M.canonicoDoOriginal(t.lista_literal_do_diploma), k);
  }
});

test('identificadores: únicos, no padrão e numerados em sequência a partir de 01', () => {
  const ids = matriz.topicos.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^OJ26-[A-Z]+(?:-[A-Z0-9]+)?-\d{2}$/);
  for (const [k, lista] of Object.entries(porChave)) {
    const nums = lista.map((t) => parseInt(t.id.slice(-2), 10));
    assert.deepEqual(nums, nums.map((_, i) => i + 1), k);
  }
});

test('Língua Portuguesa (13 itens), Matemática (13), Raciocínio Lógico (1), Informática (7), Atualidades (1 + 3 intervalos da Lei 13.146)', () => {
  assert.equal(porChave['LP/-'].length, 13);
  assert.equal(porChave['MAT/-'].length, 13);
  assert.equal(porChave['RLOG/-'].length, 1);
  assert.equal(porChave['INFO/-'].length, 7);
  assert.equal(porChave['ATUA/-'].length, 1);
  assert.equal(porChave['ATUA/L13146'].length, 3);
  assert.match(porChave['LP/-'][11].texto_edital, /^Crase\.?$/);
  assert.match(porChave['INFO/-'][2].titulo, /MS-Excel/);
  assert.match(porChave['RLOG/-'][0].texto_edital, /estruturas lógicas, lógicas de argumentação, diagramas lógicos, sequências/);
});

test('exemplos de contagem: "396 a 396-A" = 2, "311-A" = 1, "994 a 1.091-A" = 99 (mínimo), "1.001" = artigo 1001', () => {
  const [a] = M.parseListaArtigos('396 a 396-A');
  assert.equal(M.contarItem(a), 2);
  const [b] = M.parseListaArtigos('311-A');
  assert.equal(M.contarItem(b), 1);
  const [c] = M.parseListaArtigos('994 a 1.091-A');
  assert.equal(M.contarItem(c), 99);
  const [d] = M.parseListaArtigos('1.001');
  assert.equal(d.de.n, 1001);
  assert.equal(M.fmtNumero(d.de), '1.001');
  const itens = M.parseListaArtigos('156, 185; 336 e 337; 49 a 50');
  assert.deepEqual(itens.map((x) => M.fmtNumero(x.de) + (x.de === x.ate ? '' : '-' + M.fmtNumero(x.ate))), ['156', '185', '336', '337', '49-50']);
});

test('o interpretador é estrito: texto desconhecido, intervalo invertido ou vazio são recusados', () => {
  for (const ruim of ['', 'abc', '12 a x', '5 a 3', '1º a', '12-', '311-AB', '3,,4', '3;;4', ';5', 'artigos']) {
    assert.throws(() => M.parseListaArtigos(ruim), Error, 'deveria recusar: "' + ruim + '"');
  }
  // pontuação no FIM da lista é normal no edital ("...; 37)." / "...; 13.") e é descartada de propósito
  assert.equal(M.parseListaArtigos('1 a 3.').length, 1);
  assert.equal(M.parseListaArtigos('1º; 2º;').length, 2);
});

test('falha de forma explícita quando o texto do edital muda ou as páginas estão erradas', () => {
  assert.throws(() => M.construirMatriz(TEXTO.replace('Código Penal – artigos', 'Codigo Penal – artigos')), /marcador do diploma não encontrado/);
  assert.throws(() => M.construirMatriz(TEXTO, { primeiraPagina: 1, ultimaPagina: 3 }), /Anexo VIII não encontrado/);
  assert.throws(() => M.construirMatriz(TEXTO.replace('1º a 12; 100 a 106', '1º a 1x2; 100 a 106')), Error);
  // o título do Bloco III aparece também no Cap. X (p.35): troca-se a ÚLTIMA ocorrência, que é a do Anexo VIII
  const iUltimo = TEXTO.lastIndexOf('BLOCO III: Conhecimentos Gerais');
  assert.ok(iUltimo > TEXTO.indexOf('ANEXO VIII'));
  const semBloco3 = TEXTO.slice(0, iUltimo) + 'BLOCO III: Outro' + TEXTO.slice(iUltimo + 'BLOCO III: Conhecimentos Gerais'.length);
  assert.throws(() => M.construirMatriz(semBloco3), /blocos fora da ordem esperada/);
  assert.throws(() => M.construirMatriz(TEXTO.replace('Informática\n05 questões', 'Informática\n05 perguntas')), Error);
});

test('modelo de esforço (estimativa) aplicado conforme a fórmula documentada', () => {
  const ach = (disc, lit) => matriz.topicos.find((t) => t.disciplina === disc && t.texto_edital === lit);
  assert.equal(ach('DPEN', '1 a 12').esforco_min, 20 + 6 * 12);
  assert.equal(ach('DPEN', '129').esforco_min, 26);
  assert.equal(ach('DPCI', '203 a 259').esforco_min, 20 + 6 * 57);
  assert.equal(ach('DPCI', '203 a 259').complexidade_derivada, 5);
  assert.equal(ach('DPEN', '129').complexidade_derivada, 1);
  assert.equal(matriz.topicos.find((t) => t.id === 'OJ26-LP-01').esforco_min, 120);
  assert.equal(matriz.topicos.find((t) => t.id === 'OJ26-LP-02').esforco_min, 45);
  assert.equal(matriz.topicos.find((t) => t.id === 'OJ26-RLOG-01').esforco_min, 180);
  assert.equal(matriz.topicos.find((t) => t.id === 'OJ26-INFO-01').esforco_min, 30);
  assert.equal(M.complexidadeDerivada(45), 1);
  assert.equal(M.complexidadeDerivada(46), 2);
  assert.equal(M.complexidadeDerivada(240), 4);
  assert.equal(M.complexidadeDerivada(241), 5);
  for (const t of matriz.topicos) assert.ok(t.esforco_min > 0 && t.esforco_origem);
});

test('nenhum tópico começa estudado, nenhum rótulo de dispositivo foi inventado e todas as páginas são 60 a 62', () => {
  for (const t of matriz.topicos) {
    assert.equal(t.status_aprendizado, 'NÃO INICIADO');
    assert.equal(t.cobertura, 0);
    assert.equal(t.rotulo_do_dispositivo, null);
    assert.ok(t.fonte_pagina >= 60 && t.fonte_pagina <= 62, t.id + ' página ' + t.fonte_pagina);
  }
  assert.equal(matriz.frequencia_historica_vunesp.slice(0, 11), 'não apurada');
});

test('página de origem de cada tópico confere com a página do PDF onde o texto aparece (60, 61 ou 62)', () => {
  const pg = (id) => matriz.topicos.find((t) => t.id === id).fonte_pagina;
  assert.equal(pg('OJ26-LP-01'), 60);
  assert.equal(pg('OJ26-DPEN-CP-01'), 60);
  assert.equal(pg('OJ26-DPPE-CPP-01'), 60);
  assert.equal(pg('OJ26-DPCI-CPC-01'), 61);
  assert.equal(pg('OJ26-DCIV-CC-01'), 61);
  assert.equal(pg('OJ26-LESP-NSCGJ-01'), 61);
  assert.equal(pg('OJ26-ATUA-01'), 61);
  assert.equal(pg('OJ26-ATUA-L13146-01'), 61);
  assert.equal(pg('OJ26-MAT-01'), 62);
  assert.equal(pg('OJ26-RLOG-01'), 62);
  assert.equal(pg('OJ26-INFO-01'), 62);
  // verificação independente: o texto do tópico está mesmo na página registrada
  const paginas = TEXTO.normalize('NFC').split('\f');
  for (const id of ['OJ26-LP-13', 'OJ26-MAT-12', 'OJ26-INFO-07', 'OJ26-LP-01']) {
    const t = matriz.topicos.find((x) => x.id === id);
    const trecho = t.texto_edital.slice(0, 18);
    assert.ok(paginas[t.fonte_pagina - 1].replace(/\s+/g, ' ').includes(trecho), id + ' não está na página ' + t.fonte_pagina);
  }
});

test('a matriz gravada em disco é idêntica à reconstruída do texto do edital (sem divergência)', () => {
  const emDisco = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/matriz-edital.json'), 'utf8'));
  assert.deepEqual(emDisco, JSON.parse(JSON.stringify(matriz)));
});

test('o CSV tem uma linha por tópico e o mesmo conjunto de identificadores', () => {
  const linhas = fs.readFileSync(path.join(RAIZ, 'data/matriz-edital.csv'), 'utf8').replace(/^﻿/, '').trim().split('\n');
  assert.equal(linhas.length, matriz.topicos.length + 1);
  const ids = linhas.slice(1).map((l) => l.split(';')[0]);
  assert.deepEqual(ids, matriz.topicos.map((t) => t.id));
});

test('integração com o motor de progresso: carga restante = soma dos esforços e 0% no início', () => {
  const AGORA = Date.UTC(2026, 10, 20, 15, 0, 0);
  const PROVA = Date.UTC(2027, 2, 14, 17, 0, 0);
  const topicos = matriz.topicos.map((t) => ({ id: t.id, esforcoMin: t.esforco_min }));
  const r = calcularProgresso({ topicos, eventos: [], sessoes: [], estudados: [], agora: AGORA, dataProva: PROVA, revisoesVencidas: 0 });
  const soma = matriz.topicos.reduce((s, t) => s + t.esforco_min, 0);
  assert.equal(r.carga.restanteMin, soma);
  assert.equal(r.percentualGeral, 0);
  assert.equal(r.totalTopicos, 198);
  assert.equal(r.contagemPorEstado['NÃO INICIADO'], 198);
  assert.ok(r.meta.necessarioMinDia > 0 && Number.isFinite(r.meta.necessarioMinDia));
});
