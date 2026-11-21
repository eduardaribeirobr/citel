'use strict';
// Teste de ponta a ponta do app (dist/app) no Chromium, com viewport de celular.
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
    return r.abort();
  });
  await page.addInitScript(mockInit, { cenario, uid: UID });
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

(async () => {
  const browser = await chromium.launch();

  // ===== A. Primeira abertura =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    await esperarSalvo(page);
    check('A: título da página', (await page.title()) === 'Preparo TJSP');
    check('A: Hoje mostra 0 / 60 min', /0\s*\/ 60 min/.test(await txt(page, '#card-hoje')), await txt(page, '#card-hoje'));
    const itensPlano = await page.$$eval('#card-plano .item[data-tipo="estudo"]', (els) => els.map((e) => [e.dataset.topico, e.querySelector('.mono').textContent]));
    check('A: plano de partida = CPC 40 min + Português 20 min', JSON.stringify(itensPlano) === JSON.stringify([['OJ26-DPCI-CPC-01', '40 min'], ['OJ26-LP-01', '20 min']]), JSON.stringify(itensPlano));
    check('A: card "Comece por aqui" aparece', (await page.$('#btn-confirmar-padrao')) !== null);
    await page.click('#btn-confirmar-padrao');
    await esperarSalvo(page);
    check('A: card some após confirmar', (await page.$('#btn-confirmar-padrao')) === null);
    const cfg = (await dbDoc(page))['data/users/' + UID + '/config'];
    check('A: configuração gravada no espaço privado', cfg && cfg.disponivelMinDia === 60 && cfg.diasPorSemana === 6 && cfg.reservaFinalDias === 14, JSON.stringify(cfg));
    await ctx.close();
  }

  // ===== B, C, F, G, J, M: uso normal com persistência =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    await esperarSalvo(page);
    // B. registrar 30 min
    await page.fill('#min-manual', '30');
    await page.click('#btn-registrar');
    check('B: registrar 30 min atualiza o placar', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '30');
    await esperarSalvo(page);
    const somaPlano = await page.$$eval('#card-plano .item .mono', (els) => els.reduce((s, e) => s + parseInt(e.textContent, 10), 0));
    check('B: plano passa a caber nos 30 min restantes', somaPlano <= 30, 'soma=' + somaPlano);
    check('B: sessão gravada no banco', (await itens(page, 'sessoes')).length === 1 && (await itens(page, 'sessoes'))[0].min === 30);
    await page.reload(); await esperarPronto(page);
    check('B: após recarregar, os 30 min continuam', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '30');
    // validação de entrada
    await page.fill('#min-manual', '0'); await page.click('#btn-registrar');
    check('B: 0 minutos é recusado', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '30' && /entre 1 e 480/.test(await txt(page, '#toast')));
    await page.fill('#min-manual', '999'); await page.click('#btn-registrar');
    check('B: 999 minutos é recusado', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '30');

    // C. marcar estudado no Edital
    await aba(page, 'edital');
    check('C: Edital lista as 12 disciplinas', (await page.$$('details.disc')).length === 12);
    await page.fill('#busca', 'OJ26-DPCI-CPC-01');
    await page.waitForSelector('[data-topico="OJ26-DPCI-CPC-01"]');
    check('C: busca filtra para 1 tópico', (await page.$$('.topico')).length === 1);
    await page.click('[data-topico="OJ26-DPCI-CPC-01"] button[data-acao="estudado"]');
    await esperarSalvo(page);
    check('C: botão passa a "Estudado ✓"', /Estudado ✓/.test(await txt(page, '[data-topico="OJ26-DPCI-CPC-01"] button[data-acao="estudado"]')));
    check('C: marcação gravada no banco', (await itens(page, 'marcacoes')).some((m) => m.topicId === 'OJ26-DPCI-CPC-01' && m.estudado === true));
    await page.fill('#busca', '');
    await page.selectOption('#filtro-estado', 'estudado');
    check('C: filtro "Estudados" mostra só o marcado', (await page.$$('.topico')).length === 1);
    await page.selectOption('#filtro-estado', 'todos');
    await page.fill('#busca', 'zzzz-nada');
    check('C: busca sem resultado mostra aviso', /Nenhum tópico/.test(await txt(page, '#lista-edital')));
    await page.fill('#busca', '');
    await aba(page, 'painel');
    check('C: Painel mostra 1 / 198 tópicos estudados', /1 \/ 198/.test(await txt(page, 'main')));
    await aba(page, 'hoje');
    const aposMarcar = await page.$$eval('#card-plano .item[data-tipo="estudo"]', (els) => els.map((e) => e.dataset.topico));
    check('C: tópico estudado deixa de ser sugerido', !aposMarcar.includes('OJ26-DPCI-CPC-01'), JSON.stringify(aposMarcar));

    // M. cronômetro: inicia, avança 7 min no relógio, para e registra
    await page.selectOption('#sel-topico', 'OJ26-LP-02');
    await page.click('#btn-iniciar');
    check('M: cronômetro aparece', (await page.$('#timer-display')) !== null);
    await deslocar(page, 7 * 60000 + 1000);
    await page.reload(); await esperarPronto(page);
    check('M: cronômetro sobrevive ao recarregar e mostra ~07:0x', /^07:\d\d$/.test(await txt(page, '#timer-display')), await txt(page, '#timer-display'));
    await page.click('#btn-parar');
    check('M: confirmação traz 7 minutos', (await page.inputValue('#min-parar')) === '7');
    await page.fill('#min-parar', '8');
    await page.click('#btn-salvar-sessao');
    await esperarSalvo(page);
    const sess = await itens(page, 'sessoes');
    check('M: sessão do cronômetro gravada com o tópico e os minutos corrigidos', sess.some((s) => s.min === 8 && s.topicId === 'OJ26-LP-02'));
    await deslocar(page, 0);

    // F. desfazer
    await aba(page, 'mais');
    const antes = (await page.$$('#card-historico .item')).length;
    await page.click('#card-historico .item:has-text("30 min") button');
    await esperarSalvo(page);
    check('F: desfazer cria um cancelamento (o histórico só cresce)', (await itens(page, 'cancelamentos')).length === 1);
    check('F: a sessão cancelada sai da lista e do total de hoje', (await page.$$('#card-historico .item')).length === antes - 1);
    await aba(page, 'hoje');
    check('F: placar de hoje volta para 8 min', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '8');
    check('F: o registro original continua no banco (nada foi apagado)', (await itens(page, 'sessoes')).some((s) => s.min === 30));

    // J. isolamento
    const tocados = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__paths') || '[]'));
    check('J: tudo o que o app leu ou escreveu está em data/users/<uid>/', tocados.length > 5 && tocados.every((p) => p.startsWith('data/users/' + 'u_TESTE0000000000000000A' + '/') || p === 'data/users/u_TESTE0000000000000000A'), tocados.filter((p) => !p.startsWith('data/users/u_TESTE0000000000000000A')).join(','));

    // verificação de gravação
    await aba(page, 'mais');
    await page.click('#btn-verificar');
    await page.waitForFunction(() => /funcionaram|Falhou/.test(document.getElementById('texto-verificacao').textContent));
    check('Mais: "Testar gravação" funciona', /funcionaram/.test(await txt(page, '#texto-verificacao')), await txt(page, '#texto-verificacao'));

    // G. exportar e conferir o arquivo por fora
    await page.click('#btn-exportar');
    await page.waitForFunction(() => sessionStorage.getItem('__saved'));
    const salvo = JSON.parse(await page.evaluate(() => sessionStorage.getItem('__saved')));
    check('G: nome do arquivo de backup', /^preparo-tjsp-\d{4}-\d{2}-\d{2}\.json$/.test(salvo.filename), salvo.filename);
    const v = await Backup.verificarBackup(salvo.data);
    check('G: backup exportado é íntegro (SHA-256) e traz sessões, marcações e cancelamento', v.ok && v.backup.contagens.sessoes === 2 && v.backup.contagens.marcacoes === 1 && v.backup.contagens.cancelamentos === 1, v.motivo || JSON.stringify(v.backup && v.backup.contagens));
    fs.writeFileSync(path.join(SHOTS, 'backup-teste.json'), salvo.data);
    await page.screenshot({ path: path.join(SHOTS, 'app-mais-light.png'), fullPage: true });
    check('layout 390px sem rolagem horizontal: Mais', (await sobreposicao(page)) <= 0);
    for (const nome of ['hoje', 'painel', 'edital']) {
      await aba(page, nome);
      check('layout 390px sem rolagem horizontal: ' + nome, (await sobreposicao(page)) <= 0, 'excesso=' + (await sobreposicao(page)));
      await page.screenshot({ path: path.join(SHOTS, 'app-' + nome + '-light.png'), fullPage: true });
    }
    await ctx.close();
  }

  // ===== G2. importar em um aparelho/conta "novo" =====
  {
    const salvo = fs.readFileSync(path.join(SHOTS, 'backup-teste.json'), 'utf8');
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#mais' });
    await esperarSalvo(page);
    const importar = async (conteudo) => {
      await page.evaluate(() => { const x = document.getElementById('painel-importacao'); if (x) x.remove(); });
      await page.setInputFiles('#arquivo-backup', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(conteudo) });
      await page.waitForSelector('#painel-importacao');
      return txt(page, '#painel-importacao');
    };
    check('G2: arquivo adulterado é recusado', /Backup recusado/.test(await importar(salvo.replace('"min": 30', '"min": 31'))) );
    check('G2: arquivo cortado é recusado', /JSON válido/.test(await importar(salvo.slice(0, 400))));
    const t1 = await importar(salvo);
    check('G2: backup íntegro em histórico vazio é aceito ("atual vazio")', /Backup íntegro: atual vazio/.test(t1), t1);
    await page.click('#btn-confirmar-importacao');
    await esperarSalvo(page);
    check('G2: dados importados foram gravados no banco novo', (await itens(page, 'sessoes')).length === 2 && (await itens(page, 'marcacoes')).length === 1);
    await aba(page, 'hoje');
    check('G2: Hoje mostra os 8 minutos de hoje importados', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '8');
    await aba(page, 'painel');
    check('G2: Painel mostra o tópico estudado importado', /1 \/ 198/.test(await txt(page, 'main')));
    await aba(page, 'mais');
    const t2 = await importar(salvo);
    check('G2: importar de novo não traz nada ("nada novo") e o botão fica desabilitado', /nada novo/.test(t2) && (await page.isDisabled('#btn-confirmar-importacao')), t2);
    check('G2: nada foi duplicado', (await itens(page, 'sessoes')).length === 2);
    await ctx.close();
  }

  // ===== D. revisões: o tempo passa =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    await esperarSalvo(page);
    await aba(page, 'edital');
    await page.fill('#busca', 'OJ26-LP-03');
    await page.click('[data-topico="OJ26-LP-03"] button[data-acao="estudado"]');
    await esperarSalvo(page);
    await aba(page, 'hoje');
    check('D: no mesmo dia não há revisão', (await page.$$('#card-plano .item[data-tipo="revisao"]')).length === 0);
    await deslocar(page, 26 * 3600000);
    await page.reload(); await esperarPronto(page);
    const revs = await page.$$eval('#card-plano .item[data-tipo="revisao"]', (els) => els.map((e) => e.textContent));
    check('D: um dia depois aparece a revisão de 1 dia', revs.length === 1 && /Revisão 1 dia/.test(revs[0]) && /Ponto de vista do autor/.test(revs[0]), revs.join('|').slice(0, 120));
    await page.click('#card-plano .item[data-tipo="revisao"] button');
    await esperarSalvo(page);
    check('D: revisão feita some do plano', (await page.$$('#card-plano .item[data-tipo="revisao"]')).length === 0);
    check('D: revisão gravada no banco', (await itens(page, 'revisoes')).some((r) => r.topicId === 'OJ26-LP-03' && r.etapa === 1));
    await page.reload(); await esperarPronto(page);
    check('D: após recarregar a revisão continua feita', (await page.$$('#card-plano .item[data-tipo="revisao"]')).length === 0);
    await deslocar(page, 8 * 86400000);
    await page.reload(); await esperarPronto(page);
    const r8 = await page.$$eval('#card-plano .item[data-tipo="revisao"]', (els) => els.map((e) => e.textContent));
    check('D: 8 dias depois vence a revisão de 7 dias', r8.length === 1 && /Revisão 7 dias/.test(r8[0]), r8.join('|').slice(0, 80));
    await aba(page, 'painel');
    check('D: Painel informa a revisão vencida', /1 revisão\(ões\) vencida\(s\)/.test(await txt(page, '#card-revisoes')), await txt(page, '#card-revisoes'));
    await ctx.close();
  }

  // ===== E. falhas de conexão =====
  {
    const { ctx, page } = await abrir(browser, 'ok');
    await esperarSalvo(page);
    await page.evaluate(() => sessionStorage.setItem('__offline', '1'));
    await page.fill('#min-manual', '20');
    await page.click('#btn-registrar');
    check('E: com a rede fora, o minuto aparece mesmo assim', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '20');
    await esperarEstado(page, 'erro');
    check('E: o status avisa que não salvou e que vai tentar de novo', /Sem conexão, tentando de novo \(1\)/.test(await txt(page, '#status')), await txt(page, '#status'));
    check('E: nada chegou ao banco ainda', (await itens(page, 'sessoes')).length === 0);
    // recarregar ainda sem rede: não consegue carregar, não apaga nada e oferece "tentar de novo"
    await page.reload();
    await page.waitForSelector('#btn-tentar', { timeout: 30000 });
    check('E: sem rede ao abrir, mostra erro claro e botão de tentar de novo', /Não foi possível carregar/.test(await txt(page, 'main')));
    await page.evaluate(() => sessionStorage.removeItem('__offline'));
    await page.click('#btn-tentar');
    await esperarPronto(page);
    await esperarSalvo(page);
    check('E: a rede volta: a sessão pendente é recuperada da cópia local e enviada', (await itens(page, 'sessoes')).length === 1 && (await itens(page, 'sessoes'))[0].min === 20);
    check('E: e aparece no placar de hoje', (await page.getAttribute('#minutos-hoje', 'data-minutos')) === '20');
    // queda sem recarregar: a nova tentativa automática conclui
    await page.evaluate(() => sessionStorage.setItem('__offline', '1'));
    await page.fill('#min-manual', '10'); await page.click('#btn-registrar');
    await esperarEstado(page, 'erro');
    await page.evaluate(() => sessionStorage.removeItem('__offline'));
    await esperarSalvo(page);
    check('E: nova tentativa automática salva sem o usuário fazer nada', (await itens(page, 'sessoes')).length === 2);
    check('E: sem duplicar', new Set((await itens(page, 'sessoes')).map((s) => s.id)).size === 2);
    await ctx.close();
  }

  // ===== I. sem banco de dados =====
  {
    const { ctx, page } = await abrir(browser, 'semdb');
    check('I: aviso de falta de banco de dados', (await page.$('#aviso-sem-banco')) !== null && /Sem banco de dados/.test(await txt(page, '#status')));
    await aba(page, 'edital');
    check('I: o edital continua consultável', (await page.$$('details.disc')).length === 12);
    await page.click('details.disc summary');
    await page.click('details.disc .topico button[data-acao="estudado"]');
    check('I: tentar marcar sem banco explica por que não salva', /Sem banco de dados/.test(await txt(page, '#toast')));
    await aba(page, 'mais');
    check('I: exportar fica desabilitado', await page.isDisabled('#btn-exportar'));
    await ctx.close();
  }

  // ===== H. tema escuro e acessibilidade básica =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { escuro: true });
    await esperarSalvo(page);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('H: tema escuro aplica fundo escuro', bg === 'rgb(15, 21, 17)', bg);
    for (const nome of ['hoje', 'painel', 'edital', 'mais']) {
      await aba(page, nome);
      check('H: escuro, sem rolagem horizontal: ' + nome, (await sobreposicao(page)) <= 0);
    }
    await aba(page, 'painel');
    await page.screenshot({ path: path.join(SHOTS, 'app-painel-dark.png'), fullPage: true });
    check('H: aba atual tem aria-current', (await page.getAttribute('nav.abas a[aria-current="page"]', 'data-aba')) === 'painel');
    check('H: gráfico tem descrição para leitor de tela', /Minutos por dia nos últimos 14 dias/.test(await page.getAttribute('.chart', 'aria-label')));
    // o gráfico respeita a escala: a linha da meta fica em meta/máximo
    const g = await page.evaluate(() => ({ meta: Number(document.querySelector('.metalinha').dataset.meta), bottom: document.querySelector('.metalinha').style.bottom, colunas: document.querySelectorAll('.chart .area .col i').length }));
    check('H: gráfico com 14 barras e linha da meta em 100% quando não há estudo', g.colunas === 14 && g.bottom === '100%' && g.meta === 60, JSON.stringify(g));
    await ctx.close();
  }

  // ===== N. painel com dados: números coerentes com o motor =====
  {
    const { ctx, page } = await abrir(browser, 'ok', { hash: '#painel' });
    await esperarSalvo(page);
    const t = await txt(page, '#card-meta');
    const matriz = JSON.parse(MATRIZ);
    const esperado = Progresso.calcularProgresso({ topicos: matriz.topicos.map((x) => ({ id: x.id, esforcoMin: x.esforco_min })), eventos: [], sessoes: [], estudados: [], agora: Date.now(), dataProva: Date.UTC(2027, 2, 14, 17, 0, 0), revisoesVencidas: 0 },
      { disponivelMinDia: 60, diasPorSemana: 6, reservaFinalDias: 14, pesosEtapas: { estudo: 0.40, exercicio: 0.25, desempenho: 0.20, retencao: 0.15 } });
    const min = Math.round(esperado.meta.necessarioMinDia);
    const fmt = min >= 60 ? Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0') : min + ' min';
    check('N: Painel sem estudo mostra o necessário por dia calculado pelo motor (' + fmt + ') e a situação "acima da capacidade"', /acima da capacidade/.test(t) && t.includes(fmt), t.replace(/\s+/g, ' ').slice(0, 220));
    check('N: avisa que a carga é estimativa inicial', /estimativa inicial/.test(t));
    await ctx.close();
  }

  await browser.close();
  check('nenhum erro de JavaScript durante todos os cenários', erros.length === 0, erros.join(' | '));
  const falhas = resultados.filter((r) => !r.pass);
  console.log('\nTOTAL: ' + (resultados.length - falhas.length) + '/' + resultados.length + ' passaram');
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
