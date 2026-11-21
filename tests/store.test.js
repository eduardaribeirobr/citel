'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { criarStore, derivar } = require('../src/store.js');
const Backup = require('../src/backup.js');
const { criarBanco, criarArmazenamento, criarRelogio, mulberry32 } = require('./fakes.js');

const UID = 'u_TESTE000000000000000A';

function novo(db, storage, extra, uid) {
  const rel = criarRelogio();
  const aleat = mulberry32(Math.floor(Math.random() * 1e9));
  const store = criarStore(Object.assign({ db, uid: uid || UID, storage, agora: rel.agora, setTimeoutFn: rel.setTimeoutFn, clearTimeoutFn: rel.clearTimeoutFn, aleatorio: aleat }, extra));
  return { store, rel };
}
const sessao = (min, topicId, extra) => Object.assign({ min, topicId: topicId || 'OJ26-LP-01' }, extra);
const todosIds = (db) => {
  const ids = [];
  for (const [p, d] of db.docs) if (p.includes('/app/log/')) for (const k of Backup.COLECOES) for (const x of d[k]) ids.push(x.id);
  return ids;
};

test('banco vazio: carrega sem erro, estado vazio e nada pendente', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  const e = await store.carregar();
  assert.equal(e.dados.sessoes.length, 0);
  assert.equal(e.derivado.estudados.size, 0);
  assert.equal(store.status().pendentes, 0);
  assert.equal(store.status().carregado, true);
  assert.equal(db.info.escritas.length, 0);
});

test('registrar grava um bloco com o item, zera pendentes e marca a hora do último salvamento', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  const item = store.registrar('sessoes', sessao(30));
  assert.equal(store.status().pendentes, 1);
  await store.flush();
  const docs = Array.from(db.docs.entries()).filter(([p]) => p.includes('/app/log/'));
  assert.equal(docs.length, 1);
  assert.match(docs[0][0], new RegExp('^data/users/' + UID + '/app/log/[a-z0-9]+-0001$'));
  assert.equal(docs[0][1].sessoes[0].id, item.id);
  assert.equal(docs[0][1].sessoes[0].min, 30);
  assert.equal(store.status().pendentes, 0);
  assert.notEqual(store.status().ultimoSalvo, null);
  assert.equal(store.status().erro, null);
});

test('tudo o que é escrito fica dentro de data/users/<uid>/ (isolamento)', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  store.registrar('sessoes', sessao(10));
  store.registrar('marcacoes', { topicId: 'OJ26-LP-01', estudado: true });
  store.salvarConfig({ disponivelMinDia: 60 });
  await store.flush();
  await store.verificar();
  assert.ok(db.info.escritas.length >= 3);
  for (const p of db.info.escritas.concat(db.info.leituras, db.info.apagados)) assert.ok(p.startsWith('data/users/' + UID + '/'), 'fora do espaço privado: ' + p);
});

test('vários registros em sequência viram uma única gravação (debounce)', async () => {
  const db = criarBanco();
  const { store, rel } = novo(db, criarArmazenamento());
  await store.carregar();
  for (let i = 0; i < 10; i++) store.registrar('sessoes', sessao(5 + i));
  assert.equal(rel.pendentes(), 1, 'um único temporizador agendado');
  await rel.executar();
  await store.flush();
  assert.equal(db.info.escritas.filter((p) => p.includes('/app/log/')).length, 1);
  assert.equal(todosIds(db).length, 10);
});

test('registro idempotente: o mesmo id não duplica; item inválido é recusado', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  const a = store.registrar('sessoes', sessao(20, null, { id: 's-fixo' }));
  const b = store.registrar('sessoes', sessao(20, null, { id: 's-fixo' }));
  assert.ok(a);
  assert.equal(b, null);
  assert.throws(() => store.registrar('sessoes', { topicId: 'x' }), TypeError);
  assert.throws(() => store.registrar('marcacoes', { topicId: 'x', estudado: 'sim' }), TypeError);
  assert.throws(() => store.registrar('inexistente', {}), TypeError);
  await store.flush();
  assert.equal(todosIds(db).length, 1);
});

test('falha temporária: item fica pendente, repete com espera crescente e acaba gravado sem duplicar', async () => {
  const db = criarBanco();
  const { store, rel } = novo(db, criarArmazenamento());
  await store.carregar();
  db.falhar('set', 'unavailable', 2);
  store.registrar('sessoes', sessao(25));
  await store.flush();
  assert.equal(store.status().erro.code, 'unavailable');
  assert.equal(store.status().erro.fatal, false);
  assert.equal(store.status().pendentes, 1);
  assert.equal(rel.pendentes(), 1, 'nova tentativa agendada');
  await rel.executar();                                   // 2ª tentativa: ainda falha
  assert.equal(store.status().erro.code, 'unavailable');
  assert.equal(store.status().pendentes, 1);
  assert.equal(rel.pendentes(), 1, 'e agenda outra');
  await rel.executar();                                   // 3ª tentativa: funciona
  assert.equal(store.status().erro, null);
  assert.equal(store.status().pendentes, 0);
  assert.equal(todosIds(db).length, 1);
});

test('falha definitiva (cota cheia): não repete sozinho, mantém o item e informa o erro', async () => {
  const db = criarBanco();
  const { store, rel } = novo(db, criarArmazenamento());
  await store.carregar();
  db.falhar('set', 'quota_exceeded', 1000);
  store.registrar('sessoes', sessao(25));
  await store.flush();
  assert.equal(store.status().erro.code, 'quota_exceeded');
  assert.equal(store.status().erro.fatal, true);
  assert.equal(rel.pendentes(), 0);
  assert.equal(store.status().pendentes, 1);
  assert.equal(store.estado().dados.sessoes.length, 1, 'continua visível no app');
});

test('reabrir o app com a rede fora: o que estava pendente volta da caixa de saída local e é enviado depois', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  const a = novo(db, storage);
  await a.store.carregar();
  db.falhar('set', 'unavailable', 1000);
  a.store.registrar('sessoes', sessao(40, 'OJ26-LP-02', { id: 's-pendente' }));
  a.store.registrar('marcacoes', { topicId: 'OJ26-LP-02', estudado: true, id: 'm-pendente' });
  await a.store.flush();
  assert.equal(todosIds(db).length, 0, 'nada chegou ao servidor');
  // "fecha" o app e abre de novo
  a.store.fechar();
  db.limparFalhas();
  const b = novo(db, storage);
  const e = await b.store.carregar();
  assert.deepEqual(e.dados.sessoes.map((x) => x.id), ['s-pendente']);
  assert.ok(e.derivado.estudados.has('OJ26-LP-02'));
  assert.equal(b.store.status().pendentes, 0, 'bloco recuperado ainda não conta como pendente novo');
  await b.rel.executar();
  await b.store.flush();
  assert.deepEqual(todosIds(db).sort(), ['m-pendente', 's-pendente']);
});

test('registrar durante uma gravação em andamento: o item novo continua pendente e vai na gravação seguinte', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  store.registrar('sessoes', sessao(10, null, { id: 'primeiro' }));
  const liberar = db.reter();
  const envio = store.flush();                       // fica parado dentro do banco
  await null; await null; await null;
  store.registrar('sessoes', sessao(20, null, { id: 'durante' }));
  liberar();
  await envio;
  assert.equal(store.status().pendentes, 1, 'o item registrado durante o envio ainda não foi salvo');
  await store.flush();
  assert.equal(store.status().pendentes, 0);
  assert.deepEqual(todosIds(db).sort(), ['durante', 'primeiro']);
});

test('servidor já tem o bloco e a cópia local tem um item a mais: o item a mais é enviado ao reabrir', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  const a = novo(db, storage);
  await a.store.carregar();
  a.store.registrar('sessoes', sessao(10, null, { id: 'no-servidor' }));
  await a.store.flush();
  db.falhar('set', 'unavailable', 1000);
  a.store.registrar('sessoes', sessao(20, null, { id: 'so-local' }));
  await a.store.flush();
  a.store.fechar();
  db.limparFalhas();
  const b = novo(db, storage);
  const e = await b.store.carregar();
  assert.deepEqual(e.dados.sessoes.map((x) => x.id).sort(), ['no-servidor', 'so-local']);
  await b.rel.executar();
  await b.store.flush();
  assert.deepEqual(todosIds(db).sort(), ['no-servidor', 'so-local']);
});

test('duas abas do mesmo aparelho: a segunda gravação junta com a primeira em vez de sobrescrevê-la', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();                 // mesmo armazenamento = mesmo identificador de aparelho
  const abaA = novo(db, storage);
  const abaB = novo(db, storage);
  await abaA.store.carregar();
  await abaB.store.carregar();                          // as duas abriram antes de qualquer gravação
  abaA.store.registrar('sessoes', sessao(10, null, { id: 'aba-a' }));
  await abaA.store.flush();
  abaB.store.registrar('sessoes', sessao(20, null, { id: 'aba-b' }));
  await abaB.store.flush();
  assert.deepEqual(todosIds(db).sort(), ['aba-a', 'aba-b']);
  assert.deepEqual(abaB.store.estado().dados.sessoes.map((x) => x.id).sort(), ['aba-a', 'aba-b'], 'a aba B também passa a ver o item da A');
});

test('armazenamento local apagado, servidor intacto: nada se perde e novos registros somam ao que já existe', async () => {
  const db = criarBanco();
  const storage1 = criarArmazenamento();
  const a = novo(db, storage1);
  await a.store.carregar();
  a.store.registrar('sessoes', sessao(30, null, { id: 's1' }));
  await a.store.flush();
  const b = novo(db, criarArmazenamento());      // aparelho "novo" (armazenamento zerado)
  const e = await b.store.carregar();
  assert.deepEqual(e.dados.sessoes.map((x) => x.id), ['s1']);
  b.store.registrar('sessoes', sessao(20, null, { id: 's2' }));
  await b.store.flush();
  assert.deepEqual(todosIds(db).sort(), ['s1', 's2']);
});

test('mesmo aparelho, cópia local zerada: a gravação junta com o que o servidor já tem (não sobrescreve)', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  const a = novo(db, storage);
  await a.store.carregar();
  a.store.registrar('sessoes', sessao(30, null, { id: 's1' }));
  await a.store.flush();
  storage.removeItem('pl:' + UID + ':meus');    // perde só a caixa de saída; o identificador do aparelho fica
  const b = novo(db, storage);
  await b.store.carregar();
  b.store.registrar('sessoes', sessao(20, null, { id: 's2' }));
  await b.store.flush();
  assert.deepEqual(todosIds(db).sort(), ['s1', 's2']);
});

test('armazenamento local quebrado: o app continua gravando no servidor e avisa que a cópia local falhou', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  storage.quebrado = true;
  const { store } = novo(db, storage);
  await store.carregar();
  store.registrar('sessoes', sessao(30, null, { id: 's1' }));
  await store.flush();
  assert.equal(store.status().localOk, false);
  assert.equal(store.status().pendentes, 0);
  assert.deepEqual(todosIds(db), ['s1']);
});

test('blocos de no máximo N itens: 23 registros com limite 5 viram 5 blocos, sem perda', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento(), { limiteChunk: 5 });
  await store.carregar();
  for (let i = 0; i < 23; i++) store.registrar('sessoes', sessao(10 + i, null, { id: 's' + i }));
  await store.flush();
  const blocos = Array.from(db.docs.entries()).filter(([p]) => p.includes('/app/log/'));
  assert.equal(blocos.length, 5);
  for (const [, d] of blocos) assert.ok(d.sessoes.length <= 5);
  assert.equal(todosIds(db).length, 23);
  assert.equal(new Set(todosIds(db)).size, 23);
});

test('dois aparelhos escrevem em blocos diferentes e um terceiro vê a união', async () => {
  const db = criarBanco();
  const A = novo(db, criarArmazenamento());
  const B = novo(db, criarArmazenamento());
  await A.store.carregar(); await B.store.carregar();
  A.store.registrar('sessoes', sessao(10, null, { id: 'a1' }));
  B.store.registrar('sessoes', sessao(20, null, { id: 'b1' }));
  await A.store.flush(); await B.store.flush();
  assert.equal(Array.from(db.docs.keys()).filter((p) => p.includes('/app/log/')).length, 2);
  const C = novo(db, criarArmazenamento());
  const e = await C.store.carregar();
  assert.deepEqual(e.dados.sessoes.map((x) => x.id).sort(), ['a1', 'b1']);
  // A passa a ver o que B gravou depois de sincronizar
  const antes = A.store.estado().dados.sessoes.length;
  const depois = (await A.store.sincronizar()).dados.sessoes.length;
  assert.equal(antes, 1);
  assert.equal(depois, 2);
});

test('usuários diferentes no mesmo navegador não misturam dados', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  const u1 = novo(db, storage, {}, 'u_AAAAAAAAAAAAAAAAAAAAAA');
  const u2 = novo(db, storage, {}, 'u_BBBBBBBBBBBBBBBBBBBBBB');
  await u1.store.carregar(); await u2.store.carregar();
  u1.store.registrar('sessoes', sessao(10, null, { id: 'do-u1' }));
  await u1.store.flush();
  const e2 = await novo(db, storage, {}, 'u_BBBBBBBBBBBBBBBBBBBBBB').store.carregar();
  assert.equal(e2.dados.sessoes.length, 0);
  assert.ok(Array.from(db.docs.keys()).every((p) => p.startsWith('data/users/u_AAAAAAAAAAAAAAAAAAAAAA/')));
});

test('derivar: cancelamento remove sessão; última marcação por tópico vale; minutos somam só sessões ativas', () => {
  const dados = {
    sessoes: [{ id: 's1', ts: 1, min: 30, topicId: 'T1' }, { id: 's2', ts: 2, min: 20, topicId: 'T1' }, { id: 's3', ts: 3, min: 15, topicId: null }],
    marcacoes: [{ id: 'm1', ts: 10, topicId: 'T1', estudado: true }, { id: 'm2', ts: 20, topicId: 'T1', estudado: false }, { id: 'm3', ts: 5, topicId: 'T2', estudado: true }],
    cancelamentos: [{ id: 'c1', ts: 4, ref: 's2' }],
    revisoes: [], eventos: [],
  };
  const d = derivar(dados);
  assert.deepEqual(d.sessoes.map((s) => s.id), ['s1', 's3']);
  assert.equal(d.minutosPorTopico.get('T1'), 30);
  assert.equal(d.estudados.has('T1'), false, 'desmarcado depois');
  assert.equal(d.estudados.has('T2'), true);
  const empate = derivar({ marcacoes: [{ id: 'a', ts: 5, topicId: 'T', estudado: true }, { id: 'b', ts: 5, topicId: 'T', estudado: false }], sessoes: [], cancelamentos: [], revisoes: [], eventos: [] });
  assert.equal(empate.estudados.has('T'), false, 'empate de hora desempata pelo id, sempre igual');
  const cancelaMarcacao = derivar({ marcacoes: [{ id: 'a', ts: 1, topicId: 'T', estudado: true }, { id: 'b', ts: 2, topicId: 'T', estudado: false }], sessoes: [], cancelamentos: [{ id: 'c', ts: 3, ref: 'b' }], revisoes: [], eventos: [] });
  assert.equal(cancelaMarcacao.estudados.has('T'), true, 'cancelar o desmarcar restaura o estudado');
});

test('importação: 700 itens viram vários blocos; repetir a importação não acrescenta nada', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento(), { limiteChunk: 300 });
  await store.carregar();
  const dados = { sessoes: Array.from({ length: 700 }, (_, i) => ({ id: 'imp' + i, ts: 1000 + i, min: 10, topicId: 'OJ26-LP-01' })), estudados: ['OJ26-LP-03'], config: { disponivelMinDia: 45, atualizadoEm: 5 } };
  const c1 = store.adicionarItens(dados);
  assert.equal(c1.sessoes, 700);
  assert.equal(c1.estudadosLegados, 1);
  assert.equal(c1.config, 1);
  await store.flush();
  assert.equal(todosIds(db).filter((i) => i.startsWith('imp')).length, 700);
  assert.ok(Array.from(db.docs.keys()).filter((p) => p.includes('/app/log/')).length >= 3);
  const c2 = store.adicionarItens(dados);
  assert.equal(c2.sessoes, 0);
  assert.equal(c2.estudadosLegados, 0);
  assert.equal(c2.config, 0);
  assert.equal(store.estado().config.disponivelMinDia, 45);
});

test('importação com marcações E lista legada de estudados para o mesmo tópico: não duplica a marcação', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  const dados = {
    marcacoes: [{ id: 'm-original', ts: 1000, topicId: 'OJ26-LP-03', estudado: true }],
    estudados: ['OJ26-LP-03', 'OJ26-LP-04'],              // LP-03 também consta na lista legada; LP-04 só nela
    sessoes: [], eventos: [], revisoes: [], cancelamentos: [], config: {},
  };
  const c = store.adicionarItens(dados);
  assert.equal(c.marcacoes, 1);
  assert.equal(c.estudadosLegados, 1, 'só o LP-04, que não tinha marcação');
  await store.flush();
  const marcacoes = Array.from(db.docs.entries()).filter(([p]) => p.includes('/app/log/')).flatMap(([, d]) => d.marcacoes);
  assert.equal(marcacoes.filter((m) => m.topicId === 'OJ26-LP-03').length, 1);
  assert.equal(marcacoes.filter((m) => m.topicId === 'OJ26-LP-04').length, 1);
  assert.deepEqual(Array.from(store.estado().derivado.estudados).sort(), ['OJ26-LP-03', 'OJ26-LP-04']);
  const de = store.adicionarItens(dados);               // repetir não acrescenta nada
  assert.equal(de.marcacoes + de.estudadosLegados, 0);
});

test('configuração: grava no servidor e na cópia local; versão mais nova vence; local pendente mais novo é reenviado', async () => {
  const db = criarBanco();
  const storage = criarArmazenamento();
  const a = novo(db, storage);
  await a.store.carregar();
  a.store.salvarConfig({ disponivelMinDia: 60 });
  await a.store.flush();
  assert.equal(db.docs.get('data/users/' + UID + '/config').disponivelMinDia, 60);
  // alteração feita sem rede: fica na cópia local e é reenviada ao reabrir
  a.rel.avancarRelogio(5000);
  db.falhar('set', 'unavailable', 1000);
  a.store.salvarConfig({ disponivelMinDia: 90 });
  await a.store.flush();
  a.store.fechar();
  db.limparFalhas();
  const b = novo(db, storage);
  await b.store.carregar();
  assert.equal(b.store.estado().config.disponivelMinDia, 90);
  await b.store.flush();
  assert.equal(db.docs.get('data/users/' + UID + '/config').disponivelMinDia, 90);
  // servidor mais novo que a cópia local: vale o servidor
  const c = novo(db, criarArmazenamento());
  await c.store.carregar();
  assert.equal(c.store.estado().config.disponivelMinDia, 90);
});

test('verificar(): sucesso no banco saudável; falha clara quando o banco recusa; não deixa documento de prova', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  await store.carregar();
  const ok = await store.verificar();
  assert.equal(ok.ok, true);
  assert.equal(Array.from(db.docs.keys()).filter((p) => p.includes('/diag-')).length, 0);
  db.falhar('set', 'invalid_argument', 1);
  const ruim = await store.verificar();
  assert.equal(ruim.ok, false);
  assert.match(ruim.motivo, /invalid_argument/);
});

test('não registra antes de carregar (evita sobrescrever o servidor com dados parciais)', async () => {
  const { store } = novo(criarBanco(), criarArmazenamento());
  assert.throws(() => store.registrar('sessoes', sessao(10)), /não carregado/);
  assert.throws(() => store.salvarConfig({ a: 1 }), /não carregado/);
});

test('carregar falha com erro do banco: propaga o erro e não grava nada', async () => {
  const db = criarBanco();
  const { store } = novo(db, criarArmazenamento());
  db.falhar('list', 'unavailable', 1);
  await assert.rejects(() => store.carregar(), (e) => e.code === 'unavailable');
  assert.equal(store.status().carregado, false);
  assert.equal(db.info.escritas.length, 0);
  await store.carregar();   // tenta de novo e funciona
  assert.equal(store.status().carregado, true);
});

test('propriedades (300 sequências aleatórias): nada confirmado se perde, nada é inventado nem duplicado', async () => {
  const rnd = mulberry32(20261120);
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let it = 0; it < 300; it++) {
    const db = criarBanco();
    let storage = criarArmazenamento();
    const rel = criarRelogio();
    const limite = ri(3, 12);
    let n = 0;
    const abrir = async () => {
      const s = criarStore({ db, uid: UID, storage, agora: rel.agora, setTimeoutFn: rel.setTimeoutFn, clearTimeoutFn: rel.clearTimeoutFn, aleatorio: mulberry32(ri(1, 1e9)), limiteChunk: limite });
      await s.carregar();
      return s;
    };
    let store = await abrir();
    const registrados = new Set();
    const perdidos = new Set();
    const passos = ri(5, 40);
    for (let p = 0; p < passos; p++) {
      const acao = ri(1, 100);
      if (acao <= 45) {
        const id = 'x' + (n++);
        if (ri(0, 1)) store.registrar('sessoes', { id, min: ri(5, 90), topicId: 'T' + ri(1, 9) });
        else store.registrar('marcacoes', { id, topicId: 'T' + ri(1, 9), estudado: !!ri(0, 1) });
        registrados.add(id);
      } else if (acao <= 60) {
        await store.flush();
      } else if (acao <= 72) {
        db.falhar(['set', 'get', '*'][ri(0, 2)], ['unavailable', 'resource_exhausted'][ri(0, 1)], ri(1, 3));
      } else if (acao <= 85) {
        store.fechar();
        db.limparFalhas();
        store = await abrir();                     // reabre o app (caixa de saída local sobrevive)
      } else if (acao <= 92) {
        await rel.executar();                      // dispara tentativas agendadas
      } else {
        // apaga o armazenamento local: o que ainda não estava no servidor é perdido (declarado)
        const st = store.estado();
        const noServidor = new Set(todosIds(db));
        for (const k of Backup.COLECOES) for (const x of st.dados[k]) if (!noServidor.has(x.id)) perdidos.add(x.id);
        store.fechar();
        db.limparFalhas();
        storage = criarArmazenamento();
        store = await abrir();
      }
    }
    // recuperação final: banco saudável, o app é reaberto e termina de enviar tudo
    store.fechar();
    db.limparFalhas();
    store = await abrir();
    await store.flush();
    await rel.executar();
    await store.flush();
    const ids = todosIds(db);
    const noBanco = new Set(ids);
    assert.equal(ids.length, noBanco.size, 'duplicou registros (iteração ' + it + ')');
    for (const id of noBanco) assert.ok(registrados.has(id), 'inventou ' + id);
    for (const id of registrados) if (!perdidos.has(id)) assert.ok(noBanco.has(id), 'perdeu ' + id + ' (iteração ' + it + ')');
    assert.equal(store.status().pendentes, 0, 'sobrou pendência (iteração ' + it + ')');
    for (const [p, d] of db.docs) if (p.includes('/app/log/')) assert.ok(total(d) <= limite + 1000, 'bloco enorme');
    for (const p of db.info.escritas) assert.ok(p.startsWith('data/users/' + UID + '/'));
  }
});

function total(d) { return Backup.COLECOES.reduce((s, k) => s + d[k].length, 0); }
