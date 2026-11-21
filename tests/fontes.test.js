'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const F = require('../src/fontes.js');
const matriz = require('../data/matriz-edital.json');

test('htmlParaTexto: decodifica entidades acentuadas, remove script/estilo e preserva a ordem', () => {
  const t = F.htmlParaTexto('<style>x{}</style><p>Art&iacute;culo &sect; 1&ordm; &ndash; Jos&eacute; &amp; Ra&uacute;l</p><script>var a="&aacute;"</script><p>Linha&nbsp;dois</p>');
  assert.equal(t, 'Artículo § 1º – José & Raúl\nLinha dois');
  assert.equal(F.htmlParaTexto('&Aacute;gua &Ccedil;&otilde;es &foo; &#233; &#xE9;'), 'Água Ç&otilde;es &foo; é é'.replace('&otilde;', 'õ'));
});

test('extrairArtigos: números, letras, parágrafos e remissões', () => {
  const texto = ['Artigo 1° - Esta lei institui.', 'Parágrafo único - Vale para todos.', 'Artigo 2º-A - Inclui letra.', 'Artigo 12 desta lei aplica-se ao caso.', 'Artigo 3° - Fim.'].join('\n');
  const a = F.extrairArtigos(texto);
  assert.deepEqual(Object.keys(a).sort(), ['1', '2-A', '3']);
  assert.deepEqual(Object.keys(F.extrairArtigos('Artigo 4° - A prova é de todos.\nArtigo 5 - B.')).sort(), ['4', '5'], 'um "A" no começo da frase não vira letra do artigo');
  assert.match(a['1'], /Parágrafo único - Vale/);
  assert.match(a['2-A'], /desta lei aplica-se/, 'a remissão fica como continuação do artigo anterior, não vira artigo novo');
});

test('conferirCitacao: literal passa; palavra trocada, artigo inexistente e trecho curto falham', () => {
  const f = F.lerFonte('alesp-lei-11608-2003');
  const trecho = 'A taxa judiciária, que tem por fato gerador a prestação de serviços públicos de natureza forense';
  assert.equal(F.conferirCitacao(f, '1', trecho).ok, true);
  assert.equal(F.conferirCitacao(f, '1', '  A taxa   judiciária, que tem por fato gerador\na prestação de serviços públicos ').ok, true, 'espaços e quebras não importam');
  assert.equal(F.conferirCitacao(f, '1', trecho.replace('públicos', 'privados')).ok, false);
  assert.equal(F.conferirCitacao(f, '1', trecho.replace('A taxa', 'a taxa')).ok, false, 'maiúscula importa');
  assert.match(F.conferirCitacao(f, '9999', trecho).motivo, /não existe/);
  assert.match(F.conferirCitacao(f, '1', 'taxa').motivo, /curto/);
  assert.equal(F.ocorreEmQualquerLugar(f, trecho), true);
  assert.equal(F.ocorreEmQualquerLugar(f, trecho.replace('públicos', 'privados')), false);
});

test('integridade: o hash do arquivo-fonte é conferido e uma alteração é detectada', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fonte-'));
  fs.mkdirSync(path.join(tmp, 'data/fontes/x'), { recursive: true });
  const bruto = '<p>Artigo 1° - Texto de teste suficientemente longo.</p>';
  fs.writeFileSync(path.join(tmp, 'data/fontes/x/bruto.html'), bruto);
  const sha = crypto.createHash('sha256').update(bruto).digest('hex');
  fs.writeFileSync(path.join(tmp, 'data/fontes/indice.json'), JSON.stringify({ x: { nome: 'X', arquivo: 'data/fontes/x/bruto.html', sha256: sha, codificacao: 'utf8' } }));
  assert.equal(Object.keys(F.lerFonte('x', tmp).artigos)[0], '1');
  fs.writeFileSync(path.join(tmp, 'data/fontes/x/bruto.html'), bruto.replace('teste', 'TESTE'));
  assert.throws(() => F.lerFonte('x', tmp), /hash.*não confere/);
  assert.throws(() => F.lerFonte('nao-existe', tmp), /desconhecida/);
});

test('fontes reais: o arquivo guardado confere com o índice e não sobra entidade HTML nem artigo vazio', () => {
  const idx = F.carregarIndice();
  assert.ok(Object.keys(idx).length >= 2);
  for (const id of Object.keys(idx)) {
    const f = F.lerFonte(id);
    assert.match(idx[id].url, /^https:\/\//); assert.match(idx[id].consultado_em, /^\d{4}-\d\d-\d\d$/); assert.equal(idx[id].sha256.length, 64);
    assert.deepEqual(f.texto.match(/&[a-zA-Z#0-9]+;/g) || [], [], id + ': entidade não decodificada');
    const ks = Object.keys(f.artigos); assert.ok(ks.length > 5);
    for (const k of ks) assert.ok(f.artigos[k].length > 20 || F.situacao(f, k) === 'vetado' || F.situacao(f, k) === 'revogado', id + ' art. ' + k + ' vazio sem ser vetado/revogado');
  }
});

test('numeração: a lei extraída não tem lacuna (todo número de 1 ao último aparece, com ou sem letra)', () => {
  for (const id of ['alesp-lei-10261-1968', 'alesp-lei-11608-2003']) {
    const ks = Object.keys(F.lerFonte(id).artigos); const max = Math.max(...ks.map((k) => parseInt(k, 10)));
    for (let i = 1; i <= max; i++) assert.ok(ks.some((k) => k === String(i) || k.startsWith(i + '-')), id + ': falta o artigo ' + i);
  }
  assert.equal(Object.keys(F.lerFonte('alesp-lei-10261-1968').artigos).length, 351);
});

test('edital × texto oficial: todo artigo que o edital cita do Estatuto (10.261/68) existe na lei, inclusive os extremos exatos', () => {
  const f = F.lerFonte('alesp-lei-10261-1968'); const ks = Object.keys(f.artigos);
  const chave = (x) => String(x).replace(/\./g, '').replace(/[º°\s]/g, '').toUpperCase();
  let n = 0;
  for (const t of matriz.topicos.filter((x) => x.diploma && /10\.261/.test(x.diploma.nome))) for (const d of t.dispositivos) {
    const a = parseInt(chave(d.de), 10); const b = parseInt(chave(d.ate || d.de), 10);
    assert.ok(ks.includes(chave(d.de)) || ks.some((k) => k.startsWith(a + '-')) || ks.includes(String(a)), 'extremo ausente: ' + d.de);
    for (let i = a; i <= b; i++) { n++; assert.ok(ks.some((k) => k === String(i) || k.startsWith(i + '-')), 'art. ' + i + ' ausente'); }
  }
  assert.equal(n, 18);
  assert.match(f.artigos['1'], /institui o regime jurídico dos funcionários públicos civis do Estado/);
});

test('artigos vetados ou revogados não podem embasar questão (e a situação é lida do próprio texto)', () => {
  const f = F.lerFonte('alesp-lei-10261-1968');
  assert.equal(F.situacao(f, '129'), 'vetado'); assert.equal(F.situacao(f, '330'), 'vetado'); assert.equal(F.situacao(f, '1'), 'vigente'); assert.equal(F.situacao(f, '99999'), null);
  const r = F.conferirCitacao(f, '129', 'Vetado.'); assert.equal(r.ok, false); assert.match(r.motivo, /vetado/);
  const fake = { artigos: { 5: 'Artigo 5 - (Revogado pela Lei 1/2000).', 6: 'Artigo 6 - Revogada.', 7: 'Artigo 7 - O prazo é de dez dias úteis para a resposta.' }, meta: { nome: 'x' }, texto: '' };
  assert.equal(F.situacao(fake, '5'), 'revogado'); assert.equal(F.situacao(fake, '6'), 'revogado'); assert.equal(F.situacao(fake, '7'), 'vigente');
  assert.equal(F.conferirCitacao(fake, '7', 'O prazo é de dez dias úteis').ok, true);
});

test('mapa de diplomas: só aponta para fontes existentes e para nomes de diplomas do edital', () => {
  const mapa = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/fontes/mapa-diplomas.json'), 'utf8')); const idx = F.carregarIndice();
  const nomes = new Set(matriz.topicos.filter((t) => t.diploma).map((t) => t.diploma.nome));
  for (const [nome, id] of Object.entries(mapa)) { assert.ok(nomes.has(nome), 'diploma inexistente no edital: ' + nome); assert.ok(idx[id], 'fonte inexistente: ' + id); }
});

test('PDF das Normas da Corregedoria: estilo "Art. N.", início no corpo, remissões e dois-pontos', () => {
  const texto = ['Art. 1º Dar nova redação aos Capítulos (provimento antigo).', 'Art. 1º A Corregedoria alinha-se às diretrizes.', 'Art. 2º São princípios:', 'Art. 12 da Lei 8.069 não vira artigo.',
    'Art. 787: Informada a unidade.', 'Art. 1.091-A. Texto com letra.', 'Art. 371. Revogado.1', 'Art. 372. As anotações.'].join('\n');
  const a = F.extrairArtigosArtPonto(texto, '^\\s*Art\\. 1º A Corregedoria alinha-se');
  assert.deepEqual(Object.keys(a).sort(), ['1', '1091-A', '2', '371', '372', '787']);
  assert.match(a['1'], /alinha-se às diretrizes/, 'o "Art. 1º" do provimento antigo é ignorado');
  assert.match(a['2'], /Art\. 12 da Lei 8\.069/, 'remissão é continuação, não artigo novo');
  assert.equal(F.situacao({ artigos: a }, '371'), 'revogado'); assert.equal(F.situacao({ artigos: a }, '372'), 'vigente');
  assert.throws(() => F.extrairArtigosArtPonto(texto, 'marcador que não existe'), /marcador/);
});

test('Normas da Corregedoria (Tomo I) lidas do PDF oficial: hash conferido, lacunas conhecidas e artigo revogado detectado', () => {
  const f = F.lerFonte('tjsp-nscgj-tomo1'); const ks = Object.keys(f.artigos); const max = Math.max(...ks.map((k) => parseInt(k, 10)));
  assert.equal(f.meta.formato, 'pdf'); assert.ok(f.meta.observacao.includes('22/10/2026'));
  const falt = []; for (let i = 1; i <= max; i++) if (!ks.some((k) => k === String(i) || k.startsWith(i + '-'))) falt.push(i);
  assert.deepEqual(falt, [370, 981], 'numeração pula 370 e 981 no próprio texto oficial; qualquer outra lacuna é falha de leitura');
  assert.equal(F.situacao(f, '371'), 'revogado'); assert.equal(F.conferirCitacao(f, '371', 'Revogado.').ok, false);
  assert.match(f.artigos['994'], /O presente Capítulo dispõe sobre as regras aplicáveis aos Oficiais/);
  assert.ok(F.conferirCitacao(f, '994', 'O presente Capítulo dispõe sobre as regras aplicáveis aos Oficiais de Justiça').ok);
  assert.ok(f.artigos['787'].includes('Informada a unidade'), 'artigo escrito com dois-pontos');
  assert.ok(ks.includes('1091-A'));
});

test('edital × Normas da Corregedoria: os 126 dispositivos citados existem no texto oficial, com os extremos exatos', () => {
  const f = F.lerFonte('tjsp-nscgj-tomo1'); const ks = Object.keys(f.artigos);
  const chave = (x) => String(x).replace(/\./g, '').replace(/[º°\s]/g, '').toUpperCase(); let n = 0;
  for (const t of matriz.topicos.filter((x) => x.diploma && /Normas Judiciais/.test(x.diploma.nome))) for (const d of t.dispositivos) {
    assert.ok(ks.includes(chave(d.de)), 'extremo inicial ausente: ' + d.de); if (d.ate) assert.ok(ks.includes(chave(d.ate)), 'extremo final ausente: ' + d.ate);
    for (let i = parseInt(chave(d.de), 10); i <= parseInt(chave(d.ate || d.de), 10); i++) { n++; assert.ok(ks.some((k) => k === String(i) || k.startsWith(i + '-')), 'art. ' + i + ' ausente'); }
  }
  assert.equal(n, 126);
});

test('situação: "Revogado3" (nota de rodapé colada) é revogado; "Revogadas as disposições em contrário" é artigo VIGENTE', () => {
  const art = (corpo) => ({ artigos: { 1: 'Art. 1. ' + corpo } });
  for (const c of ['Revogado.', 'Revogado3', 'Revogado.1', '(Revogado pela Lei 5/2001)', 'Revogada pelo Provimento 9', 'Vetado.', '(VETADO)', 'Revogado']) assert.notEqual(F.situacao(art(c), '1'), 'vigente', c);
  for (const c of ['Revogadas as disposições em contrário.', 'Revogam-se as disposições em contrário.', 'Vetadas as emendas aditivas não podem ser repetidas.', 'O prazo revogado não corre.']) assert.equal(F.situacao(art(c), '1'), 'vigente', c);
});
