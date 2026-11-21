'use strict';
// Monta o app: insere os módulos testados (cada um dentro de uma função própria) no modelo da página
// e copia a matriz do edital para ser carregada pela página.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const modelo = fs.readFileSync(path.join(raiz, 'web/app.template.html'), 'utf8');
const ordem = ['progresso', 'backup', 'store', 'plano', 'questoes', 'questoes-mat', 'questoes-mat2', 'questoes-rl', 'questoes-rl2', 'dados-dir', 'questoes-dir', 'aprendizagem'];
const marcador = '/*__MODULOS__*/';
if (modelo.split(marcador).length !== 2) throw new Error('o marcador deve aparecer exatamente uma vez no modelo');

const modulos = ordem.map((nome) => {
  // 'dados-dir' não é arquivo de src: são os artigos oficiais (data/dir-dados.json) embutidos como dado, nunca como código
  const src = nome === 'dados-dir' ? 'globalThis.FontesDados = ' + JSON.stringify(JSON.parse(fs.readFileSync(path.join(raiz, 'data/dir-dados.json'), 'utf8'))).replace(/</g, '\\u003c') + ';' : fs.readFileSync(path.join(raiz, 'src', nome + '.js'), 'utf8');
  if (/<\/script/i.test(src)) throw new Error(nome + '.js contém "</script"');
  return '(function () {\n' + src + '\n})();';
}).join('\n');

const saida = modelo.replace(marcador, () => modulos);
const dir = path.join(raiz, 'dist/app');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.html'), saida);
for (const arq of ['matriz-edital.json', 'edital-regras.json', 'validacao-questoes.json']) fs.copyFileSync(path.join(raiz, 'data', arq), path.join(dir, arq));
console.log('dist/app/index.html: ' + saida.length + ' bytes | arquivos: ' + fs.readdirSync(dir).join(', '));
