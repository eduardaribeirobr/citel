'use strict';
/*
 * Gera tests/golden-questoes.json: impressão digital (SHA-256 abreviado) do conteúdo de várias questões de cada modelo.
 * REGRA: o id MODELO:semente:nível é imutável. O histórico guarda só o id; ao refazer, a questão é gerada de novo.
 * Se este arquivo precisar mudar para ids que já existem, isso APAGA o sentido do caderno de erros de quem já usou:
 * em vez disso, crie um modelo novo e aposente o antigo (campo `aposentado`).
 * Só acrescente ids de modelos NOVOS: node tools/golden-questoes.js --acrescentar
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js'); require('../src/questoes-mat2.js'); require('../src/questoes-rl.js'); require('../src/questoes-rl2.js');
const DIR = process.argv.includes('--dir');
if (DIR) require('../src/questoes-dir.js');

const ARQ = path.join(__dirname, DIR ? '../tests/golden-dir.json' : '../tests/golden-questoes.json');
const SEMENTES = [1, 2, 3, 7919];
const impressao = (q) => crypto.createHash('sha256').update(JSON.stringify({ e: q.enunciado, a: q.alternativas.map((x) => x.texto), g: q.gabarito })).digest('hex').slice(0, 16);

function gerar() {
  const ids = {};
  for (const t of Q.CATALOGO.filter((x) => DIR === !!x.ajustarSemente)) for (let n = 1; n <= 5; n++) for (const s of SEMENTES) {
    const sem = t.ajustarSemente ? t.ajustarSemente(Q.topicosDe(t)[s % Q.topicosDe(t).length], s * t.modulo + 1) : s;
    ids[Q.idQuestao(t.id, sem, n)] = impressao(Q.gerarQuestao(t.id, sem, n));
  }
  return ids;
}
module.exports = { impressao, gerar, ARQ };

if (require.main === module) {
  const atual = fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : { ids: {}, reais: [] };
  const novos = gerar();
  const acrescentar = process.argv.includes('--acrescentar');
  if (fs.existsSync(ARQ) && !acrescentar) { console.error('O arquivo já existe. Use --acrescentar para incluir só ids novos (nunca reescreve os existentes).'); process.exit(1); }
  let add = 0;
  for (const [id, h] of Object.entries(novos)) if (!(id in atual.ids)) { atual.ids[id] = h; add++; }
  fs.writeFileSync(ARQ, JSON.stringify(atual, null, 1) + '\n');
  console.log('tests/golden-questoes.json: ' + Object.keys(atual.ids).length + ' ids (' + add + ' acrescentados)');
}
