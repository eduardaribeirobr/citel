'use strict';
/*
 * Registro de eventos com gravação confiável (histórico individual, só de acréscimo).
 *
 * - Cada registro tem id único. O histórico é a UNIÃO por id de todos os blocos ("chunks").
 * - Cada aparelho grava só nos seus próprios blocos (data/users/<uid>/app/log/<aparelho>-<seq>),
 *   de até `limiteChunk` itens, bem abaixo do limite de 256 KiB por documento.
 * - Antes de enviar, o bloco é copiado para o armazenamento local do aparelho ("caixa de saída").
 *   Se o app fechar ou a rede cair, nada se perde: ao reabrir, o que faltava é enviado.
 * - Antes de cada gravação o app lê o bloco no servidor e junta o que já existe (nunca apaga).
 * - Falhas temporárias são repetidas com espera crescente; falhas definitivas aparecem no status.
 * - Nada é escrito fora de data/users/<uid>/.
 */
const Backup = (typeof require === 'function') ? require('./backup.js') : globalThis.Backup;

const COLECOES = Backup.COLECOES;
const FATAIS = ['invalid_argument', 'quota_exceeded', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed'];

const clone = (x) => JSON.parse(JSON.stringify(x));

function unirPorId(listas) {
  const m = new Map();
  for (const l of listas) for (const x of l) if (!m.has(x.id)) m.set(x.id, x);
  return Array.from(m.values());
}
const ordenar = (l) => l.slice().sort((p, q) => (p.ts - q.ts) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));

/** Estado derivado: aplica cancelamentos, descobre a última marcação por tópico e soma minutos. */
function derivar(dados) {
  const d = {};
  for (const k of COLECOES) d[k] = dados[k] || [];
  const cancelados = new Set(d.cancelamentos.map((c) => c.ref));
  const ativos = (k) => d[k].filter((x) => !cancelados.has(x.id));
  const sessoes = ativos('sessoes');
  const marcacoes = ativos('marcacoes');
  const revisoes = ativos('revisoes');
  const eventos = ativos('eventos');
  const ultimaMarcacao = new Map();
  for (const m of marcacoes) {
    const a = ultimaMarcacao.get(m.topicId);
    if (!a || m.ts > a.ts || (m.ts === a.ts && m.id > a.id)) ultimaMarcacao.set(m.topicId, m);
  }
  const estudados = new Set();
  for (const [t, m] of ultimaMarcacao) if (m.estudado) estudados.add(t);
  const minutosPorTopico = new Map();
  for (const s of sessoes) if (s.topicId) minutosPorTopico.set(s.topicId, (minutosPorTopico.get(s.topicId) || 0) + s.min);
  return { eventos, sessoes, marcacoes, revisoes, ultimaMarcacao, estudados, minutosPorTopico, cancelados };
}

function criarStore(opt) {
  const o = Object.assign({
    limiteChunk: 300,
    atrasoMs: 600,
    backoffMs: [1000, 2000, 5000, 15000, 30000],
    agora: () => Date.now(),
    aleatorio: Math.random,
    setTimeoutFn: (f, ms) => setTimeout(f, ms),
    clearTimeoutFn: (t) => clearTimeout(t),
  }, opt);
  const { db, uid, storage } = o;
  if (!db || typeof uid !== 'string' || !uid) throw new TypeError('db e uid são obrigatórios');

  const base = 'data/users/' + uid;
  const colChunks = db.doc(base + '/app').collection('log');
  const refConfig = db.doc(base + '/config');
  const K_DISP = 'pl:dispositivo';
  const K_MEUS = 'pl:' + uid + ':meus';
  const K_CFG = 'pl:' + uid + ':config';

  let localOk = !!storage;
  const lerLocal = (k) => {
    if (!storage) return null;
    try { const v = storage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { localOk = false; return null; }
  };
  const gravarLocal = (k, v) => {
    if (!storage) return;
    try { storage.setItem(k, JSON.stringify(v)); localOk = true; } catch (e) { localOk = false; }
  };

  const alfabeto = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const token = (n) => { let s = ''; for (let i = 0; i < n; i++) s += alfabeto[Math.floor(o.aleatorio() * alfabeto.length)]; return s; };
  const novoId = (pref) => pref + '-' + o.agora().toString(36) + '-' + token(5);

  let dispositivo = null;
  const meus = new Map();        // seq -> { doc, sujo, versao, gravada }
  let seqAtual = 1;
  let outros = [];               // corpos de blocos de outros aparelhos
  const idsConhecidos = new Set();
  let config = null;
  let sujoConfig = false;
  let versaoCfg = 0;
  let gravadaCfg = 0;
  let carregado = false;
  let erro = null;
  let ultimoSalvo = null;
  let gravando = false;
  let timer = null;
  let tentativa = 0;
  let rev = 0;
  let cache = null;
  let cadeia = Promise.resolve();
  const ouvintes = new Set();

  const idChunk = (c) => c.dispositivo + '-' + String(c.seq).padStart(4, '0');
  const total = (c) => COLECOES.reduce((s, k) => s + c[k].length, 0);
  function novoChunk(seq) {
    const t = o.agora();
    const c = { schema: 1, dispositivo, seq, criadoEm: t, atualizadoEm: t };
    for (const k of COLECOES) c[k] = [];
    return c;
  }
  const chunkValido = (c) => c && typeof c === 'object' && typeof c.dispositivo === 'string' && Number.isInteger(c.seq) && COLECOES.every((k) => Array.isArray(c[k]));
  const novoMeu = (doc, sujo) => ({ doc, sujo, versao: 0, gravada: 0 });

  /** Une dois blocos do mesmo dispositivo e sequência. Devolve se o resultado trouxe itens que `a` não tinha. */
  function unirChunk(a, b) {
    const r = clone(a);
    let novos = false;
    for (const k of COLECOES) {
      const ids = new Set(a[k].map((x) => x.id));
      for (const x of b[k] || []) if (!ids.has(x.id)) { r[k].push(clone(x)); novos = true; }
    }
    r.atualizadoEm = Math.max(a.atualizadoEm || 0, b.atualizadoEm || 0);
    return { doc: r, novos };
  }

  function obterDispositivo() {
    let d = lerLocal(K_DISP);
    if (typeof d !== 'string' || !/^[a-z0-9]{6,12}$/.test(d)) { d = token(8); gravarLocal(K_DISP, d); }
    return d;
  }

  function espelharLocal() {
    const obj = {};
    for (const [seq, m] of meus) if (m.sujo || seq === seqAtual) obj[seq] = { doc: m.doc, sujo: m.sujo };
    gravarLocal(K_MEUS, obj);
    if (config) gravarLocal(K_CFG, { doc: config, sujo: sujoConfig });
  }

  const algumSujo = () => sujoConfig || Array.from(meus.values()).some((m) => m.sujo);
  function pendentes() {
    let n = 0;
    for (const m of meus.values()) n += m.versao - m.gravada;
    if (sujoConfig) n += versaoCfg - gravadaCfg;
    return n;
  }
  function status() {
    return { carregado, pendentes: pendentes(), gravando, ultimoSalvo, erro: erro ? Object.assign({}, erro) : null, localOk, dispositivo, chunks: meus.size };
  }
  function notificar() { const s = status(); for (const f of ouvintes) { try { f(s); } catch (e) { /* ouvinte não pode derrubar o registro */ } } }
  function onStatus(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

  function reconstruirIds() {
    idsConhecidos.clear();
    for (const m of meus.values()) for (const k of COLECOES) for (const x of m.doc[k]) idsConhecidos.add(x.id);
    for (const c of outros) for (const k of COLECOES) for (const x of c[k]) idsConhecidos.add(x.id);
  }

  async function lerRemotos() {
    const snap = await colChunks.get();
    return snap.docs.map((d) => d.data()).filter(chunkValido);
  }

  async function carregar() {
    const remotos = await lerRemotos();
    dispositivo = obterDispositivo();
    meus.clear();
    outros = [];
    for (const c of remotos) {
      if (c.dispositivo === dispositivo) meus.set(c.seq, novoMeu(clone(c), false));
      else outros.push(clone(c));
    }
    const loc = lerLocal(K_MEUS);
    if (loc && typeof loc === 'object') {
      for (const [s, v] of Object.entries(loc)) {
        const seq = Number(s);
        if (!v || !chunkValido(v.doc) || v.doc.dispositivo !== dispositivo || v.doc.seq !== seq) continue;
        const rem = meus.get(seq);
        if (rem) {
          const u = unirChunk(rem.doc, v.doc);
          rem.doc = u.doc;
          if (u.novos) rem.sujo = true;
        } else {
          meus.set(seq, novoMeu(clone(v.doc), true));   // este bloco nunca chegou ao servidor
        }
      }
    }
    seqAtual = meus.size ? Math.max(...meus.keys()) : 1;
    if (!meus.has(seqAtual)) meus.set(seqAtual, novoMeu(novoChunk(seqAtual), false));
    const cs = await refConfig.get();
    const remotoCfg = cs.exists ? cs.data() : null;
    const locCfg = lerLocal(K_CFG);
    config = remotoCfg;
    sujoConfig = false;
    if (locCfg && locCfg.doc && (!config || (locCfg.doc.atualizadoEm || 0) > (config.atualizadoEm || 0))) { config = locCfg.doc; sujoConfig = true; }
    reconstruirIds();
    carregado = true;
    erro = null;
    rev++;
    cache = null;
    espelharLocal();
    notificar();
    if (algumSujo()) agendar(0);
    return estado();
  }

  /** Traz do servidor o que outros aparelhos gravaram desde a última leitura. */
  async function sincronizar() {
    if (!carregado) throw new Error('store não carregado');
    const remotos = await lerRemotos();
    const novosOutros = [];
    for (const c of remotos) {
      if (c.dispositivo === dispositivo) {
        const m = meus.get(c.seq);
        if (m) { const u = unirChunk(m.doc, c); if (u.novos) { m.doc = u.doc; } }
        else meus.set(c.seq, novoMeu(clone(c), false));
      } else novosOutros.push(clone(c));
    }
    outros = novosOutros;
    seqAtual = Math.max(...meus.keys());
    reconstruirIds();
    rev++;
    cache = null;
    notificar();
    return estado();
  }

  function registrarLote(colecao, itens) {
    if (!carregado) throw new Error('store não carregado: aguarde carregar()');
    if (!COLECOES.includes(colecao)) throw new TypeError('coleção desconhecida: ' + colecao);
    const salvos = [];
    const agora = o.agora();
    for (const it of itens) {
      if (!it || typeof it !== 'object') throw new TypeError('registro inválido');
      const item = Object.assign({}, it);
      if (!item.id) item.id = novoId(colecao.slice(0, 3));
      if (item.ts === undefined) item.ts = agora;
      if (!Backup.VALIDADORES[colecao](item)) throw new TypeError('registro de ' + Backup.ROTULO[colecao] + ' inválido');
      if (idsConhecidos.has(item.id)) continue;
      let m = meus.get(seqAtual);
      if (total(m.doc) >= o.limiteChunk) {
        seqAtual += 1;
        m = novoMeu(novoChunk(seqAtual), false);
        meus.set(seqAtual, m);
      }
      m.doc[colecao].push(item);
      m.doc.atualizadoEm = agora;
      m.sujo = true;
      m.versao += 1;
      idsConhecidos.add(item.id);
      salvos.push(item);
    }
    if (salvos.length) { rev++; cache = null; espelharLocal(); agendar(o.atrasoMs); notificar(); }
    return salvos;
  }
  const registrar = (colecao, item) => registrarLote(colecao, [item])[0] || null;

  function agendar(ms) {
    if (timer !== null) o.clearTimeoutFn(timer);
    timer = o.setTimeoutFn(() => { timer = null; return flush(); }, ms);
  }
  function agendarRetry() {
    const ms = o.backoffMs[Math.min(tentativa, o.backoffMs.length - 1)];
    tentativa += 1;
    agendar(ms);
  }
  const ehFatal = (e) => !!(e && FATAIS.includes(e.code));

  function flush() {
    if (timer !== null) { o.clearTimeoutFn(timer); timer = null; }   // um envio explícito substitui o agendado
    cadeia = cadeia.then(gravarTudo, gravarTudo);
    return cadeia;
  }

  async function gravarTudo() {
    if (!carregado) return status();
    gravando = true;
    notificar();
    try {
      const seqs = Array.from(meus.keys()).sort((a, b) => a - b);
      for (const seq of seqs) {
        const m = meus.get(seq);
        if (!m.sujo) continue;
        const v = m.versao;
        const ref = colChunks.doc(idChunk(m.doc));
        const atual = await ref.get();                       // junta o que já existe no servidor
        if (atual.exists && chunkValido(atual.data())) {
          const u = unirChunk(m.doc, atual.data());
          if (u.novos) { m.doc = u.doc; for (const k of COLECOES) for (const x of m.doc[k]) idsConhecidos.add(x.id); rev++; cache = null; }
        }
        await ref.set(clone(m.doc));
        m.gravada = v;
        if (m.versao === v) m.sujo = false;
      }
      if (sujoConfig) {
        const vc = versaoCfg;
        await refConfig.set(clone(config));
        gravadaCfg = vc;
        if (versaoCfg === vc) sujoConfig = false;
      }
      erro = null;
      tentativa = 0;
      ultimoSalvo = o.agora();
      espelharLocal();
    } catch (e) {
      erro = { code: (e && e.code) || 'erro', message: String((e && e.message) || e), fatal: ehFatal(e) };
      espelharLocal();
      if (!erro.fatal) agendarRetry();
    } finally {
      gravando = false;
      notificar();
    }
    return status();
  }

  function salvarConfig(parcial, opcoes) {
    if (!carregado) throw new Error('store não carregado');
    const preservar = opcoes && opcoes.preservarTs && parcial && Number.isFinite(parcial.atualizadoEm);
    config = Object.assign({}, config || {}, parcial);
    config.atualizadoEm = preservar ? parcial.atualizadoEm : o.agora();
    versaoCfg += 1;
    sujoConfig = true;
    rev++;
    cache = null;
    espelharLocal();
    agendar(o.atrasoMs);
    notificar();
    return config;
  }

  function estado() {
    if (cache && cache.rev === rev) return cache.valor;
    const dados = {};
    for (const k of COLECOES) {
      const listas = [];
      for (const m of meus.values()) listas.push(m.doc[k]);
      for (const c of outros) listas.push(c[k]);
      dados[k] = ordenar(unirPorId(listas));
    }
    const derivado = derivar(dados);
    const valor = { dados, derivado, config: config ? Object.assign({}, config) : {} };
    cache = { rev, valor };
    return valor;
  }

  /** Dados no formato do backup (esquema 2). */
  function exportar() {
    const e = estado();
    const d = {};
    for (const k of COLECOES) d[k] = clone(e.dados[k]);
    d.estudados = Array.from(e.derivado.estudados).sort();
    d.config = clone(e.config);
    return d;
  }

  /** Aplica dados já mesclados (resultado de Backup.planejarImportacao). Só acrescenta; nunca apaga. */
  function adicionarItens(dados) {
    const contagem = {};
    for (const k of COLECOES) {
      const novos = (dados[k] || []).filter((x) => !idsConhecidos.has(x.id));
      contagem[k] = registrarLote(k, novos).length;
    }
    const e = estado();   // estado JÁ com os itens acima: evita marcar de novo um tópico que o próprio backup marcou
    contagem.estudadosLegados = 0;
    for (const t of dados.estudados || []) {
      if (!e.derivado.estudados.has(t) && !e.derivado.ultimaMarcacao.has(t)) {
        registrar('marcacoes', { topicId: t, estudado: true });
        contagem.estudadosLegados += 1;
      }
    }
    const cfgNova = dados.config || {};
    if ((cfgNova.atualizadoEm || 0) > ((config && config.atualizadoEm) || 0)) { salvarConfig(cfgNova, { preservarTs: true }); contagem.config = 1; } else contagem.config = 0;
    return contagem;
  }

  /** Teste de gravação: escreve, lê, compara e apaga um documento de prova no espaço privado. */
  async function verificar() {
    const t0 = o.agora();
    const id = 'diag-' + token(8);
    const ref = db.collection(base).doc(id);
    const corpo = { schema: 1, prova: token(16), ts: t0 };
    try {
      await ref.set(corpo);
      const s = await ref.get();
      if (!s.exists || JSON.stringify(s.data()) !== JSON.stringify(corpo)) {
        try { await ref.delete(); } catch (e) { /* tentativa de limpeza */ }
        return { ok: false, motivo: 'o conteúdo lido não é igual ao gravado' };
      }
      await ref.delete();
      const depois = await ref.get();
      if (depois.exists) return { ok: false, motivo: 'o documento de prova não foi apagado' };
      return { ok: true, ms: o.agora() - t0 };
    } catch (e) {
      try { await ref.delete(); } catch (e2) { /* tentativa de limpeza */ }
      return { ok: false, motivo: String((e && (e.code || e.message)) || e) };
    }
  }

  function fechar() { if (timer !== null) { o.clearTimeoutFn(timer); timer = null; } }

  return { carregar, sincronizar, registrar, registrarLote, salvarConfig, flush, estado, exportar, adicionarItens, verificar, status, onStatus, novoId, fechar };
}

const API = { criarStore, derivar, COLECOES };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Store = API;
