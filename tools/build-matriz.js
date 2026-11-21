'use strict';
const fs = require('fs');
const path = require('path');
const { construirMatriz } = require('../src/matriz.js');

const raiz = path.join(__dirname, '..');
const texto = fs.readFileSync(path.join(raiz, 'data/fonte/edital-2026.txt'), 'utf8');
const m = construirMatriz(texto);

fs.writeFileSync(path.join(raiz, 'data/matriz-edital.json'), JSON.stringify(m, null, 1));

const cab = ['id', 'bloco', 'disciplina', 'diploma', 'titulo', 'n_dispositivos', 'questoes_do_grupo', 'bloco_eliminatorio', 'na_discursiva',
  'esforco_min_estimado', 'complexidade_derivada', 'status_aprendizado', 'cobertura', 'rotulo_status', 'fonte_pagina'];
const disc = Object.fromEntries(m.disciplinas.map((d) => [d.cod, d]));
const bl = Object.fromEntries(m.blocos.map((b) => [b.id, b]));
const esc = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const linhas = [cab.join(';')].concat(m.topicos.map((t) => [
  t.id, t.bloco, t.disciplina, t.diploma ? t.diploma.cod : '', t.titulo, t.n_dispositivos,
  disc[t.disciplina].questoes === null ? '' : disc[t.disciplina].questoes, bl[t.bloco].eliminatorio ? 'sim' : 'não', bl[t.bloco].na_discursiva ? 'sim' : 'não',
  t.esforco_min, t.complexidade_derivada, t.status_aprendizado, t.cobertura, t.rotulo_status, t.fonte_pagina,
].map(esc).join(';')));
fs.writeFileSync(path.join(raiz, 'data/matriz-edital.csv'), '﻿' + linhas.join('\n') + '\n');

const porDisc = {};
for (const t of m.topicos) {
  const d = (porDisc[t.disciplina] = porDisc[t.disciplina] || { topicos: 0, artigos: 0, min: 0 });
  d.topicos += 1; d.artigos += t.n_dispositivos; d.min += t.esforco_min;
}
console.log('tópicos:', m.topicos.length, '| disciplinas:', m.disciplinas.length);
for (const d of m.disciplinas) {
  const p = porDisc[d.cod];
  console.log(d.cod.padEnd(5), String(p.topicos).padStart(3), 'tópicos |', String(p.artigos).padStart(4), 'artigos |', String(p.min).padStart(5), 'min estimados |', 'questões:', d.questoes === null ? '(só o total do bloco)' : d.questoes);
}
const total = m.topicos.reduce((s, t) => s + t.esforco_min, 0);
console.log('total de artigos (mínimo):', m.topicos.reduce((s, t) => s + t.n_dispositivos, 0), '| esforço estimado total:', total, 'min =', (total / 60).toFixed(1), 'h');
