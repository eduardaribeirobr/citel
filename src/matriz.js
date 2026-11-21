'use strict';
/*
 * Matriz de conteúdos do Edital 01/2026 (Oficial de Justiça, TJSP).
 *
 * Gera a matriz a partir do TEXTO do Anexo VIII (páginas 60 a 62 do edital).
 * Nada é digitado à mão: listas de artigos são interpretadas por uma gramática
 * estrita e qualquer trecho não reconhecido interrompe a geração com erro.
 *
 * O que vem do edital: texto literal, dispositivos, quantidade de questões por
 * bloco/grupo, caráter eliminatório. O que é ESTIMATIVA nossa (marcado como tal):
 * esforço em minutos e a complexidade derivada dele.
 */

const NUM = /^(\d{1,3}(?:\.\d{3})*)(?:-([A-Z]))?$/;

function parseNumero(s) {
  const m = NUM.exec(s);
  if (!m) throw new Error('número de dispositivo não reconhecido: "' + s + '"');
  return { n: parseInt(m[1].replace(/\./g, ''), 10), letra: m[2] || null };
}

function fmtNumero(x) {
  const base = x.n >= 1000 ? String(x.n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(x.n);
  return base + (x.letra ? '-' + x.letra : '');
}

function limparLista(t) {
  return t
    .replace(/º/g, '')
    .replace(/\b(?:artigos?|arts?\.?)(?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s;,.]+$/, '');
}

/** Lista de artigos -> [{de, ate}] (de === ate quando é um artigo isolado). */
function parseListaArtigos(texto) {
  const t = limparLista(texto);
  if (!t) throw new Error('lista de artigos vazia');
  return t.split(/\s*;\s*|\s*,\s*|\s+e\s+(?=\d)/).map((p) => {
    if (!p) throw new Error('item vazio na lista de artigos (separador duplicado ou solto): "' + texto + '"');
    const r = /^(\S+)\s+a\s+(\S+)$/.exec(p);
    if (r) {
      const de = parseNumero(r[1]);
      const ate = parseNumero(r[2]);
      if (de.letra) throw new Error('intervalo iniciado por artigo com letra não é suportado: "' + p + '"');
      if (ate.n < de.n) throw new Error('intervalo invertido: "' + p + '"');
      return { de, ate };
    }
    const x = parseNumero(p);
    return { de: x, ate: x };
  });
}

/** Quantidade de artigos de um item. Em intervalos é um MÍNIMO (a lei pode ter artigos com letra dentro do intervalo). */
function contarItem(it) {
  if (it.de === it.ate) return 1;
  return (it.ate.n - it.de.n + 1) + (it.ate.letra ? 1 : 0);
}

function textoItem(it) {
  return it.de === it.ate ? fmtNumero(it.de) : fmtNumero(it.de) + ' a ' + fmtNumero(it.ate);
}

/** Forma canônica da lista, para conferir que nada se perdeu na interpretação. */
function textoCanonicoLista(itens) {
  return itens.map(textoItem).join('; ');
}

/** Normaliza o texto original da lista para o mesmo formato canônico (sem interpretar). */
function canonicoDoOriginal(texto) {
  return limparLista(texto)
    .replace(/\s*,\s*/g, '; ')
    .replace(/\s+e\s+(?=\d)/g, '; ')
    .replace(/\s*;\s*/g, '; ');
}

function tituloArtigos(itens) {
  const total = itens.length;
  const unico = total === 1 && itens[0].de === itens[0].ate;
  return (unico ? 'art. ' : 'arts. ') + itens.map(textoItem).join('; ');
}

function normalizarTexto(bruto) {
  const linhas = bruto.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const saida = [];
  for (const l of linhas) {
    if (/^PODER JUDICIÁRIO$/.test(l) || /^TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO$/.test(l)) continue;
    if (/^\d{1,3}$/.test(l)) continue;
    saida.push(l);
  }
  return saida.join('\n');
}

function planoDe(norm) {
  return norm.replace(/\s+/g, ' ').replace(/([A-Za-zÀ-ú])-\s+(?=[A-ZÀ-Ú])/g, '$1-').trim();
}

function entre(texto, inicio, fim, rotulo) {
  const i = texto.indexOf(inicio);
  if (i < 0) throw new Error('marcador não encontrado: ' + (rotulo || inicio));
  const j = fim ? texto.indexOf(fim, i + inicio.length) : texto.length;
  if (j < 0) throw new Error('marcador de fim não encontrado: ' + (rotulo || fim));
  return texto.slice(i + inicio.length, j).trim();
}

function numeroDe(texto, regex, rotulo) {
  const m = regex.exec(texto);
  if (!m) throw new Error('quantidade de questões não encontrada: ' + rotulo);
  return parseInt(m[1], 10);
}

// ---- Esforço estimado (ESTIMATIVA NOSSA; não vem do edital) ----
const MODELO_ESFORCO = Object.freeze({
  descricao: 'Estimativa inicial, a ser substituída pelo seu tempo real (o motor de progresso recalibra após 3 tópicos dominados).',
  legislacao: { baseMin: 20, porArtigoMin: 6, formula: 'esforço = 20 + 6 × nº de artigos' },
  diplomaIntegral: { min: 120, formula: 'diploma integral cujo nº de artigos não consta do edital: 120 min' },
  lingua_portuguesa: { padraoMin: 45, interpretacaoMin: 120 },
  matematica: { padraoMin: 45 },
  raciocinio_logico: { min: 180 },
  informatica: { padraoMin: 30 },
  atualidades: { fatosMin: 120 },
});

function complexidadeDerivada(esforcoMin) {
  if (esforcoMin <= 45) return 1;
  if (esforcoMin <= 90) return 2;
  if (esforcoMin <= 150) return 3;
  if (esforcoMin <= 240) return 4;
  return 5;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Cada disciplina jurídica do Bloco II: nome no edital e diplomas (marcadores literais do texto). */
const ESTRUTURA_CE = [
  { cod: 'DPEN', num: 1, nome: 'Direito Penal', cabecalho: 'DIREITO PENAL:', relevanciaCargo: 'média',
    diplomas: [{ cod: 'CP', nome: 'Código Penal', marcador: 'Código Penal – artigos' }] },
  { cod: 'DPPE', num: 2, nome: 'Direito Processual Penal', cabecalho: 'DIREITO PROCESSUAL PENAL:', relevanciaCargo: 'alta',
    diplomas: [
      { cod: 'CPP', nome: 'Código de Processo Penal', marcador: 'Código de Processo Penal – artigos' },
      { cod: 'L9099', nome: 'Lei n.º 9.099/1995', marcador: 'Lei n.º 9.099 de 26.09.1995 (artigos' },
    ] },
  { cod: 'DPCI', num: 3, nome: 'Direito Processual Civil', cabecalho: 'DIREITO PROCESSUAL CIVIL:', relevanciaCargo: 'alta',
    diplomas: [
      { cod: 'CPC', nome: 'Código de Processo Civil', marcador: 'Código de Processo Civil – artigos' },
      { cod: 'L9099', nome: 'Lei n.º 9.099/1995', marcador: 'Lei n.º 9.099 de 26.09.1995 (artigos' },
    ] },
  { cod: 'DCON', num: 4, nome: 'Direito Constitucional', cabecalho: 'DIREITO CONSTITUCIONAL:', relevanciaCargo: 'média',
    diplomas: [{ cod: 'CF', nome: 'Constituição Federal', marcador: 'Constituição Federal – artigos' }] },
  { cod: 'DADM', num: 5, nome: 'Direito Administrativo', cabecalho: 'DIREITO ADMINISTRATIVO:', relevanciaCargo: 'média',
    diplomas: [
      { cod: 'L10261', nome: 'Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei n.º 10.261/68)', marcador: 'Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei n.º 10.261/68) – artigos' },
      { cod: 'L8429', nome: 'Lei de Improbidade Administrativa (Lei n.º 8.429/92)', marcador: 'Lei Federal n.º 8.429/92 (Lei de Improbidade Administrativa) – artigos' },
    ] },
  { cod: 'DCIV', num: 6, nome: 'Direito Civil', cabecalho: 'DIREITO CIVIL:', relevanciaCargo: 'média',
    diplomas: [
      { cod: 'CC', nome: 'Código Civil', marcador: 'Código Civil – artigos' },
      { cod: 'LINDB', nome: 'Decreto-Lei n.º 4.657/1942', marcador: 'Decreto-Lei n.º 4.657 de 04/09/1942', integral: true },
    ] },
  { cod: 'LESP', num: 7, nome: 'Legislação Especial', cabecalho: 'LEGISLAÇÃO ESPECIAL:', relevanciaCargo: 'alta',
    diplomas: [
      { cod: 'L6830', nome: 'Lei n.º 6.830/1980', marcador: 'Lei n.º 6.830/1980 (artigos' },
      { cod: 'CNJ354', nome: 'Resolução CNJ n.º 354/2020', marcador: 'Resolução n.º 354/2020 do Conselho Nacional de Justiça (artigos' },
      { cod: 'L11608', nome: 'Lei n.º 11.608/2003', marcador: 'Lei n.º 11.608, de 29/12/2003', integral: true },
      { cod: 'NSCGJ', nome: 'Normas Judiciais da Corregedoria Geral da Justiça (Tomo I)', marcador: 'Normas Judiciais da Corregedoria Geral da Justiça', normas: true },
    ] },
];

/** Parte do corpo de uma disciplina em segmentos por diploma, na ordem em que aparecem. */
function segmentar(corpo, diplomas, cod) {
  const pos = diplomas.map((d) => {
    const p = corpo.indexOf(d.marcador);
    if (p < 0) throw new Error(cod + ': marcador do diploma não encontrado: ' + d.marcador);
    return p;
  });
  for (let k = 1; k < pos.length; k++) {
    if (pos[k] <= pos[k - 1]) throw new Error(cod + ': diplomas fora da ordem esperada');
  }
  return diplomas.map((d, k) => ({ d, texto: corpo.slice(pos[k] + d.marcador.length, k + 1 < pos.length ? pos[k + 1] : corpo.length) }));
}

function limparFimSegmento(t) {
  return t.replace(/[\s;,.]*\be\s*$/i, '').replace(/[\s;,.]+$/, '').trim();
}

function parseNormasCGJ(texto) {
  // texto após "...NormasJudiciais)" com linhas "Tomo I – Capítulo ...: (art. ...);"
  const partes = texto.split(/(?=Tomo I – )/).map((s) => s.trim()).filter((s) => s.startsWith('Tomo I – '));
  return partes.map((p) => {
    const m = /^(Tomo I – [^()]*?)\s*:?\s*\((.+)\)\s*[;.]?$/.exec(p);
    if (!m) throw new Error('item das Normas Judiciais não reconhecido: ' + p);
    const localizacao = m[1].replace(/\s*:$/, '').trim();
    const dentro = m[2].trim();
    let itens;
    let extra = null;
    const incs = /^art\.\s*(\d{1,4}(?:\.\d{3})*),\s*inciso\s+([IVXLC]+)$/.exec(dentro);
    const par = /^art\.\s*(\d{1,4}(?:\.\d{3})*)\.\s*§\s*(\d+º?)$/.exec(dentro);
    if (incs) { itens = parseListaArtigos(incs[1]); extra = { inciso: incs[2] }; }
    else if (par) { itens = parseListaArtigos(par[1]); extra = { paragrafo: par[2] }; }
    else itens = parseListaArtigos(dentro);
    return { localizacao, original: dentro, itens, extra };
  });
}

function criarTopicoLegal({ id, bloco, disciplina, diploma, itens, original, localizacao, extra, pagina, esforcoMin, esforcoOrigem }) {
  const n = itens.reduce((s, it) => s + contarItem(it), 0);
  return {
    id,
    bloco,
    disciplina,
    diploma,
    tipo: 'legislacao',
    titulo: (localizacao ? localizacao + ', ' : '') + diploma.nome + ', ' + tituloArtigos(itens) + (extra && extra.inciso ? ', inciso ' + extra.inciso : '') + (extra && extra.paragrafo ? ', § ' + extra.paragrafo : ''),
    texto_edital: original,
    localizacao: localizacao || null,
    dispositivos: itens.map((it) => ({ de: fmtNumero(it.de), ate: fmtNumero(it.ate), isolado: it.de === it.ate })),
    detalhe: extra || null,
    n_dispositivos: n,
    n_dispositivos_e_minimo: itens.some((it) => it.de !== it.ate),
    esforco_min: esforcoMin,
    esforco_origem: esforcoOrigem,
    complexidade_derivada: complexidadeDerivada(esforcoMin),
    rotulo_do_dispositivo: null,
    rotulo_status: 'pendente: conferir o tema do dispositivo na fonte oficial (Planalto/ALESP/CNJ/TJSP)',
    fonte_pagina: pagina,
    status_aprendizado: 'NÃO INICIADO',
    cobertura: 0,
  };
}

function esforcoLegal(n) {
  return { min: MODELO_ESFORCO.legislacao.baseMin + MODELO_ESFORCO.legislacao.porArtigoMin * n, origem: MODELO_ESFORCO.legislacao.formula };
}

function criarTopicoConteudo({ id, bloco, disciplina, titulo, texto, pagina, esforcoMin, esforcoOrigem }) {
  return {
    id, bloco, disciplina, diploma: null, tipo: 'conteudo', titulo, texto_edital: texto, localizacao: null,
    dispositivos: [], detalhe: null, n_dispositivos: 0, n_dispositivos_e_minimo: false,
    esforco_min: esforcoMin, esforco_origem: esforcoOrigem, complexidade_derivada: complexidadeDerivada(esforcoMin),
    rotulo_do_dispositivo: null, rotulo_status: 'não se aplica', fonte_pagina: pagina,
    status_aprendizado: 'NÃO INICIADO', cobertura: 0,
  };
}

function paginaDe(paginas, primeira, trecho) {
  for (let i = 0; i < paginas.length; i++) {
    if (planoDe(normalizarTexto(paginas[i])).includes(trecho)) return primeira + i;
  }
  throw new Error('trecho não encontrado em nenhuma página: ' + trecho);
}

function dividirItensNumerados(texto, padraoInicio) {
  const partes = texto.split(padraoInicio).map((s) => s.trim()).filter(Boolean);
  return partes;
}

/**
 * @param {string} textoEdital texto completo do edital (pdftotext -layout, páginas separadas por \f)
 * @param {{primeiraPagina?: number, ultimaPagina?: number}} opc
 */
function construirMatriz(textoEdital, opc) {
  const o = Object.assign({ primeiraPagina: 60, ultimaPagina: 62 }, opc || {});
  const todas = textoEdital.normalize('NFC').split('\f');
  const paginas = todas.slice(o.primeiraPagina - 1, o.ultimaPagina);
  if (paginas.length !== o.ultimaPagina - o.primeiraPagina + 1) throw new Error('páginas do Anexo VIII não encontradas');
  const plano = planoDe(normalizarTexto(paginas.join('\n')));

  if (!plano.includes('ANEXO VIII CONTEÚDO PROGRAMÁTICO')) throw new Error('Anexo VIII não encontrado nas páginas indicadas');

  const iB1 = plano.indexOf('BLOCO I: Língua Portuguesa');
  const iB2 = plano.indexOf('BLOCO II: Conhecimentos Específicos');
  const iB3 = plano.indexOf('BLOCO III: Conhecimentos Gerais');
  if (!(iB1 >= 0 && iB2 > iB1 && iB3 > iB2)) throw new Error('blocos fora da ordem esperada');

  const topicos = [];
  const disciplinas = [];
  const pg = (trecho) => paginaDe(paginas, o.primeiraPagina, trecho);

  // ---- Bloco I: Língua Portuguesa ----
  const corpoLP = plano.slice(iB1 + 'BLOCO I: Língua Portuguesa'.length, iB2).trim();
  const qLP = numeroDe(corpoLP, /^(\d+)\s+questões:/, 'Língua Portuguesa');
  const itensLP = dividirItensNumerados(corpoLP.replace(/^\d+\s+questões:\s*/, ''), /(?:^|\s)(?=\d{1,2}\.\s+[A-ZÀ-Ú])/);
  disciplinas.push({ cod: 'LP', bloco: 'B1', nome: 'Língua Portuguesa', questoes: qLP, questoes_fonte: 'Anexo VIII, Bloco I: "' + qLP + ' questões"', relevancia_cargo: null, fonte_pagina: pg('BLOCO I: Língua Portuguesa') });
  itensLP.forEach((t, k) => {
    const m = /^(\d{1,2})\.\s+(.*)$/.exec(t);
    if (!m || parseInt(m[1], 10) !== k + 1) throw new Error('numeração inesperada em Língua Portuguesa: ' + t.slice(0, 40));
    const min = k === 0 ? MODELO_ESFORCO.lingua_portuguesa.interpretacaoMin : MODELO_ESFORCO.lingua_portuguesa.padraoMin;
    topicos.push(criarTopicoConteudo({
      id: 'OJ26-LP-' + pad2(k + 1), bloco: 'B1', disciplina: 'LP', titulo: m[2].split(':')[0].replace(/\.$/, ''),
      texto: m[2], pagina: pg(m[2].slice(0, 30)), esforcoMin: min,
      esforcoOrigem: k === 0 ? 'interpretação de textos: 120 min (habilidade)' : 'padrão de Língua Portuguesa: 45 min',
    }));
  });

  // ---- Bloco II: Conhecimentos Específicos ----
  const corpoCE = plano.slice(iB2 + 'BLOCO II: Conhecimentos Específicos'.length, iB3).trim();
  const qCE = numeroDe(corpoCE, /^(\d+)\s+questões:/, 'Conhecimentos Específicos');
  const semCab = corpoCE.replace(/^\d+\s+questões:\s*/, '');
  const itensCE = semCab.split(/(?=\b[1-9]\.\s+[A-ZÀ-Ú]{3,}(?: [A-ZÀ-Ú]+)*:)/).map((s) => s.trim()).filter(Boolean);
  if (itensCE.length !== ESTRUTURA_CE.length) throw new Error('número de disciplinas do Bloco II inesperado: ' + itensCE.length);

  ESTRUTURA_CE.forEach((est, idx) => {
    const item = itensCE[idx];
    const cab = est.num + '. ' + est.cabecalho;
    if (!item.startsWith(cab)) throw new Error('disciplina inesperada na posição ' + (idx + 1) + ': ' + item.slice(0, 40));
    const corpo = item.slice(cab.length).trim();
    const pagina = pg(cab);
    disciplinas.push({ cod: est.cod, bloco: 'B2', nome: est.nome, questoes: null, questoes_fonte: 'o edital informa apenas o total do Bloco II (' + qCE + ' questões) e não discrimina por disciplina', relevancia_cargo: est.relevanciaCargo, fonte_pagina: pagina });

    const segs = segmentar(corpo, est.diplomas, est.cod);
    const cont = {};
    segs.forEach(({ d, texto }) => {
      cont[d.cod] = 0;
      const proximoId = () => { cont[d.cod] += 1; return 'OJ26-' + est.cod + '-' + d.cod + '-' + pad2(cont[d.cod]); };
      const diploma = { cod: d.cod, nome: d.nome };
      if (d.normas) {
        const aposSite = texto.slice(texto.indexOf('NormasJudiciais)') + 'NormasJudiciais)'.length);
        parseNormasCGJ(aposSite).forEach((n) => {
          const e = esforcoLegal(n.itens.reduce((s, it) => s + contarItem(it), 0));
          topicos.push(criarTopicoLegal({ id: proximoId(), bloco: 'B2', disciplina: est.cod, diploma, itens: n.itens, original: n.original, localizacao: n.localizacao, extra: n.extra, pagina: pg('Tomo I – ' + n.localizacao.replace('Tomo I – ', '').slice(0, 14)), esforcoMin: e.min, esforcoOrigem: e.origem }));
        });
      } else if (d.integral) {
        topicos.push(Object.assign(criarTopicoLegal({
          id: proximoId(), bloco: 'B2', disciplina: est.cod, diploma, itens: [{ de: { n: 1, letra: null }, ate: { n: 1, letra: null } }], original: d.marcador, localizacao: null, extra: null, pagina,
          esforcoMin: MODELO_ESFORCO.diplomaIntegral.min, esforcoOrigem: MODELO_ESFORCO.diplomaIntegral.formula,
        }), {
          titulo: d.nome + ' (diploma integral)', dispositivos: [], n_dispositivos: 0, n_dispositivos_e_minimo: false, integral: true,
          rotulo_status: 'pendente: o edital não indica os artigos; conferir o texto integral na fonte oficial',
        }));
      } else {
        let limpa;
        if (d.marcador.endsWith('(artigos')) {
          // o marcador já consumiu "(artigos": a lista vai até o parêntese de fechamento
          const fim = texto.indexOf(')');
          if (fim < 0) throw new Error(est.cod + '/' + d.cod + ': parêntese de fechamento não encontrado');
          limpa = texto.slice(0, fim);
        } else {
          limpa = limparFimSegmento(texto);
        }
        const itens = parseListaArtigos(limpa);
        const original = limparLista(limpa);
        if (textoCanonicoLista(itens) !== canonicoDoOriginal(limpa)) throw new Error(est.cod + '/' + d.cod + ': a lista interpretada não reproduz o texto original');
        itens.forEach((it) => {
          const e = esforcoLegal(contarItem(it));
          topicos.push(criarTopicoLegal({
            id: proximoId(), bloco: 'B2', disciplina: est.cod, diploma, itens: [it], original: textoItem(it), localizacao: null, extra: null, pagina, esforcoMin: e.min, esforcoOrigem: e.origem,
          }));
        });
        // guarda a lista literal do edital no primeiro tópico do diploma para auditoria
        const primeiro = topicos.find((t) => t.disciplina === est.cod && t.diploma.cod === d.cod);
        primeiro.lista_literal_do_diploma = original;
      }
    });
  });

  // ---- Bloco III: Conhecimentos Gerais ----
  const corpoCG = plano.slice(iB3 + 'BLOCO III: Conhecimentos Gerais'.length).trim();
  const iAtu = corpoCG.indexOf('Atualidades');
  const iMat = corpoCG.indexOf('Matemática e Raciocínio Lógico');
  const iInf = corpoCG.indexOf('Informática 05 questões');
  if (!(iAtu === 0 && iMat > iAtu && iInf > iMat)) throw new Error('grupos do Bloco III fora da ordem esperada');

  // Atualidades
  const txAtu = corpoCG.slice(iAtu + 'Atualidades'.length, iMat).trim();
  const qAtu = numeroDe(txAtu, /^(\d+)\s+questões:/, 'Atualidades');
  disciplinas.push({ cod: 'ATUA', bloco: 'B3', nome: 'Atualidades', questoes: qAtu, questoes_fonte: 'Anexo VIII, Bloco III: "' + qAtu + ' questões"', relevancia_cargo: null, fonte_pagina: pg('Atualidades 03 questões') });
  const itAtu = dividirItensNumerados(txAtu.replace(/^\d+\s+questões:\s*/, ''), /(?:^|\s)(?=[12]\.\s+[A-ZÀ-Ú])/);
  if (itAtu.length !== 2) throw new Error('Atualidades deveria ter 2 itens');
  topicos.push(criarTopicoConteudo({
    id: 'OJ26-ATUA-01', bloco: 'B3', disciplina: 'ATUA', titulo: 'Fatos políticos, econômicos, sociais e culturais divulgados a partir do 1º semestre de 2026',
    texto: itAtu[0].replace(/^1\.\s+/, ''), pagina: pg('Questões relacionadas a fatos políticos'), esforcoMin: MODELO_ESFORCO.atualidades.fatosMin,
    esforcoOrigem: 'acompanhamento de notícias: 120 min',
  }));
  const mPcd = /^2\.\s+Artigos\s+(.+?)\s+da Lei n\.º 13\.146\/2015/.exec(itAtu[1]);
  if (!mPcd) throw new Error('item do Estatuto da Pessoa com Deficiência não reconhecido');
  const itensPcd = parseListaArtigos(mPcd[1]);
  if (textoCanonicoLista(itensPcd) !== canonicoDoOriginal(mPcd[1])) throw new Error('ATUA/L13146: a lista interpretada não reproduz o texto original');
  itensPcd.forEach((it, k) => {
    const e = esforcoLegal(contarItem(it));
    topicos.push(criarTopicoLegal({
      id: 'OJ26-ATUA-L13146-' + pad2(k + 1), bloco: 'B3', disciplina: 'ATUA', diploma: { cod: 'L13146', nome: 'Estatuto da Pessoa com Deficiência (Lei n.º 13.146/2015)' },
      itens: [it], original: textoItem(it), localizacao: null, extra: null, pagina: pg('Estatuto da Pessoa com'), esforcoMin: e.min, esforcoOrigem: e.origem,
    }));
  });
  topicos.find((t) => t.id === 'OJ26-ATUA-L13146-01').lista_literal_do_diploma = limparLista(mPcd[1]);

  // Matemática e Raciocínio Lógico
  const txMat = corpoCG.slice(iMat + 'Matemática e Raciocínio Lógico'.length, iInf).trim();
  const mq = /^(\d+)\s+questões,\s+sendo\s+(\d+)\s+questões de matemática e\s+(\d+)\s+questões de raciocínio lógico:/.exec(txMat);
  if (!mq) throw new Error('quantidades de Matemática e Raciocínio Lógico não reconhecidas');
  const [qMR, qMat, qRL] = [parseInt(mq[1], 10), parseInt(mq[2], 10), parseInt(mq[3], 10)];
  if (qMat + qRL !== qMR) throw new Error('Matemática + Raciocínio Lógico não somam o total do grupo');
  disciplinas.push({ cod: 'MAT', bloco: 'B3', nome: 'Matemática', questoes: qMat, questoes_fonte: 'Anexo VIII: "sendo ' + qMat + ' questões de matemática"', relevancia_cargo: null, fonte_pagina: pg('Matemática e Raciocínio Lógico') });
  disciplinas.push({ cod: 'RLOG', bloco: 'B3', nome: 'Raciocínio Lógico', questoes: qRL, questoes_fonte: 'Anexo VIII: "' + qRL + ' questões de raciocínio lógico"', relevancia_cargo: null, fonte_pagina: pg('Matemática e Raciocínio Lógico') });
  const itMat = dividirItensNumerados(txMat.replace(mq[0], '').trim(), /(?:^|\s)(?=\d{1,2}\.\s+[A-ZÀ-Ú])/);
  if (itMat.length !== 14) throw new Error('Matemática e Raciocínio Lógico deveria ter 14 itens, encontrados ' + itMat.length);
  itMat.forEach((t, k) => {
    const m = /^(\d{1,2})\.\s+(.*)$/.exec(t);
    if (!m || parseInt(m[1], 10) !== k + 1) throw new Error('numeração inesperada em Matemática: ' + t.slice(0, 40));
    if (k < 13) {
      topicos.push(criarTopicoConteudo({
        id: 'OJ26-MAT-' + pad2(k + 1), bloco: 'B3', disciplina: 'MAT', titulo: m[2].split(':')[0].replace(/\.$/, ''), texto: m[2],
        pagina: pg(m[2].slice(0, 25)), esforcoMin: MODELO_ESFORCO.matematica.padraoMin, esforcoOrigem: 'padrão de Matemática: 45 min',
      }));
    } else {
      topicos.push(criarTopicoConteudo({
        id: 'OJ26-RLOG-01', bloco: 'B3', disciplina: 'RLOG', titulo: 'Raciocínio Lógico', texto: m[2],
        pagina: pg('Raciocínio Lógico: entendimento'), esforcoMin: MODELO_ESFORCO.raciocinio_logico.min, esforcoOrigem: 'raciocínio lógico: 180 min (habilidade)',
      }));
    }
  });

  // Informática
  const txInf = corpoCG.slice(iInf + 'Informática'.length).trim();
  const qInf = numeroDe(txInf, /^(\d+)\s+questões/, 'Informática');
  disciplinas.push({ cod: 'INFO', bloco: 'B3', nome: 'Informática', questoes: qInf, questoes_fonte: 'Anexo VIII, Bloco III: "' + qInf + ' questões"', relevancia_cargo: null, fonte_pagina: pg('Informática 05 questões') });
  const corpoInf = txInf.replace(/^\d+\s+questões:?\s*/, '');
  const rotulosInf = ['MS-Windows 10 ou superior:', 'MS-Word:', 'MS-Excel:', 'MS-Teams:', 'OneDrive:', 'Correio Eletrônico:', 'Internet:'];
  const posInf = rotulosInf.map((r) => {
    const p = corpoInf.indexOf(r);
    if (p < 0) throw new Error('assunto de Informática não encontrado: ' + r);
    return p;
  });
  rotulosInf.forEach((r, k) => {
    const fim = k + 1 < rotulosInf.length ? posInf[k + 1] : corpoInf.length;
    const texto = corpoInf.slice(posInf[k], fim).trim();
    topicos.push(criarTopicoConteudo({
      id: 'OJ26-INFO-' + pad2(k + 1), bloco: 'B3', disciplina: 'INFO', titulo: r.replace(/:$/, ''), texto,
      pagina: pg(r), esforcoMin: MODELO_ESFORCO.informatica.padraoMin, esforcoOrigem: 'padrão de Informática: 30 min',
    }));
  });

  const blocos = [
    { id: 'B1', nome: 'Língua Portuguesa', questoes: qLP, eliminatorio: true, acerto_minimo: 0.5, na_discursiva: false, fonte: 'Cap. IX item 1.1 (p.28); Cap. X itens 1 e 2 (p.35)' },
    { id: 'B2', nome: 'Conhecimentos Específicos', questoes: qCE, eliminatorio: true, acerto_minimo: 0.5, na_discursiva: true, fonte: 'Cap. IX itens 1.1 e 1.2 (p.28); Cap. X itens 1 e 2 (p.35)' },
    { id: 'B3', nome: 'Conhecimentos Gerais', questoes: qAtu + qMR + qInf, eliminatorio: false, acerto_minimo: null, na_discursiva: false, fonte: 'Cap. X item 2.1 (p.35)' },
  ];

  return {
    versao: '1.0',
    edital: 'Edital de Abertura n.º 01/2026, com a Retificação de 04/11/2026 (esta não altera o conteúdo programático)',
    fonte: { documento: 'Anexo VIII – Conteúdo Programático', paginas: o.primeiraPagina + ' a ' + o.ultimaPagina },
    regra_legislacao: 'Toda legislação deve ser considerada com as alterações e atualizações vigentes até a data da publicação do edital; legislação posterior pode ser usada quando superveniente ou complementar a tópico já previsto ou indispensável à avaliação.',
    modelo_esforco: MODELO_ESFORCO,
    frequencia_historica_vunesp: 'não apurada (exige provas anteriores acessíveis e contagem verificável)',
    blocos,
    disciplinas,
    topicos,
  };
}

module.exports = {
  construirMatriz, parseListaArtigos, contarItem, textoCanonicoLista, canonicoDoOriginal, fmtNumero, parseNumero,
  complexidadeDerivada, MODELO_ESFORCO, ESTRUTURA_CE,
};
