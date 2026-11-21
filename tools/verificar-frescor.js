'use strict';
/*
 * Confere, para cada norma federal guardada, se o Senado registra normas alteradoras publicadas DEPOIS da data do texto que
 * guardamos e até a data-limite do edital (publicação do edital: alterações vigentes até essa data, edital p. 60).
 * Fonte: API pública do Senado (legis.senado.leg.br/dadosabertos, campo "vides"). Cliente honesto, sem disfarce.
 * Resultado: data/fontes/alteracoes-posteriores.json. Os artigos listados passam a ser tratados como DUVIDOSOS (não geram questão)
 * até que o texto seja atualizado e reingerido. Uso: node tools/verificar-frescor.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const S = require('../src/fontes-senado.js');
const { dataDoTexto } = require('../src/fontes.js');

const RAIZ = path.join(__dirname, '..');
const LIMITE = '2026-10-14';                       // data da publicação do edital (a mesma de referencia_vigencia no índice)
const idx = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/indice.json'), 'utf8'));


const saida = { gerado_em: new Date().toISOString().slice(0, 10), limite: LIMITE, fonte_api: 'https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn=<urn>', fontes: {} };
for (const [id, meta] of Object.entries(idx)) {
  if (!/^senado-/.test(id)) continue;
  const bruto = execFileSync('curl', ['-sS', '-L', '-m', '120', '--fail', '-H', 'Accept: application/json', 'https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn=' + meta.urn], { maxBuffer: 1 << 28 });
  const dt = dataDoTexto(meta); const r = S.alteracoesPosteriores(JSON.parse(bruto.toString('utf8')), dt, LIMITE);
  saida.fontes[id] = Object.assign({ nome: meta.nome, data_texto: dt }, r);
  console.log(id.padEnd(22), 'texto de', dt, '→', r.normas.length, 'alteração(ões) até', LIMITE, r.artigos.length ? '| artigos: ' + r.artigos.join(', ') : '');
}
fs.writeFileSync(path.join(RAIZ, 'data/fontes/alteracoes-posteriores.json'), JSON.stringify(saida, null, 1) + '\n');
