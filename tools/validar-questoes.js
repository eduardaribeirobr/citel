'use strict';
/*
 * Gera data/validacao-questoes.json: relatório de auditoria do banco de questões.
 * Para cada modelo, gera questões em todos os níveis com várias sementes e passa cada uma pela validação
 * obrigatória (estrutura, segundo método de cálculo independente, unicidade do gabarito, distratores distintos).
 * Também registra a COBERTURA do edital: quais disciplinas/tópicos têm ou não têm questões.
 */
const fs = require('fs');
const path = require('path');
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js');
require('../src/questoes-mat2.js');
require('../src/questoes-rl.js'); require('../src/questoes-rl2.js'); require('../src/questoes-dir.js');

const F = require('../src/fontes.js');
const RAIZ = path.join(__dirname, '..');
const NIVEIS = [1, 2, 3, 4, 5];
const VARIACOES_SEMENTES = 400;       // quantas sementes se testam para contar enunciados distintos (o número é um piso: "400 ou mais")
const LIMITE_POUCAS = 30;             // abaixo disto o par modelo × nível é considerado de variação baixa

/** Semente de teste: modelos de Direito giram pelos tópicos geráveis; os demais usam a própria semente. */
const semente = (t, s) => (t.ajustarSemente ? t.ajustarSemente(Q.topicosDe(t)[s % Q.topicosDe(t).length], s * t.modulo + 1) : s);

function validarCatalogo(opc) {
  const sementes = (opc && opc.sementes) || 120;
  const matriz = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/matriz-edital.json'), 'utf8'));
  const modelos = Q.CATALOGO.map((t) => {
    const niveis = {}; const gabaritos = { A: 0, B: 0, C: 0, D: 0, E: 0 }; const problemas = {};
    let geradas = 0; let validas = 0; let rejeitadas = 0; let naoGeradas = 0; const variacoes = {};
    for (const n of NIVEIS) {
      const distintos = new Set();
      for (let s = 1; s <= VARIACOES_SEMENTES; s++) { try { distintos.add(Q.gerarQuestao(t.id, semente(t, s), n).enunciado); } catch (e) { /* conta como não gerada na etapa abaixo */ } }
      variacoes[n] = distintos.size;
      const c = { geradas: 0, validas: 0, rejeitadas: 0, naoGeradas: 0 };
      for (let s = 1; s <= sementes; s++) {
        let q;
        try { q = Q.gerarQuestao(t.id, semente(t, s), n); } catch (e) { c.naoGeradas++; problemas['não gerada: ' + e.message.slice(0, 80)] = 1; continue; }
        c.geradas++;
        const r = Q.validarQuestao(q);
        if (r.ok) { c.validas++; gabaritos[q.gabarito]++; } else { c.rejeitadas++; for (const m of r.erros) problemas[m] = (problemas[m] || 0) + 1; }
      }
      niveis[n] = c; geradas += c.geradas; validas += c.validas; rejeitadas += c.rejeitadas; naoGeradas += c.naoGeradas;
    }
    return { id: t.id, topicId: t.topicId, disciplina: t.disciplina, titulo: t.titulo, aposentado: t.aposentado || null, variacoes, geradas, validas, rejeitadas, naoGeradas, niveis, gabaritos, problemas };
  });
  const cobertura = matriz.disciplinas.map((d) => {
    const topicos = matriz.topicos.filter((x) => x.disciplina === d.cod);
    const comModelo = topicos.filter((x) => Q.ativos().some((t) => Q.topicosDe(t).includes(x.id)));
    return { cod: d.cod, nome: d.nome, topicos: topicos.length, topicosComQuestoes: comModelo.length, modelos: Q.ativos().filter((t) => t.disciplina === d.cod).length };
  });
  // diplomas do edital: fonte oficial ingerida? os artigos citados no edital existem no texto oficial?
  const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/mapa-diplomas.json'), 'utf8'));
  const porDiploma = new Map();
  const chave = (x) => String(x).replace(/\./g, '').replace(/[º°\s]/g, '').toUpperCase();      // "1.091-A" -> "1091-A"
  const inteiro = (x) => parseInt(chave(x), 10);
  for (const t of matriz.topicos) if (t.diploma) {
    const o = porDiploma.get(t.diploma.nome) || { nome: t.diploma.nome, topicos: 0, citados: 0, integral: false, nums: [], extremos: [] };
    o.topicos++; if (!t.dispositivos || !t.dispositivos.length) o.integral = true;
    for (const d of t.dispositivos || []) { o.extremos.push(chave(d.de)); if (d.ate) o.extremos.push(chave(d.ate)); const a = inteiro(d.de); const b = inteiro(d.ate || d.de); for (let i = a; i <= b; i++) { o.citados++; o.nums.push(i); } }
    porDiploma.set(t.diploma.nome, o);
  }
  const diplomas = [...porDiploma.values()].sort((x, y) => y.citados - x.citados).map((o) => {
    const id = mapa[o.nome]; let conferidos = 0; const ausentes = []; const inutilizaveis = []; const alteradosCitados = []; let omitidosCitados = 0;
    if (id) {
      const f = F.lerFonte(id); const ks = Object.keys(f.artigos).map((k) => k.toUpperCase());
      for (const n of o.nums) { if (ks.some((k) => k === String(n) || k.startsWith(n + '-'))) conferidos++; else ausentes.push(String(n)); }
      for (const n of new Set(o.nums)) { const k = ks.find((x) => x === String(n)); if (k && F.situacao(f, Object.keys(f.artigos).find((y) => y.toUpperCase() === k)) !== 'vigente') (f.alterados && f.alterados.includes(String(n)) ? alteradosCitados : inutilizaveis).push(String(n)); }
      if (f.omitidos) for (const n of new Set(o.nums)) if (f.omitidos[String(n)]) omitidosCitados++;
      for (const e of o.extremos) if (!ks.includes(e) && !ausentes.includes(e)) ausentes.push(e);     // extremo exato (ex.: 1091-A) precisa existir
    }
    return { nome: o.nome, topicos: o.topicos, artigos_citados: o.citados, lei_integral: o.integral, fonte: id ? 'ingerida' : 'pendente', fonte_id: id || null, artigos_conferidos: conferidos, artigos_ausentes: ausentes, artigos_revogados_ou_vetados: inutilizaveis, artigos_com_dispositivo_omitido: omitidosCitados, artigos_com_alteracao_posterior: alteradosCitados, observacao: id ? (F.carregarIndice()[id].observacao || null) : null };
  });
  const total = modelos.reduce((s, m) => ({ geradas: s.geradas + m.geradas, validas: s.validas + m.validas, rejeitadas: s.rejeitadas + m.rejeitadas, naoGeradas: s.naoGeradas + m.naoGeradas }), { geradas: 0, validas: 0, rejeitadas: 0, naoGeradas: 0 });
  const variacaoBaixa = [];
  for (const m of modelos) if (!m.aposentado) for (const n of NIVEIS) if (m.variacoes[n] < LIMITE_POUCAS) variacaoBaixa.push({ modelo: m.id, nivel: n, variacoes: m.variacoes[n] });
  return {
    gerado_em: new Date().toISOString().slice(0, 10),
    versao_motor: Q.VERSAO,
    sementes_por_nivel: sementes,
    metodo: 'Cada questão é gerada por um modelo e conferida por um segundo método de cálculo independente; só aparece se a estrutura, o gabarito único e as 5 alternativas distintas passarem. Isso prova que a conta está certa, não que a questão seja igual à da banca.',
    origem_das_questoes: 'inéditas, geradas por modelo; não são questões reais de provas da VUNESP',
    total,
    variacoes_max: VARIACOES_SEMENTES,
    limite_variacao_baixa: LIMITE_POUCAS,
    variacao_baixa: variacaoBaixa,
    modelos,
    cobertura,
    diplomas,
    limites: [
      'Matemática e Raciocínio Lógico: respostas conferidas por cálculo (nível B). Direito: 3 diplomas (Estatuto dos Funcionários, Lei 11.608/2003, Normas da Corregedoria) com questões de reprodução conferidas contra o texto oficial (nível A), só nos tópicos em que o texto permite alteração objetiva.',
      'Sem questões: os outros 11 diplomas de Direito (a fonte oficial de todos já está ingerida e conferida contra o edital, mas as questões ainda não foram geradas), Língua Portuguesa, Informática e Atualidades (sem fonte aprovada). Não vou inventar.',
      'As questões de Direito treinam a leitura precisa da lei (prazos, números, condições). Não testam interpretação nem jurisprudência.',
      'Raciocínio Lógico cobre sequências, diagramas lógicos (conjuntos), ordenação, estruturas lógicas (negação, equivalência, valor lógico) e argumentação (conclusão necessária, premissa que falta), as áreas citadas no edital (p. 62).',
      'Alguns pares modelo × nível têm poucas variações reais (lista em variacao_baixa): depois de vistas todas, o app usa o nível vizinho e só então repete. Ampliar exige modelos novos, porque os ids existentes são imutáveis.',
      'Modelos aposentados (marcados no relatório) continuam gerando as mesmas questões para reproduzir o histórico, mas não entram em sessões novas.',
    ],
  };
}

module.exports = { validarCatalogo };

if (require.main === module) {
  const r = validarCatalogo();
  fs.writeFileSync(path.join(RAIZ, 'data/validacao-questoes.json'), JSON.stringify(r, null, 1) + '\n');
  console.log('data/validacao-questoes.json: ' + r.modelos.length + ' modelos | geradas ' + r.total.geradas + ' | válidas ' + r.total.validas + ' | rejeitadas ' + r.total.rejeitadas + ' | não geradas ' + r.total.naoGeradas);
  if (r.total.rejeitadas || r.total.naoGeradas) { console.error('HÁ QUESTÕES REJEITADAS: investigar'); process.exit(1); }
}
