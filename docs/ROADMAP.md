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
14 de 198 tópicos têm questões (Matemática 13 + Raciocínio Lógico 1), todas de nível B. **Nenhum tópico jurídico, de Português, de Informática ou de Atualidades.**

## Fontes: situação em 21/11/2026
| Diploma | Fonte | Situação |
|---|---|---|
| Estatuto dos Funcionários (10.261/68) | ALESP (HTML) | **ingerida**; 351 artigos, 18/18 citados conferidos; 2 vetados (129, 330) |
| Lei 11.608/2003 | ALESP (HTML) | **ingerida**; 12 artigos; lei integral |
| Normas da Corregedoria, Tomo I | TJSP (PDF oficial, `api.tjsp.jus.br`) | **ingerida**; 1.509 dispositivos, 126/126 citados conferidos; 90 revogados no texto; numeração pula 370 e 981 no próprio texto |
| Res. CNJ 354/2020 | `atos.cnj.jus.br` | host responde; texto ainda não localizado |
| Federais (CPC, CC, CPP, CP, CF, 13.146, 9.099, 6.830, 8.429, LINDB) | Senado (Dados Abertos) | API oficial identifica a norma e lista alterações; **texto integral ainda não localizado**. Planalto/Presidência recusam clientes automatizados e não se contorna. Alternativa: a aluna envia o PDF oficial. |

**Achados da conferência edital × texto oficial:** o edital cita faixas das Normas da Corregedoria que incluem artigos já revogados (106–110, revogados pelo Prov. CG 26/2019; 1054–1091 também constam como revogados). Esses artigos nunca geram questão. O texto das Normas é de 22/10/2026 e o edital manda considerar a legislação vigente até 14/10/2026: alterações entre essas datas, se houver, não foram separadas.

## Fases e critério de saída
- **F0 Fundação (em andamento):** feito: ingestão com hash (HTML e PDF), conferência literal de citação com trava de artigo vetado/revogado, mapa de fontes por diploma na auditoria, botão "reportar problema". Falta: textos dos diplomas federais e da Res. CNJ.
  Plano original: ingestão de fontes com hash e `tools/` de conferência de citação; matriz de cobertura por tópico na tela;
  botão "reportar problema" na questão (grava no banco da aluna). *Saída:* 3 diplomas ingeridos e verificados; cobertura visível no app.
- **F1 Direito, por peso:** CPC, CC, CPP, Corregedoria, CP, CF, demais. Por diploma: texto-fonte, resumo teórico citando artigos, questões
  de nível A ligadas ao trecho (geradas a partir do texto oficial com alteração controlada de prazo/número/termo, conferindo por script que a
  versão alterada não ocorre no texto). *Saída por diploma:* todos os artigos citados no edital com itens, portão verde.
- **F2 Português, Informática, Atualidades:** só com fonte aprovada pela aluna; senão ficam como "não coberto" ou nível D rotulado.
- **F3 Estudo e prova:** simulado no formato do edital (70 questões, 5 h, corte de 50% nos Blocos I e II), módulo de discursiva com os
  critérios do edital (2 questões, 0 a 40, mínimo 24), revisão espaçada com algoritmo moderno (FSRS) calibrado pelo uso, painel visual novo.
- **F4 Operação viva:** rotina semanal opcional e curta: lê erros e tempo, aponta lacunas, propõe a próxima remessa de conteúdo. Só com aprovação.

## Riscos conhecidos
Fontes federais sem texto integral acessível; Português/Informática/Atualidades sem fonte validável; volume (882 artigos) é de muitas sessões;
Item 15 do edital ambíguo (confirmar com a VUNESP); app exige internet; compartilhamento com outras pessoas não testado.
