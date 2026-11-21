'use strict';
// Dublês de teste: banco de documentos, armazenamento local e relógio manual.
const clone = (x) => JSON.parse(JSON.stringify(x));

function criarBanco() {
  const docs = new Map();
  const info = { escritas: [], leituras: [], apagados: [], falhas: [] };
  function falhar(op, code, vezes = 1) { info.falhas.push({ op, code, vezes }); }
  function limparFalhas() { info.falhas.length = 0; }
  function talvezFalhar(op) {
    for (const f of info.falhas) {
      if ((f.op === '*' || f.op === op) && f.vezes > 0) { f.vezes -= 1; throw { code: f.code, message: 'falha simulada em ' + op }; }
    }
  }
  const snap = (path, has) => ({ id: path.split('/').pop(), exists: has, data: () => (has ? clone(docs.get(path)) : undefined) });
  function ref(path) {
    return {
      id: path.split('/').pop(), path,
      async get() { await null; talvezFalhar('get'); info.leituras.push(path); return snap(path, docs.has(path)); },
      async set(d) {
        await null;
        if (info.retencao) await info.retencao.promise;       // segura a gravação até alguém liberar
        talvezFalhar('set'); info.escritas.push(path); docs.set(path, clone(d));
      },
      async delete() { await null; talvezFalhar('delete'); info.apagados.push(path); docs.delete(path); },
      collection(nome) { return colecao(path + '/' + nome); },
    };
  }
  function colecao(path) {
    return {
      path,
      doc: (id) => ref(path + '/' + id),
      async get() {
        await null; talvezFalhar('list');
        const prof = path.split('/').length + 1;
        const chaves = Array.from(docs.keys()).filter((k) => k.startsWith(path + '/') && k.split('/').length === prof);
        return { docs: chaves.map((k) => snap(k, true)), size: chaves.length };
      },
    };
  }
  function reter() {
    let liberar;
    const promise = new Promise((r) => { liberar = r; });
    info.retencao = { promise };
    return () => { info.retencao = null; liberar(); };
  }
  return { doc: ref, collection: colecao, docs, info, falhar, limparFalhas, reter };
}

function criarArmazenamento() {
  const dados = new Map();
  const a = {
    quebrado: false,
    getItem(k) { if (a.quebrado) throw new Error('SecurityError'); return dados.has(k) ? dados.get(k) : null; },
    setItem(k, v) { if (a.quebrado) throw new Error('QuotaExceededError'); dados.set(k, String(v)); },
    removeItem(k) { dados.delete(k); },
    dados,
  };
  return a;
}

function criarRelogio(inicio = Date.UTC(2026, 10, 20, 15, 0, 0)) {
  let agora = inicio;
  let seq = 0;
  const timers = new Map();
  return {
    agora: () => agora,
    avancarRelogio(ms) { agora += ms; },
    setTimeoutFn(f, ms) { const id = ++seq; timers.set(id, { f, em: agora + ms }); return id; },
    clearTimeoutFn(id) { timers.delete(id); },
    pendentes: () => timers.size,
    async executar() {          // roda todos os temporizadores agendados, em ordem
      const lista = Array.from(timers.entries()).sort((a, b) => a[1].em - b[1].em);
      for (const [id, t] of lista) { timers.delete(id); await t.f(); }
      await null; await null;
    },
  };
}

function mulberry32(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { criarBanco, criarArmazenamento, criarRelogio, mulberry32, clone };
