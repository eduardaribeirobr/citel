# Preparo TJSP — Oficial de Justiça (Edital 01/2026, VUNESP)

Plataforma de preparação individual, usada por uma pessoa por vez. Roda como página (Artifact) dentro do Claude, no
celular ou no computador.

## O que existe
- **Hoje:** meta do dia, cronômetro/registro de minutos, plano sugerido (teoria + revisões), cartão de questões do dia.
- **Questões (Modo Aprendizagem):** questões inéditas de **Matemática (13 tópicos) e Raciocínio Lógico** (sequências,
  diagramas lógicos, ordenação, estruturas lógicas, lógicas de argumentação: as áreas citadas no edital, p. 62), com gabarito, explicação, comentário de cada alternativa e pegadinha; confiança
  (certeza/dúvida/chute); motivo do erro; resumo da sessão; **caderno de erros** com "refazer"; **revisão espaçada**
  (1, 7, 15, 30 dias) e nível automático. A sessão **evita repetir enunciados que você já viu** (não só ids) e, se as
  variações de um nível acabarem, usa o nível vizinho antes de repetir.
- **Painel:** necessário por dia, ritmo, progresso por critérios (estudo, exercícios, desempenho, retenção) e o teto
  atual por falta de questões nas demais disciplinas.
- **Edital:** os 198 tópicos do Anexo VIII, com busca, filtro, "marcar estudado" e, nos tópicos com questões, o desempenho.
- **Mais:** ajustes, histórico com desfazer, backup (.json com SHA-256) e importação, teste de gravação, **auditoria das
  questões**, **regras do edital** (54 itens com página e trecho) e limites conhecidos.

## O que NÃO existe (e por quê)
- **Questões de Direito, Língua Portuguesa, Informática e Atualidades:** só se pode afirmar que uma questão está certa
  com o texto oficial da fonte. Do ambiente de desenvolvimento só foi possível acessar `www.tjsp.jus.br`; Planalto,
  ALESP, STF, STJ, CNJ e VUNESP (provas) ficaram inacessíveis. Nada foi inventado para preencher a lacuna.
- Simulados com cronômetro e modo prova, módulo de discursiva, aulas dentro do app.
- Uso offline (o app precisa de internet) e compartilhamento com outras pessoas (a gravação por terceiros não foi testada).

## Fontes oficiais
`tools/ingerir-fonte.js` guarda o arquivo bruto (HTML ou PDF) com URL, data e SHA-256 em `data/fontes/`; `src/fontes.js` extrai os artigos e
confere citações LITERAIS (e recusa artigo vetado/revogado). A auditoria mostra, por diploma, se a fonte foi ingerida e quantos artigos do
edital foram conferidos. Hoje: 3 de 14 diplomas ingeridos (Estatuto dos Funcionários, Lei 11.608/2003, Normas da Corregedoria).

## Questões de Direito (nível A)
`tools/build-dir-dados.js` extrai só os artigos que o edital cita e que estão vigentes, ligados ao tópico (`data/dir-dados.json`, embutido no app).
`src/questoes-dir.js` gera (1) lacuna numérica e (2) "qual alternativa reproduz o dispositivo": a correta é trecho literal do artigo; cada errada é o mesmo
trecho com uma alteração rastreável (número com extenso e percentual coerentes, unidade de tempo, termo oposto, negação, advérbio omitido) e é
recusada se existir em qualquer artigo citado do diploma. Os testes conferem 4.500 questões contra o texto bruto oficial inteiro. **Treina a leitura
precisa da lei; não testa interpretação nem jurisprudência.** 10 dos 30 tópicos desses diplomas geram questão; os demais ficam declarados sem questões.

## Regra dos ids imutáveis
O histórico guarda só o id da questão (`MODELO:semente:nível`); ao refazer, a questão é gerada de novo. Por isso **um modelo
publicado nunca é editado**: se tiver defeito, cria-se um modelo novo e o antigo recebe `aposentado: '<sucessor>'` (continua
reproduzindo o histórico, não entra em sessões novas, e seu histórico de revisão passa ao sucessor). Um teste dourado
(`tests/golden-questoes.json`, 400 ids + as questões reais já respondidas) falha se algum id passar a gerar outra questão.
`RLOG-02-CONJUNTOS` está aposentado: aceitava premissas que forçam um conjunto vazio, e a resposta decorria "por vazio".

## Como as questões são validadas
Cada modelo gera a questão a partir de `MODELO:semente:nível` (mesmo id → mesma questão). Antes de aparecer, ela passa por
`validarQuestao`: estrutura, **segundo método de cálculo independente**, gabarito único e cinco alternativas distintas.
Os erros comuns (distratores) vêm com o motivo calculado. Na lógica proposicional, o gerador avalia por recursão e o segundo
método por máscaras de bits; os testes ainda usam um terceiro avaliador e um **analisador independente que lê de volta o
português das alternativas** e confere cada afirmação dos comentários de erro contra a tabela-verdade. Isso prova que a **conta está certa**; não prova que a questão
seja igual à da banca. As questões são marcadas como **inéditas**. O relatório está em `data/validacao-questoes.json`
(`node tools/validar-questoes.js`) e é mostrado em Mais → Auditoria.

## Estrutura
- `src/` módulos puros e testados: `progresso.js` (domínio e ritmo), `matriz.js`, `store.js` (registro confiável de eventos),
  `plano.js`, `backup.js`, `regras.js`, `questoes.js` (motor), `questoes-mat.js`/`questoes-mat2.js`/`questoes-rl.js`/`questoes-rl2.js` (modelos),
  `aprendizagem.js` (revisão espaçada, nível, sessão, caderno de erros).
- `data/fonte/` texto dos PDFs oficiais (SHA-256 em `proveniencia.json`); `data/edital-regras.json`; `data/matriz-edital.json|csv`;
  `data/validacao-questoes.json`.
- `web/` modelos das páginas; `tools/` montagem e relatórios; `dist/` saída publicada (`dist/app`, `dist/diag.html`).
- `docs/auditoria-edital.md` auditoria do edital.

## Comandos
```bash
node tools/build-matriz.js && node tools/validar-questoes.js && node tools/build-app.js && node tools/build-diag.js && node tools/build-auditoria.js
node --test tests/*.test.js
NODE_PATH=$(npm root -g) node tests/app.e2e.js        # Chromium (Playwright); banco simulado
NODE_PATH=$(npm root -g) node tests/questoes.e2e.js
NODE_PATH=$(npm root -g) node tests/diag.e2e.js
```

## Como foi testado
- 218 testes de unidade e de propriedades (sorteios com semente fixa; 12.000 questões geradas e validadas por rodada).
- 254 verificações ponta a ponta no Chromium com tela de celular (390 px), tema claro e escuro, banco **simulado**, incluindo
  o histórico real de uso (respostas de um aparelho de verdade) aberto na interface.
- Verificação por mutação: defeitos injetados de propósito nos módulos de progresso, plano, armazenamento, questões e
  aprendizagem; cada um precisa derrubar ao menos um teste. Os que sobreviveram revelaram lacunas de teste (fechadas) ou eram
  equivalentes (2 casos documentados: o comportamento não muda porque nenhuma premissa dos geradores é vazia).
- **Gravação real:** o app publicado gravou configuração, respostas e sessão a partir de um aparelho real da usuária (conferido no banco real; o banco registra só um código do aparelho, não o modelo).
- **Não testado:** Android, e acesso de pessoas de fora.

## Dados e privacidade
Cada pessoa grava só em `data/users/<id>/` (privado por pessoa no banco da plataforma). O histórico é só de acréscimo
(eventos com id único, em blocos por aparelho); desfazer cria um cancelamento. O motivo do erro é um registro à parte
(`tipo: "motivo"`), e `Aprendizagem.paraMotor` o retira antes de o motor de progresso receber os eventos.
Isolamento é de acesso, não criptografia.

## Limites conhecidos
- Esforço por tópico (20 min + 6 min por artigo etc.), sequência de estudo e intervalos de revisão são estimativas, ajustáveis.
- **Variação baixa em alguns pares modelo × nível** (relatório em Mais → Auditoria): MAT-04 nível 5 (16 variações), MAT-11 nível 4 (9),
  MAT-12 níveis 2, 3 e 5 (12 a 18), MAT-13 nível 4 (12), RL-sequências nível 2 (10), RL-sequências B nível 5 (10). Ampliar exige
  modelos novos (ids existentes são imutáveis).
- Como só 14 dos 198 tópicos têm questões, o progresso geral tem **teto** (≈ 44%) até haver questões para as demais disciplinas.
- Item 15 do edital (regra de nomeação) é ambíguo; confirmar com a VUNESP antes de decidir qualquer coisa com base nele.
- Evitar gravar ao mesmo tempo em duas abas do mesmo navegador.
- Nada aqui promete aprovação: os números medem o cumprimento do plano.
