'use strict';
// Quanto estudar por dia: cenários com o motor de progresso e a matriz real do edital.
// Uso: node tools/cenarios-carga.js [AAAA-MM-DD]   (padrão: data de hoje)
const fs = require('fs');
const path = require('path');
const { calcularProgresso } = require('../src/progresso.js');

const raiz = path.join(__dirname, '..');
const matriz = JSON.parse(fs.readFileSync(path.join(raiz, 'data/matriz-edital.json'), 'utf8'));
const hoje = process.argv[2] ? new Date(process.argv[2] + 'T15:00:00Z') : new Date();
const PROVA = Date.UTC(2027, 2, 14, 17, 0, 0); // 14/03/2027, edital p.28
const topicos = matriz.topicos.map((t) => ({ id: t.id, esforcoMin: t.esforco_min }));
const base = { topicos, eventos: [], sessoes: [], estudados: [], agora: hoje.getTime(), dataProva: PROVA, revisoesVencidas: 0 };

const fmt = (min) => Math.floor(min / 60) + 'h' + String(Math.round(min % 60)).padStart(2, '0');
const r0 = calcularProgresso(base);
console.log('Hoje:', hoje.toISOString().slice(0, 10), '| prova:', r0.prazo.dataProva, '| prazo de estudo (prova − 14 dias):', r0.prazo.prazoEstudo);
console.log('Dias de calendário até o prazo:', r0.prazo.diasCalendario, '| dias de estudo (6 por semana):', r0.prazo.diasEstudo.toFixed(1));
console.log('Carga total estimada:', r0.carga.restanteMin, 'min =', (r0.carga.restanteMin / 60).toFixed(1), 'h (ESTIMATIVA: 20 min + 6 min por artigo etc.)');
console.log('Necessário por dia de estudo, começando do zero:', r0.meta.necessarioMinDia.toFixed(0), 'min =', fmt(r0.meta.necessarioMinDia));
console.log('');
console.log('Disponível/dia | situação              | falta/dia | cobertura projetada do edital até o prazo');
for (const disp of [60, 90, 120, 150, 180]) {
  const r = calcularProgresso(base, { disponivelMinDia: disp });
  console.log(String(disp + ' min').padEnd(14), '|', r.meta.situacao.padEnd(21), '|', (r.meta.faltaMinDia === 0 ? '0' : r.meta.faltaMinDia.toFixed(0) + ' min').padStart(9), '|', (r.meta.projecaoCoberturaNoTempoDisponivel * 100).toFixed(0) + '%');
}
console.log('');
console.log('Sem dias de descanso (7 por semana) e sem reserva final:');
const r7 = calcularProgresso(base, { diasPorSemana: 7, reservaFinalDias: 0 });
console.log('  necessário por dia:', r7.meta.necessarioMinDia.toFixed(0), 'min =', fmt(r7.meta.necessarioMinDia));
const porDisc = {};
for (const t of matriz.topicos) porDisc[t.disciplina] = (porDisc[t.disciplina] || 0) + t.esforco_min;
console.log('');
console.log('Esforço estimado por disciplina (min):', JSON.stringify(porDisc));
