'use strict';
// Monta a página de diagnóstico inserindo src/backup.js (o mesmo código testado) no modelo.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const modelo = fs.readFileSync(path.join(raiz, 'web/diag.template.html'), 'utf8');
const backup = fs.readFileSync(path.join(raiz, 'src/backup.js'), 'utf8');

const marcador = '/*__BACKUP_JS__*/';
if (modelo.split(marcador).length !== 2) throw new Error('o marcador deve aparecer exatamente uma vez no modelo');
if (/<\/script/i.test(backup)) throw new Error('backup.js contém "</script" e quebraria a página');

const saida = modelo.replace(marcador, () => backup);
fs.mkdirSync(path.join(raiz, 'dist'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'dist/diag.html'), saida);
console.log('dist/diag.html gerado: ' + saida.length + ' bytes');
