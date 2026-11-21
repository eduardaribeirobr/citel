'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../src/fontes.js');
const S = require('../src/fontes-senado.js');
const matriz = require('../data/matriz-edital.json');

// ---------- fixtures sintéticas (cada regra de versão com um caso próprio) ----------
const v = (data, tipo, texto) => ({ legislationDate: data, legislationType: tipo, text: texto });
const no = (sufixo, versoes, filhos) => { const n = { '@type': 'Legislation', legislationIdentifier: 'urn:lex:br:federal:lei:2000-01-01;1!' + sufixo, workExample: versoes }; if (filhos) n.hasPart = filhos; return n; };
const norma = (...artigos) => ({ '@type': 'Legislation', hasPart: artigos });
const REF = '2026-10-14';

test('versões: vale a última versão até a data do edital; alteração posterior é ignorada', () => {
  const j = norma(no('art5', [v('2000-01-01', 'Original_Version', null)], [no('art5_cpt', [v('2000-01-01', 'Original_Version', 'Texto A.'), v('2010-05-05', 'Text_Change_Version', 'Texto B.'), v('2030-01-01', 'Text_Change_Version', 'Texto C.')])]));
  const r = S.artigosSenadoJson(j, REF);
  assert.deepEqual(Object.keys(r.artigos), ['5']); assert.equal(r.artigos['5'], 'Art. 5º Texto B.');
  assert.equal(S.artigosSenadoJson(j, '2005-01-01').artigos['5'], 'Art. 5º Texto A.', 'em outra data, outra redação');
  assert.equal(S.artigosSenadoJson(j, '2031-01-01').artigos['5'], 'Art. 5º Texto C.');
});

test('dispositivos: revogado some, inserido depois não existe, decisão judicial é omitida (e contada), o resto do artigo fica', () => {
  const j = norma(no('art10', [v('2000-01-01', 'Original_Version', null)], [
    no('art10_cpt', [v('2000-01-01', 'Original_Version', 'Caput vigente.')]),
    no('art10_par1', [v('2000-01-01', 'Original_Version', 'Parágrafo velho.'), v('2015-01-01', 'Repeal_Version', null)]),
    no('art10_par2', [v('2027-01-01', 'Insertion_Version', 'Parágrafo futuro.')]),
    no('art10_par3', [v('2000-01-01', 'Original_Version', 'Parágrafo discutido.'), v('2020-01-01', 'Court_Decision_Version', 'Parágrafo discutido, como decidiu o tribunal.')]),
    no('art10_par4', [v('2000-01-01', 'Original_Version', 'Quarto parágrafo.')]),
  ]));
  const r = S.artigosSenadoJson(j, REF);
  assert.equal(r.artigos['10'], 'Art. 10. Caput vigente.\n§ 4º Quarto parágrafo.');
  assert.deepEqual(r.omitidos, { 10: 1 }, 'só o dispositivo duvidoso conta como omitido');
  for (const t of ['Suppression_Version', 'Applicability_Suppression_Version', 'Vetoed_Text_Change_Version']) {
    const k = norma(no('art11', [v('2000-01-01', 'Original_Version', null)], [no('art11_cpt', [v('2000-01-01', 'Original_Version', 'Texto.')]), no('art11_par1', [v('2000-01-01', 'Original_Version', 'X.'), v('2012-01-01', t, 'X alterado.')])]));
    assert.deepEqual(S.artigosSenadoJson(k, REF).omitidos, { 11: 1 }, t);
  }
});

test('artigo: revogado, sem nenhum dispositivo usável, com letra, inserido depois e rótulo oficial', () => {
  const j = norma(
    no('art20', [v('2000-01-01', 'Original_Version', null), v('2010-01-01', 'Repeal_Version', null)], [no('art20_cpt', [v('2000-01-01', 'Original_Version', 'Antigo.'), v('2010-01-01', 'Repeal_Version', null)])]),
    no('art21', [v('2000-01-01', 'Original_Version', null)], [no('art21_cpt', [v('2000-01-01', 'Original_Version', 'A.'), v('2011-01-01', 'Repeal_Version', null)]), no('art21_par1', [v('2000-01-01', 'Original_Version', 'B.'), v('2011-01-01', 'Repeal_Version', null)])]),
    no('art22', [v('2000-01-01', 'Original_Version', null)], [no('art22_cpt', [v('2000-01-01', 'Original_Version', 'T.'), v('2018-01-01', 'Court_Decision_Version', 'T com decisão.')])]),
    no('art48-1', [v('2005-01-01', 'Insertion_Version', null)], [no('art48-1_cpt', [v('2005-01-01', 'Insertion_Version', 'Com letra.')])]),
    no('art99', [v('2030-01-01', 'Insertion_Version', null)], [no('art99_cpt', [v('2030-01-01', 'Insertion_Version', 'Futuro.')])]),
  );
  const a = S.artigosSenadoJson(j, REF).artigos;
  assert.equal(a['20'], 'Art. 20. (Revogado)'); assert.equal(a['21'], 'Art. 21. (Revogado)', 'todos os dispositivos revogados');
  assert.match(a['22'], /Texto com supressão ou decisão judicial/); assert.equal(a['48-A'], 'Art. 48-A. Com letra.'); assert.equal(a['99'], undefined, 'inserido depois da data não existe');
  const f = (t) => ({ artigos: { 1: t } });
  assert.equal(F.situacao(f(a['20']), '1'), 'revogado'); assert.equal(F.situacao(f(a['22']), '1'), 'incerto'); assert.equal(F.situacao(f(a['48-A']), '1'), 'vigente');
  assert.equal(F.conferirCitacao({ artigos: { 22: a['22'] }, meta: { nome: 'x' }, texto: '' }, '22', 'Texto com supressão ou decisão judicial').ok, false);
});

test('formatação dos dispositivos: caput, parágrafos, parágrafo único, incisos romanos, alíneas e identificadores com sufixo de norma', () => {
  const j = norma(no('art30', [v('2000-01-01', 'Original_Version', null)], [
    no('art30_cpt', [v('2000-01-01', 'Original_Version', 'Caput:')]),
    no('art30_cpt_inc1', [v('2000-01-01', 'Original_Version', 'primeiro;')]), no('art30_cpt_inc4', [v('2000-01-01', 'Original_Version', 'quarto:')]), no('art30_cpt_inc4_ali2', [v('2000-01-01', 'Original_Version', 'segunda alínea;')]),
    no('art30_par1', [v('2000-01-01', 'Original_Version', 'Um.')]), no('art30_par10', [v('2000-01-01', 'Original_Version', 'Dez.')]), no('art30_par1u', [v('2000-01-01', 'Original_Version', 'Único.')]),
    no('art30_par2,lei-5-2001-01-01', [v('2001-01-01', 'Insertion_Version', 'Dois, inserido por lei.')]), no('art30_par2', [v('2001-01-01', 'Insertion_Version', 'Dois, inserido por lei.'), v('2008-01-01', 'Text_Change_Version', 'Dois, alterado.')]),
  ]));
  assert.equal(S.artigosSenadoJson(j, REF).artigos['30'], ['Art. 30. Caput:', 'I - primeiro;', 'IV - quarto:', 'b) segunda alínea;', '§ 1º Um.', '§ 10. Dez.', 'Parágrafo único. Único.', '§ 2º Dois, alterado.'].join('\n'));
  assert.deepEqual([S.romano(4), S.romano(9), S.romano(14), S.romano(1994), S.letra(1), S.letra(26)], ['IV', 'IX', 'XIV', 'MCMXCIV', 'A', 'Z']);
});

test('limpeza de anotações: tira marcação XML e anotações legislativas, preserva parênteses do texto da lei, sinaliza decisão judicial', () => {
  const l = S.limparAnotacoes;
  assert.equal(l('conforme a <span xmlns="http://www.lexml.gov.br/1.0" xlink:href="urn:x">Constituição</span> da República.').texto, 'conforme a Constituição da República.');
  assert.equal(l('Texto da regra. (Redação dada pela Lei nº 1.234, de 5 de maio de 2001)').texto, 'Texto da regra.');
  assert.equal(l('Matar mulher: (“Caput” do artigo acrescido pela Lei nº 14.994, de 9/10/2024)').texto, 'Matar mulher:');
  assert.equal(l('Pena - reclusão, de 20 a 40 anos. (Pena acrescida pela Lei nº 14.994, de 2024)').texto, 'Pena - reclusão, de 20 a 40 anos.');
  assert.equal(l('Incluído pelo texto (Incluído pela Emenda Constitucional nº 5, de 1999) fim').texto, 'Incluído pelo texto fim');
  for (const preservar of ['conforme o disposto (art. 5º) e a regra (inciso II)', 'nos termos da Lei nº 8.069, de 13 de julho de 1990 (Estatuto da Criança e do Adolescente)', '(Revogado pela Lei nº 9.520, de 27/11/1997)', '(VETADO)', 'prazo de 10 (dez) dias']) assert.equal(l(preservar).texto, preservar);
  assert.equal(l('Texto. (Vide ADI 4277)').duvida, true); assert.equal(l('Expressão. (Expressão declarada inconstitucional pelo STF)').duvida, true); assert.equal(l('Texto. (Redação dada pela Lei nº 1, de 2000)').duvida, false);
  assert.equal(l('a &amp; b &nbsp;c').texto, 'a & b c');
});

test('texto compilado (HTML): rubricas e títulos saem, anotações saem, ordinais são ajustados, linha com decisão judicial é omitida e contada', () => {
  const t = ['CAPÍTULO I', 'Da aplicação da lei', 'Art. 1 º Esta lei regula o caso. (Redação dada pela Lei nº 5, de 2001)', 'Anterioridade da lei', 'Parágrafo único. O prazo é de 10 (dez) dias.', 'Art. 2º (Revogado pela Lei nº 9, de 2002)',
    'Art. 3º A regra vale. (Vide ADI 123)', 'Art. 4º Cumpre-se o mandado.', '§ 1 º Primeiro parágrafo, com texto. (Expressão declarada inconstitucional pelo STF)', '§ 2º Segundo parágrafo normal.', 'Art. 12 da Lei 8.069 não é artigo novo.'].join('\n');
  const r = S.artigosSenadoHtml(t);
  assert.deepEqual(Object.keys(r.artigos).sort(), ['1', '2', '3', '4']);
  assert.equal(r.artigos['1'], 'Art. 1º Esta lei regula o caso.\nParágrafo único. O prazo é de 10 (dez) dias.');
  assert.equal(r.artigos['2'], 'Art. 2º (Revogado pela Lei nº 9, de 2002)');
  assert.match(r.artigos['3'], /Texto com supressão ou decisão judicial/); assert.equal(r.artigos['4'], 'Art. 4º Cumpre-se o mandado.\n§ 2º Segundo parágrafo normal.\nArt. 12 da Lei 8.069 não é artigo novo.');
  assert.deepEqual(r.omitidos, { 3: 1, 4: 1 });
  assert.equal(F.situacao({ artigos: r.artigos }, '2'), 'revogado'); assert.equal(F.situacao({ artigos: r.artigos }, '3'), 'incerto');
});

// ---------- fontes reais ----------
const FED = Object.keys(F.carregarIndice()).filter((k) => k.startsWith('senado-')); const LID = {}; const lido = (id) => (LID[id] = LID[id] || F.lerFonte(id));

test('as 10 normas federais estão ingeridas, com proveniência completa e hash do arquivo e do conteúdo', () => {
  assert.equal(FED.length, 10); const idx = F.carregarIndice();
  for (const id of FED) {
    const m = idx[id]; assert.match(m.url, /^https:\/\/normas\.leg\.br\/api\/public\/normas\?urn=urn:lex:br:federal:/); assert.match(m.urn, /^urn:lex:br:federal:/);
    assert.match(m.consultado_em, /^\d{4}-\d\d-\d\d$/); assert.equal(m.sha256.length, 64); assert.equal(m.sha256_bruto.length, 64); assert.equal(m.licenca, 'https://creativecommons.org/licenses/by/4.0/');
    assert.ok(['senado-json', 'senado-html'].includes(m.formato)); assert.ok(m.observacao.length > 40);
    if (m.formato === 'senado-html') assert.ok(m.texto_salvo_em, id + ': texto compilado sem data de salvamento');
  }
  assert.deepEqual(FED.filter((i) => idx[i].formato === 'senado-json').sort(), ['senado-cc-2002', 'senado-cf-1988', 'senado-cpc-2015']);
});

test('integridade: alterar o arquivo guardado (compactado ou o conteúdo) é detectado', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sen-')); const zlib = require('zlib'); const crypto = require('crypto');
  const raiz = path.join(__dirname, '..'); const id = 'senado-lindb-1942'; const m = F.carregarIndice()[id];
  fs.mkdirSync(path.join(tmp, path.dirname(m.arquivo)), { recursive: true });
  const bruto = zlib.gunzipSync(fs.readFileSync(path.join(raiz, m.arquivo)));
  const alterado = zlib.gzipSync(Buffer.from(bruto.toString('utf8').replace('quarenta e cinco dias', 'quarenta e seis dias')));
  fs.writeFileSync(path.join(tmp, m.arquivo), alterado);
  fs.writeFileSync(path.join(tmp, 'data-indice-nao-usado'), '');
  fs.mkdirSync(path.join(tmp, 'data/fontes'), { recursive: true });
  const idx = { [id]: Object.assign({}, m, { sha256: crypto.createHash('sha256').update(alterado).digest('hex') }) };       // hash do .gz "consertado": só o do conteúdo pega
  fs.writeFileSync(path.join(tmp, 'data/fontes/indice.json'), JSON.stringify(idx));
  assert.throws(() => F.lerFonte(id, tmp), /conteúdo.*não confere/);
  fs.writeFileSync(path.join(tmp, m.arquivo), fs.readFileSync(path.join(raiz, m.arquivo)).subarray(0, 100));
  assert.throws(() => F.lerFonte(id, tmp), /hash.*não confere/);
});

test('textos de referência conferem com a fonte oficial (e a fonte manda: art. 2º da Lei 9.099 diz "buscando")', () => {
  const t = (id, k) => lido(id).artigos[k];
  assert.match(t('senado-cc-2002', '1583'), /^Art\. 1583\. A guarda será unilateral ou compartilhada\.\n§ 1º Compreende-se por guarda unilateral/);
  assert.equal(t('senado-cc-2002', '194'), 'Art. 194. (Revogado)'); assert.equal(F.situacao(lido('senado-cc-2002'), '194'), 'revogado');
  assert.match(t('senado-cc-2002', '48-A'), /^Art\. 48-A\. As pessoas jurídicas de direito privado/);
  assert.match(t('senado-cf-1988', '1'), /^Art\. 1º A República Federativa do Brasil[\s\S]*\nI - a soberania;\nII - a cidadania;/);
  assert.match(t('senado-cf-1988', '5'), /^Art\. 5º Todos são iguais perante a lei, sem distinção de qualquer natureza/); assert.ok(lido('senado-cf-1988').omitidos['5'] >= 1, 'art. 5º tem dispositivo omitido por dúvida judicial');
  assert.match(t('senado-cpc-2015', '1'), /^Art\. 1º O processo civil será ordenado, disciplinado e interpretado conforme os valores e as normas fundamentais estabelecidos na Constituição da República Federativa do Brasil, observando-se as disposições deste Código\.$/);
  assert.match(t('senado-cp-1940', '121'), /^Art\. 121\. Matar alguém:\nPena - reclusão, de seis a vinte anos\.\n§ 1º Se o agente comete o crime impelido/);
  assert.match(t('senado-cp-1940', '121-A'), /^Art\. 121-A\. Matar mulher por razões da condição do sexo feminino:\nPena - reclusão, de 20 \(vinte\) a 40 \(quarenta\) anos\.\n§ 1º/);
  assert.equal(t('senado-cpp-1941', '35'), 'Art. 35. (Revogado pela Lei nº 9.520, de 27/11/1997)'); assert.equal(F.situacao(lido('senado-cpp-1941'), '35'), 'revogado');
  assert.match(t('senado-lei-9099-1995', '2'), /critérios da oralidade, simplicidade, informalidade, economia processual e celeridade, buscando, sempre que possível, a conciliação ou a transação\.$/);
  assert.match(t('senado-lindb-1942', '1'), /^Art\. 1º Salvo disposição contrária, a lei começa a vigorar em todo o país quarenta e cinco dias depois de oficialmente publicada\./);
  assert.equal(F.situacao(lido('senado-lei-13146-2015'), '82'), 'vetado');
  assert.match(t('senado-lei-6830-1980', '1'), /^Art\. 1º A execução judicial para cobrança da Dívida Ativa da União, dos Estados, do Distrito Federal, dos Municípios e respectivas autarquias/);
});

test('nenhum texto federal tem marcação XML/HTML, entidade solta ou anotação legislativa sobrando', () => {
  for (const id of FED) {
    const f = lido(id); const ruins = [];
    for (const [k, a] of Object.entries(f.artigos)) {
      if (/<[a-z/][^>]*>|&[a-z]+;|xmlns|xlink:/.test(a)) ruins.push(k + ': marcação');
      if (/\((?:Redação dada|Incluíd[oa]|Acrescid[oa]|Renumerad[oa]|Vide\b|“Caput” d)[^)]*\)/.test(a)) ruins.push(k + ': anotação');
      if (!/^Art\. \d/.test(a)) ruins.push(k + ': não começa com "Art. N"');
    }
    assert.deepEqual(ruins.slice(0, 5), [], id + ' tem ' + ruins.length + ' problemas');
    const sit = Object.keys(f.artigos).filter((k) => F.situacao(f, k) === 'vigente').length; assert.ok(sit > 20, id + ': poucos artigos vigentes');
  }
});

test('edital × texto oficial federal: TODO artigo citado existe, inclusive os extremos exatos, e os inutilizáveis são identificados', () => {
  const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fontes/mapa-diplomas.json'), 'utf8')); const chave = (x) => String(x).replace(/\./g, '').replace(/[º°\s]/g, '').toUpperCase();
  const esperado = { 'senado-cpc-2015': 232, 'senado-cc-2002': 186, 'senado-cpp-1941': 147, 'senado-cp-1940': 87, 'senado-cf-1988': 33, 'senado-lei-13146-2015': 27, 'senado-lei-9099-1995': 12, 'senado-lei-6830-1980': 6, 'senado-lei-8429-1992': 2, 'senado-lindb-1942': 0 };
  const inutil = {};
  for (const [nome, id] of Object.entries(mapa).filter(([, i]) => i.startsWith('senado-'))) {
    const f = lido(id); const ks = Object.keys(f.artigos).map((k) => k.toUpperCase()); let n = 0; inutil[id] = [];
    for (const t of matriz.topicos.filter((x) => x.diploma && x.diploma.nome === nome)) for (const d of t.dispositivos || []) {
      assert.ok(ks.includes(chave(d.de)), id + ': extremo inicial ausente ' + d.de); if (d.ate) assert.ok(ks.includes(chave(d.ate)), id + ': extremo final ausente ' + d.ate);
      for (let i = parseInt(chave(d.de), 10); i <= parseInt(chave(d.ate || d.de), 10); i++) { n++; const k = ks.find((x) => x === String(i)); assert.ok(k, id + ': art. ' + i + ' ausente'); if (F.situacao(f, f.artigos[k] ? k : Object.keys(f.artigos).find((y) => y.toUpperCase() === k)) !== 'vigente') inutil[id].push(i); }
    }
    assert.equal(n, esperado[id], id);
  }
  assert.deepEqual(inutil['senado-cc-2002'].filter((x) => [194, 1776].includes(x)), [194, 1776], 'CC 194 e 1.776 revogados'); assert.deepEqual(inutil['senado-cpp-1941'], [35, 65, 298], 'CPP: 35 e 298 revogados; 65 tem anotação de ADPF e é tratado como duvidoso'); assert.deepEqual(inutil['senado-lei-13146-2015'], [82]);
  assert.deepEqual(inutil['senado-cp-1940'], []); assert.ok(!inutil['senado-cf-1988'].includes(5), 'CF art. 5º continua usável');
});

test('a data de referência da reconstrução é a do edital, e a ressalva sobre atualização da fonte fica registrada', () => {
  const idx = F.carregarIndice();
  for (const id of ['senado-cf-1988', 'senado-cc-2002', 'senado-cpc-2015']) { assert.equal(idx[id].referencia_vigencia, '2026-10-14'); assert.match(idx[id].observacao, /reconstruído na data de referência/); assert.match(idx[id].atualizado_pela_fonte_em, /^\d{4}-\d\d-\d\d$/); }
  assert.equal(idx['senado-cc-2002'].atualizado_pela_fonte_em, '2024-06-28'); assert.match(idx['senado-cc-2002'].observacao, /2024-06-28/);
  for (const id of ['senado-cp-1940', 'senado-cpp-1941']) assert.match(idx[id].observacao, /não é reconstruído por data/);
});

test('SEGURANÇA: artigo "acrescido por uma lei e revogado por outra" é revogado (a anotação não pode ser apagada), e artigo sem texto nunca é vigente', () => {
  const l = S.limparAnotacoes('Art. 231-A. (Artigo acrescido pela Lei nº 11.106, de 28/3/2005, e revogado pela Lei nº 13.344, de 6/10/2016)');
  assert.match(l.texto, /e revogado pela Lei nº 13\.344/);
  const r = S.artigosSenadoHtml('Art. 231-A. (Artigo acrescido pela Lei nº 11.106, de 28/3/2005, e revogado pela Lei nº 13.344, de 6/10/2016)\nArt. 232. Texto normal da regra que continua valendo.');
  assert.equal(F.situacao({ artigos: r.artigos }, '231-A'), 'revogado'); assert.equal(F.situacao({ artigos: r.artigos }, '232'), 'vigente');
  assert.equal(F.situacao({ artigos: { 7: 'Art. 7.' } }, '7'), 'incerto'); assert.equal(F.situacao({ artigos: { 7: 'Art. 7º   ' } }, '7'), 'incerto');
  assert.equal(F.situacao(lido('senado-cp-1940'), '231-A'), 'revogado'); assert.equal(F.conferirCitacao(lido('senado-cp-1940'), '231-A', 'Artigo acrescido pela Lei nº 11.106').ok, false);
  for (const id of FED) { const f = lido(id); for (const k of Object.keys(f.artigos)) if (F.situacao(f, k) === 'vigente') assert.ok(f.artigos[k].replace(/^Art\.\s*\S+\s*/, '').trim().length > 10, id + ' art. ' + k + ' vigente mas sem texto'); }
});

test('versões fora de ordem cronológica na lista: a data decide, não a posição', () => {
  const j = norma(no('art40', [v('2000-01-01', 'Original_Version', null)], [no('art40_cpt', [v('2020-01-01', 'Text_Change_Version', 'Redação de 2020.'), v('2000-01-01', 'Original_Version', 'Redação original.'), v('2010-01-01', 'Text_Change_Version', 'Redação de 2010.'), v('2030-01-01', 'Text_Change_Version', 'Redação de 2030.')])]));
  assert.equal(S.artigosSenadoJson(j, REF).artigos['40'], 'Art. 40. Redação de 2020.');
  assert.equal(S.artigosSenadoJson(j, '2012-06-01').artigos['40'], 'Art. 40. Redação de 2010.');
});

test('anotação de decisão judicial DENTRO do texto estruturado também torna o dispositivo duvidoso (mesmo sem versão "decisão judicial")', () => {
  const j = norma(no('art41', [v('2000-01-01', 'Original_Version', null)], [no('art41_cpt', [v('2000-01-01', 'Original_Version', 'Caput normal.')]), no('art41_par1', [v('2000-01-01', 'Original_Version', 'Parágrafo discutido. (Vide ADI 4277)')]), no('art41_par2', [v('2000-01-01', 'Original_Version', 'Parágrafo comum. (Redação dada pela Lei nº 1, de 2001)')])]));
  const r = S.artigosSenadoJson(j, REF);
  assert.equal(r.artigos['41'], 'Art. 41. Caput normal.\n§ 2º Parágrafo comum.'); assert.deepEqual(r.omitidos, { 41: 1 });
});
