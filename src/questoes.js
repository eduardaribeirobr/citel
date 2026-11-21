'use strict';
/*
 * Motor de questões inéditas VERIFICADAS POR COMPUTAÇÃO (Matemática e Raciocínio Lógico).
 *
 * Cada questão é gerada de forma determinística a partir de (modelo, semente, nível), então o id
 *   MODELO:semente:nível
 * reproduz exatamente a mesma questão (necessário para "refazer" e para o caderno de erros).
 *
 * Regra de ouro (protocolo de validação): só se apresenta uma questão que passou por TODAS as verificações:
 *   1. estrutura: 5 alternativas distintas, exatamente uma correta, todas as erradas comentadas;
 *   2. correção: a resposta é recalculada por um SEGUNDO método independente (resolver) e confere;
 *   3. unicidade: nenhuma alternativa errada tem o mesmo valor da correta.
 * Direito, Português, Informática e Atualidades NÃO têm questões aqui: dependem de fonte oficial.
 */
const VERSAO = '1';
const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karen', 'Lucas', 'Marta', 'Nelson'];

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function criarRng(semente) {
  const f = mulberry32(semente >>> 0);
  return {
    prox: f,
    int(a, b) { return a + Math.floor(f() * (b - a + 1)); },
    pick(l) { return l[Math.floor(f() * l.length)]; },
    embaralhar(l) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
  };
}

const mdc = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; };
const mmc = (a, b) => (a / mdc(a, b)) * b;

/** Número no padrão brasileiro: 1.234,5. Sem `casas`, mostra até 4 decimais sem zeros à direita. */
function fmt(n, casas) {
  const neg = n < 0;
  const a = Math.abs(n);
  let s = casas === undefined ? String(Math.round(a * 1e4) / 1e4) : a.toFixed(casas);
  if (/e/.test(s)) s = a.toFixed(4);
  const [i, d] = s.split('.');
  return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
}
const brl = (n) => 'R$ ' + fmt(n, 2);

// Frações simplificadas
const F = (p, q) => { if (q === undefined) q = 1; if (q < 0) { p = -p; q = -q; } const g = mdc(p, q) || 1; return { p: p / g, q: q / g }; };
const fadd = (a, b) => F(a.p * b.q + b.p * a.q, a.q * b.q);
const fsub = (a, b) => F(a.p * b.q - b.p * a.q, a.q * b.q);
const fmul = (a, b) => F(a.p * b.p, a.q * b.q);
const fdiv = (a, b) => F(a.p * b.q, a.q * b.p);
const fval = (a) => a.p / a.q;
const ftxt = (a) => (a.p < 0 ? '−' : '') + (a.q === 1 ? fmt(Math.abs(a.p)) : Math.abs(a.p) + '/' + a.q);

const CATALOGO = [];

function iguais(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return a === b;
}
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

function modelo(id) {
  const t = CATALOGO.find((x) => x.id === id);
  if (!t) throw new Error('modelo de questão desconhecido: ' + id);
  return t;
}
function idQuestao(templateId, semente, nivel) { return templateId + ':' + semente + ':' + nivel; }
function lerId(id) {
  const m = /^([A-Z0-9-]+):(\d+):([1-5])$/.exec(String(id));
  return m ? { templateId: m[1], semente: Number(m[2]), nivel: Number(m[3]) } : null;
}

// ---------- texto: concordância "1 + plural" ----------
// Os modelos montam frases com números sorteados; quando o número é 1, a unidade tem de ficar no singular.
// Esta correção é só de TEXTO (não mexe em sorteios, valores nem na posição do gabarito).
const SINGULAR = { partes: 'parte', operários: 'operário', dias: 'dia', anos: 'ano', meses: 'mês', semanas: 'semana', horas: 'hora', minutos: 'minuto', segundos: 'segundo',
  canetas: 'caneta', cadernos: 'caderno', máquinas: 'máquina', peças: 'peça', metros: 'metro', litros: 'litro', quilos: 'quilo', pessoas: 'pessoa', alunos: 'aluno',
  funcionários: 'funcionário', torneiras: 'torneira', pedaços: 'pedaço', unidades: 'unidade', reais: 'real', amigos: 'amigo', candidatos: 'candidato', sócios: 'sócio' };
function corrigirPlural(txt) {
  return String(txt).replace(/(^|[^\d,.\-−])1 (\p{L}+)(?!\p{L})/gu, (m, pre, w) => (SINGULAR[w] ? pre + '1 ' + SINGULAR[w] : m));
}

// ---------- modelos aposentados ----------
// REGRA: o id de uma questão (MODELO:semente:nível) é IMUTÁVEL: o histórico guarda só o id e a questão é gerada de novo ao
// refazer. Um modelo com defeito não é editado: cria-se um modelo novo e o antigo recebe `aposentado: '<id do sucessor>'`.
// Modelo aposentado continua reproduzindo o histórico, mas não entra em sessões novas.
const ativos = () => CATALOGO.filter((t) => !t.aposentado);
function sucessorDe(templateId) {
  let t = CATALOGO.find((x) => x.id === templateId);
  for (let i = 0; t && t.aposentado && i < 10; i++) t = CATALOGO.find((x) => x.id === t.aposentado);
  return t ? t.id : templateId;
}

/**
 * Gera a questão (mesmo id => mesma questão). Tenta variações de parâmetros até haver 4 distratores
 * distintos e de valor diferente da resposta; falha de forma explícita se não conseguir.
 */
function gerarQuestao(templateId, semente, nivel) {
  const t = modelo(templateId);
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const rng = criarRng(hashStr([templateId, VERSAO, semente, nivel, tentativa].join('|')));
    const g = t.gerar(rng, nivel, semente);
    const vistos = new Set([norm(g.correta.texto)]);
    const escolhidos = [];
    for (const e of rng.embaralhar(g.erros)) {
      if (e.valor === null || e.valor === undefined || (typeof e.valor === 'number' && !Number.isFinite(e.valor))) continue;
      if (iguais(e.valor, g.correta.valor)) continue;
      const k = norm(e.texto);
      if (vistos.has(k)) continue;
      vistos.add(k);
      escolhidos.push(e);
      if (escolhidos.length === 4) break;
    }
    if (escolhidos.length < 4) continue;
    const todas = rng.embaralhar([{ texto: g.correta.texto, valor: g.correta.valor, correta: true, comentario: 'Correta. ' + (g.comentarioCorreta || '') }]
      .concat(escolhidos.map((e) => ({ texto: e.texto, valor: e.valor, correta: false, comentario: 'Errada: ' + e.porque + '.' }))));
    const gabaritoIdx = todas.findIndex((a) => a.correta);
    return {
      id: idQuestao(templateId, semente, nivel),
      templateId, semente, nivel, versao: VERSAO,
      topicId: g.topicId || t.topicId, disciplina: t.disciplina, assunto: t.titulo,
      enunciado: corrigirPlural(g.enunciado),
      alternativas: todas.map((a, i) => ({ letra: LETRAS[i], texto: corrigirPlural(a.texto), valor: a.valor, correta: a.correta, comentario: corrigirPlural(a.comentario) })),
      gabarito: LETRAS[gabaritoIdx], gabaritoIdx,
      explicacao: corrigirPlural(g.explicacao), pegadinha: corrigirPlural(g.pegadinha),
      origem: g.origem || 'inédita', fonte: g.fonte || 'Verificação computacional por dois métodos independentes', confianca: g.confianca || 'B', valor: g.correta.valor, params: g.params,
    };
  }
  throw new Error('não foi possível gerar 4 distratores válidos para ' + templateId + ' (semente ' + semente + ', nível ' + nivel + ')');
}

/** Verificações obrigatórias. Devolve {ok, erros}. Só questão com ok === true pode ser apresentada. */
function validarQuestao(q) {
  const erros = [];
  const t = CATALOGO.find((x) => x.id === q.templateId);
  if (!t) return { ok: false, erros: ['modelo desconhecido'] };
  if (!Array.isArray(q.alternativas) || q.alternativas.length !== 5) erros.push('deve ter 5 alternativas');
  else {
    if (new Set(q.alternativas.map((a) => norm(a.texto))).size !== 5) erros.push('alternativas repetidas');
    if (q.alternativas.filter((a) => a.correta).length !== 1) erros.push('deve haver exatamente uma alternativa correta');
    if (!(q.gabaritoIdx >= 0 && q.alternativas[q.gabaritoIdx] && q.alternativas[q.gabaritoIdx].correta)) erros.push('gabarito não aponta a alternativa correta');
    if (q.gabarito !== LETRAS[q.gabaritoIdx]) erros.push('letra do gabarito inconsistente');
    for (const a of q.alternativas) if (!a.comentario || a.comentario.length < 12) erros.push('alternativa ' + a.letra + ' sem comentário');
    const certa = q.alternativas.find((a) => a.correta);
    let indep;
    try { indep = t.resolver(q.params); } catch (e) { indep = undefined; erros.push('o segundo método falhou: ' + e.message); }
    if (indep !== undefined) {
      if (!iguais(indep, q.valor)) erros.push('o segundo método discorda da resposta (' + indep + ' ≠ ' + q.valor + ')');
      if (certa && !iguais(indep, certa.valor)) erros.push('a alternativa correta não tem o valor do segundo método');
      for (const a of q.alternativas) if (!a.correta && iguais(indep, a.valor)) erros.push('alternativa errada ' + a.letra + ' tem o valor da resposta (gabarito ambíguo)');
    }
  }
  if (!q.enunciado || q.enunciado.length < 10 || q.enunciado.length > 1200) erros.push('enunciado fora do tamanho esperado');
  if (!q.explicacao || q.explicacao.length < 30) erros.push('explicação ausente ou curta');
  if (!q.pegadinha || q.pegadinha.length < 15) erros.push('pegadinha ausente');
  return { ok: erros.length === 0, erros };
}

/** Gera uma questão válida a partir de uma semente-base (se a semente falhar, tenta as seguintes). */
function gerarValida(templateId, sementeBase, nivel) {
  for (let i = 0; i < 40; i++) {
    try {
      const q = gerarQuestao(templateId, sementeBase + i, nivel);
      if (validarQuestao(q).ok) return q;
    } catch (e) { /* tenta a próxima semente */ }
  }
  throw new Error('nenhuma questão válida para ' + templateId + ' a partir de ' + sementeBase);
}

/** Tópicos que um modelo atende: um só (`topicId`) ou vários (`topicIds`, modelos de Direito: um por diploma). */
const topicosDe = (t) => t.topicIds || [t.topicId];
const templatesDoTopico = (topicId) => CATALOGO.filter((t) => topicosDe(t).includes(topicId));

const API = {
  VERSAO, LETRAS, NOMES, CATALOGO, criarRng, hashStr, mdc, mmc, fmt, brl, F, fadd, fsub, fmul, fdiv, fval, ftxt, iguais,
  idQuestao, lerId, modelo, gerarQuestao, validarQuestao, gerarValida, templatesDoTopico, topicosDe, corrigirPlural, ativos, sucessorDe,
};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.Questoes = API;
