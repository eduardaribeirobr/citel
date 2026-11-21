'use strict';
/*
 * Fontes oficiais: leitura do arquivo bruto guardado (com SHA-256), extração do texto por artigo
 * e conferência de citações LITERAIS. Nenhum conteúdo jurídico entra sem passar por aqui.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª', deg: '°', sect: '§', laquo: '«', raquo: '»', ndash: '–', mdash: '—',
  hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', copy: '©', times: '×', frac12: '½', shy: '', ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ' };
for (const [base, acentos] of Object.entries({ a: ['acute:á', 'grave:à', 'circ:â', 'tilde:ã', 'uml:ä'], e: ['acute:é', 'grave:è', 'circ:ê', 'uml:ë'], i: ['acute:í', 'grave:ì', 'circ:î', 'uml:ï'],
  o: ['acute:ó', 'grave:ò', 'circ:ô', 'tilde:õ', 'uml:ö'], u: ['acute:ú', 'grave:ù', 'circ:û', 'uml:ü'] })) {
  for (const par of acentos) { const [nome, ch] = par.split(':'); ENT[base + nome] = ch; ENT[base.toUpperCase() + nome] = ch.toUpperCase(); }
}

function htmlParaTexto(html) {
  let t = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/<\s*(br|\/p|\/div|\/tr|\/li|\/h\d)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  t = t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n] !== undefined ? ENT[n] : m));
  return t.split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}
/** Forma para comparar trechos: sem diferença de espaço/quebra de linha, mas sensível a letras e pontuação. */
const normalizar = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

const INICIO_ARTIGO = /^Artigo\s+(\d+(?:\.\d+)*)[º°]?(?:-([A-Z]{1,2})\b)?\s*[º°.]?\s*(?:-|–|—)?/;
const INICIO_ART_PONTO = /^\s*Art\.\s*(\d+(?:\.\d{3})*)\s*[º°]?(?:-([A-Z]{1,2})\b)?(?=[\s.:\-–—]|$)/;
const REMISSAO = /^\s*Art\.\s*\d[\d.]*\S*\s+(?:da|do|das|dos|desta|deste|e|ou|a|ao|c\/c|,)\b/;
/** Estilo "Art. 994." (PDF das Normas da Corregedoria). Começa em `inicio` (regex) para pular provimentos e índice. */
function extrairArtigosArtPonto(texto, inicio) {
  const linhas = texto.split('\n'); let i0 = 0;
  if (inicio) { const re = new RegExp(inicio); i0 = linhas.findIndex((l) => re.test(l)); if (i0 < 0) throw new Error('marcador de início do corpo não encontrado: ' + inicio); }
  const out = {}; let atual = null;
  for (const bruta of linhas.slice(i0)) {
    const linha = bruta.replace(/\s+/g, ' ').trim(); if (!linha) continue;
    const m = INICIO_ART_PONTO.exec(bruta);
    if (m && !REMISSAO.test(bruta)) {
      const chave = m[1].replace(/\./g, '') + (m[2] ? '-' + m[2] : '');
      if (out[chave] === undefined) { atual = chave; out[atual] = linha; } else atual = null;
    } else if (atual) out[atual] += '\n' + linha;
  }
  return out;
}
/** Separa o texto em artigos: { '121': 'texto literal…', '121-A': '…' }. Não interpreta nem resume. */
function extrairArtigos(texto) {
  const out = {}; let atual = null;
  for (const linha of texto.split('\n')) {
    const m = INICIO_ARTIGO.exec(linha);
    if (m && /^Artigo\s+\d/.test(linha) && !/^Artigo\s+\d+\S*\s+(?:desta|da|do|e|ou)\b/.test(linha)) {
      atual = m[1] + (m[2] ? '-' + m[2] : '');
      if (out[atual] === undefined) out[atual] = linha; else atual = null;     // repetição (ex.: remissão): ignora
    } else if (atual) out[atual] += '\n' + linha;
  }
  return out;
}

function carregarIndice(raiz) { return JSON.parse(fs.readFileSync(path.join(raiz || RAIZ, 'data/fontes/indice.json'), 'utf8')); }
/** Lê a fonte, CONFERE o hash contra o índice e devolve { texto, artigos, meta }. Falha alto se o arquivo mudou. */
function lerFonte(id, raiz) {
  const base = raiz || RAIZ; const meta = carregarIndice(base)[id];
  if (!meta) throw new Error('fonte desconhecida: ' + id);
  const bytes = fs.readFileSync(path.join(base, meta.arquivo));
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha !== meta.sha256) throw new Error('hash da fonte ' + id + ' não confere (arquivo alterado)');
  if (meta.formato === 'pdf') {
    const tb = fs.readFileSync(path.join(base, meta.texto));
    if (crypto.createHash('sha256').update(tb).digest('hex') !== meta.sha256_texto) throw new Error('hash do texto extraído de ' + id + ' não confere (arquivo alterado)');
    const texto = tb.toString('utf8');
    return { texto, artigos: extrairArtigosArtPonto(texto, meta.inicio), meta };
  }
  const texto = htmlParaTexto(bytes.toString(meta.codificacao === 'latin1' ? 'latin1' : 'utf8'));
  return { texto, artigos: extrairArtigos(texto), meta };
}
/** 'vetado' | 'revogado' | 'vigente' (pelo texto do próprio artigo na fonte). */
function situacao(fonte, artigo) {
  const a = fonte.artigos[artigo]; if (a === undefined) return null;
  const corpo = a.replace(/^Art(?:igo)?\.?\s+\S+\s*[-–—.:]?\s*/, '').trim();
  if (/^\(?\s*vetad[oa]\s*(?:[.\d()]|pel[oa]s?\b|$)/i.test(corpo)) return 'vetado';
  if (/^\(?\s*revogad[oa]\s*(?:[.\d()]|pel[oa]s?\b|$)/i.test(corpo)) return 'revogado';
  return 'vigente';
}
/** A citação é literal? Procura `trecho` (normalizado) no artigo indicado. */
function conferirCitacao(fonte, artigo, trecho) {
  const art = fonte.artigos[artigo];
  if (art === undefined) return { ok: false, motivo: 'artigo ' + artigo + ' não existe na fonte ' + fonte.meta.nome };
  const sit = situacao(fonte, artigo);
  if (sit !== 'vigente') return { ok: false, motivo: 'artigo ' + artigo + ' está ' + sit + ': não pode embasar questão' };
  if (!trecho || normalizar(trecho).length < 12) return { ok: false, motivo: 'trecho curto demais para ser prova' };
  return normalizar(art).includes(normalizar(trecho)) ? { ok: true } : { ok: false, motivo: 'o trecho não aparece literalmente no artigo ' + artigo };
}
/** O trecho ocorre em algum ponto da fonte inteira? (usado para provar que uma versão ALTERADA não existe no texto oficial) */
const ocorreEmQualquerLugar = (fonte, trecho) => normalizar(fonte.texto).includes(normalizar(trecho));

module.exports = { extrairArtigosArtPonto, situacao, htmlParaTexto, extrairArtigos, normalizar, carregarIndice, lerFonte, conferirCitacao, ocorreEmQualquerLugar };
