'use strict';
/*
 * Gera data/dir-dados.json: os artigos que o EDITAL cita, VIGENTES (nem vetados nem revogados), de cada diploma com fonte ingerida,
 * ligados ao tópico do edital. É a única base das questões de Direito: o app embute este arquivo; nada vem de memória do modelo de IA.
 * Segunda passada: registra quais tópicos conseguem de fato gerar questão (o restante fica declarado como "sem questões").
 */
const fs = require('fs');
const path = require('path');
const F = require('../src/fontes.js');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(RAIZ, 'data/dir-dados.json');
const ROTULOS = {
  'alesp-lei-10261-1968': { id: 'DIR-DADM-L10261', rotulo: 'do Estatuto dos Funcionários Públicos Civis do Estado de São Paulo (Lei 10.261/68)', titulo: 'Direito: Estatuto dos Funcionários Públicos Civis (Lei 10.261/68)', disciplina: 'DADM' },
  'alesp-lei-11608-2003': { id: 'DIR-LESP-L11608', rotulo: 'da Lei 11.608/2003 (taxa judiciária)', titulo: 'Direito: Lei 11.608/2003 (taxa judiciária)', disciplina: 'LESP' },
  'tjsp-nscgj-tomo1': { id: 'DIR-LESP-NSCGJ', rotulo: 'das Normas de Serviço da Corregedoria Geral da Justiça (Tomo I)', titulo: 'Direito: Normas da Corregedoria Geral da Justiça (Tomo I)', disciplina: 'LESP' },
  'senado-lei-9099-1995': { id: 'DIR-DPPE-L9099', rotulo: 'da Lei 9.099/1995 (Juizados Especiais Cíveis e Criminais)', titulo: 'Direito: Lei 9.099/1995 (Juizados Especiais)', disciplina: 'DPPE', concordancia: true },
  'senado-lei-6830-1980': { id: 'DIR-LESP-L6830', rotulo: 'da Lei 6.830/1980 (Execução Fiscal)', titulo: 'Direito: Lei 6.830/1980 (Execução Fiscal)', disciplina: 'LESP', concordancia: true },
  'cnj-res-354-2020': { id: 'DIR-LESP-CNJ354', rotulo: 'da Resolução CNJ 354/2020 (cumprimento digital de ato processual e de ordem judicial)', titulo: 'Direito: Resolução CNJ 354/2020', disciplina: 'LESP', concordancia: true },
  'senado-cp-1940': { id: 'DIR-DPEN-CP', rotulo: 'do Código Penal (Decreto-Lei 2.848/1940)', titulo: 'Direito: Código Penal', disciplina: 'DPEN', concordancia: true },
  'senado-cpp-1941': { id: 'DIR-DPPE-CPP', rotulo: 'do Código de Processo Penal (Decreto-Lei 3.689/1941)', titulo: 'Direito: Código de Processo Penal', disciplina: 'DPPE', concordancia: true },
  'senado-cf-1988': { id: 'DIR-DCON-CF', rotulo: 'da Constituição Federal de 1988', titulo: 'Direito: Constituição Federal', disciplina: 'DCON', concordancia: true },
  'senado-lei-13146-2015': { id: 'DIR-ATUA-L13146', rotulo: 'do Estatuto da Pessoa com Deficiência (Lei 13.146/2015)', titulo: 'Atualidades: Estatuto da Pessoa com Deficiência (Lei 13.146/2015)', disciplina: 'ATUA', concordancia: true },
  'senado-cc-2002': { id: 'DIR-DCIV-CC', rotulo: 'do Código Civil (Lei 10.406/2002)', titulo: 'Direito: Código Civil', disciplina: 'DCIV', concordancia: true },
  'senado-cpc-2015': { id: 'DIR-DPCI-CPC', rotulo: 'do Código de Processo Civil (Lei 13.105/2015)', titulo: 'Direito: Código de Processo Civil', disciplina: 'DPCI', concordancia: true },
  'senado-lei-8429-1992': { id: 'DIR-DADM-L8429', rotulo: 'da Lei de Improbidade Administrativa (Lei 8.429/1992)', titulo: 'Direito: Lei 8.429/1992 (Improbidade Administrativa)', disciplina: 'DADM', concordancia: true },
  'senado-lindb-1942': { id: 'DIR-DCIV-LINDB', rotulo: 'da Lei de Introdução às Normas do Direito Brasileiro (Decreto-Lei 4.657/1942)', titulo: 'Direito: LINDB (Decreto-Lei 4.657/1942)', disciplina: 'DCIV', concordancia: true },
};
const chave = (x) => String(x).replace(/\./g, '').replace(/[º°\s]/g, '').toUpperCase();

function construir() {
  const matriz = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/matriz-edital.json'), 'utf8'));
  const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/mapa-diplomas.json'), 'utf8'));
  const indice = F.carregarIndice();
  const fontes = {}; const topicos = {};
  for (const [nome, id] of Object.entries(mapa)) {
    const f = F.lerFonte(id); const ks = Object.keys(f.artigos); const rot = ROTULOS[id]; if (!rot) continue;
    const doTopico = new Map();                                               // artigo -> topicId
    for (const t of matriz.topicos.filter((x) => x.diploma && x.diploma.nome === nome)) {
      if (!t.dispositivos || !t.dispositivos.length) { for (const k of ks) doTopico.set(k, t.id); continue; }   // lei integral
      for (const d of t.dispositivos) { const a = parseInt(chave(d.de), 10); const b = parseInt(chave(d.ate || d.de), 10); for (let i = a; i <= b; i++) for (const k of ks) if (k.toUpperCase() === String(i) || k.toUpperCase().startsWith(i + '-')) doTopico.set(k, t.id); }
    }
    const artigos = {};
    for (const [k, tid] of [...doTopico].sort((x, y) => parseInt(x[0], 10) - parseInt(y[0], 10) || x[0].localeCompare(y[0]))) {
      if (F.situacao(f, k) !== 'vigente') continue;
      artigos[k] = { topicId: tid, texto: F.limparNotas(f.artigos[k]) };
      (topicos[tid] = topicos[tid] || []).push({ fonte: id, artigo: k });
    }
    fontes[id] = { id: rot.id, ...(rot.concordancia ? { concordancia: true } : {}), nome, rotulo: rot.rotulo, titulo: rot.titulo, disciplina: rot.disciplina, url: indice[id].url, consultado_em: indice[id].consultado_em, sha256: indice[id].sha256, observacao: indice[id].observacao || null, artigos };
  }
  return { versao: 1, fontes, topicos };
}
module.exports = { construir, ARQ };

if (require.main === module) {
  const d = construir();
  fs.writeFileSync(ARQ, JSON.stringify(d) + '\n');
  // 2ª passada: quais tópicos geram questão de verdade?
  delete require.cache[require.resolve('../src/questoes-dir.js')];
  const Q = require('../src/questoes.js'); const M = require('../src/questoes-dir.js');
  d.topicosComQuestao = M.descobrirTopicosComQuestao(d);
  fs.writeFileSync(ARQ, JSON.stringify(d) + '\n');
  const n = Object.values(d.fontes).reduce((s, f) => s + Object.keys(f.artigos).length, 0);
  console.log('data/dir-dados.json: ' + Object.keys(d.fontes).length + ' diplomas, ' + n + ' artigos vigentes citados, ' + Object.keys(d.topicos).length + ' tópicos ligados, ' + d.topicosComQuestao.length + ' com questão gerável');
  void Q;
}
