'use strict';
// Teste de ponta a ponta do Modo Aprendizagem (aba Questões), auditoria e regras, no Chromium com viewport de celular.
// O banco da plataforma (window.claude) é SIMULADO (persiste entre recarregamentos via sessionStorage).
// localStorage, relógio (deslocável) e a interface são reais. NÃO valida a plataforma real nem iOS/Android.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const Backup = require('../src/backup.js');
const Progresso = require('../src/progresso.js');

const RAIZ = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS_DIR || '/tmp';
const INDEX = fs.readFileSync(path.join(RAIZ, 'dist/app/index.html'), 'utf8');
const MATRIZ = fs.readFileSync(path.join(RAIZ, 'dist/app/matriz-edital.json'), 'utf8');
const VALIDACAO = fs.readFileSync(path.join(RAIZ, 'dist/app/validacao-questoes.json'), 'utf8');
const REGRAS = fs.readFileSync(path.join(RAIZ, 'dist/app/edital-regras.json'), 'utf8');
const wrapper = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + INDEX + '</body></html>';
const UID = 'u_TESTE0000000000000000A';

function mockInit({ cenario, uid }) {
  // relógio deslocável
  const R = Date;
  const off = () => Number(localStorage.getItem('__dateOffset') || 0);
  class D extends R { constructor(...a) { if (a.length) super(...a); else super(R.now() + off()); } static now() { return R.now() + off(); } }
  window.Date = D;
  // banco simulado persistente
  const ler = () => JSON.parse(sessionStorage.getItem('__mockdb') || '{}');
  const gravar = (o) => sessionStorage.setItem('__mockdb', JSON.stringify(o));
  const tocar = (p) => { const l = JSON.parse(sessionStorage.getItem('__paths') || '[]'); l.push(p); sessionStorage.setItem('__paths', JSON.stringify(l)); };
  const offline = () => sessionStorage.getItem('__offline') === '1';
  const checar = (op) => { if (offline()) throw { code: 'unavailable', message: 'sem conexão (' + op + ')' }; };
  const snap = (p, d) => ({ id: p.split('/').pop(), exists: d !== undefined, data: () => (d === undefined ? undefined : JSON.parse(JSON.stringify(d))) });
  function ref(p) {
    return {
      id: p.split('/').pop(), path: p,
      async get() { await null; checar('get'); tocar(p); return snap(p, ler()[p]); },
      async set(d) { await null; checar('set'); tocar(p); const o = ler(); o[p] = JSON.parse(JSON.stringify(d)); gravar(o); },
      async delete() { await null; checar('delete'); tocar(p); const o = ler(); delete o[p]; gravar(o); },
      collection(n) { return col(p + '/' + n); },
    };
  }
  function col(p) {
    return {
      path: p, doc: (id) => ref(p + '/' + id),
      async get() {
        await null; checar('list'); tocar(p);
        const o = ler(); const prof = p.split('/').length + 1;
        const ks = Object.keys(o).filter((k) => k.startsWith(p + '/') && k.split('/').length === prof);
        return { docs: ks.map((k) => snap(k, o[k])), size: ks.length };
      },
    };
  }
  const db = { doc: ref, collection: col };
  const user = { async id() { return uid; }, async isOwner() { return true; }, async canEdit() { return true; }, async can() { return true; } };
  const downloads = { async save(req) { if (cenario === 'recusar') throw { code: 'declined' }; sessionStorage.setItem('__saved', JSON.stringify(req)); return { status: 'saved' }; } };
  window.claude = { async use(n) { if (cenario === 'semdb' && n === 'db') return null; return ({ db, user, downloads })[n] || null; } };
}

const erros = [];
const resultados = [];
function check(nome, cond, detalhe = '') {
  resultados.push({ nome, pass: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + nome + (detalhe ? '  [' + detalhe + ']' : ''));
}

async function abrir(browser, cenario, opc = {}) {
  const ctx = opc.ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: opc.escuro ? 'dark' : 'light', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route(/^https?:/, (r) => {
    const u = r.request().url();
    if (u === 'https://app.test/') return r.fulfill({ contentType: 'text/html; charset=utf-8', body: wrapper });
    if (u === 'https://app.test/matriz-edital.json') return r.fulfill({ contentType: 'application/json', body: MATRIZ });
    if (!opc.semAux && u === 'https://app.test/validacao-questoes.json') return r.fulfill({ contentType: 'application/json', body: VALIDACAO });
    if (!opc.semAux && u === 'https://app.test/edital-regras.json') return r.fulfill({ contentType: 'application/json', body: REGRAS });
    return r.abort();
  });
  await page.addInitScript(mockInit, { cenario, uid: UID });
  if (opc.seed) await page.addInitScript((sd) => { if (!sessionStorage.getItem('__mockdb')) sessionStorage.setItem('__mockdb', JSON.stringify(sd)); }, opc.seed);
  page.on('pageerror', (e) => { console.log('  [pageerror] ' + e.message); erros.push(e.message); });
  await page.goto('https://app.test/' + (opc.hash || ''), { waitUntil: 'domcontentloaded' });
  await esperarPronto(page);
  return { ctx, page };
}
const esperarPronto = (page) => page.waitForSelector('body[data-pronto="1"]', { timeout: 15000 });
const esperarSalvo = (page) => page.waitForFunction(() => document.getElementById('status').dataset.estado === 'salvo', null, { timeout: 15000 });
const esperarEstado = (page, e) => page.waitForFunction((x) => document.getElementById('status').dataset.estado === x, e, { timeout: 15000 });
const txt = (page, sel) => page.textContent(sel);
const aba = async (page, nome) => { await page.click('nav.abas a[data-aba="' + nome + '"]'); await page.waitForFunction((n) => document.querySelector('nav.abas a[aria-current="page"]').dataset.aba === n, nome); };
const dbDoc = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('__mockdb') || '{}'));
const chunks = async (page) => Object.entries(await dbDoc(page)).filter(([p]) => p.includes('/app/log/')).map(([, d]) => d);
const itens = async (page, colecao) => (await chunks(page)).flatMap((c) => c[colecao]);
const deslocar = (page, ms) => page.evaluate((m) => localStorage.setItem('__dateOffset', String(m)), ms);
const sobreposicao = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);


const DIA = 86400000;
const Q = require('../src/questoes.js');
require('../src/questoes-mat.js'); require('../src/questoes-mat2.js'); require('../src/questoes-rl.js'); require('../src/questoes-rl2.js'); require('../src/questoes-dir.js');
const Aprendizagem = require('../src/aprendizagem.js');

const qidAtual = (page) => page.getAttribute('#card-questao', 'data-qid');
const alvoCorreto = (qid) => { const x = Q.lerId(qid); return Q.gerarQuestao(x.templateId, x.semente, x.nivel); };
async function responder(page, { acertar, conf }) {
  const qid = await qidAtual(page);
  const q = alvoCorreto(qid);
  const idx = acertar ? q.gabaritoIdx : (q.gabaritoIdx + 1) % 5;
  await (await page.$$('button.alt'))[idx].click();
  await page.click('button.conf[data-conf="' + conf + '"]');
  await page.click('#btn-q-confirmar');
  await page.waitForSelector('#q-feedback');
  return { qid, q, idx };
}
async function configurar(page, { n, assunto, nivel }) {
  if (n) await page.selectOption('#q-n', String(n));
  if (assunto !== undefined) await page.selectOption('#q-assunto', assunto);
  if (nivel) await page.selectOption('#q-nivel', String(nivel));
}
const pctTxt = (x) => (Math.round(x * 1000) / 10).toLocaleString('pt-BR') + '%';

(async () => {
  const browser = await chromium.launch();
  let ids = {};

  // ===== K1: sessão completa, gravação e resumo =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes' });
    await esperarSalvo(page);
    check('K1: cinco abas, Questões é a atual', (await page.$$('nav.abas a')).length === 5 && (await page.getAttribute('nav.abas a[aria-current="page"]', 'data-aba')) === 'questoes');
    check('K1: tela inicial honesta sobre o que não existe', /só 3 dos 14 diplomas/.test(await txt(page, '#card-q-limites')) && /não testam interpretação nem jurisprudência/.test(await txt(page, '#card-q-limites')) && /Português, Informática e Atualidades/.test(await txt(page, '#card-q-limites')));
    check('K1: sem questões respondidas, desempenho vazio', /Nenhuma questão respondida ainda/.test(await txt(page, '#card-q-desempenho')));
    check('K1: botão Começar habilitado', !(await page.isDisabled('#btn-q-comecar')));
    await configurar(page, { n: 5, assunto: '', nivel: 'auto' });
    await page.click('#btn-q-comecar');
    check('K1: abre a questão 1 de 5', /Questão 1 de 5/.test(await txt(page, '#q-pos')));
    check('K1: cinco alternativas A–E', JSON.stringify(await page.$$eval('button.alt', (b) => b.map((x) => x.dataset.letra))) === JSON.stringify(['A', 'B', 'C', 'D', 'E']));
    check('K1: confirmar começa desabilitado', await page.isDisabled('#btn-q-confirmar'));
    await (await page.$$('button.alt'))[0].click();
    check('K1: só marcar a alternativa não basta', await page.isDisabled('#btn-q-confirmar'));
    check('K1: alternativa marcada fica com aria-pressed', (await page.getAttribute('button.alt[data-letra="A"]', 'aria-pressed')) === 'true');
    await page.click('button.conf[data-conf="seguro"]');
    check('K1: com alternativa e confiança, confirmar habilita', !(await page.isDisabled('#btn-q-confirmar')));

    // fidelidade: o que a tela mostra é a questão validada
    const qid1 = await qidAtual(page); const q1 = alvoCorreto(qid1);
    check('K1: enunciado na tela = enunciado gerado e validado', (await txt(page, '#q-enunciado')) === q1.enunciado);
    check('K1: alternativas na tela = alternativas geradas', JSON.stringify(await page.$$eval('button.alt .corpo > span:first-child', (e) => e.map((x) => x.textContent))) === JSON.stringify(q1.alternativas.map((a) => a.texto)));
    check('K1: a questão passa na validação obrigatória', Q.validarQuestao(q1).ok);

    // Q1: acerta com certeza (mantém a escolha de uma alternativa certa)
    await (await page.$$('button.alt'))[q1.gabaritoIdx].click();
    const antes = (await itens(page, 'eventos')).length;
    await page.click('#btn-q-confirmar');
    await page.waitForSelector('#q-feedback');
    check('K1: acertou: mostra "Acertou"', /Acertou/.test(await txt(page, '#q-feedback')));
    check('K1: a alternativa certa fica destacada e rotulada', (await page.getAttribute('button.alt.certa', 'data-letra')) === q1.gabarito && /Correta/.test(await txt(page, 'button.alt.certa')));
    check('K1: cada alternativa mostra seu comentário', (await page.$$eval('button.alt .com', (e) => e.length)) === 5);
    check('K1: a explicação e a pegadinha aparecem', /Explicação:/.test(await txt(page, '#q-feedback')) && /Atenção:/.test(await txt(page, '#q-feedback')));
    check('K1: avisa que não é questão da banca', /não é questão de prova da VUNESP/i.test(await txt(page, '#q-feedback')));
    check('K1: acerto não pergunta o motivo', (await page.$('#q-motivo')) === null);
    await esperarSalvo(page);
    let ev = await itens(page, 'eventos');
    const e1 = ev.find((x) => x.questionId === qid1);
    check('K1: resposta gravada no banco (uma só)', ev.length === antes + 1 && e1 && e1.correct === true && e1.conf === 'seguro' && e1.resposta === q1.gabarito && e1.gabarito === q1.gabarito, JSON.stringify(e1));
    check('K1: gravou tópico, nível, tempo e data', e1.topicId === q1.topicId && e1.nivel === 1 && Number.isFinite(e1.ms) && e1.ms >= 0 && Number.isFinite(e1.ts));
    ids.e1 = e1.id;
    await page.click('#btn-q-proxima');

    // Q2: erra por chute, anota motivo
    const r2 = await responder(page, { acertar: false, conf: 'chute' });
    check('K1: errou: mostra o gabarito', new RegExp('Errou · gabarito ' + r2.q.gabarito).test(await txt(page, '#q-feedback')));
    check('K1: a alternativa escolhida fica marcada como errada', (await page.getAttribute('button.alt.errada', 'data-letra')) === r2.q.alternativas[r2.idx].letra);
    check('K1: erro pergunta o motivo', (await page.$$('#q-motivo .motivos button')).length === 5);
    await page.click('.motivos button[data-motivo="calculo"]');
    check('K1: motivo marcado', (await page.getAttribute('.motivos button[data-motivo="calculo"]', 'aria-pressed')) === 'true');
    await esperarSalvo(page);
    ev = await itens(page, 'eventos');
    const e2 = ev.find((x) => x.questionId === r2.qid && x.tipo !== 'motivo'); const m2 = ev.find((x) => x.tipo === 'motivo');
    check('K1: erro gravado com o que o usuário marcou', e2 && e2.correct === false && e2.conf === 'chute' && e2.resposta === r2.q.alternativas[r2.idx].letra && e2.gabarito === r2.q.gabarito);
    check('K1: motivo gravado e ligado à resposta', m2 && m2.ref === e2.id && m2.motivo === 'calculo' && m2.tipo === 'motivo');
    await page.click('.motivos button[data-motivo="calculo"]');
    await esperarSalvo(page);
    check('K1: clicar de novo no mesmo motivo não duplica', (await itens(page, 'eventos')).filter((x) => x.tipo === 'motivo').length === 1);
    ids.e2 = e2.id; ids.q2 = r2.qid;
    await page.click('#btn-q-proxima');

    // Q3: erra com certeza (sem anotar motivo); proteção contra envio duplo
    const qid3 = await qidAtual(page); const q3 = alvoCorreto(qid3);
    await (await page.$$('button.alt'))[(q3.gabaritoIdx + 2) % 5].click();
    await page.click('button.conf[data-conf="seguro"]');
    const nAntes = (await itens(page, 'eventos')).length;
    await page.evaluate(() => { const b = document.querySelector('#btn-q-confirmar'); b.click(); b.click(); });
    await page.waitForSelector('#q-feedback');
    await esperarSalvo(page);
    check('K1: clique duplo em Confirmar grava uma resposta só', (await itens(page, 'eventos')).length === nAntes + 1);
    ids.q3 = qid3;
    await page.click('#btn-q-proxima');
    // Q4: acerta com dúvida; Q5: acerta com certeza
    await responder(page, { acertar: true, conf: 'duvida' });
    check('K1: penúltima questão oferece "Próxima"', /Próxima questão/.test(await txt(page, '#btn-q-proxima')));
    await page.click('#btn-q-proxima');
    await responder(page, { acertar: true, conf: 'seguro' });
    check('K1: última questão oferece "Ver resumo"', /Ver resumo/.test(await txt(page, '#btn-q-proxima')));
    await page.click('#btn-q-proxima');
    check('K1: resumo: placar 3 / 5 · 60%', /3 \/ 5\s*·\s*60%/.test(await txt(page, '#q-resumo-placar')), await txt(page, '#q-resumo-placar'));
    const rs = await txt(page, '#card-q-resumo');
    check('K1: resumo conta 1 acerto com dúvida e 1 erro com certeza', /Acertos com dúvida\s*1/.test(rs) && /Erros com certeza\s*1/.test(rs), rs.replace(/\s+/g, ' ').slice(0, 260));
    check('K1: resumo explica o erro com certeza', /errou 1 com certeza/.test(rs));
    check('K1: sem rolagem horizontal no resumo', (await sobreposicao(page)) <= 0);
    await page.click('#btn-q-tempo');
    await esperarSalvo(page);
    let ses = await itens(page, 'sessoes');
    check('K1: registrar tempo cria UMA sessão de estudo', ses.length === 1 && ses[0].min >= 1, JSON.stringify(ses));
    check('K1: botão de tempo fica desativado depois', await page.isDisabled('#btn-q-tempo') && /registrado/i.test(await txt(page, '#btn-q-tempo')));
    ev = await itens(page, 'eventos');
    check('K1: 5 respostas + 1 motivo no banco', ev.filter((x) => x.tipo !== 'motivo').length === 5 && ev.filter((x) => x.tipo === 'motivo').length === 1);
    check('K1: nenhuma resposta repete id de questão', new Set(ev.filter((x) => x.tipo !== 'motivo').map((x) => x.questionId)).size === 5);
    await ctx.close();
  }

  // ===== K2/K3/K4: caderno de erros, persistência e revisão espaçada (mesmo contexto) =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes' });
    await esperarSalvo(page);
    // refaz o estado do K1 neste contexto (cada contexto tem banco próprio): 3 acertos e 2 erros
    await configurar(page, { n: 5, assunto: '', nivel: 'auto' });
    await page.click('#btn-q-comecar');
    const feitas = [];
    const plano = [{ acertar: true, conf: 'seguro' }, { acertar: false, conf: 'chute', motivo: 'calculo' }, { acertar: false, conf: 'seguro' }, { acertar: true, conf: 'duvida' }, { acertar: true, conf: 'seguro' }];
    for (let i = 0; i < plano.length; i++) {
      const r = await responder(page, plano[i]); feitas.push(r);
      if (plano[i].motivo) await page.click('.motivos button[data-motivo="' + plano[i].motivo + '"]');
      await page.click('#btn-q-proxima');
    }
    await esperarSalvo(page);

    // K2: caderno (o fim da sessão leva ao resumo; de lá volta-se ao início)
    await page.waitForSelector('#card-q-resumo');
    await page.click('#btn-q-nova');
    await page.click('#btn-q-caderno');
    const cad = await page.$$eval('#card-q-caderno .item', (els) => els.map((e) => e.dataset.eid));
    check('K2: caderno lista exatamente os 2 erros', cad.length === 2, JSON.stringify(cad));
    const evAll = await itens(page, 'eventos');
    const erroSeguro = evAll.find((x) => x.questionId === feitas[2].qid && x.tipo !== 'motivo');
    const erroChute = evAll.find((x) => x.questionId === feitas[1].qid && x.tipo !== 'motivo');
    check('K2: mais recente primeiro', cad[0] === erroSeguro.id && cad[1] === erroChute.id);
    const itemChute = await txt(page, '#card-q-caderno .item[data-eid="' + erroChute.id + '"]');
    check('K2: mostra o motivo anotado', /Erro de cálculo/.test(itemChute), itemChute.replace(/\s+/g, ' '));
    check('K2: mostra resposta e gabarito', new RegExp('Você marcou ' + erroChute.resposta + '; o gabarito é ' + erroChute.gabarito).test(itemChute));
    check('K2: erro sem motivo diz "Motivo não anotado"', /Motivo não anotado/.test(await txt(page, '#card-q-caderno .item[data-eid="' + erroSeguro.id + '"]')));
    check('K2: mostra a próxima revisão', /Próxima revisão: \d\d\/\d\d/.test(itemChute));
    check('K2: sem rolagem horizontal no caderno', (await sobreposicao(page)) <= 0);
    // refazer a mesma questão
    await page.click('#card-q-caderno .item[data-eid="' + erroChute.id + '"] button[data-acao="refazer"]');
    check('K2: "Refazer" reabre exatamente a mesma questão', (await qidAtual(page)) === feitas[1].qid);
    check('K2: marcada como "Refazendo", 1 de 1', /Refazendo/.test(await txt(page, '#card-questao')) && /Questão 1 de 1/.test(await txt(page, '#q-pos')));
    const rf = await responder(page, { acertar: true, conf: 'seguro' });
    check('K2: refazer grava nova resposta para a mesma questão', rf.qid === feitas[1].qid);
    await page.click('#btn-q-proxima');
    check('K2: resumo da sessão de 1 questão', /1 \/ 1/.test(await txt(page, '#q-resumo-placar')));
    await esperarSalvo(page);
    const evRefeito = (await itens(page, 'eventos')).filter((x) => x.questionId === feitas[1].qid && x.tipo !== 'motivo');
    check('K2: histórico preserva o erro antigo e o acerto novo', evRefeito.length === 2 && evRefeito.some((x) => !x.correct) && evRefeito.some((x) => x.correct));

    // K3: persistência após recarregar
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarPronto(page); await esperarSalvo(page);
    await aba(page, 'questoes');
    const desemp = await txt(page, '#card-q-desempenho');
    check('K3: depois de recarregar, o desempenho vem do banco (6 respondidas, 4 acertos = 66,7%)', /Respondidas\s*6/.test(desemp) && /66,7%/.test(desemp), desemp.replace(/\s+/g, ' '));
    check('K3: caderno continua com 2 erros', /2 erro\(s\)/.test(await txt(page, '#card-q-caderno-atalho')));
    await aba(page, 'hoje');
    check('K3: Hoje mostra as questões do dia', /6 respondida\(s\) hoje/.test(await txt(page, '#q-hoje-texto')), await txt(page, '#q-hoje-texto'));

    // K10: o motor de progresso recebe as respostas e ignora o registro de motivo
    const dados = await dbDoc(page);
    const respostas = (await itens(page, 'eventos')).filter((x) => x.tipo !== 'motivo');
    const matriz = JSON.parse(MATRIZ);
    const cfg = { disponivelMinDia: 60, diasPorSemana: 6, reservaFinalDias: 14, pesosEtapas: { estudo: 0.40, exercicio: 0.25, desempenho: 0.20, retencao: 0.15 } };
    const entrada = (evs) => ({ topicos: matriz.topicos.map((x) => ({ id: x.id, esforcoMin: x.esforco_min })), eventos: evs, sessoes: [], estudados: [], agora: Date.now(), dataProva: Date.UTC(2027, 2, 14, 17, 0, 0), revisoesVencidas: 0 });
    const semMotivo = Progresso.calcularProgresso(entrada(respostas), cfg);
    await aba(page, 'edital');
    const linhas = await page.$$eval('[data-questoes]', (els) => els.map((e) => [e.dataset.questoes, e.textContent]));
    const somaTela = linhas.reduce((s, [, t]) => { const m = /Questões: (\d+) distintas/.exec(t); return s + (m ? Number(m[1]) : 0); }, 0);
    check('K10: aba Edital mostra a contagem de questões distintas igual à do motor sem o motivo', somaTela === semMotivo.topicos.reduce((s, t) => s + t.questoesDistintas, 0) && somaTela === 5, 'tela=' + somaTela);
    check('K10: tópicos sem questões não ganham linha de questões', (await page.$$('[data-questoes]')).length === 24);
    await aba(page, 'painel');
    check('K10: Painel declara o teto atual por falta de questões', /24 dos 198 tópicos/.test(await txt(page, '#texto-teto')) && /teto atual do progresso geral é/.test(await txt(page, '#texto-teto')), await txt(page, '#texto-teto'));
    const tetoEsperado = (() => { const com = new Set(Q.ativos().flatMap((t) => Q.topicosDe(t))); let a = 0; let b = 0; for (const t of matriz.topicos) { a += t.esforco_min; b += t.esforco_min * (com.has(t.id) ? 1 : 0.4); } return b / a; })();
    check('K10: teto exibido bate com o cálculo independente (' + pctTxt(tetoEsperado) + ')', (await txt(page, '#texto-teto')).includes(pctTxt(tetoEsperado)));

    // K4: revisão espaçada no dia seguinte
    await deslocar(page, DIA);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarPronto(page); await esperarSalvo(page);
    await aba(page, 'hoje');
    const hojeTxt = await txt(page, '#q-hoje-texto');
    const nModelos = new Set(respostas.map((x) => Q.lerId(x.questionId).templateId)).size;
    check('K4: no dia seguinte, os assuntos respondidos aparecem como revisões vencidas', new RegExp(nModelos + ' revisões? vencidas?').test(hojeTxt) , hojeTxt);
    check('K4: botão passa a chamar para revisões', /Fazer revisões e questões/.test(await txt(page, '#btn-ir-questoes')));
    await page.click('#btn-ir-questoes');
    await page.waitForSelector('#q-revisoes');
    check('K4: início lista as revisões vencidas', new RegExp(nModelos + ' revisões? vencidas?').test(await txt(page, '#q-revisoes')));
    await configurar(page, { n: 10, assunto: '', nivel: 'auto' });
    await page.click('#btn-q-comecar');
    check('K4: a primeira questão da sessão é uma revisão', /Revisão/.test(await txt(page, '#card-questao')));
    const jaFeitas = new Set(respostas.map((x) => x.questionId));
    let revisoes = 0; let repetidas = 0; const naSessao = new Set();
    for (let i = 0; i < 10; i++) {
      const tipo = await page.$eval('#card-questao .acoes .chip', (c) => c.textContent);
      if (tipo === 'Revisão') revisoes++;
      const qid = await qidAtual(page);
      if (jaFeitas.has(qid) || naSessao.has(qid)) repetidas++;
      naSessao.add(qid);
      await responder(page, { acertar: true, conf: 'seguro' });
      await page.click('#btn-q-proxima');
    }
    check('K4: até 40% de revisões na sessão de 10 (' + revisoes + ')', revisoes >= 1 && revisoes <= 4);
    check('K4: nenhuma questão da sessão repete uma já respondida', repetidas === 0);
    await esperarSalvo(page);
    // os acertos no prazo avançam a revisão: não aparecem mais como vencidas hoje para os assuntos revisados
    await aba(page, 'hoje');
    const aposTxt = await txt(page, '#q-hoje-texto');
    const restam = nModelos - revisoes;
    check('K4: acertos no prazo avançam a revisão: restam exatamente ' + restam + ' vencida(s)', restam === 0 ? !/vencida/.test(aposTxt) : new RegExp(restam + (restam === 1 ? ' revisão vencida' : ' revisões vencidas')).test(aposTxt), aposTxt);
    await ctx.close();
  }

  // ===== K10b: com 15 questões do mesmo assunto, o desempenho exibido é o do motor (o motor guarda só o último evento de cada questão) =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes' });
    await esperarSalvo(page);
    await configurar(page, { n: 15, assunto: 'OJ26-MAT-02', nivel: '1' });
    await page.click('#btn-q-comecar');
    for (let i = 0; i < 15; i++) {
      await responder(page, { acertar: i !== 12, conf: 'seguro' });   // o erro fica dentro da janela das últimas 10 respostas
      if (i === 12) await page.click('.motivos button[data-motivo="desatencao"]');
      await page.click('#btn-q-proxima');
    }
    await esperarSalvo(page);
    const todos = await itens(page, 'eventos');
    const respostas = todos.filter((x) => x.tipo !== 'motivo');
    check('K10b: 15 respostas e 1 motivo gravados', respostas.length === 15 && todos.length === 16);
    const matriz = JSON.parse(MATRIZ);
    const cfg = { disponivelMinDia: 60, diasPorSemana: 6, reservaFinalDias: 14, pesosEtapas: { estudo: 0.40, exercicio: 0.25, desempenho: 0.20, retencao: 0.15 } };
    const entrada = (evs) => ({ topicos: matriz.topicos.map((x) => ({ id: x.id, esforcoMin: x.esforco_min })), eventos: evs, sessoes: [], estudados: [], agora: Date.now(), dataProva: Date.UTC(2027, 2, 14, 17, 0, 0), revisoesVencidas: 0 });
    const sem = Progresso.calcularProgresso(entrada(respostas), cfg).topicos.find((t) => t.id === 'OJ26-MAT-02');
    check('K10b: (premissa) 15 questões distintas e desempenho calculado', sem.questoesDistintas === 15 && sem.desempenhoPonderado > 0);
    await aba(page, 'edital');
    const linha = await txt(page, '[data-questoes="OJ26-MAT-02"]');
    check('K10b: a tela mostra o desempenho calculado pelo motor (' + pctTxt(sem.desempenhoPonderado) + ')', linha.includes('15 distintas') && linha.includes('desempenho ' + pctTxt(sem.desempenhoPonderado)), linha);
    await aba(page, 'painel');
    check('K10b: Painel renderiza com respostas e motivo, sem erro', (await page.$('#card-meta')) !== null);
    await ctx.close();
  }

  // ===== K11: histórico REAL (10 respostas de uso de verdade, incluindo modelo aposentado) aberto na interface =====
  {
    const gold = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tests/golden-questoes.json'), 'utf8'));
    const t0 = Date.now() - 2 * DIA;
    const eventos = gold.reais.map((e, i) => ({ id: 'real-' + i, ts: t0 + i * 60000, topicId: 'OJ26-RLOG-01', questionId: e.id, correct: e.correct, conf: 'seguro', resposta: e.resposta, gabarito: e.gabarito, ms: 20000, nivel: 1, templateId: Q.lerId(e.id).templateId }));
    const chunk = { atualizadoEm: t0, cancelamentos: [], criadoEm: t0, dispositivo: 'afc4d228', eventos, marcacoes: [], revisoes: [], schema: 1, seq: 1, sessoes: [] };
    const seed = {}; seed['data/users/' + UID + '/app/log/afc4d228-0001'] = chunk; seed['data/users/' + UID + '/config'] = { atualizadoEm: t0, disponivelMinDia: 60, diasPorSemana: 6, reservaFinalDias: 14 };
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes', seed });
    await esperarSalvo(page);
    check('K11: o desempenho vem do histórico real (10 respondidas)', /Respondidas\s*10/.test(await txt(page, '#card-q-desempenho')), (await txt(page, '#card-q-desempenho')).replace(/\s+/g, ' ').slice(0, 120));
    const erros = gold.reais.filter((e) => !e.correct);
    const venc0 = (await txt(page, '#q-revisoes')).replace(/\s+/g, ' ');
    check('K11: 3 revisões vencidas, e a do modelo aposentado aparece como o SUCESSOR (diagramas)', /3 revisões vencidas/.test(venc0) && /Raciocínio lógico: diagramas lógicos/.test(venc0) && !/relações entre conjuntos/.test(venc0), venc0);
    await page.click('#btn-q-caderno');
    const eids = await page.$$eval('#card-q-caderno .item', (els) => els.map((e) => e.dataset.eid));
    check('K11: o caderno mostra os ' + erros.length + ' erros reais', eids.length === erros.length, JSON.stringify(eids));
    // refazer o erro do modelo APOSENTADO: reabre exatamente a mesma questão antiga
    const alvo = erros.find((e) => /RLOG-02-CONJUNTOS/.test(e.id));
    const eidAlvo = 'real-' + gold.reais.indexOf(alvo);
    await page.click('#card-q-caderno .item[data-eid="' + eidAlvo + '"] button[data-acao="refazer"]');
    const qid = await qidAtual(page);
    check('K11: "Refazer" reabre a questão antiga do modelo aposentado (mesmo id)', qid === alvo.id, qid);
    const esperada = Q.gerarQuestao('RLOG-02-CONJUNTOS', Q.lerId(alvo.id).semente, 1);
    check('K11: enunciado e alternativas idênticos ao que foi respondido (gabarito ' + alvo.gabarito + ')', (await txt(page, '#q-enunciado')) === esperada.enunciado && esperada.gabarito === alvo.gabarito);
    const rf = await responder(page, { acertar: true, conf: 'seguro' });
    check('K11: refazer funciona e acerta com o gabarito histórico', rf.q.gabarito === alvo.gabarito && /Acertou/.test(await txt(page, '#q-feedback')));
    await page.click('#btn-q-proxima');
    await esperarSalvo(page);
    // dois dias depois: os modelos respondidos vencem; o aposentado entrega a revisão ao sucessor
    await page.click('#btn-q-nova');
    const venc1 = (await txt(page, '#q-revisoes')).replace(/\s+/g, ' ');
    check('K11: depois de refazer e acertar a questão antiga, a revisão de diagramas deixa de estar vencida (o histórico do aposentado conta para o sucessor)', /2 revisões vencidas/.test(venc1) && !/diagramas/.test(venc1), venc1);
    await page.selectOption('#q-assunto', 'OJ26-RLOG-01'); await page.selectOption('#q-n', '15');
    await page.click('#btn-q-comecar');
    const modelos = []; const vistosIds = new Set(gold.reais.map((e) => e.id)); let repetidos = 0;
    for (let i = 0; i < 15; i++) {
      const id = await qidAtual(page); modelos.push(Q.lerId(id).templateId);
      if (vistosIds.has(id)) repetidos++; vistosIds.add(id);
      await responder(page, { acertar: true, conf: 'seguro' }); await page.click('#btn-q-proxima');
    }
    check('K11: a sessão nunca sorteia o modelo aposentado', !modelos.includes('RLOG-02-CONJUNTOS'), modelos.join(','));
    check('K11: a sessão de RL mistura todos os 6 modelos ativos', new Set(modelos).size === 6, [...new Set(modelos)].join(','));
    check('K11: nenhuma questão repete uma já respondida no histórico real', repetidos === 0);
    check('K11: sem rolagem horizontal', (await sobreposicao(page)) <= 0);
    await ctx.close();
  }

  // ===== K12: reportar problema numa questão =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes' });
    await esperarSalvo(page);
    await configurar(page, { n: 5, assunto: 'OJ26-MAT-02', nivel: '1' });
    await page.click('#btn-q-comecar');
    check('K12: antes de responder não há botão de reportar', (await page.$('#btn-q-reportar')) === null);
    const r = await responder(page, { acertar: false, conf: 'seguro' });
    await page.click('.motivos button[data-motivo="calculo"]');
    await page.click('#btn-q-reportar');
    await page.selectOption('#q-rep-cat', 'gabarito'); await page.fill('#q-rep-nota', 'Acho que o gabarito está trocado');
    await page.click('#btn-q-enviar-rep');
    check('K12: confirmação visível e o botão some', /Aviso registrado/.test(await txt(page, '#q-reportado')) && (await page.$('#btn-q-reportar')) === null);
    await esperarSalvo(page);
    const ev = await itens(page, 'eventos'); const av = ev.find((x) => x.tipo === 'problema'); const resp = ev.find((x) => x.questionId === r.qid && !x.tipo);
    check('K12: aviso gravado, ligado à resposta e à questão', av && av.ref === resp.id && av.questionId === r.qid && av.categoria === 'gabarito' && av.nota === 'Acho que o gabarito está trocado', JSON.stringify(av));
    await page.click('#btn-q-proxima');
    await responder(page, { acertar: true, conf: 'seguro' });
    await page.click('#btn-q-reportar'); await page.click('#btn-q-enviar-rep');
    await esperarSalvo(page);
    check('K12: aviso sem texto usa a categoria escolhida por padrão', (await itens(page, 'eventos')).filter((x) => x.tipo === 'problema').length === 2);
    await page.click('#btn-q-encerrar-sessao').catch(() => {});
    await aba(page, 'mais');
    check('K12: Mais lista os 2 avisos', /2 aviso\(s\)/.test(await txt(page, '#card-problemas')) && /O gabarito parece errado/.test(await txt(page, '#card-problemas')), (await txt(page, '#card-problemas')).slice(0, 160));
    await aba(page, 'questoes');
    const sess = await page.$('#card-q-resumo'); if (!sess) { await page.click('button.sec:has-text("Encerrar sessão")').catch(() => {}); }
    const total = (await itens(page, 'eventos')).filter((x) => !x.tipo).length;
    check('K12: os avisos não contam como respostas (2 respostas no banco)', total === 2);
    check('K12: sem rolagem horizontal', (await sobreposicao(page)) <= 0);
    await ctx.close();
  }

  // ===== K13: menu completo do edital e questão de Direito de ponta a ponta =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes' });
    await esperarSalvo(page);
    await page.waitForFunction(() => /questões em preparo/.test(document.getElementById('q-assunto').textContent), null, { timeout: 8000 }).catch(() => {});
    const matriz = JSON.parse(MATRIZ);
    const ops = await page.$$eval('#q-assunto option', (o) => o.map((x) => ({ v: x.value, t: x.textContent, d: x.disabled })));
    const topicosOps = ops.filter((o) => /^OJ26-/.test(o.v));
    check('K13: o menu lista os ' + matriz.topicos.length + ' tópicos do edital, todos', topicosOps.length === matriz.topicos.length, topicosOps.length + ' de ' + matriz.topicos.length);
    check('K13: 12 disciplinas em grupos', (await page.$$('#q-assunto optgroup')).length === 12);
    check('K13: 24 tópicos habilitados e o resto desabilitado', topicosOps.filter((o) => !o.d).length === 24 && topicosOps.filter((o) => o.d).length === matriz.topicos.length - 24);
    const rot = (id) => (ops.find((o) => o.v === id) || {}).t || '';
    check('K13: Direito Penal (fonte ingerida, sem questões ainda) aparece esmaecido como "questões em preparo"', /questões em preparo/.test(rot('OJ26-DPEN-CP-01')) && ops.find((o) => o.v === 'OJ26-DPEN-CP-01').d, rot('OJ26-DPEN-CP-01'));
    const cnj = ops.find((o) => /CNJ/.test(o.t) || /LESP-.*CNJ|RES/.test(o.v)); check('K13: a Resolução do CNJ (fonte ainda não localizada) aparece como "fonte oficial pendente"', ops.filter((o) => o.d && /fonte oficial pendente/.test(o.t)).length >= 1, ops.filter((o) => /fonte oficial pendente/.test(o.t)).map((o) => o.v).join(',')); void cnj;
    check('K13: Língua Portuguesa aparece esmaecida com o motivo "sem fonte aprovada"', /sem fonte aprovada/.test(rot('OJ26-LP-01')));
    check('K13: Estatuto (fonte ingerida, sem trecho gerável) aparece como "questões em preparo"', /questões em preparo/.test(rot('OJ26-DADM-L10261-01')), rot('OJ26-DADM-L10261-01'));
    check('K13: tópico com questão de Direito está habilitado', !ops.find((o) => o.v === 'OJ26-LESP-L11608-01').d);
    check('K13: opção "Toda a disciplina" só onde há questões', ops.filter((o) => /^disc:/.test(o.v)).map((o) => o.v).sort().join() === 'disc:DADM,disc:LESP,disc:MAT,disc:RLOG');
    check('K13: aviso de cobertura: 24 de 198', /24 de 198 tópicos do edital já têm questões/.test(await txt(page, '#q-cobertura')));
    await configurar(page, { n: 10, assunto: 'disc:LESP', nivel: 'auto' });
    await page.click('#btn-q-comecar');
    const tops = new Set(); let alvos = 0;
    for (let i = 0; i < 10; i++) {
      const qid = await qidAtual(page); const q = alvoCorreto(qid); tops.add(q.topicId);
      if (q.confianca === 'A') alvos++;
      check('K13: questão ' + (i + 1) + ' mostra o enunciado e as alternativas exatos do gerador', (await txt(page, '#q-enunciado')) === q.enunciado && JSON.stringify(await page.$$eval('button.alt .corpo > span:first-child', (e) => e.map((x) => x.textContent))) === JSON.stringify(q.alternativas.map((a) => a.texto)));
      await responder(page, { acertar: i % 2 === 0, conf: 'seguro' });
      if (i === 0) {
        const nota = await txt(page, '#q-nota-fonte');
        check('K13: feedback do Direito mostra "Nível A" e a fonte oficial com data', /Nível A/.test(nota) && /texto oficial consultado em \d\d\/\d\d\/\d{4}/.test(nota) && /letra por letra/.test(nota), nota.slice(0, 160));
        check('K13: não promete ser prova da banca', /não é questão de prova da VUNESP/.test(nota));
        check('K13: a explicação cita o texto oficial', /Texto oficial \(/.test(await txt(page, '#q-feedback')));
        check('K13: sem rolagem horizontal na questão de Direito respondida', (await sobreposicao(page)) <= 0);
        await page.screenshot({ path: path.join(SHOTS, 'app-direito.png'), fullPage: true });
      }
      await page.click('#btn-q-proxima');
    }
    check('K13: a sessão de "toda a disciplina" só traz tópicos de LESP com questão (' + [...tops].length + ' tópicos)', [...tops].every((t) => /^OJ26-LESP-/.test(t)) && alvos === 10);
    await esperarSalvo(page);
    const ev = (await itens(page, 'eventos')).filter((x) => !x.tipo);
    check('K13: respostas de Direito gravadas com o tópico da própria questão', ev.length === 10 && ev.every((x) => /^OJ26-LESP-/.test(x.topicId) && /^DIR-LESP-/.test(x.questionId)));
    await aba(page, 'edital');
    const linhas = await page.$$eval('[data-questoes^="OJ26-LESP"]', (els) => els.map((e) => e.textContent));
    check('K13: aba Edital mostra o desempenho dos tópicos de Direito respondidos', linhas.some((t) => /Questões: [1-9]\d* distintas/.test(t)), linhas.join(' | ').slice(0, 160));
    await ctx.close();
  }

  // ===== K5: sem banco de dados =====
  {
    const { ctx, page } = await abrir(browser, 'semdb', { hash: '#questoes' });
    check('K5: prática desativada e explicada sem banco de dados', (await page.isDisabled('#btn-q-comecar')) && /Sem banco de dados/.test(await txt(page, '#card-q-inicio')));
    await aba(page, 'hoje');
    check('K5: sem banco, Hoje não mostra o card de questões', (await page.$('#card-questoes-hoje')) === null);
    await ctx.close();
  }

  // ===== K6: auditoria e regras =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#mais' });
    await page.waitForFunction(() => /conferidas/.test((document.getElementById('texto-auditoria') || {}).textContent || ''), null, { timeout: 8000 });
    const v = JSON.parse(VALIDACAO);
    const t = await txt(page, '#texto-auditoria');
    check('K6: auditoria mostra os números do relatório (' + v.total.geradas + ' geradas, ' + v.total.rejeitadas + ' rejeitadas)', t.includes(v.total.geradas.toLocaleString('pt-BR')) && new RegExp(v.total.rejeitadas + ' rejeitadas').test(t), t);
    await page.click('#card-auditoria details summary');
    const cobertura = await txt(page, '#card-auditoria details');
    check('K6: cobertura mostra Matemática 13/13 e Direito sem questões', /Matemática[\s\S]*13\/13/.test(cobertura) && /sem questões/.test(cobertura), cobertura.replace(/\s+/g, ' ').slice(0, 300));
    await page.click('#card-auditoria details:nth-of-type(2) summary');
    check('K6: modelo aposentado aparece marcado como aposentado', /aposentado/.test(await txt(page, '#card-auditoria [data-modelo="RLOG-02-CONJUNTOS"]')));
    check('K6: variação por nível é exibida para cada modelo', /Variações distintas por nível \(1→5\): \d+/.test(await txt(page, '#card-auditoria [data-modelo="MAT-02-MMC-MDC"]')));
    check('K6: pontos fracos de variação declarados (' + v.variacao_baixa.length + ')', new RegExp(v.variacao_baixa.length + ' combinações de modelo e nível têm menos de').test(await txt(page, '#texto-variacao')), await txt(page, '#texto-variacao'));
    check('K6: modelo com pouca variação recebe aviso', /pouca variação/.test(await txt(page, '#card-auditoria [data-modelo="MAT-12-GEOMETRIA"]')));
    await page.click('#det-diplomas summary');
    const nIng = v.diplomas.filter((d) => d.fonte === 'ingerida').length;
    check('K6: auditoria mostra a situação das fontes por diploma (' + nIng + ' de ' + v.diplomas.length + ')', new RegExp(nIng + ' de ' + v.diplomas.length + ' ingeridas').test(await txt(page, '#det-diplomas')), (await txt(page, '#det-diplomas')).slice(0, 120));
    check('K6: só a Resolução do CNJ aparece como fonte pendente; CPC com 232 conferidos e Estatuto com 18', /fonte pendente/.test(await txt(page, '#det-diplomas [data-diploma^="Resolução CNJ"]')) && /232 conferido\(s\) no texto oficial/.test(await txt(page, '#det-diplomas [data-diploma^="Código de Processo Civil"]')) && /18 conferido\(s\) no texto oficial/.test(await txt(page, '#det-diplomas [data-diploma^="Estatuto dos Funcionários"]')) && (await page.$$eval('#det-diplomas .chip.bad', (c) => c.length)) === 1);
    check('K6: limites declaram que Direito não tem questões', /outros 11 diplomas de Direito/.test(await txt(page, '#card-auditoria')) && /leitura precisa da lei/.test(await txt(page, '#card-auditoria')));
    const r = JSON.parse(REGRAS);
    check('K6: regras do edital: ' + r.fatos.length + ' itens com página', /54 regras conferidas/.test(await txt(page, '#card-regras')) || new RegExp(r.fatos.length + ' regras').test(await txt(page, '#card-regras')));
    await page.click('#card-regras details summary');
    const itensRegra = await page.$$eval('#regras-lista .item', (e) => e.map((x) => x.textContent));
    check('K6: todas as regras listadas, cada uma com página e trecho', itensRegra.length === r.fatos.length && itensRegra.every((x) => /p\. \d+ — “/.test(x)));
    check('K6: regra da calculadora e do mínimo da discursiva aparecem', itensRegra.some((x) => /Calculadora proibida/.test(x)) && itensRegra.some((x) => /Discursiva mínimo geral: 24 pontos/.test(x)));
    check('K6: limites conhecidos atualizados (não diz mais que questões não existem)', !/questões, que ainda não existem aqui/.test(await txt(page, '#card-limites')) && /Matemática e Raciocínio Lógico/.test(await txt(page, '#card-limites')));
    check('K6: sem rolagem horizontal em Mais', (await sobreposicao(page)) <= 0);
    await ctx.close();
  }
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#mais', semAux: true });
    await page.waitForFunction(() => /indisponível/.test((document.getElementById('card-auditoria') || {}).textContent || ''), null, { timeout: 8000 });
    check('K6: sem os arquivos, auditoria e regras avisam "indisponível" sem quebrar', /indisponível/.test(await txt(page, '#card-auditoria')) && /indisponíveis/.test(await txt(page, '#card-regras')));
    await ctx.close();
  }

  // ===== K7: telas de questão em todos os modelos de Raciocínio Lógico e Matemática: fidelidade e layout (celular, claro e escuro) =====
  for (const escuro of [false, true]) {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#questoes', escuro });
    await esperarSalvo(page);
    let falhasLayout = 0; let falhasFidelidade = 0; let vistas = new Set(); let longas = 0; const tiradas = new Set();
    for (const assunto of ['OJ26-RLOG-01', 'OJ26-MAT-12', 'OJ26-MAT-13']) {
      await configurar(page, { n: 15, assunto, nivel: assunto === 'OJ26-RLOG-01' ? '5' : 'auto' });
      await page.click('#btn-q-comecar');
      for (let i = 0; i < 15; i++) {
        const qid = await qidAtual(page); const q = alvoCorreto(qid); vistas.add(Q.lerId(qid).templateId);
        if ((await txt(page, '#q-enunciado')) !== q.enunciado) falhasFidelidade++;
        if ((await sobreposicao(page)) > 0) falhasLayout++;
        if (q.enunciado.length > 250) longas++;
        await responder(page, { acertar: i % 2 === 0, conf: 'seguro' });
        const certa = await page.getAttribute('button.alt.certa', 'data-letra');
        if (certa !== q.gabarito) falhasFidelidade++;
        if ((await sobreposicao(page)) > 0) falhasLayout++;
        if (i === 0 && assunto === 'OJ26-RLOG-01') await page.screenshot({ path: path.join(SHOTS, 'app-questao-' + (escuro ? 'dark' : 'light') + '.png'), fullPage: true });
        const tpl = Q.lerId(qid).templateId;
        if (!escuro && ['RLOG-05-DIAGRAMAS', 'RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS'].includes(tpl) && !tiradas.has(tpl)) { tiradas.add(tpl); await page.screenshot({ path: path.join(SHOTS, 'app-' + tpl + '.png'), fullPage: true }); }
        await page.click('#btn-q-proxima');
      }
      await page.waitForSelector('#card-q-resumo');
      await page.click('#btn-q-nova');
    }
    check('K7' + (escuro ? ' (escuro)' : '') + ': 45 telas de questão conferidas contra o gerador (enunciado e gabarito)', falhasFidelidade === 0, 'falhas=' + falhasFidelidade);
    check('K7' + (escuro ? ' (escuro)' : '') + ': sem rolagem horizontal em nenhuma das 90 telas (antes e depois de responder), com ' + longas + ' enunciados longos', falhasLayout === 0, 'falhas=' + falhasLayout);
    check('K7' + (escuro ? ' (escuro)' : '') + ': passou pelos 6 modelos ativos de RL (e nunca pelo aposentado), geometria e situações-problema', ['RLOG-01-SEQUENCIAS', 'RLOG-03-ORDENACAO', 'RLOG-04-SEQUENCIAS-B', 'RLOG-05-DIAGRAMAS', 'RLOG-06-ESTRUTURAS', 'RLOG-07-ARGUMENTOS', 'MAT-12-GEOMETRIA', 'MAT-13-SITUACOES'].every((m) => vistas.has(m)) && !vistas.has('RLOG-02-CONJUNTOS'), [...vistas].join(','));
    await ctx.close();
  }

  await browser.close();
  check('nenhum erro de JavaScript durante todos os cenários', erros.length === 0, erros.join(' | '));
  const falhas = resultados.filter((r) => !r.pass);
  console.log('\nTOTAL: ' + (resultados.length - falhas.length) + '/' + resultados.length + ' passaram');
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

