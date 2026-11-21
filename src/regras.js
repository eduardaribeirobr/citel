'use strict';
/*
 * Leitura de dados tabulares do edital a partir do texto extraído.
 * Quantitativo de candidatos da Lista Geral cuja prova discursiva será corrigida (edital p.35 a 37).
 */

function extrairQuantitativosDiscursiva(textoEdital) {
  const paginas = textoEdital.normalize('NFC').split('\f');
  const alvo = [35, 36, 37].map((p) => paginas[p - 1] || '');
  const linhas = alvo.join('\n').split('\n');
  const rows = [];
  for (const l of linhas) {
    const m = /^\s*(CAPITAL|\d{2}ª)\s+(\d{1,2}ª)\s+(\S.*?)\s+(\d{1,3})\s*$/.exec(l);
    if (m) rows.push({ cj: m[1] === 'CAPITAL' ? 'CAPITAL' : m[1], raj: m[2], sede: m[3].trim(), corrigidas: parseInt(m[4], 10) });
  }
  return rows;
}

module.exports = { extrairQuantitativosDiscursiva };
