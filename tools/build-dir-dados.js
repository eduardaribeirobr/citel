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
    fontes[id] = { id: rot.id, nome, rotulo: rot.rotulo, titulo: rot.titulo, disciplina: rot.disciplina, url: indice[id].url, consultado_em: indice[id].consultado_em, sha256: indice[id].sha256, observacao: indice[id].observacao || null, artigos };
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
