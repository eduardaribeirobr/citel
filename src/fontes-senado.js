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
const ajustaOrdinais = (s) => s.replace(/(\d)\s+([º°ª])/g, '$1$2').replace(/(Art\.|§)\s+(\d)/g, '$1 $2');

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
/**
 * Normas alteradoras que o Senado registra (campo "vides" do detalhe da norma) com publicação DEPOIS da data do texto guardado
 * e até a data-limite do edital. Não interpreta o que mudou: só lista a norma, a data e os dispositivos que ela cita.
 * Devolve { normas: [{ norma, assinatura, publicacao, comentario, itens: [{ dispositivo, comentario }] }], artigos: [chaves], nao_artigo: [dispositivos] }.
 */
function alteracoesPosteriores(detalhe, dataTexto, limite) {
  const doc = detalhe && detalhe.DetalheDocumento && detalhe.DetalheDocumento.documentos && detalhe.DetalheDocumento.documentos.documento;
  const d = Array.isArray(doc) ? doc[0] : doc;
  if (!d) throw new Error('detalhe da norma sem documento');
  let vides = (d.vides && d.vides.vide) || []; if (!Array.isArray(vides)) vides = [vides];
  const normas = []; const artigos = new Set(); const naoArtigo = new Set();
  for (const v of vides) {
    const assinatura = dataIso(v.datAssinatura); const publicacao = dataIso(v.datapub) || assinatura;
    if (!publicacao) throw new Error('alteração sem data: ' + v.nomeNormaPosterior);
    if (publicacao <= dataTexto || publicacao > limite) continue;
    let itens = (v.itens && v.itens.item) || []; if (!Array.isArray(itens)) itens = [itens];
    const lista = itens.map((i) => ({ dispositivo: String(i.dispositivo || '').trim(), comentario: i.comentario || null }));
    for (const i of lista) {
      const m = /^Art\.?\s*(\d+(?:\.\d{3})*)(?:\s*-\s*([A-Z]{1,2})\b)?/.exec(i.dispositivo);
      if (m) artigos.add(m[1].replace(/\./g, '') + (m[2] ? '-' + m[2] : '')); else if (i.dispositivo) naoArtigo.add(i.dispositivo);
    }
    normas.push({ norma: v.nomeNormaPosterior, assinatura, publicacao, comentario: v.comentario || null, itens: lista });
  }
  normas.sort((x, y) => (x.publicacao < y.publicacao ? -1 : x.publicacao > y.publicacao ? 1 : x.norma < y.norma ? -1 : x.norma > y.norma ? 1 : 0));
  const chaves = [...artigos].sort((x, y) => { const px = x.split('-'); const py = y.split('-'); return Number(px[0]) - Number(py[0]) || (px[1] || '').localeCompare(py[1] || ''); });
  return { normas, artigos: chaves, nao_artigo: [...naoArtigo].sort() };
}

module.exports = { alteracoesPosteriores, dataIso, artigosSenadoJson, artigosSenadoHtml, limparAnotacoes, romano, letra, MARCA_REVOGADO, MARCA_INCERTO };
