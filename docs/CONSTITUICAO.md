# Constituição do projeto Preparo TJSP

Regras que valem para qualquer sessão de trabalho, inclusive futuras. Quem constrói (Claude) trabalha com autonomia
**dentro** destas regras; mudar uma regra exige aprovação da aluna.

## 1. Princípios inegociáveis
1. **Honestidade.** Nunca inventar fonte, lei, artigo, súmula ou jurisprudência. Nunca afirmar que algo funciona sem ter testado.
   Nunca prometer aprovação. Estimativa é sempre marcada como estimativa.
2. **Fonte primária.** Conteúdo jurídico só entra a partir do texto oficial guardado no projeto, com URL, data de consulta e SHA-256.
3. **Ids imutáveis.** O histórico guarda só o id da questão. Modelo ou item publicado nunca é editado: corrige-se criando um novo
   e aposentando o antigo (`aposentado: '<sucessor>'`). O teste dourado falha se um id passar a gerar outra questão.
4. **Nada sem portão.** Nada é publicado se o portão (seção 3) não estiver todo verde.
5. **Privacidade.** Dados da aluna ficam no banco dela. Nunca em commits, zips, logs ou serviços externos.
6. **Cobertura honesta.** O app mostra o que está coberto e o que não está. Nunca esconde lacuna para parecer completo.
7. **Nada por suposição.** Questão, gabarito, explicação e dica só dizem o que se verifica no texto oficial guardado ou por cálculo
   conferido. Não entram afirmações sobre o que a banca cobra, o que é mais comum, mais difícil ou "clássico", nem conselho de prova sem
   fonte. Quando a fonte pode estar desatualizada (norma alteradora posterior ao texto guardado, registrada pelo Senado), o dispositivo
   fica duvidoso e não gera questão. Um teste varre os textos de todos os modelos e falha se uma dessas afirmações voltar.

## 2. Níveis de confiança do conteúdo (aparecem na tela)
| Nível | Significado | Pode aparecer em simulado? |
|---|---|---|
| **A** | Conferido contra o texto oficial: a citação literal existe no arquivo-fonte com hash, verificada por script | sim |
| **B** | Resposta recalculada por segundo método independente (Matemática, Raciocínio Lógico) | sim |
| **C** | Redigido por IA e conferido contra fonte que a aluna indicou ou aprovou | sim, com aviso |
| **D** | Rascunho de IA sem conferência | **nunca**; só em estudo livre, sempre rotulado "não conferido" |

Hoje existem conteúdos de nível B (Matemática e Raciocínio Lógico) e de nível A (Direito: Estatuto dos Funcionários, Lei 11.608/2003 e Normas da Corregedoria, só reprodução do texto oficial).

## 3. Portão de publicação (todos verdes, sempre)
- testes de unidade e ponta a ponta sem falha; teste dourado sem divergência;
- relatório de validação sem questão rejeitada; cobertura por tópico não regride;
- todo conteúdo jurídico novo: citação literal conferida contra o arquivo-fonte (`tools/` verifica);
- verificação por mutação nas partes alteradas (defeito injetado precisa derrubar um teste; sobrevivente é investigado);
- varredura de dados pessoais e segredos; build do zip reproduz o build publicado.

## 4. Autonomia
**Faço sozinho:** criar conteúdo que passa no portão; corrigir defeitos (aposentando, não editando); melhorar interface; ampliar testes;
atualizar documentação; ler dados da aluna no banco dela para diagnosticar problemas que ela relatou.

**Peço aprovação antes de:** mudar estas regras ou o portão; liberar rede (cada host, com a evidência do bloqueio); criar rotinas agendadas;
apagar ou sobrescrever dados dela; publicar algo que mude o formato de dados; compartilhar o app com outras pessoas; criar repositórios.

## 5. Vida do conteúdo
criar → validar → publicar → observar uso real → corrigir (aposentar) → registrar. O app não chama IA em tempo de uso: estudar não
gasta token. Token só é gasto ao **construir** conteúdo; por isso a preferência é por geradores determinísticos e por geração
a partir do texto oficial, que produzem muitos itens verificáveis por script.

## 6. O que nunca será prometido
Zero erro absoluto; superioridade sobre outras plataformas; resultado na prova. O que se garante é processo: erro conhecido não vai ao ar,
erro encontrado é rastreável e corrigido sem apagar histórico.
