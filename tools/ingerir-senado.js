'use strict';
/*
 * Baixa uma norma federal da API pública oficial do Senado (normas.leg.br, licença CC BY 4.0) e guarda o JSON BRUTO compactado
 * com URL, data, hash do arquivo e hash do conteúdo, em data/fontes/<id>/bruto.json.gz. Cliente honesto, sem disfarce.
 * Uso: node tools/ingerir-senado.js <id> "<urn>" "<nome do diploma>"
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const [id, urn, nome] = process.argv.slice(2);
if (!id || !urn || !nome) { console.error('uso: ingerir-senado.js <id> "<urn>" "<nome>"'); process.exit(2); }
const dir = path.join(__dirname, '../data/fontes', id); fs.mkdirSync(dir, { recursive: true });
const url = 'https://normas.leg.br/api/public/normas?urn=' + urn + '&&tipo_documento=maior-detalhe';
const tmp = path.join(dir, 'bruto.tmp');
execFileSync('curl', ['-sS', '-L', '-m', '240', '--fail', '-H', 'Accept: application/json', '-o', tmp, url], { stdio: ['ignore', 'inherit', 'inherit'] });
const bruto = fs.readFileSync(tmp); fs.rmSync(tmp);
const json = JSON.parse(bruto.toString('utf8')); const raiz = Array.isArray(json) ? json[0] : json;
if (!raiz || raiz['@type'] !== 'Legislation') throw new Error('resposta sem norma: ' + id);
let formato = 'senado-json'; let conteudo = bruto; let arquivoNome = 'bruto.json.gz'; let extra = {};
if (!raiz.hasPart) {
  // sem estrutura: usa o texto COMPILADO vigente publicado pela própria fonte (compilação monovigente)
  const encs = (raiz.encoding || []).filter((e) => e.contentUrl);
  const enc = encs.find((e) => /Compila/i.test(e.additionalType || '')) || encs.find((e) => e.version === 'Current');
  if (!enc) throw new Error('sem estrutura e sem texto compilado: ' + id);
  const urlTexto = enc.contentUrl.replace('/api/binario/', '/api/public/binario/');
  execFileSync('curl', ['-sS', '-L', '-m', '240', '--fail', '-o', tmp, urlTexto], { stdio: ['ignore', 'inherit', 'inherit'] });
  conteudo = fs.readFileSync(tmp); fs.rmSync(tmp); formato = 'senado-html'; arquivoNome = 'bruto.html.gz';
  const salvo = /<o:LastSaved>([^<]+)</.exec(conteudo.toString('utf8', 0, 4000));
  extra = { url_texto: urlTexto, tipo_texto: enc.additionalType || ('versão ' + enc.version), texto_salvo_em: salvo ? salvo[1].slice(0, 10) : null };
  if (!/Art\./.test(conteudo.toString('utf8'))) throw new Error('texto compilado sem artigos: ' + id);
}
const gz = zlib.gzipSync(conteudo, { level: 9 });
fs.writeFileSync(path.join(dir, arquivoNome), gz);
const idxArq = path.join(__dirname, '../data/fontes/indice.json');
const idx = JSON.parse(fs.readFileSync(idxArq, 'utf8'));
idx[id] = Object.assign({
  nome, url, urn, consultado_em: new Date().toISOString().slice(0, 10), formato, licenca: raiz.license || null,
  atualizado_pela_fonte_em: raiz.dateModified || null, publicado_pela_fonte_em: raiz.sdDatePublished || null, referencia_vigencia: '2026-10-14',
  sha256: crypto.createHash('sha256').update(gz).digest('hex'), sha256_bruto: crypto.createHash('sha256').update(conteudo).digest('hex'),
  bytes: gz.length, bytes_bruto: conteudo.length, arquivo: 'data/fontes/' + id + '/' + arquivoNome,
  observacao: (formato === 'senado-json' ? 'Texto consolidado do Senado reconstruído na data de referência do edital (14/10/2026). ' : 'Texto compilado vigente, publicado pela fonte' + (extra.texto_salvo_em ? ' (salvo em ' + extra.texto_salvo_em + ')' : '') + '; não é reconstruído por data. ') + 'A própria fonte informa atualização até ' + (raiz.dateModified || 'data não informada') + ': alterações posteriores a essa data podem não constar.',
}, extra);
fs.writeFileSync(idxArq, JSON.stringify(idx, null, 1) + '\n');
console.log(id + ' [' + formato + ']: ' + (conteudo.length / 1e6).toFixed(1) + ' MB bruto, ' + (gz.length / 1e3).toFixed(0) + ' KB compactado; fonte atualizada em ' + raiz.dateModified);
