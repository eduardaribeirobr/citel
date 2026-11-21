'use strict';
// Teste de ponta a ponta da página de diagnóstico (dist/diag.html) no Chromium.
// localStorage e IndexedDB são REAIS. O banco da plataforma (window.claude) é simulado.
// Isto NÃO valida a plataforma real nem iOS/Android.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const Backup = require('../src/backup.js');

const RAIZ = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS_DIR || '/tmp';
const html = fs.readFileSync(path.join(RAIZ, 'dist/diag.html'), 'utf8');
const wrapper = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + html + '</body></html>';

function mockInit({ scenario }) {
  const store = new Map();
  window.__store = store;
  const tick = () => new Promise(r => setTimeout(r, 2));
  const snap = (p, has) => ({ id: p.split('/').pop(), exists: has, data: () => (has ? structuredClone(store.get(p)) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
  const mkDoc = (p) => ({
    id: p.split('/').pop(), path: p,
    async get() {
      await tick();
      const has = store.has(p);
      if (scenario === 'corrupt' && has) {
        const d = structuredClone(store.get(p));
        if (d.events && d.events.length) d.events[7].correct = !d.events[7].correct;
        return { id: p.split('/').pop(), exists: true, data: () => d, metadata: {} };
      }
      return snap(p, has);
    },
    async set(d) { await tick(); if (scenario === 'writefail') throw { code: 'invalid_argument', message: 'negado' }; store.set(p, structuredClone(d)); },
    async update(d) { await tick(); const cur = store.get(p); if (!cur) throw { code: 'invalid_argument', message: 'não existe' }; store.set(p, Object.assign({}, cur, structuredClone(d))); },
    async delete() { await tick(); store.delete(p); },
  });
  const db = {
    doc: (p) => mkDoc(p),
    collection: (p) => ({
      path: p, doc: (id) => mkDoc(p + '/' + id),
      async get() {
        await tick();
        const depth = p.split('/').length + 1;
        const keys = [...store.keys()].filter(k => k.startsWith(p + '/') && k.split('/').length === depth);
        return { docs: keys.map(k => snap(k, true)), size: keys.length, empty: !keys.length };
      },
    }),
  };
  const user = { async id() { return scenario === 'noid' ? null : 'u_TESTE0000000000000000'; }, async isOwner() { return true; }, async canEdit() { return true; }, async can() { return true; } };
  const downloads = { async save(req) { if (scenario === 'declined') throw { code: 'declined', message: 'não' }; window.__saved = req; return { status: 'saved' }; } };
  if (scenario === 'lsblock') {
    const boom = () => { throw new DOMException('bloqueado', 'SecurityError'); };
    Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom;
  }
  if (scenario === 'idbnone') Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true });
  window.claude = { async use(name) { if (scenario === 'nodb' && name === 'db') return null; return ({ db, user, downloads })[name] || null; } };
}

async function abrir(browser, scenario, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: opts.dark ? 'dark' : 'light', deviceScaleFactor: 1, acceptDownloads: false });
  const page = await ctx.newPage();
  await page.route(/^https?:/, r => (r.request().url() === 'https://diag.test/' ? r.fulfill({ contentType: 'text/html; charset=utf-8', body: wrapper }) : r.abort()));
  await page.addInitScript(mockInit, { scenario });
  page.on('pageerror', e => { console.log('  [pageerror] ' + e.message); erros.push(e.message); });
  await page.goto('https://diag.test/', { waitUntil: 'domcontentloaded' });
  await esperarBoot(page);
  return { ctx, page };
}
async function esperarBoot(page) {
  await page.waitForFunction(() => document.getElementById('r-mark').textContent !== 'verificando' && document.getElementById('r-ls').textContent !== 'verificando', null, { timeout: 15000 });
}
const erros = [];
const results = [];
function check(nome, cond, detalhe = '') {
  results.push({ nome, pass: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + nome + (detalhe ? '  [' + detalhe + ']' : ''));
}
const txt = (page, sel) => page.textContent(sel);
async function aguardarVeredito(page, sel) {
  await page.waitForFunction((s) => document.querySelector(s).textContent.length > 0, sel, { timeout: 30000 });
  return txt(page, sel);
}
const dadosOk = () => ({ eventos: [{ id: 'a1', topicId: 'T1', questionId: 'q1', ts: 1, correct: true, conf: 'seguro' }], sessoes: [], estudados: [], config: {} });

(async () => {
  const browser = await chromium.launch();

  // ===== Banco de dados da plataforma =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    check('db/ok: botão habilitado', !(await page.$eval('#run', b => b.disabled)));
    await page.click('#run');
    const v = await aguardarVeredito(page, '#verdict');
    check('db/ok: 6 de 6', /Todas as 6/.test(v), v);
    check('db/ok: nada sobrou no banco', (await page.evaluate(() => window.__store.size)) === 0);
    const rel = await txt(page, '#report');
    check('db/ok: relatório traz 6 linhas OK', (rel.match(/^OK /gm) || []).length === 6);
    check('db/ok: relatório não contém o id do usuário', !/u_TESTE/.test(rel));
    await ctx.close();
  }
  for (const [cen, esperado, nome] of [['nodb', /não está disponível/, 'sem banco'], ['noid', /identidade/, 'sem identidade']]) {
    const { ctx, page } = await abrir(browser, cen);
    check(`db/${cen}: botão do banco desabilitado`, await page.$eval('#run', b => b.disabled));
    check(`db/${cen}: orientação (${nome})`, esperado.test(await txt(page, '#hint')));
    check(`db/${cen}: modo local continua disponível`, !(await page.$eval('#run-local', b => b.disabled)));
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'writefail');
    await page.click('#run');
    const v = await aguardarVeredito(page, '#verdict');
    check('db/writefail: acusa falha, não declara sucesso', /0 de 6/.test(v) && !/Todas as 6/.test(v), v);
    check('db/writefail: relatório traz o código do erro', /invalid_argument/.test(await txt(page, '#report')));
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'corrupt');
    await page.click('#run');
    const v = await aguardarVeredito(page, '#verdict');
    check('db/corrupt: integridade detecta dado alterado', /FALHOU Reler o bloco/.test(await txt(page, '#report')), v);
    check('db/corrupt: limpeza removeu os documentos', (await page.evaluate(() => window.__store.size)) === 0);
    await ctx.close();
  }

  // ===== Modo local (armazenamento real) =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    check('local: IndexedDB e localStorage disponíveis', /disponível/.test(await txt(page, '#r-idb')) && /funciona/.test(await txt(page, '#r-ls')));
    await page.click('#run-local');
    const v = await aguardarVeredito(page, '#verdict-local');
    check('local/ok: 6 de 6', /Todas as 6/.test(v), v);
    const rel = await txt(page, '#report');
    check('local/ok: adulteração foi recusada', /Recusar um backup adulterado.*recusado: conteúdo alterado/.test(rel.replace(/\n/g, ' ')));
    check('local/ok: importação repetida não duplica', /0 novos/.test(rel));
    const sobras = await page.evaluate(async () => ({
      ls: Object.keys(localStorage).filter(k => k.startsWith('diag-local-')),
      bancos: (await indexedDB.databases()).map(d => d.name).filter(n => n.startsWith('plataforma-diag-teste-')),
    }));
    check('local/ok: nada sobrou no localStorage nem no IndexedDB', sobras.ls.length === 0 && sobras.bancos.length === 0, JSON.stringify(sobras));
    // exportação: confere o arquivo de forma independente
    await page.click('#export');
    await page.waitForFunction(() => /Exportação/.test(document.getElementById('verdict-local').textContent), null, { timeout: 8000 });
    const salvo = await page.evaluate(() => window.__saved);
    check('export: nome do arquivo', salvo && salvo.filename === 'plataforma-backup-teste.json');
    const ver = await Backup.verificarBackup(salvo.data);
    check('export: arquivo gerado é íntegro e tem 50 respostas', ver.ok && ver.backup.contagens.eventos === 50, ver.motivo || '');
    // importação do arquivo bom, adulterado, cortado e estranho
    const importar = async (conteudo) => {
      await page.evaluate(() => { document.getElementById('verdict-local').textContent = ''; });
      await page.setInputFiles('#imp', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(conteudo) });
      return aguardarVeredito(page, '#verdict-local');
    };
    check('import: arquivo íntegro é aceito', /Backup íntegro: 50 respostas/.test(await importar(salvo.data)));
    check('import: arquivo adulterado é recusado', /recusado: conteúdo alterado/.test(await importar(salvo.data.replace('"correct": false', '"correct": true'))));
    check('import: arquivo cortado é recusado', /JSON válido/.test(await importar(salvo.data.slice(0, 300))));
    check('import: arquivo qualquer é recusado', /recusado/.test(await importar('olá, isto não é um backup')));
    const rel2 = await txt(page, '#report');
    check('relatório final resume exportação e importação', /Teste de exportação: saved/.test(rel2) && /Teste de importação: recusado/.test(rel2));
    // layout depois de executar tudo
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('layout 390px sem rolagem horizontal (claro)', ov <= 0, 'excesso=' + ov);
    await page.screenshot({ path: path.join(SHOTS, 'diag2-light.png'), fullPage: true });
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'ok', { dark: true });
    await page.click('#run-local'); await aguardarVeredito(page, '#verdict-local');
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('layout 390px sem rolagem horizontal (escuro)', ov <= 0, 'excesso=' + ov);
    await page.screenshot({ path: path.join(SHOTS, 'diag2-dark.png'), fullPage: true });
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'declined');
    await page.click('#export');
    const v = await aguardarVeredito(page, '#verdict-local');
    check('export/declined: mensagem de cancelamento', /cancelou/.test(v), v);
    await ctx.close();
  }

  // ===== Falhas do armazenamento local =====
  {
    const { ctx, page } = await abrir(browser, 'lsblock');
    check('lsblock: localStorage aparece como bloqueado', /bloqueado/.test(await txt(page, '#r-ls')));
    check('lsblock: marcador usa só o IndexedDB e não acusa "parcial"', !/parcial/.test(await txt(page, '#r-mark')) && /só IndexedDB disponível/.test(await txt(page, '#mark-note')), await txt(page, '#mark-note'));
    await page.click('#run-local');
    const v = await aguardarVeredito(page, '#verdict-local');
    check('lsblock: modo local acusa falha, não declara sucesso', /0 de 6/.test(v) && !/Todas as 6/.test(v), v);
    const bancos = await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).filter(n => n.startsWith('plataforma-diag-teste-')));
    check('lsblock: não deixou banco de teste para trás', bancos.length === 0, JSON.stringify(bancos));
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'idbnone');
    check('idbnone: IndexedDB aparece como indisponível', /indisponível/.test(await txt(page, '#r-idb')));
    check('idbnone: marcador usa só o localStorage', /só localStorage disponível/.test(await txt(page, '#mark-note')), await txt(page, '#mark-note'));
    await page.click('#run-local');
    const v = await aguardarVeredito(page, '#verdict-local');
    check('idbnone: passa o localStorage e falha no IndexedDB (1 de 6)', /1 de 6/.test(v), v);
    check('idbnone: relatório explica o motivo', /IndexedDB indisponível/.test(await txt(page, '#report')));
    await ctx.close();
  }

  // ===== Marcador de persistência ao longo do tempo =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    check('marcador: 1º uso', /primeiro uso/.test(await txt(page, '#r-mark')));
    await page.reload(); await esperarBoot(page);
    check('marcador: após recarregar, presente (hoje)', /presente \(hoje\)/.test(await txt(page, '#r-mark')), await txt(page, '#r-mark'));
    // simula 3 dias: recua os dois marcadores
    await page.evaluate(async () => {
      const t = Date.now() - 3 * 86400000 - 3600000;
      localStorage.setItem('plataforma-diag-marcador', JSON.stringify({ criadoEm: t }));
      await new Promise((res, rej) => { const r = indexedDB.open('plataforma-diag', 1); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put({ criadoEm: t }, 'plataforma-diag-marcador'); tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); });
    });
    await page.reload(); await esperarBoot(page);
    check('marcador: após 3 dias, "presente há 3 dias"', /presente há 3 dias/.test(await txt(page, '#r-mark')), await txt(page, '#r-mark'));
    // apaga só o localStorage: perda parcial
    await page.evaluate(() => localStorage.removeItem('plataforma-diag-marcador'));
    await page.reload(); await esperarBoot(page);
    check('marcador: perda só do localStorage vira "parcial"', /parcial/.test(await txt(page, '#r-mark')) && /Só IndexedDB manteve/.test(await txt(page, '#mark-note')), await txt(page, '#mark-note'));
    await ctx.close();
  }

  await browser.close();
  check('nenhum erro de JavaScript na página durante todos os cenários', erros.length === 0, erros.join(' | '));
  const falhas = results.filter(r => !r.pass);
  console.log('\nTOTAL: ' + (results.length - falhas.length) + '/' + results.length + ' passaram');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
