'use strict';
/*
 * Questões de DIREITO a partir do TEXTO OFICIAL (nível de confiança A). Nenhum conteúdo jurídico vem da memória de uma IA:
 *   - os artigos vêm de data/dir-dados.json, gerado pelos arquivos oficiais guardados com hash (tools/build-dir-dados.js);
 *   - a alternativa correta é um trecho LITERAL de um artigo que o edital cita e que está vigente (não vetado, não revogado);
 *   - cada alternativa errada é o mesmo trecho com uma alteração mecânica e rastreável (número, termo oposto, negação)
 *     e é recusada se o resultado existir em qualquer artigo citado do diploma.
 * Formatos: lacuna numérica (nível 1) e "qual alternativa reproduz corretamente o dispositivo" (níveis 2 a 5).
 * Isto treina a LEITURA PRECISA da lei (prazos, números, condições). Não substitui compreensão nem jurisprudência.
 */
const Q = (typeof require === 'function') ? require('./questoes.js') : globalThis.Questoes;
const DADOS = (typeof require === 'function') ? require('../data/dir-dados.json') : globalThis.FontesDados;

const E = (valor, texto, porque) => ({ valor, texto, porque });
const limpar = (s) => String(s).replace(/([.;:!?])\d{1,2}(?=\s|$)/g, '$1').replace(/[ \t]+\n/g, '\n');
const norm = (s) => limpar(s).normalize('NFC').replace(/\s+/g, ' ').trim();

// ---------- números por extenso ----------
const U = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function extenso(n, fem) {
  const f = (w) => (fem ? ({ um: 'uma', dois: 'duas', duzentos: 'duzentas', trezentos: 'trezentas', quatrocentos: 'quatrocentas', quinhentos: 'quinhentas', seiscentos: 'seiscentas', setecentos: 'setecentas', oitocentos: 'oitocentas', novecentos: 'novecentas' }[w] || w) : w);
  if (n === 100) return 'cem';
  if (n < 20) return f(U[n]);
  if (n < 100) return D[Math.floor(n / 10)] + (n % 10 ? ' e ' + f(U[n % 10]) : '');
  if (n < 1000) return f(C[Math.floor(n / 100)]) + (n % 100 ? ' e ' + extenso(n % 100, fem) : '');
  throw new Error('fora do intervalo');
}
const VALORES = [1, 2, 3, 5, 6, 8, 10, 12, 15, 20, 24, 30, 45, 48, 60, 90, 120, 180];
const UNIDADES = 'dias?|horas?|meses|m[êe]s|anos?|vezes|semanas?|%|por cento|reais|UFESPs?|sal[aá]rios?|funcion[aá]rios?|cargos?|vagas?|processos?|parcelas?|pessoas?';
const FEM = /^(?:\s*(?:úteis\s+)?)(horas?|vezes|semanas?|vagas?|parcelas?)/i;
const RE_PCT = /(^|[^\d.,])(\d{1,3})(\s*%)(\s*\(([^)]{2,50})\))?/g;
const RE_NUM = new RegExp('(^|[^\\d.,])(\\d{1,3}(?:\\.\\d{3})*)(\\s*\\(([^)]{2,40})\\))?(?=\\s*(?:úteis\\s+|corridos\\s+)?(?:' + UNIDADES + ')(?![\\p{L}]))', 'giu');
const PALAVRAS_NUM = ['um', 'uma', 'dois', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'quinze', 'vinte', 'trinta', 'quarenta', 'sessenta', 'noventa'];
const RE_NUM_PAL = new RegExp('(^|[^\\p{L}])(' + PALAVRAS_NUM.join('|') + ')(?=\\s+(?:úteis\\s+)?(?:' + UNIDADES + ')(?![\\p{L}]))', 'giu');
const VAL_DE_PALAVRA = (w) => { const l = w.toLowerCase(); const i = [['um', 1], ['uma', 1], ['dois', 2], ['duas', 2], ['três', 3], ['quatro', 4], ['cinco', 5], ['seis', 6], ['sete', 7], ['oito', 8], ['nove', 9], ['dez', 10], ['quinze', 15], ['vinte', 20], ['trinta', 30], ['quarenta', 40], ['sessenta', 60], ['noventa', 90]].find((p) => p[0] === l); return i ? i[1] : null; };
const UNIDADES_MASC = ['dias', 'meses', 'anos'];
const ADVERBIOS = ['imediatamente', 'obrigatoriamente', 'expressamente', 'necessariamente', 'exclusivamente', 'somente', 'apenas'];

// ---------- termos opostos e negação (lista fechada, gramática segura) ----------
const PARES = [['poderá', 'deverá'], ['deverá', 'poderá'], ['poderão', 'deverão'], ['deverão', 'poderão'], ['pode', 'deve'], ['podem', 'devem'], ['deve', 'pode'], ['devem', 'podem'],
  ['vedado', 'permitido'], ['vedada', 'permitida'], ['proibido', 'permitido'], ['proibida', 'permitida'], ['obrigatório', 'facultativo'], ['obrigatória', 'facultativa'], ['facultativo', 'obrigatório'], ['facultativa', 'obrigatória'],
  ['superior', 'inferior'], ['inferior', 'superior'], ['maior', 'menor'], ['menor', 'maior'], ['antes', 'depois'], ['depois', 'antes'], ['anterior', 'posterior'], ['posterior', 'anterior'], ['mais', 'menos'], ['menos', 'mais'], ['sempre', 'nunca'], ['nunca', 'sempre'], ['úteis', 'corridos'], ['corridos', 'úteis']];
const VERBOS_NEG = ['poderá', 'deverá', 'será', 'serão', 'poderão', 'deverão', 'cabe', 'cabem', 'pode', 'podem', 'deve', 'devem'];
const maius = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pontos alteráveis do texto: { ini, fim, original, tipo, opcoes:[substituições] }. Cada ponto tem texto coerente (dígito e extenso mudam juntos). */
function pontos(texto) {
  const out = []; const bloq = []; let m;
  const livre = (ini, fim) => !out.some((p) => ini < p.fim && fim > p.ini) && !bloq.some((p) => ini < p.fim && fim > p.ini);
  const REF = /(?:art|arts|artigo|artigos|§|n\.?º|lei|decreto|inciso|incisos)\.?\s*[\d.]*$/i;     // número que é referência, não quantidade
  RE_PCT.lastIndex = 0;
  while ((m = RE_PCT.exec(texto))) {
    const ini = m.index + m[1].length; const fim = m.index + m[0].length; const v = parseInt(m[2], 10);
    if (!(v >= 1 && v <= 100) || (m[4] && m[5].trim().toLowerCase() !== extenso(v, false) + ' por cento')) { bloq.push({ ini, fim }); continue; }   // incoerente: ninguém mexe
    const opcoes = VALORES.filter((x) => x !== v && x <= 100).map((x) => x + '%' + (m[4] ? ' (' + extenso(x, false) + ' por cento)' : ''));
    out.push({ ini, fim, original: texto.slice(ini, fim), tipo: 'numero', opcoes });
  }
  RE_NUM.lastIndex = 0;
  while ((m = RE_NUM.exec(texto))) {
    const ini = m.index + m[1].length; const fim = m.index + m[0].length;
    if (!livre(ini, fim)) continue;
    if (REF.test(texto.slice(0, ini + m[2].length))) { bloq.push({ ini, fim }); continue; }
    const valor = parseInt(m[2].replace(/\./g, ''), 10); if (!(valor >= 1 && valor <= 360)) { bloq.push({ ini, fim }); continue; }
    const fem = FEM.test(texto.slice(fim));
    if (m[3]) { let ext; try { ext = extenso(valor, fem); } catch (e) { bloq.push({ ini, fim }); continue; } if (m[4].trim().toLowerCase() !== ext) { bloq.push({ ini, fim }); continue; } }
    const opcoes = VALORES.filter((v) => v !== valor).map((v) => (m[3] ? v + ' (' + extenso(v, fem) + ')' : String(v)));
    out.push({ ini, fim, original: texto.slice(ini, fim), tipo: 'numero', opcoes });
  }
  RE_NUM_PAL.lastIndex = 0;
  while ((m = RE_NUM_PAL.exec(texto))) {
    const ini = m.index + m[1].length; const fim = ini + m[2].length;
    const v = VAL_DE_PALAVRA(m[2]); if (v === null || !livre(ini, fim)) continue;
    const fem = FEM.test(texto.slice(fim)); const cap = m[2].charAt(0) !== m[2].charAt(0).toLowerCase();
    const opcoes = VALORES.filter((x) => x !== v && x <= 99).map((x) => { const w = extenso(x, fem); return cap ? maius(w) : w; });
    out.push({ ini, fim, original: texto.slice(ini, fim), tipo: 'numero', opcoes });
  }
  // unidade de tempo logo depois de uma quantidade (só unidades masculinas: a concordância do número não muda)
  const reU = /(\d|\))\s*(?:(?:úteis|corridos)\s+)?(dias|meses|anos)(?![\p{L}])/giu;
  while ((m = reU.exec(texto))) {
    const ini = m.index + m[0].length - m[2].length;
    if (m[1] === ')' && !/\(\s*[^)]*\)\s*(?:úteis\s+|corridos\s+)?$/.test(texto.slice(0, ini))) continue;
    if (REF.test(texto.slice(0, m.index + 1)) || /\d{4,}$/.test(texto.slice(0, m.index + 1).replace(/[.,]/g, ''))) continue;      // "art. 12 dias", "2026 dias"
    if (bloq.some((b) => m.index >= b.ini && m.index < b.fim)) continue;                      // unidade de uma quantidade incoerente: não mexe
    if (!livre(ini, ini + m[2].length)) continue;
    out.push({ ini, fim: ini + m[2].length, original: m[2], tipo: 'unidade', opcoes: UNIDADES_MASC.filter((u) => u !== m[2].toLowerCase()) });
  }
  for (const [de, para] of PARES) {
    const re = new RegExp('(^|[^\\p{L}])(' + de + ')(?![\\p{L}])', 'giu'); re.lastIndex = 0;
    while ((m = re.exec(texto))) {
      const ini = m.index + m[1].length; const orig = m[2]; if (!livre(ini, ini + orig.length)) continue;
      out.push({ ini, fim: ini + orig.length, original: orig, tipo: 'termo', opcoes: [orig.charAt(0) !== orig.charAt(0).toLowerCase() ? maius(para) : para] });
    }
  }
  const reA = new RegExp('(^|[^\\p{L}])(' + ADVERBIOS.join('|') + ')(?![\\p{L}])', 'giu');
  while ((m = reA.exec(texto))) {
    const ini = m.index + m[1].length; const orig = m[2]; if (!livre(ini, ini + orig.length) || ini === 0) continue;
    out.push({ ini, fim: ini + orig.length, original: orig, tipo: 'omissao', opcoes: [''] });
  }
  const reV = new RegExp('(^|[^\\p{L}])(?:(não)\\s+)?(' + VERBOS_NEG.join('|') + ')(?![\\p{L}])', 'giu'); let achouNeg = false;
  while ((m = reV.exec(texto)) && !achouNeg) {
    const ini = m.index + m[1].length;
    if (m[2]) { const ori = texto.slice(ini, ini + m[2].length + 1 + m[3].length); if (livre(ini, ini + ori.length)) { out.push({ ini, fim: ini + ori.length, original: ori, tipo: 'negacao', opcoes: [m[3]] }); achouNeg = true; } }
    else if (livre(ini, ini + m[3].length)) { out.push({ ini, fim: ini + m[3].length, original: m[3], tipo: 'negacao', opcoes: ['não ' + m[3]] }); achouNeg = true; }
  }
  return out.sort((a, b) => a.ini - b.ini);
}
/** Aplica substituições (uma por ponto) de trás para a frente. */
function aplicar(texto, trocas) {
  let t = texto;
  for (const x of trocas.slice().sort((a, b) => b.p.ini - a.p.ini)) t = t.slice(0, x.p.ini) + x.op + t.slice(x.p.fim);
  return t.replace(/ {2,}/g, ' ').replace(/ ([,;.:])/g, '$1');
}

// ---------- segmentos de um artigo ----------
const MARCADOR = /^(?:Artigo|Art\.)\s*\S+|^Parágrafo único\b|^§\s*\d|^[IVXLC]+\s*[-–—]\s|^[a-z]\)\s|^\d+\s*[-–.)]\s/;
const RUIDO = /Prov(?:imento)?\.?\s*(?:CG|CGJ)|\bCG\s*\d+\/\d{4}|Redação dada|Nova redação|\(Acrescentad|\(Revogad|Revogad|\(VETADO\)|\bNR\)/i;
function segmentos(textoArtigo) {
  const segs = [];
  for (const linha of textoArtigo.split('\n')) {
    const l = linha.replace(/\s+/g, ' ').trim(); if (!l) continue;
    if (MARCADOR.test(l) || !segs.length) segs.push(l); else segs[segs.length - 1] += ' ' + l;
  }
  const out = [];
  for (const s0 of segs) {
    let corpo = s0.replace(/^(?:Artigo|Art\.)\s*\S+\s*[-–—.:]?\s*/, '').replace(/^(?:Parágrafo único|§\s*\d+\S*)\s*[-–—.:]?\s*/, '').replace(/^[IVXLC]+\s*[-–—]\s*/, '').replace(/^[a-z]\)\s*/, '').trim();
    if (corpo.length > 330) { const i = corpo.search(/[.;:](?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/); if (i >= 44 && i < 330) corpo = corpo.slice(0, i + 1); }
    corpo = limpar(corpo);
    if (corpo.length < 45 || corpo.length > 330 || RUIDO.test(corpo) || RUIDO.test(s0)) continue;
    out.push({ corpo, marcador: s0.slice(0, 18) });
  }
  return out;
}
function rotuloArtigo(k) { const [n, l] = String(k).split('-'); const v = parseInt(n, 10); return (v >= 1000 ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(v)) + (l ? '-' + l : ''); }
const dataBR = (iso) => iso.split('-').reverse().join('/');

// ---------- montagem ----------
const cacheCorpus = {}; const cacheCand = {};
const corpusDe = (fid) => (cacheCorpus[fid] = cacheCorpus[fid] || norm(Object.values(DADOS.fontes[fid].artigos).map((a) => a.texto).join('\n')));
function candidatos(fid, artigo) {
  const k = fid + '#' + artigo; if (cacheCand[k]) return cacheCand[k];
  const lista = []; for (const s of segmentos(DADOS.fontes[fid].artigos[artigo].texto)) { const ps = pontos(s.corpo); if (ps.length) lista.push({ corpo: s.corpo, pontos: ps }); }
  return (cacheCand[k] = lista);
}
function intercalar(rng, pts) {                 // uma substituição por ponto, em rodízio entre os pontos
  const filas = pts.map((p) => rng.embaralhar(p.opcoes).map((op) => ({ p, op })));
  const out = []; for (let i = 0; filas.some((f) => i < f.length); i++) for (const f of filas) if (i < f.length) out.push(f[i]);
  return out;
}
function descTroca(t) { return t.op === '' ? 'omissão de “' + t.p.original + '”' : '“' + t.p.original + '” por “' + t.op + '”'; }

function distratores(rng, c, nivel, corp, correto) {
  const vistos = new Set([norm(correto)]); const out = [];
  const tenta = (trocas) => { const texto = aplicar(c.corpo, trocas); const nt = norm(texto); if (vistos.has(nt) || corp.includes(nt)) return; vistos.add(nt); out.push({ texto, trocas }); };
  const simples = intercalar(rng, c.pontos).map((t) => [t]);
  const duplos = []; if (c.pontos.length >= 2) for (let i = 0; i < c.pontos.length; i++) for (let j = i + 1; j < c.pontos.length; j++) for (const a of rng.embaralhar(c.pontos[i].opcoes).slice(0, 2)) for (const b of rng.embaralhar(c.pontos[j].opcoes).slice(0, 2)) duplos.push([{ p: c.pontos[i], op: a }, { p: c.pontos[j], op: b }]);
  const ordem = nivel >= 4 ? rng.embaralhar(duplos).concat(simples) : simples.concat(rng.embaralhar(duplos));
  for (const g of ordem) { if (out.length >= 6) break; tenta(g); }
  return out;
}

function gerarNoTopico(fid, topicId, rng, nivel) {
  const meta = DADOS.fontes[fid]; const corp = corpusDe(fid);
  const lista = rng.embaralhar(DADOS.topicos[topicId].filter((x) => x.fonte === fid));
  const todos = []; for (const x of lista) for (const c of candidatos(fid, x.artigo)) todos.push({ artigo: x.artigo, c });
  if (!todos.length) throw new Error('tópico sem trecho alterável: ' + topicId);
  let pool = todos; if (nivel >= 3) { const longos = todos.filter((x) => x.c.corpo.length >= (nivel === 5 ? 150 : 100)); if (longos.length) pool = longos; }
  for (const x of rng.embaralhar(pool)) {
    const rot = 'art. ' + rotuloArtigo(x.artigo) + ' ' + meta.rotulo; const fonteTxt = meta.nome + ', art. ' + rotuloArtigo(x.artigo) + ' (texto oficial consultado em ' + dataBR(meta.consultado_em) + ')';
    const base = { topicId, confianca: 'A', origem: 'texto oficial', fonte: fonteTxt };
    const num = x.c.pontos.filter((p) => p.tipo === 'numero');
    if (nivel === 1 && num.length) {                          // lacuna numérica
      const p = rng.pick(num); const branco = x.c.corpo.slice(0, p.ini) + '_____' + x.c.corpo.slice(p.fim);
      const erros = []; const vistos = new Set([norm(x.c.corpo)]);
      for (const op of rng.embaralhar(p.opcoes)) { const t = aplicar(x.c.corpo, [{ p, op }]); const nt = norm(t); if (vistos.has(nt) || corp.includes(nt)) continue; vistos.add(nt); erros.push(E(op, op, 'preenchida com “' + op + '”, a frase deixa de ser a do texto oficial, que traz “' + p.original + '”')); if (erros.length >= 6) break; }
      if (erros.length < 4) continue;
      return Object.assign(base, {
        enunciado: 'Complete a lacuna em um dispositivo do ' + rot + ':\n“' + branco + '”',
        correta: { texto: p.original, valor: p.original }, erros,
        explicacao: 'Texto oficial (' + meta.nome + ', art. ' + rotuloArtigo(x.artigo) + '): “' + x.c.corpo + '”. A lacuna é “' + p.original + '”.',
        pegadinha: 'Prazos, percentuais e quantidades são os pontos mais fáceis de trocar e mais cobrados: leia o número e a unidade juntos.',
        params: { forma: 'lacuna', fonte: fid, artigo: x.artigo, topicId, corpo: x.c.corpo, branco, correto: p.original, distratores: erros.map((e) => ({ valor: e.valor, texto: aplicar(x.c.corpo, [{ p, op: e.texto }]) })) },
        comentarioCorreta: 'Completa a frase como no texto oficial.',
      });
    }
    const ds = distratores(rng, x.c, nivel, corp, x.c.corpo);
    if (ds.length < 4) continue;
    const escolhidos = ds.slice(0, 6);
    const erros = escolhidos.map((d) => E(d.texto, d.texto, 'o dispositivo foi alterado: ' + d.trocas.map(descTroca).join(' e ') + '; o texto oficial é diferente'));
    const tipos = escolhidos.slice(0, 4).flatMap((d) => d.trocas.map((t) => t.p.tipo));
    const peg = tipos.includes('numero') || tipos.includes('unidade') ? 'Prazos, percentuais e quantidades são os pontos mais fáceis de trocar e mais cobrados: leia o número e a unidade juntos.'
      : tipos.includes('negacao') ? 'Uma negação a mais ou a menos inverte o sentido do dispositivo: confira o "não".' : 'Palavras como "poderá/deverá", "vedado/permitido" e "maior/menor" mudam a regra inteira com uma troca só.';
    return Object.assign(base, {
      enunciado: 'Qual alternativa reproduz corretamente um dispositivo do ' + rot + '?',
      correta: { texto: x.c.corpo, valor: x.c.corpo }, erros,
      explicacao: 'Texto oficial (' + meta.nome + ', art. ' + rotuloArtigo(x.artigo) + '): “' + x.c.corpo + '”. As demais alternativas são o mesmo trecho com alterações: ' + escolhidos.slice(0, 4).map((d) => d.trocas.map(descTroca).join(' + ')).join('; ') + '.',
      pegadinha: peg,
      params: { forma: 'reproducao', fonte: fid, artigo: x.artigo, topicId, corpo: x.c.corpo, correto: x.c.corpo, distratores: escolhidos.map((d) => ({ valor: d.texto, texto: d.texto })) },
      comentarioCorreta: 'Reproduz o texto oficial.',
    });
  }
  throw new Error('nenhum trecho do tópico ' + topicId + ' gera 4 alternativas distintas (nível ' + nivel + ')');
}

// ---------- registro dos modelos (um por diploma) ----------
function registrar() {
  if (!DADOS || !DADOS.fontes) return;
  for (const fid of Object.keys(DADOS.fontes)) {
    const meta = DADOS.fontes[fid];
    const fixos = Object.keys(DADOS.topicos).filter((t) => DADOS.topicos[t].some((x) => x.fonte === fid)).sort();   // lista FIXA: o tópico de uma semente nunca muda
    const geraveis = fixos.filter((t) => !DADOS.topicosComQuestao || DADOS.topicosComQuestao.includes(t));
    if (!fixos.length) continue;
    const K = fixos.length;
    Q.CATALOGO.push({
      id: meta.id, topicId: geraveis[0] || fixos[0], topicIds: geraveis, topicosFixos: fixos, modulo: K, disciplina: meta.disciplina, titulo: meta.titulo,
      ajustarSemente(topicId, base) { const i = fixos.indexOf(topicId); if (i < 0) throw new Error('tópico fora do modelo: ' + topicId); return base - (base % K) + i; },
      gerar(rng, nivel, semente) { const t = semente === undefined ? rng.pick(fixos) : fixos[semente % K]; return gerarNoTopico(fid, t, rng, nivel); },
      resolver(p) {
        // Segundo método: relê os dados e confere o trecho correto no artigo, e a AUSÊNCIA de cada alternativa errada em todo o diploma.
        const art = DADOS.fontes[p.fonte].artigos[p.artigo]; if (!art) throw new Error('artigo inexistente nos dados: ' + p.artigo);
        if (art.topicId !== p.topicId) throw new Error('o artigo não pertence ao tópico');
        if (!norm(art.texto).includes(norm(p.corpo))) throw new Error('o trecho não está literalmente no artigo');
        const corp = corpusDe(p.fonte);
        if (p.forma === 'reproducao') { if (norm(p.correto) !== norm(p.corpo)) throw new Error('a correta não é o trecho do artigo'); } else if (!norm(p.corpo).includes(norm(p.correto))) throw new Error('a lacuna não é parte do trecho');
        for (const d of p.distratores) { if (corp.includes(norm(d.texto))) throw new Error('uma alternativa errada existe no texto oficial (ambíguo)'); if (norm(d.texto) === norm(p.corpo)) throw new Error('alternativa errada igual ao texto oficial'); }
        return p.forma === 'reproducao' ? p.corpo : p.correto;
      },
    });
  }
}
registrar();

/** Quais tópicos geram questão de verdade (usado na 2ª passada do construtor). */
function descobrirTopicosComQuestao(dados) {
  const out = [];
  for (const t of Q.CATALOGO.filter((x) => x.topicosFixos)) for (const topico of t.topicosFixos) {
    let ok = false;
    for (let nivel = 1; nivel <= 5 && !ok; nivel++) for (let s = 1; s <= 25 && !ok; s++) { try { const q = Q.gerarQuestao(t.id, t.ajustarSemente(topico, 1000 + s * t.modulo), nivel); if (q.topicId === topico && Q.validarQuestao(q).ok) ok = true; } catch (e) { /* tenta a próxima */ } }
    if (ok) out.push(topico);
  }
  void dados; return out.sort();
}
const _testes = { limparCaches() { for (const k of Object.keys(cacheCorpus)) delete cacheCorpus[k]; for (const k of Object.keys(cacheCand)) delete cacheCand[k]; } };
const API = { _testes, extenso, pontos, aplicar, segmentos, rotuloArtigo, descobrirTopicosComQuestao, norm, limpar };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof globalThis !== 'undefined') globalThis.QuestoesDir = API;
