'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/backup.js');

const T0 = Date.UTC(2026, 10, 20, 15, 0, 0);
const ev = (i, extra) => Object.assign({ id: 'e' + i, topicId: 'T' + (i % 7), questionId: 'q' + i, ts: T0 + i * 1000, correct: i % 3 !== 0, conf: 'seguro' }, extra);
const se = (i) => ({ id: 's' + i, ts: T0 + i * 60000, min: 30 + i, topicId: 'T1' });
const dadosEx = (n = 5) => ({
  eventos: Array.from({ length: n }, (_, i) => ev(i)),
  sessoes: [se(1), se(2)],
  estudados: ['T1', 'T2'],
  config: { disponivelMinDia: 60, atualizadoEm: T0 },
});

test('SHA-256 bate com o vetor de teste conhecido ("abc")', async () => {
  assert.equal(await B.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('ida e volta: criar e verificar preserva todos os dados', async () => {
  const d = dadosEx(20);
  const txt = await B.criarBackup(d, { dispositivo: 'iphone', agora: T0 });
  const v = await B.verificarBackup(txt);
  assert.equal(v.ok, true);
  assert.deepEqual(v.backup.dados, Object.assign({ marcacoes: [], revisoes: [], cancelamentos: [] }, d));
  assert.equal(v.backup.contagens.eventos, 20);
  assert.equal(v.backup.esquema, 2);
  assert.equal(v.backup.criadoEm, '2026-11-20T15:00:00.000Z');
});

test('adulteração de um único valor é detectada', async () => {
  const txt = await B.criarBackup(dadosEx());
  const alterado = txt.replace('"correct": false', '"correct": true');
  assert.notEqual(alterado, txt);
  const v = await B.verificarBackup(alterado);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /SHA-256 não confere/);
});

test('arquivo cortado, vazio, não JSON e de outro app são recusados com motivo claro', async () => {
  const txt = await B.criarBackup(dadosEx());
  assert.match((await B.verificarBackup(txt.slice(0, txt.length - 40))).motivo, /JSON válido/);
  assert.match((await B.verificarBackup('')).motivo, /vazio/);
  assert.match((await B.verificarBackup('   ')).motivo, /vazio/);
  assert.match((await B.verificarBackup(null)).motivo, /vazio/);
  assert.match((await B.verificarBackup('[1,2,3]')).motivo, /formato/);
  const outro = JSON.parse(txt); outro.app = 'outro';
  assert.match((await B.verificarBackup(JSON.stringify(outro))).motivo, /não é um backup desta plataforma/);
});

test('impressão digital trocada ou ausente é recusada', async () => {
  const o = JSON.parse(await B.criarBackup(dadosEx()));
  const trocada = Object.assign({}, o, { sha256: '0'.repeat(64) });
  assert.equal((await B.verificarBackup(JSON.stringify(trocada))).ok, false);
  const sem = Object.assign({}, o); delete sem.sha256;
  assert.match((await B.verificarBackup(JSON.stringify(sem))).motivo, /SHA-256/);
});

test('versão: futura é recusada com orientação; ausente também', async () => {
  const o = JSON.parse(await B.criarBackup(dadosEx()));
  assert.match((await B.verificarBackup(JSON.stringify(Object.assign({}, o, { esquema: 99 })))).motivo, /versão mais nova/);
  const sem = Object.assign({}, o); delete sem.esquema;
  assert.match((await B.verificarBackup(JSON.stringify(sem))).motivo, /versão/);
});

test('estrutura inválida: evento sem id, sessão sem minutos, listas ausentes', async () => {
  const o = JSON.parse(await B.criarBackup(dadosEx()));
  const semId = JSON.parse(JSON.stringify(o)); delete semId.dados.eventos[0].id;
  assert.match((await B.verificarBackup(JSON.stringify(semId))).motivo, /resposta inválido/);
  const semMin = JSON.parse(JSON.stringify(o)); delete semMin.dados.sessoes[0].min;
  assert.match((await B.verificarBackup(JSON.stringify(semMin))).motivo, /sessão inválido/);
  const semLista = JSON.parse(JSON.stringify(o)); delete semLista.dados.estudados;
  assert.match((await B.verificarBackup(JSON.stringify(semLista))).motivo, /estudados/);
  const semDados = JSON.parse(JSON.stringify(o)); delete semDados.dados;
  assert.match((await B.verificarBackup(JSON.stringify(semDados))).motivo, /não contém dados/);
});

test('a ordem das chaves no arquivo não importa (formato canônico)', async () => {
  const o = JSON.parse(await B.criarBackup(dadosEx()));
  const inverter = (e) => Object.fromEntries(Object.entries(e).reverse());
  const dadosInvertidos = Object.fromEntries(Object.entries(o.dados).reverse().map(([k, v]) => [k, k === 'eventos' ? v.map(inverter) : v]));
  const embaralhado = { dados: dadosInvertidos, sha256: o.sha256, contagens: o.contagens, criadoEm: o.criadoEm, esquema: o.esquema, app: o.app };
  assert.equal((await B.verificarBackup(JSON.stringify(embaralhado))).ok, true);
});

test('contagens do cabeçalho adulteradas são recusadas', async () => {
  const o = JSON.parse(await B.criarBackup(dadosEx()));
  o.contagens.eventos = 999;
  assert.match((await B.verificarBackup(JSON.stringify(o))).motivo, /contagens/);
});

test('volume e acentuação: 5.000 respostas e texto em português fazem a ida e volta', async () => {
  const d = dadosEx(5000);
  d.config.observacao = 'Atenção: ação, coração, não, índice, Ça va ✓';
  const t0 = Date.now();
  const txt = await B.criarBackup(d);
  const v = await B.verificarBackup(txt);
  assert.equal(v.ok, true);
  assert.equal(v.backup.dados.config.observacao, d.config.observacao);
  assert.ok(Date.now() - t0 < 5000, 'lento demais: ' + (Date.now() - t0) + ' ms');
});

test('criarBackup não altera a entrada e normaliza dados ausentes', async () => {
  const d = Object.freeze({ eventos: Object.freeze([Object.freeze(ev(1))]) });
  const v = await B.verificarBackup(await B.criarBackup(d));
  assert.equal(v.ok, true);
  assert.deepEqual(v.backup.dados.sessoes, []);
  assert.deepEqual(v.backup.dados.config, {});
  assert.equal((await B.verificarBackup(await B.criarBackup(undefined))).ok, true);
});

// ---- Fusão ----
test('mesclar é idempotente: importar o mesmo backup duas vezes não duplica nada', () => {
  const d = dadosEx(10);
  const r1 = B.mesclarDados(d, d);
  assert.equal(r1.dados.eventos.length, 10);
  assert.equal(r1.relatorio.eventosNovos, 0);
  assert.equal(r1.relatorio.eventosDuplicados, 10);
  const r2 = B.mesclarDados(r1.dados, d);
  assert.deepEqual(r2.dados, r1.dados);
});

test('mesclar une aparelhos diferentes sem perder nenhuma resposta', () => {
  const celular = { eventos: [ev(1), ev(2), ev(3)], sessoes: [se(1)], estudados: ['T1'], config: {} };
  const notebook = { eventos: [ev(3), ev(4), ev(5)], sessoes: [se(2)], estudados: ['T2'], config: {} };
  const r = B.mesclarDados(celular, notebook);
  assert.deepEqual(r.dados.eventos.map((e) => e.id), ['e1', 'e2', 'e3', 'e4', 'e5']);
  assert.equal(r.dados.sessoes.length, 2);
  assert.deepEqual(r.dados.estudados, ['T1', 'T2']);
  assert.equal(r.relatorio.eventosNovos, 2);
  assert.equal(r.relatorio.eventosDuplicados, 1);
});

test('mesclar mantém o registro local e acusa conflito quando o mesmo id tem conteúdo diferente', () => {
  const local = { eventos: [ev(1)], sessoes: [], estudados: [], config: {} };
  const importado = { eventos: [ev(1, { correct: !ev(1).correct })], sessoes: [], estudados: [], config: {} };
  const r = B.mesclarDados(local, importado);
  assert.deepEqual(r.relatorio.conflitosEventos, ['e1']);
  assert.equal(r.dados.eventos[0].correct, ev(1).correct);
});

test('config: vale a de atualizadoEm mais recente', () => {
  const a = { config: { x: 'A', atualizadoEm: 100 } };
  const b = { config: { x: 'B', atualizadoEm: 200 } };
  assert.equal(B.mesclarDados(a, b).dados.config.x, 'B');
  assert.equal(B.mesclarDados(b, a).dados.config.x, 'B');
  assert.equal(B.mesclarDados(a, {}).dados.config.x, 'A');
});

test('planejarImportacao classifica o caso e avisa quanto se perderia ao substituir', () => {
  const vazio = { eventos: [], sessoes: [], estudados: [], config: {} };
  const base = dadosEx(5);
  assert.equal(B.planejarImportacao(vazio, base).tipo, 'ATUAL VAZIO');
  assert.equal(B.planejarImportacao(base, base).tipo, 'NADA NOVO');
  const mais = Object.assign({}, base, { eventos: base.eventos.concat([ev(50), ev(51)]) });
  const p = B.planejarImportacao(base, mais);
  assert.equal(p.tipo, 'SOMENTE NOVOS');
  assert.equal(p.relatorio.eventosNovos, 2);
  assert.equal(p.recomendacao, 'MESCLAR');
  // substituir o "mais" pelo "base" apagaria 0; substituir o "base" pelo "pouco" apagaria os que faltam
  const pouco = Object.assign({}, base, { eventos: base.eventos.slice(0, 2) });
  assert.equal(B.planejarImportacao(base, pouco).perdaSeSubstituir.eventos, 3);
  const conf = Object.assign({}, base, { eventos: [ev(0, { correct: !ev(0).correct })] });
  assert.equal(B.planejarImportacao(base, conf).tipo, 'COM CONFLITOS');
});

test('planejarImportacao e mesclarDados não alteram as entradas', () => {
  const a = JSON.parse(JSON.stringify(dadosEx(6)));
  const b = JSON.parse(JSON.stringify({ eventos: [ev(7)], sessoes: [se(9)], estudados: ['T9'], config: {} }));
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  const congelar = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };
  congelar(a); congelar(b);
  B.planejarImportacao(a, b); B.mesclarDados(a, b);
  assert.equal(JSON.stringify(a), sa);
  assert.equal(JSON.stringify(b), sb);
});

// ---- Esquema 2: marcações, revisões e cancelamentos ----
const mar = (i, extra) => Object.assign({ id: 'm' + i, ts: T0 + i * 1000, topicId: 'OJ26-LP-0' + (i % 9 + 1), estudado: true }, extra);
const rev = (i, extra) => Object.assign({ id: 'r' + i, ts: T0 + i * 1000, topicId: 'OJ26-LP-01', etapa: 1 + (i % 3) }, extra);
const can = (i, ref) => ({ id: 'c' + i, ts: T0 + i * 1000, ref });
const dadosNovos = () => ({
  eventos: [], sessoes: [se(1), se(2)], estudados: [], config: {},
  marcacoes: [mar(1), mar(2, { estudado: false })], revisoes: [rev(1), rev(2)], cancelamentos: [can(1, 's1')],
});

test('esquema 2: marcações, revisões e cancelamentos fazem a ida e volta e entram nas contagens', async () => {
  const v = await B.verificarBackup(await B.criarBackup(dadosNovos(), { agora: T0 }));
  assert.equal(v.ok, true);
  assert.deepEqual(v.backup.dados.marcacoes, dadosNovos().marcacoes);
  assert.deepEqual(v.backup.contagens, { eventos: 0, sessoes: 2, marcacoes: 2, revisoes: 2, cancelamentos: 1, estudados: 0 });
});

test('esquema 2: registros inválidos de cada tipo novo são recusados', async () => {
  const base = JSON.parse(await B.criarBackup(dadosNovos()));
  const testar = async (colecao, alterar, esperado) => {
    const o = JSON.parse(JSON.stringify(base));
    alterar(o.dados[colecao][0]);
    const v = await B.verificarBackup(JSON.stringify(o));
    assert.equal(v.ok, false, colecao);
    assert.match(v.motivo, esperado, colecao);
  };
  await testar('marcacoes', (m) => { m.estudado = 'sim'; }, /marcação de estudo inválido/);
  await testar('marcacoes', (m) => { delete m.topicId; }, /marcação de estudo inválido/);
  await testar('revisoes', (r) => { r.etapa = 0; }, /revisão inválido/);
  await testar('revisoes', (r) => { r.etapa = 1.5; }, /revisão inválido/);
  await testar('cancelamentos', (c) => { delete c.ref; }, /cancelamento inválido/);
  await testar('cancelamentos', (c) => { c.ts = 'ontem'; }, /cancelamento inválido/);
});

test('esquema 2: coleção nova que não é lista é recusada; ausente é aceita como vazia (compatibilidade)', async () => {
  const o = JSON.parse(await B.criarBackup(dadosNovos()));
  const ruim = JSON.parse(JSON.stringify(o)); ruim.dados.revisoes = 'x';
  assert.match((await B.verificarBackup(JSON.stringify(ruim))).motivo, /revisoes/);
});

test('compatibilidade: backup do esquema 1 (sem as coleções novas) continua válido e importável', async () => {
  const dados1 = { eventos: [ev(1)], sessoes: [se(1)], estudados: ['T1'], config: { atualizadoEm: 5 } };
  const sha = await B.sha256Hex(B.canonico({ esquema: 1, dados: dados1 }));
  const arquivo = JSON.stringify({ app: 'plataforma-oficial-tjsp', esquema: 1, criadoEm: '2026-11-01T00:00:00.000Z', dispositivo: null, contagens: { eventos: 1, sessoes: 1, estudados: 1 }, sha256: sha, dados: dados1 }, null, 1);
  const v = await B.verificarBackup(arquivo);
  assert.equal(v.ok, true, v.motivo);
  const p = B.planejarImportacao({ eventos: [], sessoes: [], estudados: [], config: {} }, v.backup.dados);
  assert.equal(p.tipo, 'ATUAL VAZIO');
  assert.equal(p.resultado.eventos.length, 1);
  assert.deepEqual(p.resultado.marcacoes, []);
});

test('mesclar e planejar consideram as coleções novas; uma só marcação nova já é "somente novos"', () => {
  const atual = { eventos: [], sessoes: [se(1)], estudados: [], config: {}, marcacoes: [mar(1)], revisoes: [], cancelamentos: [] };
  const igual = B.planejarImportacao(atual, atual);
  assert.equal(igual.tipo, 'NADA NOVO');
  const comNova = Object.assign({}, atual, { marcacoes: [mar(1), mar(2)] });
  const p = B.planejarImportacao(atual, comNova);
  assert.equal(p.tipo, 'SOMENTE NOVOS');
  assert.equal(p.totalNovos, 1);
  assert.equal(p.relatorio.novos.marcacoes, 1);
  const soRevisao = Object.assign({}, atual, { revisoes: [rev(7)] });
  assert.equal(B.planejarImportacao(atual, soRevisao).tipo, 'SOMENTE NOVOS');
  const pouco = Object.assign({}, atual, { marcacoes: [] });
  assert.equal(B.planejarImportacao(atual, pouco).perdaSeSubstituir.marcacoes, 1);
  const conflito = Object.assign({}, atual, { marcacoes: [mar(1, { estudado: false })] });
  assert.equal(B.planejarImportacao(atual, conflito).tipo, 'COM CONFLITOS');
});

function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('propriedades (300 sorteios): fusão é comutativa, associativa, idempotente e nunca perde registros', () => {
  const rnd = mulberry32(777);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const conj = () => ({
    eventos: Array.from({ length: ri(0, 25) }, () => ev(ri(0, 40))),   // ids repetidos entre conjuntos, conteúdo igual por id
    sessoes: Array.from({ length: ri(0, 6) }, () => se(ri(0, 10))),
    estudados: Array.from({ length: ri(0, 4) }, () => 'T' + ri(0, 9)),
    config: {},
  });
  const ids = (d) => d.eventos.map((e) => e.id);
  for (let i = 0; i < 300; i++) {
    const a = conj(), b = conj(), c = conj();
    const ab = B.mesclarDados(a, b).dados, ba = B.mesclarDados(b, a).dados;
    assert.deepEqual(ab, ba, 'não comutativa');
    const l = B.mesclarDados(B.mesclarDados(a, b).dados, c).dados;
    const r = B.mesclarDados(a, B.mesclarDados(b, c).dados).dados;
    assert.deepEqual(l, r, 'não associativa');
    assert.deepEqual(B.mesclarDados(ab, ab).dados, ab, 'não idempotente');
    const todos = new Set(ids(a).concat(ids(b)));
    assert.deepEqual(new Set(ids(ab)), todos, 'perdeu ou inventou registros');
    assert.equal(ids(ab).length, todos.size, 'duplicou registros');
  }
});
