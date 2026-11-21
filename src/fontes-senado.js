'use strict';
/*
 * Leitura das normas federais obtidas da API pública oficial do Senado (normas.leg.br, CC BY 4.0), em dois formatos:
 *  - 'senado-json': texto ESTRUTURADO, com todas as versões de cada dispositivo. O texto é RECONSTRUÍDO na data de referência
 *    (a do edital): para cada dispositivo vale a última versão até essa data.
 *  - 'senado-html': texto COMPILADO vigente publicado pela fonte (sem reconstrução por data).
 * Sai sempre { 'N' | 'N-A': 'Art. N. ...\n§ 1º ...' } no mesmo formato dos demais leitores, para o resto do sistema não distinguir a origem.
 * Dispositivo revogado, suprimido ou com decisão judicial NUNCA vira questão: o texto do artigo recebe uma marca que `situacao()` reconhece.
 */
const ROMANOS = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const romano = (n) => { let r = ''; for (const [v, s] of ROMANOS) while (n >= v) { r += s; n -= v; } return r; };
const letra = (n) => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : 'Z' + n);
// Anotações legislativas entre parênteses ("Redação dada pela Lei...", "Incluído pela...") não fazem parte do texto normativo e são retiradas.
// Regra ESTREITA e sensível a maiúsculas: parênteses do próprio texto da lei (ex.: "(art. 5º)") nunca são tocados. "(Revogado...)" e "(VETADO)" ficam.
const ANOT_A = /\s*\((?:Redação dada|Nova redação|Incluíd[oa]|Acrescid[oa]|Alterad[oa]|Renumerad[oa]|Vide\b|Vigência|Regulamento|Expressão|Produção de efeito|Convertid[oa]|Mensagem de veto|Declarad[oa]|Suspens[oa])[^()]*\)/g;
const ANOT_B = /\s*\([A-ZÀ-Ú“][^()]*?\b(?:acrescid|incluíd|renumerad|alterad|redação|dad[ao]|substituíd|transformad|suprimid|inserid)[^()]*?\bpel[oa]s?\s+(?:Lei|Decreto|Emenda|Medida|Resolução|Provimento|Ato)[^()]*\)/g;
const ANOT_C = /\s*\((?:“?Caput”?|Parágrafo único|Parágrafo|Inciso|Alínea|Item|Artigo|Dispositivo)\s+d[oae]s?\s+(?:artigo|parágrafo|inciso|alínea|item|dispositivo|caput)\b[^()]*\)/g;      // "(“Caput” do artigo retificado no DOU...)"
const DUVIDA_JUDICIAL = /\b(?:ADI|ADPF|ADC|ADO)\b|inconstitucional|Suspens[oa]|Declarad[oa]|\bSTF\b|Supremo Tribunal/;
const entidade = (s) => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
/** { texto, duvida }: tira marcação XML/HTML e anotações; `duvida` indica anotação de decisão judicial/suspensão (o dispositivo não deve ser usado). */
function limparAnotacoes(bruto) {
  let t = entidade(String(bruto).replace(/<[^>]*>/g, ''));
  let duvida = false;
  // anotação que fala de REVOGAÇÃO ou VETO carrega a situação do dispositivo: nunca é apagada
  const tira = (re) => { t = t.replace(re, (m) => { if (/revogad|vetad/i.test(m)) return m; if (DUVIDA_JUDICIAL.test(m)) duvida = true; return ''; }); };
  tira(ANOT_A); tira(ANOT_B); tira(ANOT_C);
  return { texto: t.replace(/\s+/g, ' ').trim(), duvida };
}
const MARCA_REVOGADO = '(Revogado)';
const MARCA_INCERTO = '(Texto com supressão ou decisão judicial: não usado)';      // só quando NENHUM dispositivo do artigo é usável
const INUTILIZAVEIS = new Set(['Suppression_Version', 'Applicability_Suppression_Version', 'Vetoed_Text_Change_Version', 'Court_Decision_Version']);

function versoes(no) {
  const we = no.workExample; const lista = Array.isArray(we) ? we : we ? [we] : []; const out = [];
  for (const v of lista) {
    const l = typeof v.text === 'string' ? limparAnotacoes(v.text) : null;
    out.push({ data: v.legislationDate || '0000-00-00', tipo: typeof v.legislationType === 'string' ? v.legislationType : '', texto: l ? l.texto : null, duvida: !!(l && l.duvida) });
  }
  return out;
}

/** Reconstrói os artigos na data `ref` ('AAAA-MM-DD'). */
function artigosSenadoJson(raiz, ref) {
  const elementos = new Map(); let ordem = 0;
  (function varre(x) {
    if (Array.isArray(x)) { for (const v of x) varre(v); return; }
    if (!x || typeof x !== 'object') return;
    const id = x.legislationIdentifier;
    if (typeof id === 'string' && id.indexOf('!') >= 0 && id.indexOf('@') < 0) {
      const chave = id.split('!')[1].split(',')[0];
      if (/^art\d/.test(chave) && x.workExample) {
        const e = elementos.get(chave) || { chave, ordem: ordem++, versoes: [] };
        for (const v of versoes(x)) if (!e.versoes.some((w) => w.data === v.data && w.tipo === v.tipo && w.texto === v.texto)) e.versoes.push(v);
        elementos.set(chave, e);
      }
    }
    for (const v of Object.values(x)) if (v && typeof v === 'object') varre(v);
  })(raiz);

  const porArtigo = new Map();
  for (const e of elementos.values()) { const m = /^(art\d+(?:-\d+)?)(?:_(.*))?$/.exec(e.chave); if (!m) continue; (porArtigo.get(m[1]) || porArtigo.set(m[1], []).get(m[1])).push(Object.assign({ resto: m[2] || '' }, e)); }

  const estadoNaData = (e) => {
    const vs = e.versoes.filter((v) => v.data <= ref).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)); if (!vs.length) return { tipo: 'ausente' };
    const u = vs[vs.length - 1];
    if (u.tipo === 'Repeal_Version') return { tipo: 'revogado' };
    if (INUTILIZAVEIS.has(u.tipo)) return { tipo: 'incerto' };
    if (u.texto === null || !u.texto.trim()) return { tipo: u.tipo === 'Original_Version' || u.tipo === 'Text_Change_Version' || u.tipo === 'Insertion_Version' ? 'vazio' : 'incerto' };
    if (u.duvida) return { tipo: 'incerto' };
    return { tipo: 'texto', texto: u.texto };
  };
  const rotuloLinha = (resto) => {            // cpt | parN | parNu | incN | aliN | par1_inc2 ... : usa o ÚLTIMO componente
    const partes = resto.split('_'); const u = partes[partes.length - 1]; let m;
    if (u === 'cpt') return ''; if ((m = /^parNu$/.exec(u.replace(/\d+/, 'N')))) return 'Parágrafo único.'; if ((m = /^par(\d+)$/.exec(u))) { const n = Number(m[1]); return n < 10 ? '§ ' + n + 'º' : '§ ' + n + '.'; }
    if ((m = /^inc(\d+)$/.exec(u))) return romano(Number(m[1])) + ' -'; if ((m = /^ali(\d+)$/.exec(u))) return letra(Number(m[1])).toLowerCase() + ')'; return '-';
  };
  const out = {}; const omitidos = {};
  for (const [artKey, els] of porArtigo) {
    const m = /^art(\d+)(?:-(\d+))?$/.exec(artKey); const chaveArt = m[1] + (m[2] ? '-' + letra(Number(m[2])) : ''); const nArt = Number(m[1]); const rotulo = 'Art. ' + nArt + (m[2] ? '-' + letra(Number(m[2])) + '.' : (nArt < 10 ? 'º' : '.'));
    els.sort((a, b) => a.ordem - b.ordem);
    const raizEl = els.find((e) => e.resto === ''); const estRaiz = raizEl ? estadoNaData(raizEl) : { tipo: 'ausente' };
    const estados = els.map((e) => ({ e, s: estadoNaData(e) }));
    if (estados.every((x) => x.s.tipo === 'ausente')) continue;                           // ainda não existia na data
    const relevantes = estados.filter((x) => x.s.tipo !== 'ausente' && x.s.tipo !== 'vazio');                   // o nó-artigo costuma não ter texto próprio
    if (estRaiz.tipo === 'revogado' || (relevantes.length > 0 && relevantes.every((x) => x.s.tipo === 'revogado'))) { out[chaveArt] = rotulo + ' ' + MARCA_REVOGADO; continue; }
    const duvidosos = estados.filter((x) => x.s.tipo === 'incerto').length;      // só o dispositivo duvidoso é omitido; o restante do artigo continua usável
    if (duvidosos) omitidos[chaveArt] = duvidosos;
    if (estados.filter((x) => x.s.tipo === 'texto').length === 0) { if (relevantes.some((x) => x.s.tipo === 'incerto')) out[chaveArt] = rotulo + ' ' + MARCA_INCERTO; continue; }
    const linhas = []; let primeira = true;
    for (const { e, s } of estados) {
      if (s.tipo !== 'texto') continue;
      const r = rotuloLinha(e.resto);
      if (primeira && (e.resto === '' || e.resto === 'cpt' || e.resto.indexOf('_') < 0 && r === '')) { linhas.push(rotulo + ' ' + s.texto); primeira = false; continue; }
      if (primeira) { linhas.push(rotulo); primeira = false; }
      linhas.push((r ? r + ' ' : '') + s.texto);
    }
    if (!linhas.length) continue;
    out[chaveArt] = linhas.join('\n');
  }
  return { artigos: out, omitidos };
}

// ---------- texto compilado (HTML) ----------
const MARCADOR_LINHA = /^(?:Art\.\s*\d|§\s*\d|Parágrafo único|[IVXLC]+\s*[-–—]\s|[a-z]\)\s|\d+\s*[-–.)]\s)/;
/** A Câmara/Senado publicam "Art. 1 º"/"§ 2 º" com espaço antes do ordinal. */
const ajustaOrdinais = (s) => s.replace(/(\d)\s+([º°ª])/g, '$1$2').replace(/(Art\.|§)\s*(\d)/g, '$1 $2');

function artigosSenadoHtml(texto) {
  const omitidos = {};
  const linhas = texto.split('\n').map((l) => ({ ...limparAnotacoes(l), orig: l })).map((x) => ({ texto: ajustaOrdinais(x.texto), duvida: x.duvida })).filter((x) => x.texto);
  // descarta rubricas e títulos: linha que não começa com marcador e não termina em pontuação, curta
  const uteis = linhas.filter((x) => MARCADOR_LINHA.test(x.texto) || /[.;:!?)”"]$/.test(x.texto) || x.texto.length >= 110);
  const out = {}; let atual = null;
  for (const x of uteis) {
    const l = x.texto;
    const m = /^Art\.\s*(\d+(?:\.\d{3})*)\s*[º°]?(?:-([A-Z]{1,2})\b)?(?=[\s.:\-–—]|$)/.exec(l);
    if (m && !/^Art\.\s*\d[\d.]*\S*\s+(?:da|do|das|dos|desta|deste|e|ou|a|ao|c\/c)\b/.test(l)) {
      const chave = m[1].replace(/\./g, '') + (m[2] ? '-' + m[2] : '');
      if (out[chave] === undefined) { atual = chave; if (x.duvida) { omitidos[chave] = (omitidos[chave] || 0) + 1; out[atual] = l.match(/^Art\.\s*[^\s]+/)[0] + ' ' + MARCA_INCERTO; } else out[atual] = l; } else atual = null;
    } else if (atual) {
      if (x.duvida) { omitidos[atual] = (omitidos[atual] || 0) + 1; continue; }                 // omite só a linha duvidosa
      if (out[atual].indexOf(MARCA_INCERTO) >= 0) out[atual] = out[atual].replace(MARCA_INCERTO, '').trim() + (out[atual].replace(MARCA_INCERTO, '').trim().endsWith('.') || /Art\.\s*[^\s]+$/.test(out[atual].replace(MARCA_INCERTO, '').trim()) ? '' : '') + '\n' + l;
      else out[atual] += '\n' + l;
    }
  }
  return { artigos: out, omitidos };
}
/** "dd/mm/aaaa" -> "aaaa-mm-dd" (null se não for data). */
const dataIso = (s) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function somaMeses(iso, n) {
  const [a, m, d] = iso.split('-').map(Number); const t = (a * 12 + (m - 1)) + n; const aa = Math.floor(t / 12); const mm = (t % 12) + 1;
  const ult = new Date(Date.UTC(aa, mm, 0)).getUTCDate();                       // dia 31 + 1 mês cai no último dia do mês seguinte
  return aa + '-' + String(mm).padStart(2, '0') + '-' + String(Math.min(d, ult)).padStart(2, '0');
}

/** "Lei nº 15.040 de 09/12/2024" -> URN do LexML; null para o que não é ato normativo numerado (ex.: acórdão do STF). */
function urnDaNorma(nome) {
  const m = /^(Lei Complementar|Lei Delegada|Lei|Medida Provisória|Decreto-Lei|Decreto Legislativo|Decreto|Emenda Constitucional|Resolução)\s+n[ºo°.]*\s*([\d.]+)\s+de\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(String(nome || '').trim());
  if (!m) return null;
  const tipo = { 'lei complementar': 'lei.complementar', 'lei delegada': 'lei.delegada', lei: 'lei', 'medida provisória': 'medida.provisoria', 'decreto-lei': 'decreto.lei', 'decreto legislativo': 'decreto.legislativo', decreto: 'decreto', 'emenda constitucional': 'emenda.constitucional', 'resolução': 'resolucao' }[m[1].toLowerCase()];
  return 'urn:lex:br:federal:' + tipo + ':' + m[5] + '-' + m[4] + '-' + m[3] + ';' + m[2].replace(/\./g, '');
}

const NUM_PAL = { um: 1, uma: 1, dois: 2, duas: 2, 'três': 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, noventa: 90, cento: 100, 'cento e vinte': 120, 'cento e oitenta': 180, 'trezentos e sessenta e cinco': 365 };
const MESES = { janeiro: 1, fevereiro: 2, 'março': 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const ate = (s) => String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
/** "1 (um) ano" / "90 (noventa) dias" / "dois meses" -> data de início, ou null se o número não for entendido. */
function aposPrazo(n1, n2, unidade, publicacao) {
  let n = /^\d+$/.test(String(n1).trim()) ? Number(String(n1).trim()) : NUM_PAL[String(n1).trim().toLowerCase()];
  if (n === undefined && n2 && NUM_PAL[String(n2).trim().toLowerCase()] !== undefined) n = NUM_PAL[String(n2).trim().toLowerCase()];
  if (n === undefined || !publicacao) return null;
  const u = unidade.toLowerCase();
  return u.startsWith('dia') ? somaDias(publicacao, n) : u === 'mês' || u === 'meses' ? somaMeses(publicacao, n) : somaMeses(publicacao, 12 * n);
}
/** Uma cláusula (ou item de lista) de início de vigência -> data mínima de início (null = não entendida). */
function inicioDeItem(txt, publicacao) {
  const t = ate(txt).replace(/[;.]\s*(?:e\s*)?$/, '').replace(/\s+\./g, '.').trim();
  if (/^na data de (?:sua|da sua) publicação(?:\s*,?\s*quanto (?:aos|às|ao|a) demais [\p{L}\s]+)?$/iu.test(t)) return publicacao;
  let m = /^(?:em\s+)?([^()]*?)\s*(?:\(([^)]*)\)\s*)?(dias?|meses|mês|anos?),? (?:contados? )?(?:da data de sua publicação|após a data de sua publicação|da sua publicação)\b/i.exec(t);
  if (m) return aposPrazo(m[1], m[2], m[3], publicacao);
  m = /^(?:após|depois de) decorrid[oa]s? (?:o prazo de )?([^()]*?)\s*(?:\(([^)]*)\)\s*)?(dias?|meses|mês|anos?)(?: corridos)? (?:de sua|da sua|da) publicação(?: oficial)?$/i.exec(t);
  if (m) return aposPrazo(m[1], m[2], m[3], publicacao);
  if (/^no primeiro dia útil do primeiro mês subsequente ao da data de sua publicação\b/i.test(t) && publicacao) return somaDias(somaMeses(publicacao.slice(0, 8) + '01', 1), 0);      // 1º do mês seguinte (o dia útil pode ser até 4 dias depois: ver inicio_max)
  m = /^em (\d{1,2})º? de ([a-zç]+) de (\d{4})\b/i.exec(t);
  if (m && MESES[m[2].toLowerCase()]) return m[3] + '-' + String(MESES[m[2].toLowerCase()]).padStart(2, '0') + '-' + String(Number(m[1])).padStart(2, '0');
  return null;
}
/**
 * Classifica a(s) cláusula(s) de vigência de uma lei a partir dos textos que falam de si mesma, na ordem do documento
 * ("Esta Lei entra em vigor ..."), inclusive em lista ("Esta Lei entra em vigor: I - ...; II - ...").
 * { classe: 'imediata' | 'diferida' | 'desconhecida', inicio_min, inicio_max, clausula, itens? }:
 *   imediata: tudo vale na publicação; diferida: algum item começa depois (inicio_max = o mais tardio) e TODOS os itens foram entendidos;
 *   desconhecida: não há cláusula ou algum item não foi entendido. 'desconhecida' NUNCA é tratada como em vigor: quem usa trata como duvidosa.
 */
function classificarVigencia(textos, publicacao) {
  const T = (textos || []).map(ate);
  const i = T.findIndex((t) => /^(?:Esta|Este)\b/.test(t) && /\bvigor\b/i.test(t) && t.length < 900);
  if (i < 0) return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula: null };
  const cab = T[i]; let itens = [];
  if (/[:]$/.test(cab) || /produzirá efeitos:$/i.test(cab)) {
    for (let k = i + 1; k < T.length && !/^Brasília\b/.test(T[k]); k++) itens.push(T[k]);
    if (!itens.length) return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula: cab };
    const inicios = itens.map((x) => inicioDeItem(x, publicacao));
    const clausula = cab + ' ' + itens.join(' | ');
    if (inicios.some((x) => x === null)) return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula };
    // "Esta Lei entra em vigor na data de sua publicação e produzirá efeitos:" -> vigência imediata, efeitos nas datas dos itens (tratado do mesmo modo: o mais tardio manda)
    const folga = (x, k) => (/^no primeiro dia útil do primeiro mês subsequente/i.test(ate(itens[k]).replace(/[;.]\s*(?:e\s*)?$/, '')) ? somaDias(x, 4) : x);
    const fim = inicios.map(folga); const min = inicios.slice().sort()[0]; const max = fim.slice().sort().pop();
    return { classe: max > publicacao ? 'diferida' : 'imediata', inicio_min: min, inicio_max: max, clausula, itens: itens.length };
  }
  if (/^(?:Esta|Este) [^,;:]*? entra(?:m)? em vigor na data de (?:sua|da sua|sua respectiva) publicação\s*\.?$/i.test(cab)) return { classe: 'imediata', inicio_min: publicacao, inicio_max: publicacao, clausula: cab };
  // "na data de sua publicação, salvo quanto ao art. 29, que entra em vigor após decorridos 180 dias": o prazo mais longo manda
  const sv = /^(?:Esta|Este) [^,;:]*? entra(?:m)? em vigor na data de (?:sua|da sua) publicação,?\s*(?:salvo|exceto)\b(.*)$/i.exec(cab);
  if (sv) {
    const prazos = []; const re = /(?:após decorrid[oa]s?|depois de decorrid[oa]s?|em|no prazo de)\s+(?:o prazo de\s+)?([^()]*?)\s*(?:\(([^)]*)\)\s*)?(dias?|meses|mês|anos?)\b/gi; let q;
    while ((q = re.exec(ate(sv[1]).replace(/art\.? \d+[^,;]*/gi, '')))) { const d = aposPrazo(q[1], q[2], q[3], publicacao); if (d) prazos.push(d); }
    if (prazos.length) { const mx = prazos.slice().sort().pop(); return { classe: 'diferida', inicio_min: publicacao, inicio_max: somaDias(mx, 1), clausula: cab }; }
    return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula: cab };
  }
  const m = /^(?:Esta|Este) [^,;:]*? entra(?:m)? em vigor (.+)$/i.exec(cab);
  const ini = m ? inicioDeItem(m[1], publicacao) : null;
  if (ini) return { classe: ini > publicacao ? 'diferida' : 'imediata', inicio_min: ini, inicio_max: somaDias(ini, ini > publicacao ? 1 : 0), clausula: cab };      // LC 95/98 art. 8º §1: vigora no dia seguinte à consumação do prazo; guarda as duas bordas
  return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula: cab };
}
/** Textos (nós "text") do JSON estruturado da norma, em ordem. */
function textosDaNorma(norma) {
  const out = []; const andar = (o) => { if (Array.isArray(o)) o.forEach(andar); else if (o && typeof o === 'object') { if (typeof o.text === 'string') out.push(o.text); Object.values(o).forEach(andar); } };
  andar(norma && norma.hasPart); return out;
}

/** Relações que o Senado registra e que NÃO mudam o texto do dispositivo (regulamentação por decreto, dispositivo correlato): não tornam o artigo duvidoso. */
const NAO_ALTERA = /^(?:Regulamentado|Dispositivo Correlato)$/i;
const CHAVE_ART = /^Art\.?\s*(\d+(?:\.\d{3})*)(?:\s*-\s*([A-Z]{1,2})\b)?/;
const chaveDe = (dispositivo) => { const m = CHAVE_ART.exec(dispositivo); return m ? m[1].replace(/\./g, '') + (m[2] ? '-' + m[2] : '') : null; };
/**
 * Normas alteradoras que o Senado registra (campo "vides" do detalhe da norma) e que podem NÃO estar no texto guardado:
 *  (a) publicadas depois da data do texto e até a data-limite do edital: sempre listadas;
 *  (b) publicadas antes ou na data do texto, mas cuja cláusula de vigência (em `vigencia[nomeDaNorma]`, já classificada) mostra que a
 *      alteração só passou a valer depois da data do texto (e até o limite) ou que a cláusula não pôde ser entendida: listadas
 *      (só examina dispositivos para os quais `citado(chave)` é verdadeiro, pois só eles viram questão).
 * Não interpreta o que mudou: só lista a norma, a data, o motivo e os dispositivos que ela cita.
 * Devolve { normas: [{ norma, assinatura, publicacao, comentario, motivo, vigencia?, itens }], artigos: [chaves], nao_artigo: [dispositivos] }.
 */
function alteracoesPosteriores(detalhe, dataTexto, limite, vigencia, citado) {
  const doc = detalhe && detalhe.DetalheDocumento && detalhe.DetalheDocumento.documentos && detalhe.DetalheDocumento.documentos.documento;
  const d = Array.isArray(doc) ? doc[0] : doc;
  if (!d) throw new Error('detalhe da norma sem documento');
  vigencia = vigencia || {}; citado = citado || (() => true);
  let vides = (d.vides && d.vides.vide) || []; if (!Array.isArray(vides)) vides = [vides];
  const normas = []; const artigos = new Set(); const naoArtigo = new Set();
  for (const v of vides) {
    const assinatura = dataIso(v.datAssinatura); const publicacao = dataIso(v.datapub) || assinatura;
    if (!publicacao) throw new Error('alteração sem data: ' + v.nomeNormaPosterior);
    if (publicacao > limite) continue;
    let itens = (v.itens && v.itens.item) || []; if (!Array.isArray(itens)) itens = [itens];
    const lista = itens.map((i) => ({ dispositivo: String(i.dispositivo || '').trim(), comentario: i.comentario || null }));
    const altera = lista.filter((i) => !NAO_ALTERA.test(i.comentario || ''));
    if (lista.length && !altera.length) continue;                        // só regulamentação/correlato: o texto da lei não muda
    let motivo = null; let infoV = null;
    if (publicacao > dataTexto) motivo = 'publicada depois da data do texto guardado';
    else {
      const info = vigencia[v.nomeNormaPosterior];
      if (info && altera.some((i) => { const k = chaveDe(i.dispositivo); return k && citado(k); })) {
        infoV = info;
        if (info.classe === 'diferida') { if (info.inicio_max > dataTexto && info.inicio_min <= limite) motivo = 'vigência diferida: passou a valer depois da data do texto guardado'; }
        else if (info.classe !== 'imediata') motivo = 'cláusula de vigência não reconhecida (' + info.classe + '): tratada como duvidosa';
      }
    }
    if (!motivo) continue;
    const afetados = publicacao > dataTexto ? altera : altera.filter((i) => { const k = chaveDe(i.dispositivo); return k && citado(k); });
    for (const i of afetados) { const k = chaveDe(i.dispositivo); if (k) artigos.add(k); else if (i.dispositivo) naoArtigo.add(i.dispositivo); }
    normas.push(Object.assign({ norma: v.nomeNormaPosterior, assinatura, publicacao, comentario: v.comentario || null, motivo }, infoV ? { vigencia: { classe: infoV.classe, inicio_min: infoV.inicio_min, inicio_max: infoV.inicio_max, clausula: infoV.clausula } } : {}, { itens: lista }));
  }
  normas.sort((x, y) => (x.publicacao < y.publicacao ? -1 : x.publicacao > y.publicacao ? 1 : x.norma < y.norma ? -1 : x.norma > y.norma ? 1 : 0));
  const chaves = [...artigos].sort((x, y) => { const px = x.split('-'); const py = y.split('-'); return Number(px[0]) - Number(py[0]) || (px[1] || '').localeCompare(py[1] || ''); });
  return { normas, artigos: chaves, nao_artigo: [...naoArtigo].sort() };
}

/**
 * Aplica revisões feitas por leitura do texto da norma alteradora: o artigo sai de `r.artigos` SÓ se TODA norma que o atinge tem revisão
 * para ele (mesmo nome de norma e mesmo artigo). Qualquer outra norma que o atinja mantém o artigo como duvidoso. Devolve o que foi liberado.
 */
function aplicarRevisoes(r, revisoes) {
  const liberados = [];
  for (const k of r.artigos.slice()) {
    const atingem = r.normas.filter((n) => n.itens.some((i) => chaveDe(i.dispositivo) === k && !NAO_ALTERA.test(i.comentario || '')));
    if (!atingem.length) continue;
    const todas = atingem.every((n) => revisoes.some((rv) => rv.norma === n.norma && rv.artigos.includes(k)));
    if (todas) { r.artigos.splice(r.artigos.indexOf(k), 1); liberados.push({ artigo: k, normas: atingem.map((n) => n.norma) }); }
  }
  return liberados;
}

module.exports = { alteracoesPosteriores, aplicarRevisoes, classificarVigencia, textosDaNorma, urnDaNorma, chaveDe, somaDias, somaMeses, dataIso, artigosSenadoJson, artigosSenadoHtml, limparAnotacoes, romano, letra, MARCA_REVOGADO, MARCA_INCERTO };
