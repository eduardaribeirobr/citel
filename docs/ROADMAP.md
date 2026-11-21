# Roteiro: cobrir todo o edital (situação em 21/11/2026)

## O que o edital exige (derivado de `data/matriz-edital.json`)
- **198 tópicos**; **163 jurídicos** (14 diplomas, **882 artigos** citados, 2 leis integrais) e **35 não jurídicos**
  (Português 13, Matemática 13, Informática 7, Raciocínio Lógico 1, Atualidades 1).

| Diploma | Artigos citados | Tópicos |
|---|---:|---:|
| Código de Processo Civil | 232 | 39 |
| Código Civil | 186 | 23 |
| Código de Processo Penal | 148 | 25 |
| Normas Judiciais da Corregedoria (Tomo I) | 127 | 13 |
| Código Penal | 87 | 17 |
| Constituição Federal | 33 | 7 |
| Estatuto da Pessoa com Deficiência (13.146/2015) | 27 | 3 |
| Estatuto dos Funcionários Públicos Civis do Estado de SP (10.261/68) | 18 | 16 |
| Lei 9.099/1995 | 12 | 8 |
| Lei 6.830/1980 | 6 | 6 |
| Resolução CNJ 354/2020 | 4 | 2 |
| Lei 8.429/1992 | 2 | 2 |
| LINDB (Decreto-Lei 4.657/1942) | integral | 1 |
| Lei 11.608/2003 | integral | 1 |

## Cobertura hoje
**24 de 198 tópicos** têm questões: Matemática 13 + Raciocínio Lógico 1 (nível B) e 10 de Direito (nível A): Estatuto dos Funcionários 5, Lei 11.608/2003 1, Normas da Corregedoria 4. As de Direito são de **reprodução fiel do texto oficial** (lacuna numérica e "qual alternativa reproduz o dispositivo"), geradas por alteração mecânica de número, unidade de tempo, termo oposto, negação ou advérbio, e só onde o trecho permite isso objetivamente. Não testam interpretação nem jurisprudência. Dos 30 tópicos desses 3 diplomas, 20 não geram questão por esse método (trechos definicionais). **Nenhum tópico dos outros 11 diplomas (a fonte oficial de 10 deles já está ingerida; faltam as questões), de Português, de Informática ou de Atualidades.**

## Fontes: situação em 21/11/2026
**13 dos 14 diplomas têm fonte oficial ingerida e conferida contra o edital** (todo artigo citado existe no texto oficial, inclusive os extremos exatos de cada faixa).

| Diploma | Fonte | Artigos do edital conferidos | Atualização da fonte | Observação |
|---|---|---:|---|---|
| Código de Processo Civil | Senado (estruturado, reconstruído em 14/10/2026) | 232/232 | até 13/03/2025 | 3 artigos sem dispositivo usável; 13 com dispositivo omitido por dúvida |
| Código Civil | Senado (estruturado, reconstruído em 14/10/2026) | 186/186 | até 28/06/2024 | revogados 194 e 1.776; 4 com dispositivo omitido |
| Código de Processo Penal | Senado (texto compilado) | 147/147 | salvo em 07/08/2026 | revogados 35 e 298; art. 65 tratado como duvidoso (anotação de ADPF) |
| Normas da Corregedoria, Tomo I | TJSP (PDF oficial) | 126/126 | até 22/10/2026 | 43 dos citados estão revogados |
| Código Penal | Senado (texto compilado) | 87/87 | salvo em 23/09/2026 | |
| Constituição Federal | Senado (estruturado, reconstruído em 14/10/2026) | 33/33 | até 16/10/2026 | 6 artigos citados com dispositivo omitido por dúvida (decisão judicial) |
| Estatuto da Pessoa com Deficiência | Senado (texto compilado) | 27/27 | salvo em 06/11/2025 | art. 82 vetado |
| Estatuto dos Funcionários (10.261/68) | ALESP | 18/18 | consultado em 21/11/2026 | |
| Lei 9.099/1995 | Senado (texto compilado) | 12/12 | salvo em 23/11/2021 | |
| Lei 6.830/1980 | Senado (texto compilado) | 6/6 | salvo em 26/12/2023 | |
| Lei 8.429/1992 | Senado (texto compilado) | 2/2 | salvo em 05/09/2022 | |
| LINDB | Senado (texto compilado) | integral | salvo em 15/01/2021 | |
| Lei 11.608/2003 | ALESP | integral | consultado em 21/11/2026 | |
| **Resolução CNJ 354/2020** | `atos.cnj.jus.br` | **pendente** | | host responde; texto ainda não localizado |

**Como o texto federal é obtido:** API pública oficial do Senado (`normas.leg.br`, licença CC BY 4.0), por rota documentada no próprio portal. Planalto e Presidência recusam acesso automatizado e **não são contornados**.
**Ressalvas honestas:** (1) nas fontes "compiladas", o texto é o vigente na data de salvamento, não reconstruído para 14/10/2026; (2) a fonte pode estar desatualizada em relação a alterações recentes (datas acima), então vale conferir antes de tratar como definitivo; (3) anotações legislativas (\"Redação dada pela Lei…\") são retiradas do texto citado, e anotações de decisão judicial (ADI, ADPF) tornam o dispositivo duvidoso e ele é **omitido**, nunca usado; (4) o edital cita faixas que incluem artigos revogados (por exemplo, Normas da Corregedoria 106–110 e 1054–1091; CC 194 e 1.776; CPP 35 e 298): eles não geram questão.

## Fases e critério de saída
- **F0 Fundação (quase concluída):** feito: ingestão com hash (HTML, PDF e API do Senado), conferência literal de citação com trava de artigo vetado/revogado/duvidoso, mapa de fontes por diploma na auditoria, botão "reportar problema". Falta: o texto da Res. CNJ 354/2020.
  Plano original: ingestão de fontes com hash e `tools/` de conferência de citação; matriz de cobertura por tópico na tela;
  botão "reportar problema" na questão (grava no banco da aluna). *Saída:* 3 diplomas ingeridos e verificados; cobertura visível no app.
- **F1 Direito, por peso (iniciada com os 3 diplomas já ingeridos):** CPC, CC, CPP, Corregedoria, CP, CF, demais. Por diploma: texto-fonte, resumo teórico citando artigos, questões
  de nível A ligadas ao trecho (geradas a partir do texto oficial com alteração controlada de prazo/número/termo, conferindo por script que a
  versão alterada não ocorre no texto). *Saída por diploma:* todos os artigos citados no edital com itens, portão verde.
- **F2 Português, Informática, Atualidades:** só com fonte aprovada pela aluna; senão ficam como "não coberto" ou nível D rotulado.
- **F3 Estudo e prova:** simulado no formato do edital (70 questões, 5 h, corte de 50% nos Blocos I e II), módulo de discursiva com os
  critérios do edital (2 questões, 0 a 40, mínimo 24), revisão espaçada com algoritmo moderno (FSRS) calibrado pelo uso, painel visual novo.
- **F4 Operação viva:** rotina semanal opcional e curta: lê erros e tempo, aponta lacunas, propõe a próxima remessa de conteúdo. Só com aprovação.

## Riscos conhecidos
Fontes federais sem texto integral acessível; Português/Informática/Atualidades sem fonte validável; volume (882 artigos) é de muitas sessões;
Item 15 do edital ambíguo (confirmar com a VUNESP); app exige internet; compartilhamento com outras pessoas não testado.
