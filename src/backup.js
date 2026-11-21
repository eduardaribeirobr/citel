'use strict';
/*
 * Backup, verificação de integridade e importação do histórico de estudo.
 *
 * O histórico é um registro de eventos com id único. Por isso importar um
 * backup é uma UNIÃO por id: repetir a importação não duplica nada e nenhum
 * registro existente é apagado. Substituir tudo é uma ação separada, e o app
 * deve avisar quantos registros locais seriam perdidos (perdaSeSubstituir).
 *
 * Esquema 2: além de eventos (respostas) e sessoes, guarda marcacoes (tópico
 * estudado ou não), revisoes e cancelamentos. Backups do esquema 1 continuam
 * válidos (as coleções novas ficam vazias).
 *
 * Funciona no Node 18+ e no navegador (usa crypto.subtle).
 */

const ESQUEMA = 2;
const APP = 'plataforma-oficial-tjsp';
const COLECOES = ['eventos', 'sessoes', 'marcacoes', 'revisoes', 'cancelamentos'];
const OBRIGATORIAS = ['eventos', 'sessoes'];

function canonico(v) {
  return JSON.stringify(v, (k, x) => {
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      return Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {});
    }
    return x;
  });
}

async function sha256Hex(texto) {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new Error('SHA-256 indisponível neste ambiente');
  const buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const ehObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const finito = (x) => typeof x === 'number' && Number.isFinite(x);
const idOk = (x) => ehObj(x) && typeof x.id === 'string' && x.id.length > 0 && finito(x.ts);

const VALIDADORES = {
  eventos: (e) => idOk(e) && typeof e.topicId === 'string' && typeof e.questionId === 'string',
  sessoes: (s) => idOk(s) && finito(s.min),
  marcacoes: (m) => idOk(m) && typeof m.topicId === 'string' && typeof m.estudado === 'boolean',
  revisoes: (r) => idOk(r) && typeof r.topicId === 'string' && Number.isInteger(r.etapa) && r.etapa >= 1,
  cancelamentos: (c) => idOk(c) && typeof c.ref === 'string' && c.ref.length > 0,
};
const ROTULO = {
  eventos: 'resposta', sessoes: 'sessão', marcacoes: 'marcação de estudo', revisoes: 'revisão', cancelamentos: 'cancelamento',
};

function normalizarDados(d) {
  const o = ehObj(d) ? d : {};
  const r = {};
  for (const c of COLECOES) r[c] = Array.isArray(o[c]) ? o[c] : [];
  r.estudados = Array.isArray(o.estudados) ? o.estudados : [];
  r.config = ehObj(o.config) ? o.config : {};
  return r;
}

function contagensDe(d) {
  const c = {};
  for (const k of COLECOES) c[k] = d[k].length;
  c.estudados = d.estudados.length;
  return c;
}

async function criarBackup(dados, meta) {
  const m = meta || {};
  const d = normalizarDados(dados);
  const sha = await sha256Hex(canonico({ esquema: ESQUEMA, dados: d }));
  const agora = finito(m.agora) ? m.agora : Date.now();
  return JSON.stringify({
    app: APP,
    esquema: ESQUEMA,
    criadoEm: new Date(agora).toISOString(),
    dispositivo: m.dispositivo || null,
    contagens: contagensDe(d),
    sha256: sha,
    dados: d,
  }, null, 1);
}

async function verificarBackup(texto) {
  const nao = (motivo, extra) => Object.assign({ ok: false, motivo }, extra);
  if (typeof texto !== 'string' || !texto.trim()) return nao('o arquivo está vazio');
  let a;
  try { a = JSON.parse(texto); } catch (e) { return nao('o arquivo não é um JSON válido (pode ter sido cortado ou editado)'); }
  if (!ehObj(a)) return nao('o arquivo não tem o formato de um backup');
  if (a.app !== APP) return nao('este arquivo não é um backup desta plataforma');
  if (!Number.isInteger(a.esquema) || a.esquema < 1) return nao('versão do backup ausente ou inválida');
  if (a.esquema > ESQUEMA) return nao('backup criado por uma versão mais nova da plataforma: atualize antes de importar');
  if (!ehObj(a.dados)) return nao('o backup não contém dados');
  const d = a.dados;
  for (const k of OBRIGATORIAS.concat(['estudados'])) {
    if (!Array.isArray(d[k])) return nao('campo "' + k + '" ausente ou inválido');
  }
  if (!ehObj(d.config)) return nao('campo "config" ausente ou inválido');
  for (const k of COLECOES) {
    if (d[k] === undefined && !OBRIGATORIAS.includes(k)) continue;
    if (!Array.isArray(d[k])) return nao('campo "' + k + '" ausente ou inválido');
    for (const item of d[k]) {
      if (!VALIDADORES[k](item)) return nao('há um registro de ' + ROTULO[k] + ' inválido');
    }
  }
  if (typeof a.sha256 !== 'string' || !a.sha256) return nao('o backup não traz a impressão digital SHA-256');
  let calc;
  try { calc = await sha256Hex(canonico({ esquema: a.esquema, dados: d })); }
  catch (e) { return nao('não foi possível calcular o SHA-256 neste aparelho', { indeterminado: true }); }
  if (calc !== a.sha256) return nao('conteúdo alterado ou corrompido (o SHA-256 não confere)');
  const c = a.contagens;
  if (ehObj(c)) {
    for (const k of COLECOES.concat(['estudados'])) {
      if (c[k] !== undefined && Array.isArray(d[k]) && c[k] !== d[k].length) return nao('as contagens do cabeçalho não conferem com os dados');
    }
    for (const k of OBRIGATORIAS.concat(['estudados'])) {
      if (c[k] !== d[k].length) return nao('as contagens do cabeçalho não conferem com os dados');
    }
  }
  return { ok: true, backup: a };
}

function uniaoPorId(a, b) {
  const mapa = new Map();
  for (const x of a) if (!mapa.has(x.id)) mapa.set(x.id, x);
  let adicionados = 0;
  let duplicados = 0;
  const conflitos = [];
  for (const y of b) {
    if (!mapa.has(y.id)) { mapa.set(y.id, y); adicionados++; }
    else if (canonico(mapa.get(y.id)) === canonico(y)) duplicados++;
    else if (!conflitos.includes(y.id)) conflitos.push(y.id);
  }
  const lista = Array.from(mapa.values())
    .sort((p, q) => (p.ts - q.ts) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  return { lista, adicionados, duplicados, conflitos };
}

function mesclarDados(atual, outro) {
  const A = normalizarDados(atual);
  const B = normalizarDados(outro);
  const dados = {};
  const novos = {};
  const duplicados = {};
  const conflitos = {};
  for (const k of COLECOES) {
    const u = uniaoPorId(A[k], B[k]);
    dados[k] = u.lista;
    novos[k] = u.adicionados;
    duplicados[k] = u.duplicados;
    conflitos[k] = u.conflitos;
  }
  dados.estudados = Array.from(new Set(A.estudados.concat(B.estudados))).sort();
  const maisNova = (B.config.atualizadoEm || 0) > (A.config.atualizadoEm || 0) ? B.config : A.config;
  dados.config = Object.assign({}, maisNova);
  return {
    dados,
    relatorio: {
      eventosNovos: novos.eventos, eventosDuplicados: duplicados.eventos, conflitosEventos: conflitos.eventos,
      sessoesNovas: novos.sessoes, sessoesDuplicadas: duplicados.sessoes, conflitosSessoes: conflitos.sessoes,
      novos, duplicados, conflitos,
    },
  };
}

function planejarImportacao(atual, importado) {
  const A = normalizarDados(atual);
  const B = normalizarDados(importado);
  const m = mesclarDados(A, B);
  const r = m.relatorio;
  const totalNovos = COLECOES.reduce((s, k) => s + r.novos[k], 0);
  const temConflito = COLECOES.some((k) => r.conflitos[k].length > 0);
  const atualVazio = COLECOES.every((k) => A[k].length === 0);
  let tipo;
  if (atualVazio) tipo = 'ATUAL VAZIO';
  else if (temConflito) tipo = 'COM CONFLITOS';
  else if (totalNovos === 0) tipo = 'NADA NOVO';
  else tipo = 'SOMENTE NOVOS';
  const perda = {};
  for (const k of COLECOES) {
    const ids = new Set(B[k].map((x) => x.id));
    perda[k] = A[k].filter((x) => !ids.has(x.id)).length;
  }
  return {
    tipo,
    recomendacao: 'MESCLAR',
    resultado: m.dados,
    relatorio: r,
    totalNovos,
    perdaSeSubstituir: perda,
  };
}

const API = { ESQUEMA, COLECOES, VALIDADORES, ROTULO, canonico, sha256Hex, normalizarDados, criarBackup, verificarBackup, mesclarDados, planejarImportacao };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Backup = API;
