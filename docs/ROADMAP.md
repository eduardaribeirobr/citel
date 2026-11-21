# Roteiro: cobrir todo o edital (situação em 21/11/2026)

## O que o edital exige (derivado de `data/matriz-edital.json`)
- **198 tópicos**; **163 jurídicos** (14 diplomas, **882 artigos** citados, 2 leis integrais) e **35 não jurídicos**
  (Português 13, Matemática 13, Informática 7, Raciocínio Lógico 1, Atualidades 1).

| Diploma | Artigos citados | Tópicos |
|---|---:|---:|
| Código de Processo Civil | Senado (texto compilado vigente) | 232/232 | salvo em 14/03/2025 | 3 com dispositivo omitido por dúvida; art. 833 revisado por leitura (ver abaixo) |
| Código Civil | Senado (texto compilado vigente) | 186/186 | salvo em 24/12/2024 | revogados 194 e 1.776; Lei 15.040/2024 (seguros) tem vigência diferida e não atinge artigo citado |
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
**75 de 198 tópicos** têm questões: Matemática 13 + Raciocínio Lógico 1 (nível B) e 61 de Direito (nível A), em 12 dos 14 diplomas (tópicos com questão / tópicos do diploma): Código Penal 15/17, Código de Processo Civil 15/39, Código de Processo Penal 6/24, Código Civil 5/23, Estatuto dos Funcionários 5/16, Normas da Corregedoria 4/13, Constituição Federal 3/7, Lei 6.830/1980 3/6, Lei 9.099/1995 2/8, Estatuto da Pessoa com Deficiência 1/3, Lei 11.608/2003 1/1 e LINDB 1/1. As de Direito são de **reprodução fiel do texto oficial** (lacuna numérica e "qual alternativa reproduz o dispositivo"), geradas por alteração mecânica de número, unidade de tempo, termo oposto, negação ou advérbio, e só onde o trecho permite isso objetivamente. Não testam interpretação nem jurisprudência. Um tópico só é exposto se gera questão válida nos 5 níveis. Os modelos novos têm regras extras de qualidade (concordância número/unidade, numeral composto, "sempre que"); os 3 primeiros modelos ficaram como foram publicados (ids imutáveis). Artigos duvidosos (revogados, vetados, com decisão judicial ou alterados depois do texto guardado) nunca geram questão. **Sem questões:** os tópicos de Direito de texto definicional, Lei 8.429/1992 e Resolução CNJ 354/2020 (nenhum trecho permite alteração objetiva), Português, Informática e Atualidades (exceto o Estatuto da PcD).

## Fontes: situação em 21/11/2026
**Os 14 diplomas têm fonte oficial ingerida e conferida contra o edital** (todo artigo citado existe no texto oficial, inclusive os extremos exatos de cada faixa).

| Diploma | Fonte | Artigos do edital conferidos | Atualização da fonte | Observação |
|---|---|---:|---|---|
| Código de Processo Civil | Senado (estruturado, reconstruído em 14/10/2026) | 232/232 | até 13/03/2025 | 1 revogado/vetado/incerto; 13 com dispositivo omitido por dúvida; **82 e 833 alterados por lei posterior ao texto** (ver abaixo) |
| Código Civil | Senado (estruturado, reconstruído em 14/10/2026) | 186/186 | até 28/06/2024 | revogados 194 e 1.776; 4 com dispositivo omitido; **44 alterado por lei posterior ao texto** (ver abaixo) |
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
| Resolução CNJ 354/2020 | `atos.cnj.jus.br` (PDF do texto compilado) | 4/4 | compilado com as Res. 481/2022, 508/2023 e 679/2026 | o título do PDF diz 18/11/2020 e a página do ato diz 19/11/2020; divergência só registrada |

**Como o texto federal é obtido:** API pública oficial do Senado (`normas.leg.br`, licença CC BY 4.0), por rota documentada no próprio portal. Planalto e Presidência recusam acesso automatizado e **não são contornados**.
**Ressalvas honestas:** (1) nas fontes "compiladas", o texto é o vigente na data de salvamento, não reconstruído para 14/10/2026; (2) a fonte pode estar desatualizada em relação a alterações recentes (datas acima), então vale conferir antes de tratar como definitivo; (3) anotações legislativas (\"Redação dada pela Lei…\") são retiradas do texto citado, e anotações de decisão judicial (ADI, ADPF) tornam o dispositivo duvidoso e ele é **omitido**, nunca usado; (4) **frescor, checado por `tools/verificar-frescor.js` (janela até 14/10/2026, edital p. 60):** compara a data de cada texto com as normas alteradoras que o Senado registra. (a) Alterações publicadas depois do texto deixam o artigo duvidoso. (b) Para leis alteradoras de até 5 anos antes do texto que atinjam artigos citados, o programa **lê a cláusula de vigência no texto oficial da lei** (na publicação, após prazo, data fixa, lista ou "salvo"): vigência diferida que só valeu depois do texto, ou cláusula não entendida, deixa o artigo duvidoso. Exemplo real: a Lei 15.040/2024 (seguros) foi publicada antes do compilado do Código Civil, mas entra em vigor 1 ano depois; o compilado ainda mostra os arts. 757 a 802 antigos (nenhum é citado no edital). **Premissa declarada:** para alteradoras publicadas mais de 5 anos antes do texto, considera-se que a vacatio já transcorreu. Decretos regulamentadores e dispositivos "correlatos" não tornam artigo duvidoso (não mudam o texto da lei). Decisões do STF posteriores ao texto tornam (Lei 8.429, arts. 2 e 13; LINDB, art. 28). Revisão por leitura (`data/fontes/revisoes-frescor.json`): CPC art. 833, inciso X: a Lei 15.252/2025 só cria hipótese contratual que cita o dispositivo e não altera sua redação. O registro vem do cadastro do Senado e pode estar incompleto; ele não prova que o resto do texto está atualizado; (5) o edital cita faixas que incluem artigos revogados (por exemplo, Normas da Corregedoria 106–110 e 1054–1091; CC 194 e 1.776; CPP 35 e 298): eles não geram questão.

## Fases e critério de saída
- **F0 Fundação (quase concluída):** feito: ingestão com hash (HTML, PDF e API do Senado), conferência literal de citação com trava de artigo vetado/revogado/duvidoso, mapa de fontes por diploma na auditoria, botão "reportar problema". Falta: nada que dependa de acesso às fontes; o que não é possível obter de modo oficial e automatizado (Planalto) não é contornado.
  Plano original: ingestão de fontes com hash e `tools/` de conferência de citação; matriz de cobertura por tópico na tela;
  botão "reportar problema" na questão (grava no banco da aluna). *Saída:* 3 diplomas ingeridos e verificados; cobertura visível no app.
- **F1 Direito, por peso (questões de reprodução geradas para 12 dos 14 diplomas; faltam resumo teórico por artigo e questões de interpretação):** Por diploma: texto-fonte, resumo teórico citando artigos, questões
  de nível A ligadas ao trecho (geradas a partir do texto oficial com alteração controlada de prazo/número/termo, conferindo por script que a
  versão alterada não ocorre no texto). *Saída por diploma:* todos os artigos citados no edital com itens, portão verde.
- **F2 Português, Informática, Atualidades:** só com fonte aprovada pela aluna; senão ficam como "não coberto" ou nível D rotulado.
- **F3 Estudo e prova:** simulado no formato do edital (70 questões, 5 h, corte de 50% nos Blocos I e II), módulo de discursiva com os
  critérios do edital (2 questões, 0 a 40, mínimo 24), revisão espaçada com algoritmo moderno (FSRS) calibrado pelo uso, painel visual novo.
- **F4 Operação viva:** rotina semanal opcional e curta: lê erros e tempo, aponta lacunas, propõe a próxima remessa de conteúdo. Só com aprovação.

## Riscos conhecidos
Fontes federais sem texto integral acessível; Português/Informática/Atualidades sem fonte validável; volume (882 artigos) é de muitas sessões;
Item 15 do edital ambíguo (confirmar com a VUNESP); app exige internet; compartilhamento com outras pessoas não testado.
