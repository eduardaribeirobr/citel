'use strict';
/*
 * Baixa um texto oficial, guarda o arquivo BRUTO e registra URL, data e SHA-256 em data/fontes/indice.json.
 * Cliente honesto: sem disfarce de navegador. Se o site recusar, a fonte NÃO é ingerida.
 * Uso: node tools/ingerir-fonte.js <id> <url> "<nome do diploma>" [codificacao]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ehPdf = process.argv.includes('--pdf');
const inicioArg = (process.argv.find((a) => a.startsWith('--inicio=')) || '').slice(9);
const estiloArg = (process.argv.find((a) => a.startsWith('--estilo=')) || '').slice(9);
const [id, url, nome, cod] = args;
if (!id || !url || !nome) { console.error('uso: ingerir-fonte.js <id> <url> "<nome>" [codificacao]'); process.exit(2); }
const dir = path.join(__dirname, '../data/fontes', id);
fs.mkdirSync(dir, { recursive: true });
const bruto = path.join(dir, ehPdf ? 'bruto.pdf' : 'bruto.html');
execFileSync('curl', ['-sS', '-L', '-m', '60', '--fail', '-o', bruto, url], { stdio: ['ignore', 'inherit', 'inherit'] });
const bytes = fs.readFileSync(bruto);
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
const idxArq = path.join(__dirname, '../data/fontes/indice.json');
const idx = fs.existsSync(idxArq) ? JSON.parse(fs.readFileSync(idxArq, 'utf8')) : {};
idx[id] = { nome, url, consultado_em: new Date().toISOString().slice(0, 10), sha256: sha, bytes: bytes.length, codificacao: cod || 'utf8', arquivo: 'data/fontes/' + id + '/' + path.basename(bruto) };
if (ehPdf) {
  const txt = path.join(dir, 'texto.txt');
  execFileSync('pdftotext', ['-layout', bruto, txt]);
  Object.assign(idx[id], { formato: 'pdf', texto: 'data/fontes/' + id + '/texto.txt', sha256_texto: crypto.createHash('sha256').update(fs.readFileSync(txt)).digest('hex'), estilo: estiloArg || 'art-ponto', inicio: inicioArg || null });
}
fs.writeFileSync(idxArq, JSON.stringify(idx, null, 1) + '\n');
console.log(id + ': ' + bytes.length + ' bytes, sha256 ' + sha.slice(0, 16) + '…');
