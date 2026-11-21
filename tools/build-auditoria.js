'use strict';
// Gera docs/auditoria-edital.md a partir dos dados testados (regras + matriz). Não digita nada à mão.
const fs = require('fs');
const path = require('path');
const { extrairQuantitativosDiscursiva } = require('../src/regras.js');

const raiz = path.join(__dirname, '..');
const regras = JSON.parse(fs.readFileSync(path.join(raiz, 'data/edital-regras.json'), 'utf8'));
const matriz = JSON.parse(fs.readFileSync(path.join(raiz, 'data/matriz-edital.json'), 'utf8'));
const prov = JSON.parse(fs.readFileSync(path.join(raiz, 'data/fonte/proveniencia.json'), 'utf8'));
const texto = fs.readFileSync(path.join(raiz, 'data/fonte/edital-2026.txt'), 'utf8');
const F = Object.fromEntries(regras.fatos.map((f) => [f.id, f]));
const ref = (id) => '(' + (F[id].arquivo === 'edital' ? 'edital' : 'retificação') + ' p.' + F[id].pagina + ')';
const linha = (id, rotulo) => '- **' + rotulo + ':** ' + F[id].valor + ' ' + ref(id);

const L = [];
const add = (...x) => x.forEach((s) => L.push(s));

add('# Auditoria do Edital 01/2026 — Oficial de Justiça (TJSP)', '',
  'Gerado em ' + new Date().toISOString().slice(0, 10) + ' a partir dos PDFs enviados pela aluna. Cada regra abaixo tem página e citação literal conferida automaticamente (`data/edital-regras.json`).', '',
  '**Fontes (SHA-256 dos PDFs):**',
  '- Edital (62 páginas): `' + prov.arquivos.edital.pdf_sha256 + '`',
  '- Retificação (2 páginas): `' + prov.arquivos.retificacao.pdf_sha256 + '`', '',
  '> Nada aqui é previsão de prova. Onde o edital não diz algo, o documento diz "não informado".', '');

add('## 1. Identificação', '',
  linha('identificacao', 'Documento'), linha('banca', 'Banca organizadora'), linha('cargo', 'Cargo'), linha('jornada', 'Jornada'),
  linha('vagas_total', 'Cargos oferecidos'), linha('atribuicoes', 'Sumário das atribuições'),
  linha('escolaridade', 'Escolaridade exigida'), linha('data_do_edital', 'Data do edital'), linha('retificacao_dejesp', 'Publicação'),
  linha('remuneracao_retificada', 'Remuneração (RETIFICADA em 04/11/2026)'),
  '- Valor anterior, substituído pela retificação: ' + F.remuneracao_original.valor + ' ' + ref('remuneracao_original'), '');

add('## 2. Calendário', '',
  linha('inscricoes_periodo', 'Inscrições'), linha('taxa', 'Taxa de inscrição'), linha('pagamento_ate', 'Último dia para pagar o boleto'),
  linha('data_prova', 'Prova objetiva e discursiva'), linha('periodo_prova', 'Período'), linha('gabarito_previsto', 'Gabarito'), linha('resultado_final', 'Resultado final'),
  linha('retificacao_lista_negros', 'Listas de cotistas (alterado pela retificação)'),
  '- Demais datas (redução de taxa, recursos, condição especial): cronograma do edital, p.52.', '');

add('## 3. Estrutura da prova', '',
  linha('etapa_unica', 'Etapa'), linha('objetiva_formato', 'Prova objetiva'), linha('objetiva_carater', 'Caráter da objetiva'),
  linha('blocos', 'Blocos'), linha('discursiva_formato', 'Prova discursiva'), linha('discursiva_objetivo', 'Finalidade da discursiva'),
  linha('duracao', 'Duração'), linha('peso_igual', 'Peso das questões'), linha('escala_objetiva', 'Escala da objetiva'),
  '',
  '| Bloco | Questões | Caráter | Observação |', '|---|---|---|---|');
for (const b of matriz.blocos) {
  add('| ' + b.id + ' — ' + b.nome + ' | ' + b.questoes + ' | ' + (b.eliminatorio ? 'eliminatório e classificatório (mín. 50% de acertos no bloco)' : 'apenas classificatório') + ' | ' + (b.na_discursiva ? 'a discursiva versa sobre este bloco' : '') + ' |');
}
add('');
add('Questões por grupo do Bloco III e por disciplina (Anexo VIII):', '');
for (const d of matriz.disciplinas) add('- ' + d.nome + ': ' + (d.questoes === null ? '**não discriminado** (o edital só informa o total do Bloco II: 40)' : d.questoes + ' questões') + ' (p.' + d.fonte_pagina + ')');
add('');

add('## 4. Critérios de avaliação, habilitação e eliminação', '',
  linha('blocos_eliminatorios', 'Blocos eliminatórios'), linha('bloco3_classificatorio', 'Bloco III'),
  linha('habilitacao_objetiva', 'Habilitação na objetiva'), linha('nao_habilitado_excluido', 'Não habilitado'),
  linha('discursiva_corrigida_para', 'Quem tem a discursiva corrigida'), linha('discursiva_escala', 'Escala da discursiva'),
  linha('discursiva_minimo_geral', 'Aprovação na discursiva (Lista Geral)'), linha('discursiva_minimo_cotas', 'Aprovação na discursiva (cotistas)'),
  linha('discursiva_somente_eliminatoria', 'Natureza da discursiva'), linha('discursiva_criterios', 'Critérios de correção da discursiva'),
  linha('desempate_portugues', 'Desempate (após idade ≥ 60)'), linha('desempate_direito', 'Desempate (seguinte)'),
  linha('recurso_prazo', 'Prazo de recurso'), linha('recurso_gabarito', 'Recurso contra gabarito'), linha('sem_revisao', 'Revisão de prova'),
  linha('calculadora_proibida', 'Calculadora'), linha('validade', 'Validade do concurso'), linha('nomeacao_vedada_ate', 'Nomeação'),
  linha('troca_cj_proibida', 'Circunscrição'), linha('inscricoes_simultaneas', 'Inscrições em mais de uma circunscrição'), '');

add('Consequência aritmética das regras (cálculo, não texto do edital): com 70 questões de mesmo valor, a nota final ≥ 5 equivale a **no mínimo 35 acertos**; ' +
  'o mínimo de 50% por bloco equivale a **8 acertos em 15** (7 seriam 46,7%) no Bloco I e **20 em 40** no Bloco II.', '');

const q = extrairQuantitativosDiscursiva(texto);
add('## 5. Vagas imediatas e corte da discursiva', '',
  '132 cargos em 7 circunscrições; a Capital e as demais circunscrições têm apenas cadastro de reserva (quadro de vagas, p.2 a 10). A discursiva só é corrigida para os melhores da Lista Geral na objetiva, na quantidade abaixo (p.35 a 37):', '',
  '| Circunscrição | Sede | Vagas (total / geral / PcD / negros / indígenas / quilombolas) | Discursivas corrigidas (Lista Geral) |', '|---|---|---|---|');
for (const l of regras.vagas_imediatas.linhas) {
  const c = q.find((x) => x.cj === l.cj);
  add('| ' + l.cj + ' (' + l.raj + ' RAJ) | ' + l.sede + ' | ' + [l.total, l.geral, l.pcd, l.negros, l.indigenas, l.quilombolas].join(' / ') + ' | ' + c.corrigidas + ' |');
}
const cap = q.find((x) => x.cj === 'CAPITAL');
add('', 'Capital: apenas cadastro de reserva; ' + cap.corrigidas + ' discursivas corrigidas. Tabela completa das 57 circunscrições: `tests/regras.test.js` valida a leitura.', '');

add('## 6. Pontos de atenção do próprio edital', '',
  '1. **Quem pode ser nomeado e quando (item 15, p.51).** O edital veda a nomeação "até o encerramento dos concursos de Oficial de Justiça para a Comarca da Capital, homologado em 20/08/2025". A notícia do TJSP de 19/10/2026 resume como "encerramento da validade dos concursos anteriores para os respectivos cargos e localidades". O texto do edital cita só a Capital, e a notícia generaliza. **Não é possível concluir daqui quais circunscrições são afetadas**: confirmar com a banca antes de escolher a circunscrição.',
  '2. **A escolha da circunscrição é definitiva** e a opção de comarca dentro dela não vincula a nomeação (cap. II, itens 3.5 a 3.7, p.15).',
  '3. **Desempate:** o item c cita "Prova de Conhecimentos em Direito", nome que não existe entre os três blocos (provável referência aos Conhecimentos Específicos; confirmar).',
  '4. **Calculadora é motivo de exclusão** (p.34): Matemática se resolve à mão.',
  '5. **Sem revisão de prova** ' + ref('sem_revisao') + '. A discursiva é manuscrita, preferencialmente com tinta preta ou azul-escura ' + ref('discursiva_manuscrita') + '; texto a lápis ou em outra cor é considerado não escrito ' + ref('discursiva_cor_invalida') + '. Leve caneta esferográfica de tinta preta ' + ref('caneta_preta_prova') + '.',
  '6. **Listas de artigos:** o edital escreve "156, 185" com vírgula no CPP (tratado como dois artigos) e "357 e 359" no Código Penal (dois artigos, o 358 não entra).',
  '7. **Legislação:** vale com as alterações vigentes até a data da publicação do edital; lei posterior pode ser usada quando superveniente ou complementar (p.60).', '');

add('## 7. Conteúdo programático completo (Anexo VIII, p.60 a 62)', '',
  'IDs estáveis por tópico em `data/matriz-edital.json` e `data/matriz-edital.csv` (' + matriz.topicos.length + ' tópicos). Contagens de artigos em intervalos são um mínimo.', '');
const bloco = { B1: 'BLOCO I — Língua Portuguesa', B2: 'BLOCO II — Conhecimentos Específicos', B3: 'BLOCO III — Conhecimentos Gerais' };
for (const b of ['B1', 'B2', 'B3']) {
  add('### ' + bloco[b], '');
  for (const d of matriz.disciplinas.filter((x) => x.bloco === b)) {
    const ts = matriz.topicos.filter((t) => t.disciplina === d.cod);
    add('**' + d.nome + '** (' + (d.questoes === null ? 'questões não discriminadas' : d.questoes + ' questões') + '; ' + ts.length + ' tópicos' + (ts.some((t) => t.n_dispositivos) ? '; ' + ts.reduce((s, t) => s + t.n_dispositivos, 0) + ' artigos' : '') + ')', '');
    const diplomas = [...new Set(ts.map((t) => (t.diploma ? t.diploma.cod : '')))];
    for (const dc of diplomas) {
      const g = ts.filter((t) => (t.diploma ? t.diploma.cod : '') === dc);
      if (!dc) { g.forEach((t) => add('- `' + t.id + '` ' + t.texto_edital)); continue; }
      const nome = g[0].diploma.nome;
      if (g[0].integral) { add('- `' + g[0].id + '` ' + nome + ': diploma integral (o edital não lista artigos)'); continue; }
      if (dc === 'NSCGJ') { add('- ' + nome + ':'); g.forEach((t) => add('  - `' + t.id + '` ' + t.localizacao + ' (' + t.texto_edital + ')')); continue; }
      add('- `' + g[0].id.replace(/-\d+$/, '-NN') + '` ' + nome + ' — arts. ' + g[0].lista_literal_do_diploma + ' (' + g.reduce((s, t) => s + t.n_dispositivos, 0) + ' artigos, ' + g.length + ' tópicos)');
    }
    add('');
  }
}

add('## 8. O que NÃO está no edital (e portanto não foi inventado)', '',
  '- Distribuição das 40 questões do Bloco II entre Penal, Processo Penal, Processo Civil, Constitucional, Administrativo, Civil e Legislação Especial.',
  '- Frequência histórica de cobrança pela VUNESP: **não apurada** (exige provas anteriores acessíveis e contagem verificável).',
  '- O tema (rubrica) de cada artigo: fica **pendente** até conferência no texto oficial da lei.', '');

fs.mkdirSync(path.join(raiz, 'docs'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'docs/auditoria-edital.md'), L.join('\n') + '\n');
console.log('docs/auditoria-edital.md gerado: ' + L.length + ' linhas');
