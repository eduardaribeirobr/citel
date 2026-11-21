'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extrairQuantitativosDiscursiva } = require('../src/regras.js');

const RAIZ = path.join(__dirname, '..');
const regras = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/edital-regras.json'), 'utf8'));
const edital = fs.readFileSync(path.join(RAIZ, 'data/fonte/edital-2026.txt'), 'utf8').normalize('NFC');
const retif = fs.readFileSync(path.join(RAIZ, 'data/fonte/retificacao-2026.txt'), 'utf8').normalize('NFC');
const pags = { edital: edital.split('\f'), retificacao: retif.split('\f') };
const colapsar = (s) => s.replace(/\s+/g, ' ').trim();

test('proveniência: o texto da retificação tem o SHA-256 registrado', () => {
  const prov = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fonte/proveniencia.json'), 'utf8'));
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, 'data/fonte/retificacao-2026.txt'))).digest('hex');
  assert.equal(h, prov.arquivos.retificacao.texto_sha256);
});

test('cada regra tem identificador único, página válida e citação literal presente NA PÁGINA indicada', () => {
  const ids = new Set();
  assert.ok(regras.fatos.length >= 40);
  for (const f of regras.fatos) {
    assert.ok(!ids.has(f.id), 'id repetido: ' + f.id);
    ids.add(f.id);
    const lista = pags[f.arquivo];
    assert.ok(lista, f.id + ': arquivo desconhecido');
    assert.ok(f.pagina >= 1 && f.pagina <= lista.length - 1, f.id + ': página fora do documento');
    const texto = colapsar(lista[f.pagina - 1]);
    assert.ok(texto.includes(colapsar(f.citacao)), f.id + ': citação não encontrada na página ' + f.pagina + ' do ' + f.arquivo + ': "' + f.citacao + '"');
    assert.ok(f.valor !== undefined && f.valor !== '');
  }
});

test('a retificação altera a remuneração e a data da lista de candidatos negros, e o edital original traz o valor antigo', () => {
  const f = Object.fromEntries(regras.fatos.map((x) => [x.id, x]));
  assert.notEqual(f.remuneracao_original.citacao, f.remuneracao_retificada.citacao);
  assert.ok(colapsar(pags.retificacao[0]).includes('Onde se lê'));
  assert.ok(colapsar(pags.retificacao[0]).includes('Leia-se'));
  assert.ok(colapsar(pags.edital[21]).includes('No dia 25.11.2026 será divulgada'), 'a data antiga (25/11/2026) consta no edital original, p.22');
});

test('quadro de vagas imediatas: 7 circunscrições somam os 132 cargos do edital e cada linha fecha', () => {
  const linhas = regras.vagas_imediatas.linhas;
  assert.equal(linhas.length, 7);
  const total = linhas.reduce((s, l) => s + l.total, 0);
  const fato = regras.fatos.find((x) => x.id === 'vagas_total').valor;
  assert.equal(total, 132);
  assert.equal(total, fato);
  for (const l of linhas) assert.equal(l.geral + l.pcd + l.negros + l.indigenas + l.quilombolas, l.total, l.sede);
  assert.equal(new Set(linhas.map((l) => l.cj)).size, 7);
});

test('quantitativo de discursivas corrigidas: 57 linhas (Capital + 56 circunscrições), sem lacunas', () => {
  const rows = extrairQuantitativosDiscursiva(edital);
  assert.equal(rows.length, 57);
  const cjs = rows.map((r) => r.cj);
  assert.equal(new Set(cjs).size, 57);
  assert.ok(cjs.includes('CAPITAL'));
  for (let i = 1; i <= 56; i++) assert.ok(cjs.includes(String(i).padStart(2, '0') + 'ª'), 'falta a ' + i + 'ª');
  const q = Object.fromEntries(rows.map((r) => [r.cj, r.corrigidas]));
  assert.equal(q.CAPITAL, 100);
  assert.equal(q['01ª'], 25);
  assert.equal(q['02ª'], 15);
  assert.equal(q['03ª'], 15);
  assert.equal(q['04ª'], 35);
  assert.equal(q['08ª'], 30);
  assert.equal(q['44ª'], 35);
  assert.equal(q['45ª'], 35);
  assert.equal(q['52ª'], 35);
  assert.equal(q['53ª'], 20);
  for (const r of rows) assert.ok(r.corrigidas >= 8 && r.corrigidas <= 100, r.cj);
});

test('toda circunscrição com vagas imediatas aparece na tabela de discursivas, com sede coerente', () => {
  const rows = extrairQuantitativosDiscursiva(edital);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  for (const l of regras.vagas_imediatas.linhas) {
    const r = rows.find((x) => x.cj === l.cj);
    assert.ok(r, l.cj);
    assert.equal(norm(r.sede), norm(l.sede), l.cj);
    assert.equal(r.raj, l.raj, l.cj);
  }
});
