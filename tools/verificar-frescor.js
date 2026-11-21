'use strict';
/*
 * Confere, para cada norma federal guardada, se o Senado registra alterações que podem NÃO estar no texto guardado, até a data-limite
 * do edital (publicação do edital: legislação com as alterações vigentes até essa data, edital p. 60):
 *   (a) normas alteradoras publicadas depois da data do texto guardado;
 *   (b) normas publicadas antes, mas com vigência diferida ("entra em vigor após decorrido 1 ano...") que só valeu depois da data do
 *       texto, ou cuja cláusula de vigência não foi entendida (então é tratada como duvidosa).
 * Para (b) lê a cláusula "Esta Lei entra em vigor..." do texto oficial de cada lei alteradora que atinja artigos CITADOS no edital.
 * Fonte: API pública do Senado (legis.senado.leg.br/dadosabertos e normas.leg.br). Cliente honesto, sem disfarce.
 * Resultado: data/fontes/alteracoes-posteriores.json. Os artigos listados são tratados como DUVIDOSOS (não geram questão) até o texto
 * ser atualizado e reingerido. Uso: node tools/verificar-frescor.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const S = require('../src/fontes-senado.js');
const { dataDoTexto } = require('../src/fontes.js');

const RAIZ = path.join(__dirname, '..');
const LIMITE = '2026-10-14';
const JANELA_ANOS = 5;                              // cláusula de vigência lida só para leis publicadas até 5 anos antes da data do texto (premissa declarada no arquivo gerado)                       // data da publicação do edital (a mesma de referencia_vigencia no índice)
const idx = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/indice.json'), 'utf8'));
const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/mapa-diplomas.json'), 'utf8'));
const matriz = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/matriz-edital.json'), 'utf8'));
const revisoes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/fontes/revisoes-frescor.json'), 'utf8'));
const CACHE = path.join(os.tmpdir(), 'frescor-leis'); fs.mkdirSync(CACHE, { recursive: true });

// artigos citados pelo edital, por fonte (lei integral = todos)
const citados = {};
for (const t of matriz.topicos) if (t.diploma && mapa[t.diploma.nome]) {
  const o = citados[mapa[t.diploma.nome]] = citados[mapa[t.diploma.nome]] || { integral: false, faixas: [] };
  if (!t.dispositivos || !t.dispositivos.length) o.integral = true;
  for (const d of t.dispositivos || []) o.faixas.push([parseInt(String(d.de).replace(/\D/g, ''), 10), parseInt(String(d.ate || d.de).replace(/\D/g, ''), 10)]);
}
const citadoEm = (fid) => (chave) => { const o = citados[fid]; if (!o) return false; if (o.integral) return true; const n = parseInt(chave, 10); return o.faixas.some(([a, b]) => n >= a && n <= b); };

const curl = (url, saida) => new Promise((resolve) => execFile('curl', ['-sS', '-L', '-m', '120', '--fail', '-H', 'Accept: application/json', '-o', saida, url], (e) => resolve(!e)));
async function buscar(url, arq) { if (fs.existsSync(arq) && fs.statSync(arq).size > 50) return true; for (let i = 0; i < 3; i++) if (await curl(url, arq)) return true; return false; }
async function emLotes(itens, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < itens.length) { const k = i++; out[k] = await fn(itens[k], k); } })); return out; }

async function vigenciaDe(nome, publicacao) {
  const urn = S.urnDaNorma(nome);
  if (!urn) return { classe: 'imediata', inicio_min: publicacao, inicio_max: publicacao, clausula: null, observacao: 'decisão judicial ou ato sem urn: efeito na publicação' };
  const arq = path.join(CACHE, urn.replace(/[^\w.;-]/g, '_') + '.json');
  const ok = await buscar('https://normas.leg.br/api/public/normas?urn=' + urn + '&&tipo_documento=maior-detalhe', arq);
  if (!ok) return { classe: 'desconhecida', inicio_min: null, inicio_max: null, clausula: null, observacao: 'texto da norma alteradora não obtido' };
  const j = JSON.parse(fs.readFileSync(arq, 'utf8')); const r = Array.isArray(j) ? j[0] : j;
  return S.classificarVigencia(S.textosDaNorma(r), publicacao);
}

(async () => {
  const saida = { gerado_em: new Date().toISOString().slice(0, 10), limite: LIMITE, premissa: 'Para normas alteradoras publicadas mais de ' + JANELA_ANOS + ' anos antes da data do texto guardado, considera-se que a vacatio já transcorreu (a cláusula de vigência não foi lida). Para as demais, a cláusula foi lida no texto oficial da lei.', fonte_api: 'https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn=<urn>', fontes: {} };
  for (const [id, meta] of Object.entries(idx)) {
    if (!/^senado-/.test(id)) continue;
    const arq = path.join(CACHE, 'detalhe-' + id + '.json');
    if (!(await buscar('https://legis.senado.leg.br/dadosabertos/legislacao/urn?urn=' + meta.urn, arq))) throw new Error('detalhe não obtido: ' + id);
    const detalhe = JSON.parse(fs.readFileSync(arq, 'utf8')); const dt = dataDoTexto(meta); const cit = citadoEm(id);
    // normas anteriores à data do texto que atingem artigos citados: lê a cláusula de vigência de cada uma
    const vigencia = {}; const analisadas = {};
    if (dt < LIMITE) {
      const doc = detalhe.DetalheDocumento.documentos.documento; const d = Array.isArray(doc) ? doc[0] : doc;
      let vides = (d.vides && d.vides.vide) || []; if (!Array.isArray(vides)) vides = [vides];
      const alvo = [];
      for (const v of vides) {
        const pub = S.dataIso(v.datapub) || S.dataIso(v.datAssinatura); if (!pub || pub > dt || pub < S.somaMeses(dt, -12 * JANELA_ANOS) || alvo.some((x) => x.nome === v.nomeNormaPosterior)) continue;
        let it = (v.itens && v.itens.item) || []; if (!Array.isArray(it)) it = [it];
        if (it.some((i) => { const k = S.chaveDe(String(i.dispositivo || '').trim()); return k && cit(k) && !/^(?:Regulamentado|Dispositivo Correlato)$/i.test(i.comentario || ''); })) alvo.push({ nome: v.nomeNormaPosterior, pub });
      }
      await emLotes(alvo, 6, async (a) => { vigencia[a.nome] = await vigenciaDe(a.nome, a.pub); });
      for (const a of alvo) analisadas[a.nome] = { publicacao: a.pub, classe: vigencia[a.nome].classe, inicio_min: vigencia[a.nome].inicio_min, inicio_max: vigencia[a.nome].inicio_max, clausula: vigencia[a.nome].clausula, observacao: vigencia[a.nome].observacao || undefined };
    }
    const r = S.alteracoesPosteriores(detalhe, dt, LIMITE, vigencia, cit);
    const aplicadas = S.aplicarRevisoes(r, revisoes[id] || []);
    saida.fontes[id] = Object.assign({ nome: meta.nome, data_texto: dt }, r, { leis_com_vigencia_lida: Object.keys(analisadas).length, analise_vigencia: analisadas }, aplicadas.length ? { revisados: aplicadas } : {});
    console.log(id.padEnd(22), 'texto de', dt, '| leis lidas:', String(Object.keys(analisadas).length).padStart(3), '| alterações a tratar:', r.normas.length, r.artigos.length ? '| artigos: ' + r.artigos.join(', ').slice(0, 160) : '');
  }
  fs.writeFileSync(path.join(RAIZ, 'data/fontes/alteracoes-posteriores.json'), JSON.stringify(saida, null, 1) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
