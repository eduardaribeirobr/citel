'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Q = require('../src/questoes.js');
const M = require('../src/questoes-dir.js');
const F = require('../src/fontes.js');
const A = require('../src/aprendizagem.js');
const { construir } = require('../tools/build-dir-dados.js');
const { impressao } = require('../tools/golden-questoes.js');

const DADOS = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/dir-dados.json'), 'utf8'));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden-dir.json'), 'utf8'));
const AMOSTRAS = Number(process.env.AMOSTRAS || 300);          // AMOSTRAS menor só para a verificação por mutação (mais rápida)
const modelos = Q.CATALOGO.filter((t) => t.ajustarSemente);
const FONTES = {}; const fonteBruta = (id) => (FONTES[id] = FONTES[id] || F.lerFonte(id));
const semente = (t, s) => t.ajustarSemente(Q.topicosDe(t)[s % Q.topicosDe(t).length], s * t.modulo + 1);
const idDaFonte = (t) => Object.keys(DADOS.fontes).find((k) => DADOS.fontes[k].id === t.id);

test('os dados embutidos são exatamente os que se derivam dos arquivos oficiais guardados (nada digitado à mão)', () => {
  const novo = construir(); const atual = JSON.parse(JSON.stringify(DADOS)); delete atual.topicosComQuestao;
  assert.deepEqual(JSON.parse(JSON.stringify(novo)), atual, 'rode: node tools/build-dir-dados.js (e revise o que mudou)');
  for (const [fid, f] of Object.entries(DADOS.fontes)) {
    const src = fonteBruta(fid);
    for (const [k, a] of Object.entries(f.artigos)) {
      assert.equal(F.situacao(src, k), 'vigente', fid + ' art. ' + k + ' não é vigente');
      assert.equal(a.texto, F.limparNotas(src.artigos[k]), fid + ' art. ' + k + ': texto difere da fonte');
    }
    assert.equal(f.sha256, src.meta.sha256);
  }
});

test('três modelos de Direito, ligados a tópicos reais do edital, com lista fixa de tópicos e só tópicos geráveis expostos', () => {
  assert.deepEqual(modelos.map((t) => t.id).sort(), ['DIR-DADM-L10261', 'DIR-LESP-L11608', 'DIR-LESP-NSCGJ']);
  const matriz = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/matriz-edital.json'), 'utf8')); const ids = new Set(matriz.topicos.map((t) => t.id));
  for (const t of modelos) {
    assert.ok(t.topicosFixos.length >= t.topicIds.length && t.topicIds.length >= 1);
    for (const x of t.topicosFixos) assert.ok(ids.has(x), 'tópico fora da matriz: ' + x);
    assert.deepEqual(t.topicosFixos.slice().sort(), t.topicosFixos, 'lista fixa precisa estar ordenada (o tópico sai de semente % módulo)');
    for (const x of t.topicIds) assert.ok(t.topicosFixos.includes(x));
    assert.equal(t.modulo, t.topicosFixos.length);
  }
  assert.deepEqual(DADOS.topicosComQuestao, [...new Set(modelos.flatMap((t) => t.topicIds))].sort());
});

test('PROPRIEDADE (sorteios × 5 níveis × 3 modelos; 300 por padrão): válida, trecho literal no texto oficial BRUTO inteiro e nenhuma errada existe no diploma', () => {
  let n = 0; const formas = { lacuna: 0, reproducao: 0 };
  for (const t of modelos) {
    const src = fonteBruta(idDaFonte(t));
    for (let nivel = 1; nivel <= 5; nivel++) for (let s = 1; s <= AMOSTRAS; s++) {
      const q = Q.gerarQuestao(t.id, semente(t, s), nivel); n++; formas[q.params.forma]++;
      assert.deepEqual(Q.validarQuestao(q), { ok: true, erros: [] });
      assert.ok(Q.topicosDe(t).includes(q.topicId), 'tópico fora do modelo');
      assert.equal(q.confianca, 'A'); assert.match(q.fonte, /texto oficial consultado em \d\d\/\d\d\/\d{4}/);
      const certa = q.alternativas.find((a) => a.correta);
      const p = q.params; const artSrc = src.artigos[p.artigo];
      assert.equal(F.situacao(src, p.artigo), 'vigente');
      assert.equal(DADOS.fontes[p.fonte].artigos[p.artigo].topicId, q.topicId, 'o artigo não pertence ao tópico da questão');
      if (p.forma === 'reproducao') {
        assert.equal(certa.texto, p.corpo); assert.deepEqual(F.conferirCitacao(src, p.artigo, certa.texto), { ok: true }, 'a correta não é literal no texto oficial');
        for (const a of q.alternativas.filter((x) => !x.correta)) assert.equal(F.ocorreEmQualquerLugar(src, a.texto), false, 'alternativa errada EXISTE no texto oficial: ' + a.texto.slice(0, 80));
      } else {
        assert.ok(F.conferirCitacao(src, p.artigo, p.corpo).ok);
        assert.ok(p.corpo.includes(certa.texto)); assert.match(q.enunciado, /_____/);
        for (const a of q.alternativas) { const cheio = p.branco.replace('_____', a.texto); assert.equal(F.ocorreEmQualquerLugar(src, cheio), a.correta, 'lacuna preenchida com "' + a.texto + '": ' + (a.correta ? 'a correta tem de existir' : 'a errada existe no texto oficial')); }
      }
      assert.equal(new Set(q.alternativas.map((a) => a.texto.replace(/\s+/g, ' '))).size, 5);
      for (const x of [q.enunciado, q.explicacao].concat(q.alternativas.map((a) => a.texto))) assert.ok(!/undefined|NaN|\[object|Prov\.? ?CG|Revogad/.test(x), 'texto com defeito: ' + x.slice(0, 100));
    }
  }
  assert.equal(n, 15 * AMOSTRAS); assert.ok(formas.lacuna > AMOSTRAS / 3 && formas.reproducao > AMOSTRAS * 3, JSON.stringify(formas));
});

test('o texto da lei NÃO é alterado pelo normalizador de plural (a alternativa correta continua literal depois de montada)', () => {
  for (const t of modelos) { const src = fonteBruta(idDaFonte(t)); for (let s = 1; s <= 120; s++) { const q = Q.gerarQuestao(t.id, semente(t, s), 2 + (s % 4)); if (q.params.forma === 'reproducao') assert.ok(F.conferirCitacao(src, q.params.artigo, q.alternativas.find((a) => a.correta).texto).ok); } }
});

test('alterações: percentual muda com o extenso, unidade e "úteis/corridos" trocam, advérbio pode ser omitido, remissões e anos não são mexidos', () => {
  const pt = (txt) => M.pontos(txt);
  const pct = pt('devida a razão de 3% (três por cento) do valor').find((p) => p.original.startsWith('3'));
  assert.equal(pct.original, '3% (três por cento)'); assert.ok(pct.opcoes.includes('24% (vinte e quatro por cento)')); assert.ok(pct.opcoes.every((o) => /^\d+% \([a-zç ]+ por cento\)$/.test(o) && parseInt(o, 10) <= 100));
  assert.ok(!pct.opcoes.includes('3% (três por cento)'));
    const dias = pt('no prazo de 10 (dez) dias úteis, contado da intimação').filter((p) => p.tipo === 'numero');
  assert.equal(dias.length, 1); assert.ok(dias[0].opcoes.includes('5 (cinco)') && dias[0].opcoes.includes('120 (cento e vinte)'));
  const hor = pt('em 24 (vinte e quatro) horas').find((p) => p.tipo === 'numero'); assert.ok(hor.opcoes.includes('2 (duas)') && hor.opcoes.includes('1 (uma)'), 'unidade feminina: uma/duas');
  const un = pt('no prazo de 10 (dez) dias úteis').filter((p) => p.tipo === 'unidade' || p.tipo === 'termo'); assert.deepEqual(un.map((p) => p.original).sort(), ['dias', 'úteis']);
  assert.deepEqual(pt('prazo de 10 (dez) dias').find((p) => p.tipo === 'unidade').opcoes, ['meses', 'anos']);
  assert.equal(pt('o oficial cumprirá o ato imediatamente, na forma da lei').filter((p) => p.tipo === 'omissao').length, 1);
  assert.equal(pt('imediatamente o ato será cumprido').filter((p) => p.tipo === 'omissao').length, 0, 'omissão no início da frase não é feita');
  assert.deepEqual(pt('nos termos do art. 12 dias da Lei 8.069, de 1990, e em 2026 dias'), [], 'remissão a artigo/lei e ano não são quantidade (e "2026" não vira "026")');
  assert.equal(pt('o disposto no art. 30 dias úteis').filter((p) => p.tipo === 'numero' || p.tipo === 'unidade').length, 0);
  assert.deepEqual(pt('o prazo de 3% (dois por cento)'), [], 'extenso incoerente bloqueia o trecho todo (nenhum ponto solto dentro dele)');
  assert.deepEqual(pt('prazo de 10 (nove) dias'), [], 'extenso incoerente com número: bloqueia');
  const neg = pt('o prazo será contado em dobro').find((p) => p.tipo === 'negacao'); assert.deepEqual(neg.opcoes, ['não será']);
  assert.deepEqual(pt('o prazo não será contado em dobro').find((p) => p.tipo === 'negacao').opcoes, ['será']);
  assert.deepEqual(pt('o oficial poderá certificar o fato').map((p) => p.tipo + ':' + p.opcoes), ['termo:deverá'], 'verbo com par (poderá/deverá) usa a troca, não a negação');
  assert.equal(M.aplicar('a b c', [{ p: { ini: 2, fim: 3 }, op: '' }]), 'a c', 'omissão não deixa espaço duplo');
  assert.equal(M.extenso(21, true), 'vinte e uma'); assert.equal(M.extenso(100), 'cem'); assert.equal(M.extenso(120), 'cento e vinte'); assert.equal(M.extenso(2, true), 'duas');
});

test('segmentos: junta linhas quebradas, tira marcador, descarta notas de rodapé, ementas curtas e artigos revogados', () => {
  const t = ['Art. 5º O oficial de justiça cumprirá os mandados no prazo de 10 (dez) dias,', 'contado do recebimento da ordem judicial na central.', '§ 1º Revogado.2', '§ 2º Redação dada pelo Provimento CG 5/2020 ao parágrafo do artigo quinto.', 'I - curto;'].join('\n');
  const s = M.segmentos(t);
  assert.equal(s.length, 1); assert.equal(s[0].corpo, 'O oficial de justiça cumprirá os mandados no prazo de 10 (dez) dias, contado do recebimento da ordem judicial na central.');
  assert.equal(M.rotuloArtigo('1054'), '1.054'); assert.equal(M.rotuloArtigo('1091-A'), '1.091-A'); assert.equal(M.rotuloArtigo('12'), '12');
});

test('ids imutáveis: o arquivo dourado de Direito reproduz exatamente as mesmas questões, e a lista fixa de tópicos não mudou', () => {
  assert.ok(Object.keys(gold.ids).length >= 60); const dif = [];
  for (const [id, h] of Object.entries(gold.ids)) { const x = Q.lerId(id); if (impressao(Q.gerarQuestao(x.templateId, x.semente, x.nivel)) !== h) dif.push(id); }
  assert.deepEqual(dif, [], 'Estes ids passaram a gerar OUTRA questão: o histórico de quem já respondeu ficaria errado. Crie um modelo novo (versão) em vez de editar.');
  const fixos = Object.fromEntries(modelos.map((t) => [t.id, t.topicosFixos.length]));
  assert.deepEqual(fixos, { 'DIR-DADM-L10261': 16, 'DIR-LESP-L11608': 1, 'DIR-LESP-NSCGJ': 13 }, 'lista fixa mudou: ids antigos trocariam de tópico');
});

test('ajustarSemente: a semente cai no tópico pedido, e o passo de sorteio preserva o tópico', () => {
  for (const t of modelos) for (const topico of t.topicIds) for (const base of [1, 77, 123456789, 4000000000]) {
    const s = t.ajustarSemente(topico, base); assert.equal(t.topicosFixos[s % t.modulo], topico); assert.ok(Math.abs(s - base) < t.modulo);
    assert.equal(t.topicosFixos[(s + 7919 * t.modulo) % t.modulo], topico);
    for (const nivel of [1, 3, 5]) assert.equal(Q.gerarQuestao(t.id, t.ajustarSemente(topico, base + 7919 * t.modulo * 3), nivel).topicId, topico);
  }
  assert.throws(() => modelos[0].ajustarSemente('OJ26-NAO-EXISTE', 5), /fora do modelo/);
});

test('o segundo método (resolver) REJEITA: alternativa errada que existe no diploma, correta alterada, artigo de outro tópico e lacuna fora do trecho', () => {
  const t = Q.modelo('DIR-LESP-L11608'); const top = t.topicIds[0];
  const q = Q.gerarQuestao(t.id, t.ajustarSemente(top, 900), 2); const p = q.params;
  assert.equal(t.resolver(p), p.corpo);
  assert.throws(() => t.resolver(Object.assign({}, p, { distratores: p.distratores.concat([{ valor: 'x', texto: p.corpo }]) })), /existe no texto oficial|igual ao texto oficial/);
  const outroArt = Object.values(DADOS.fontes['alesp-lei-11608-2003'].artigos).find((a) => !a.texto.includes(p.corpo)).texto.replace(/\n/g, ' ').slice(0, 120);
  assert.throws(() => t.resolver(Object.assign({}, p, { distratores: [{ valor: 'y', texto: outroArt }] })), /existe no texto oficial/);
  assert.throws(() => t.resolver(Object.assign({}, p, { corpo: p.corpo.replace(/\d/, '9'), correto: p.corpo.replace(/\d/, '9') })), /literalmente/);
  assert.throws(() => t.resolver(Object.assign({}, p, { artigo: '99999' })), /inexistente/);
  const q1 = Q.gerarQuestao(t.id, t.ajustarSemente(top, 900), 1); assert.equal(q1.params.forma, 'lacuna');
  assert.throws(() => t.resolver(Object.assign({}, q1.params, { correto: 'texto que não está no trecho' })), /lacuna/);
  const falsa = Object.assign({}, q, { params: Object.assign({}, p, { artigo: '99999' }) }); assert.equal(Q.validarQuestao(falsa).ok, false);
});

test('cobertura: os tópicos declarados com questão são exatamente os que geram, e os demais falham de forma explícita', () => {
  for (const t of modelos) for (const topico of t.topicosFixos) {
    let gera = false; for (let nivel = 1; nivel <= 5 && !gera; nivel++) for (let s = 1; s <= 25 && !gera; s++) { try { const q = Q.gerarQuestao(t.id, t.ajustarSemente(topico, 1000 + s * t.modulo), nivel); gera = q.topicId === topico && Q.validarQuestao(q).ok; } catch (e) { /* próximo */ } }
    assert.equal(t.topicIds.includes(topico), gera, t.id + ' ' + topico);
  }
  assert.equal(DADOS.topicosComQuestao.length, 10);
});

test('sessões: com filtro de tópico de Direito, todos os itens são do tópico, sem repetir enunciado entre sessões, e o nível sugerido acompanha o tópico', () => {
  const topico = Q.modelo('DIR-LESP-NSCGJ').topicIds.find((x) => DADOS.topicos[x].length >= 1); const BASE = Date.UTC(2026, 11, 1, 15);
  const eventos = []; const textos = new Set(); let repetidos = 0;
  for (let sessao = 0; sessao < 4; sessao++) {
    const itens = A.montarSessao({ n: 12, topicIds: [topico], nivel: 'auto', eventos, hojeIdx: Math.floor(BASE / 86400000) + sessao, semente: 50 + sessao });
    assert.equal(itens.length, 12);
    for (const it of itens) {
      assert.equal(it.topicId, topico); assert.equal(it.templateId, 'DIR-LESP-NSCGJ');
      const q = Q.gerarQuestao(it.templateId, it.semente, it.nivel); assert.equal(q.topicId, topico); assert.ok(Q.validarQuestao(q).ok);
      if (textos.has(q.enunciado + '|' + q.alternativas.map((a) => a.texto).join('|'))) repetidos++; textos.add(q.enunciado + '|' + q.alternativas.map((a) => a.texto).join('|'));
      eventos.push({ id: 'd' + eventos.length, ts: BASE + sessao * 86400000 + eventos.length * 1000, topicId: q.topicId, questionId: q.id, correct: true, conf: 'seguro', nivel: q.nivel });
    }
  }
  assert.equal(repetidos, 0, 'questão repetida entre sessões');
  const a = A.montarSessao({ n: 6, topicIds: [topico], nivel: 'auto', eventos: [], hojeIdx: 1, semente: 9 }); assert.deepEqual(A.montarSessao({ n: 6, topicIds: [topico], nivel: 'auto', eventos: [], hojeIdx: 1, semente: 9 }), a);
});

test('sessões sem filtro de tópico incluem Direito, e cada item de Direito cai num tópico gerável', () => {
  let direito = 0;
  for (let s = 1; s <= 40; s++) for (const it of A.montarSessao({ n: 20, eventos: [], hojeIdx: 1, semente: s * 13 })) if (it.templateId.startsWith('DIR-')) {
    direito++; assert.ok(Q.topicosDe(Q.modelo(it.templateId)).includes(it.topicId)); assert.equal(Q.gerarQuestao(it.templateId, it.semente, it.nivel).topicId, it.topicId);
  }
  assert.ok(direito > 100, 'Direito quase não aparece nas sessões: ' + direito);
});

test('o histórico de uma questão de Direito segue as mesmas regras: id válido, motivo, reportar problema e caderno', () => {
  const t = Q.modelo('DIR-LESP-L11608'); const q = Q.gerarQuestao(t.id, t.ajustarSemente(t.topicIds[0], 321), 2);
  assert.deepEqual(Q.lerId(q.id), { templateId: 'DIR-LESP-L11608', semente: Q.lerId(q.id).semente, nivel: 2 });
  const errada = (q.gabaritoIdx + 1) % 5; const resp = Object.assign({ id: 'e1', ts: 1 }, A.eventoResposta(q, errada, 'seguro', 4000));
  assert.equal(resp.correct, false); assert.equal(resp.topicId, q.topicId); assert.equal(A.templateDe(q.id), 'DIR-LESP-L11608');
  const c = A.cadernoErros([resp], 5); assert.equal(c.length, 1); assert.equal(c[0].questionId, q.id);
  assert.deepEqual(Q.gerarQuestao(Q.lerId(c[0].questionId).templateId, Q.lerId(c[0].questionId).semente, Q.lerId(c[0].questionId).nivel), q, 'refazer reproduz a mesma questão');
  assert.equal(A.paraMotor([resp, Object.assign({ id: 'p1', ts: 2 }, A.eventoProblema(resp, 'gabarito', 'x'))]).length, 1);
});
