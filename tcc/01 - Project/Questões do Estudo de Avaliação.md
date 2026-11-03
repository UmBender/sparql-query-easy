# Questões do estudo de avaliação — atuais e propostas (preview e filtros)

> Reúne todas as questões usadas nos testes da dissertação (as 13 questões
> de competência e os 15 itens do questionário) e propõe questões novas para
> avaliar as funcionalidades de **pré-visualização (preview)** e de
> **filtros**, que surgiram depois da avaliação da dissertação. As propostas
> seguem a mesma metodologia da dissertação e os princípios da Física das
> Notações (Moody, 2009), explicados em [[Física das Notações (Moody, 2009)]].
> Revisão de 03/11/2026: as questões PokemonGen1 seguem a forma de tarefa
> definida com o orientador (DEC-020: diagrama salvo, sem variáveis
> obrigatórias, correção manual) e o questionário completa o SUS e cobre os
> nove princípios (§6).
> Tarefa: DOC-010. Fontes: `tcc/PDF/Dissertação Corrigida - Versao Deposito
> Biblioteca Digital.pdf` (§2.5, §4.1–4.6, §5.2) e `tcc/PDF/The “Physics”
> of Notations.pdf` (§4). Respostas conferidas em 28/10/2026 (ver
> [Proveniência](#9-proveniência)).
> Relacionadas: [[Base do Vídeo de Apresentação]],
> [[../90 - Tasks/items/STUDY-015-dissertation-questionnaire|STUDY-015]] (o
> questionário no app), [[../90 - Tasks/items/STUDY-013-brasileirao-practice-tasks|STUDY-013]]
> (tarefas de treino).

## 1. A metodologia da dissertação (resumo)

1. **Público:** usuários leigos, com pouco ou nenhum conhecimento de
   SPARQL/RDF (75% dos 32 participantes não tinham nenhum).
2. **Base:** `CampeonatoBrasileiro2023` (18.724 triplas), construída a
   partir de **questões de competência** (§4.2) e de uma ontologia OWL (§4.3).
3. **Vídeo de demonstração** antes das tarefas, com questões **diferentes**
   das questões de competência, "para garantir que os participantes não
   tivessem como antecipar a construção da consulta" (§4.1).
4. **Tarefas:** cada participante tenta construir consultas para **cinco
   questões sorteadas** entre as 13 questões de competência.
5. **Questionário** online (§4.5), escala de Likert de 5 pontos, em três
   grupos:
   - **contexto** (não pontuado): itens 1, 2 e 4;
   - **usabilidade**: subconjunto do SUS (Brooke, 1995), itens 3, 5–10,
     marcados positivos (+) ou negativos (–). A pontuação vai de 0 a 70:
     `2,5 · (Σ₍₅,₇,₁₀₎(5 − q) + Σ₍₃,₆,₈,₉₎(q − 1))`. É aceitável a partir de
     47,6, o corte de 68 de Lewis (2018) proporcional à escala;
   - **notação**: itens 11–15, todos (+), cada um ligado a um princípio da
     Física das Notações. A pontuação vai de 0 a 20: `Σ₍₁₁–₁₅₎(q − 1)`. É
     aceitável acima de 10 (critério do autor: metade da escala).
6. **Resultado:** usabilidade média 57/70 e notação média 15,9/20; 84%
   completaram as cinco consultas e todos completaram pelo menos três.

A dissertação liga cada item de notação a um princípio de Moody: 11 ao
discernimento perceptivo, 12 à transparência semântica, 13 e 14 à clareza
semiótica e 15 ao gerenciamento de complexidade (§4.6). Uma observação: pela
definição de Moody (§4.8 do artigo), o item 13 (quantidade de símbolos) mede
na verdade a **economia gráfica**.

## 2. Questões de competência usadas nas tarefas da dissertação

As 13 questões de §4.2, com a resposta na base atual
(`src/main/resources/futebol_completo.ttl`) e o recurso do editor atual que
a resolve. O recurso indicado é o caminho mais direto hoje, não
necessariamente o usado em 2025.

| # | Questão (texto da dissertação) | Resposta na base | Recurso principal hoje |
|---|---|---|---|
| C1 | Qual foi a classificação do São Paulo no campeonato? | 11º lugar (53 pontos) | busca + Explore relationships |
| C2 | Qual foi a partida com o maior número de gols do mandante da segunda rodada? | empate em 3 gols: Goiás x Corinthians e São Paulo x América-MG | filtro exato (rodada 2) + **MAX** |
| C3 | Quais equipes se classificaram para a Libertadores? | 8: Palmeiras, Grêmio, Atlético-MG, Flamengo, Botafogo, Bragantino, Fluminense, São Paulo | valor booleano `true` |
| C4 | Quais equipes foram rebaixadas? | 4: Santos, Goiás, Coritiba, América-MG | valor booleano `true` |
| C5 | Quantas rodadas teve o campeonato? | 38 | variável + número de resultados |
| C6 | Quantos empates tiveram na rodada 30 do campeonato? | 3: Goiás x Vasco, Corinthians x Santos, Athletico-PR x São Paulo | filtro exato (rodada 30) + booleano |
| C7 | Qual equipe terminou o campeonato na 5ª posição? | Botafogo | filtro exato (5) |
| C8 | Quantos gols marcou o Calleri do São Paulo no campeonato? | 9 | dois saltos (gol → atleta) + número de resultados |
| C9 | Quantos gols sofreu o Bahia no campeonato? | 53 | busca + Explore relationships |
| C10 | Qual equipe teve o maior número de vitórias? | Grêmio (21) | **MAX** |
| C11 | Qual a data do jogo entre São Paulo e Corinthians? | 14/05/2023 (Corinthians x São Paulo) e 30/09/2023 (São Paulo x Corinthians) | duas entidades fixas + Explore relationships |
| C12 | Qual o resultado do jogo entre Palmeiras e Botafogo? | Palmeiras 0x1 Botafogo (25/06) e Botafogo 3x4 Palmeiras (01/11) | idem |
| C13 | Qual equipe teve o melhor saldo de gols? | Palmeiras (+31) | **MAX** |

Observações:

- **Contagens.** C5, C6 e C8 pedem um número. No app, a resposta enviada
  (*Submit answer*) é o conjunto de valores de uma variável; o número é a
  quantidade de resultados. Basta enunciar a tarefa como "Quais…"/"Liste…",
  ou aceitar a contagem lida pelo participante.
- **Não reutilizar no teste atual.** As 13 questões são do Brasileirão, a
  base do vídeo e do treino. A pergunta P1 do vídeo ("Quais times foram
  rebaixados?") é a própria C4, e a P5 usa a mesma relação de C3. No teste
  atual, as tarefas são do PokemonGen1 (§5).
- Só C2, C10 e C13 usam filtros (MAX). Nenhuma questão original **exige**
  os filtros por faixa (≥, ≤, Between), os filtros de texto, o funil ou a
  pré-visualização.

## 3. Questionário de avaliação da dissertação (§4.5)

Escala 1–5. Pol. = polaridade na pontuação. Está no app como
`profile.v2.json` (item 1) e `usability.v2.json` (itens 2–15), com as
pontuações no CSV do admin (STUDY-015).

| # | Item | Pol. | Grupo | Princípio (dissertação) |
|---|---|---|---|---|
| 1 | Qual é o seu nível de conhecimento sobre SPARQL/RDF? | — | contexto | — |
| 2 | Qual foi a quantidade de consultas que você conseguiu realizar? | — | contexto | — |
| 3 | Quão fácil foi usar a ferramenta para a construção de uma consulta SPARQL? | + | usabilidade | — |
| 4 | Quão útil foi o vídeo de demonstração para aprender a usar a ferramenta SPARQL EasyQuery? | — | contexto | — |
| 5 | Como você avaliaria a afirmação de que você precisaria de suporte técnico para conseguir usar plenamente o sistema? | – | usabilidade | — |
| 6 | … de que as diferentes funcionalidades do sistema estão bem integradas? | + | usabilidade | — |
| 7 | … de que existem muitas inconsistências no sistema? | – | usabilidade | — |
| 8 | … de que a maioria das pessoas aprenderia a usar este sistema rapidamente? | + | usabilidade | — |
| 9 | … de que você se sentiu muito confiante usando o sistema? | + | usabilidade | — |
| 10 | … de que você precisou aprender muitas coisas antes de começar a usar o sistema? | – | usabilidade | — |
| 11 | … de que os símbolos gráficos são claros e distintos entre si? | + | notação | discernimento perceptivo |
| 12 | … de que a aparência dos símbolos gráficos é intuitiva e sugere o significado esperado? | + | notação | transparência semântica |
| 13 | Você acredita que a quantidade de símbolos gráficos utilizados é adequada e não torna a visualização sobrecarregada? | + | notação | clareza semiótica (economia gráfica, ver §1) |
| 14 | Você acredita que a notação para a construção de uma consulta é consistente e não apresenta redundância ou ambiguidade? | + | notação | clareza semiótica |
| 15 | Você acredita que o suporte à disposição automática/manual dos elementos gráficos facilita a compreensão de uma consulta construída? | + | notação | gerenciamento de complexidade |

Itens 5–10 começam por "Como você avaliaria a afirmação…", como o item 5.

## 4. O que ainda não foi avaliado: preview e filtros

Funcionalidades que a avaliação de 2025 não cobriu, com o princípio de Moody
que cada uma implementa. Nomes conforme a página Help e a nota do vídeo.

| Funcionalidade | O que faz | Princípio (Moody, 2009) |
|---|---|---|
| Tipos de filtro (*Exact match*, *Starts with*, *Contains*, *At least*, *At most*, *Between*, *MAX*, *MIN*, *Any value*) | restringe um valor literal ou uma variável de valor literal | **ajuste cognitivo**: nomes em linguagem comum, não `FILTER(?x >= 60)`; **transparência semântica** |
| Editor de filtro com **histograma** e entidades mantidas | mostra a distribuição real e quais entidades o filtro mantém | **expressividade visual** (posição e tamanho codificam os valores); **codificação dupla** (barras + números + nomes) |
| **Sugestões** ao digitar (texto) | lista os valores existentes que casam com o texto | ajuste cognitivo (reconhecer em vez de lembrar o vocabulário da base) |
| **Selo** "mantidos / total" e valor real com ✓/✗ | mostra no próprio nó o efeito do filtro | **codificação dupla** (texto junto ao símbolo); **discernimento perceptivo** (nó filtrado diferente do não filtrado) |
| **Filter funnel** | quantos resultados restam depois de cada filtro; desmarcar um passo só pré-visualiza | **gerenciamento de complexidade** (decompõe a consulta em passos); **integração cognitiva**, monitoramento de rota ("estou no caminho certo?") |
| **Run Query em etapas** (*Find matching values*, variáveis numeradas, *Change order*) | explora uma variável por vez, só com valores compatíveis com os já escolhidos | **gerenciamento de complexidade** (modularização, §4.4.1); **integração cognitiva**, orientação ("onde estou?", numeração de níveis, §4.5.2) |
| Pré-visualização **Possible graph** | ao passar o mouse sobre um valor, mostra o grafo concreto a que ele leva | **integração cognitiva**: escolha de rota e reconhecimento do destino; um segundo diagrama ligado ao principal (*visual momentum*, §4.5.1) |
| **Assume** / **Apply to graph** | leva os valores escolhidos para o grafo | integração cognitiva (junta os dois diagramas em um) |
| **View SPARQL** | mostra a consulta textual gerada | ajuste cognitivo (dialeto para usuários avançados) |

As quatro etapas de navegação que Moody cita (§4.5.2: *orientation, route
choice, route monitoring, destination recognition*) correspondem
diretamente a: etapas numeradas, preview do valor, funil/selos e resultado
final. Essa é a base teórica dos novos itens da §6.

## 5. Novas questões de competência propostas (PokemonGen1)

**Base do teste.** No estudo atual, as tarefas usam o **PokemonGen1**, e o
vídeo e as tarefas de treino usam o Brasileirão 2023. É a mesma regra do
§4.1 da dissertação, aplicada à base inteira: o vídeo não pode antecipar a
construção das consultas do teste ([[../90 - Tasks/items/DOC-009-video-presentation-base|DOC-009]]).
Por isso as questões novas são sobre o PokemonGen1 (151 Pokémon,
`src/main/resources/pokemon_gen1.ttl`). Há um banco equivalente no
Brasileirão no [Apêndice A](#apêndice-a-banco-alternativo-no-brasileirão-2023-treino),
para treino.

### 5.1 Forma das tarefas (redefinida com o orientador em 02/11/2026)

A decisão com o orientador ([[../90 - Tasks/items/DEC-020-manual-evaluation-and-submission-export|DEC-020]],
implementada em STUDY-016/017/018) muda o que é uma tarefa e como ela é
corrigida:

1. **O participante salva um diagrama, não uma variável de resposta.** Ele
   usa a ferramenta até chegar ao resultado e salva o diagrama (*Save
   answer*). Pode salvar várias vezes; vale o **último** salvamento.
2. **Sem correção visível.** O participante não vê certo/errado nem
   contagens. A questão precisa deixar claro *o que* encontrar, porque ele
   não terá retorno.
3. **A resposta não depende de variáveis.** São aceitas duas formas:
   - **(A) com variáveis:** o diagrama é uma consulta (variáveis, filtros)
     cujo resultado é a resposta;
   - **(B) sem variáveis:** o diagrama mostra as entidades e relações da
     resposta, por exemplo depois de *Assume*/*Apply to graph* na
     pré-visualização, ou desenhado a partir da busca e de *Explore
     relationships*.
4. **Correção manual** (ou com ajuda de IA) depois do estudo, no
   `/admin/submissions` ou no ZIP (`diagram.txt` ao lado do `reference.txt`
   da mesma revisão). O `auto_check` é só uma pista.

Consequências para as questões:

- O enunciado **não fala de variáveis** nem de "variável de resposta"
  (diferente das tarefas de treino do Brasileirão, que ainda dizem
  "Responda com a variável…", ver a limitação de STUDY-016).
- O enunciado pede **todas** as informações que o diagrama deve mostrar
  (por exemplo, "e qual item é usado"), porque é isso que será conferido.
- Cada questão tem um **diagrama de referência** (forma A, §5.5) e um
  exemplo de resposta aceita na forma B.
- Os recursos (filtro, preview) são o **caminho esperado**, não uma
  exigência: quem chega ao resultado por outro caminho acerta. A forma do
  diagrama salvo mostra o caminho usado, o que complementa o item de
  contexto 36 do questionário (§6).

Instrução comum a todas as tarefas, exibida antes do enunciado:

> Use a ferramenta para encontrar a resposta da pergunta abaixo. Quando o
> diagrama mostrar a resposta, clique em *Save answer*. Você pode salvar
> quantas vezes quiser; vale o último salvamento. Não é preciso usar
> variáveis.

### 5.2 Critérios das questões

Os da dissertação, mais três:

1. Enunciado em linguagem comum, sem termos de SPARQL nem de variáveis,
   como em §4.2.
2. Diferentes dos exemplos que o participante já vê: o exemplo da Help e do
   tour (Fogo com *speed* ≥ 90) e as consultas de teste do STUDY-012
   ("Fast-growing Water fish" e "Toughest Fire Pokémon").
3. Cada questão tem como **caminho esperado** pelo menos um filtro ou a
   exploração em etapas com preview, mas pode ser respondida sem
   variáveis. A resposta foi conferida na base (§9).
4. Respostas pequenas (até ~10 valores), para que a correção manual e um
   diagrama sem variáveis (forma B) sejam viáveis.

Os nomes de tipos, itens e propriedades aparecem em inglês no app
(*Electric*, *Moon Stone*, *Speed*). O enunciado usa os dois.

### 5.3 Rubrica de correção

| Nota | Forma A (com variáveis) | Forma B (sem variáveis) |
|---|---|---|
| **Correta** | A consulta gerada é equivalente à de referência: mesmas condições, mesmo resultado, independente dos nomes das variáveis, da ordem e da posição dos nós. | O diagrama mostra todas as entidades da resposta, só elas, cada uma ligada às relações que a pergunta pede. |
| **Parcial** | Caminho certo com um erro que muda o resultado: falta ou sobra uma condição, limite errado, um empate perdido. | Falta ou sobra uma entidade, ou falta a relação que justifica a resposta (por exemplo, o item da evolução). |
| **Incorreta** | Outra pergunta, resultado vazio ou sem relação com a pergunta. | Entidades erradas ou diagrama sem relação com a pergunta. |

Resultado igual **não basta** na forma A: na NF4, um diagrama sem o tipo
Psíquico também dá Mewtwo (o maior ataque especial de toda a base), mas
responde outra pergunta e é **parcial**. Registrar, para cada resposta, a
nota, a forma (A ou B) e os recursos que o diagrama mostra (filtro, MAX/MIN,
duas variáveis).

### 5.4 Banco de questões

#### Filtros

| # | Enunciado (como o participante vê) | Caminho esperado | Funil esperado | Resultado esperado | Exemplo aceito na forma B |
|---|---|---|---|---|---|
| NF1 | Quais Pokémon do tipo Elétrico (*Electric*) têm velocidade (*Speed*) de pelo menos 100? | *At least* + histograma | 151 → 9 → 6 | Electrode (150), Jolteon (130), Raichu (110), Electabuzz (105), Voltorb (100), Zapdos (100) | os 6 Pokémon, cada um com *has type* → Electric e *Speed* → seu valor |
| NF2 | Quais Pokémon medem entre 2 e 3 metros de altura (*height*)? | *Between* com decimais (ou *At least* + *At most*) | 151 → 9 | Ekans, Exeggutor, Mewtwo, Moltres, Venusaur (2,0); Snorlax (2,1); Dragonite, Kangaskhan (2,2); Lapras (2,5) | os 9, cada um com *height (m)* → seu valor |
| NF3 | Qual é o Pokémon mais leve (*weight*)? | **MIN** com empate | 151 → 2 | Gastly e Haunter (0,1 kg) | Gastly e Haunter com *weight (kg)* → 0.1; só um dos dois é parcial |
| NF4 | Qual Pokémon do tipo Psíquico (*Psychic*) tem o maior ataque especial (*Sp. Atk*)? | tipo fixo + **MAX** | 151 → 14 → 1 | Mewtwo (154) | Mewtwo com *has type* → Psychic e *Sp. Atk* → 154 |
| NF5 | Quais Pokémon têm uma categoria (*category*) que contém a palavra "Bird"? | *Contains* + sugestões de texto | 151 → 6 | Pidgey, Pidgeotto, Pidgeot, Spearow, Doduo, Dodrio | os 6, cada um com *category* → sua categoria |
| NF6 | Quais Pokémon têm uma categoria (*category*) que começa com "Poison"? | *Starts with* | 151 → 8 | Nidoran♀, Nidorina, Nidoran♂, Nidorino, Beedrill, Venomoth, Koffing, Weezing | os 8, cada um com *category* → sua categoria |
| NF7 | Quais Pokémon do tipo Água (*Water*) têm defesa (*Defense*) e velocidade (*Speed*) de pelo menos 80? | tipo + dois *At least*; **funil** de 3 passos | 151 → 32 → 16 → 3 | Kabutops, Seadra, Starmie | os 3, cada um com o tipo, a defesa e a velocidade |
| NF8 | Quais Pokémon que não evoluem de nenhum outro (estágio de evolução 1, *evolution stage*) têm total de atributos (*base stat total*) de pelo menos 500? | valor exato (estágio 1) + *At least*; **funil** | 151 → 79 → 10 | Mewtwo, Mew, Articuno, Moltres, Zapdos, Snorlax, Lapras, Aerodactyl, Pinsir, Scyther | os 10, cada um com o estágio e o total |

Notas:

- NF3 e NF4: MAX/MIN só se aplica a um **valor literal**, não a uma variável
  de valor literal (nota do vídeo, F20). A NF3 testa se o participante
  percebe que há empate; sem retorno de correção, só a pré-visualização ou
  o resultado mostram os dois.
- NF4: os 14 Pokémon Psíquicos incluem os de tipo secundário (`hasType`).
- NF8 é a mais difícil do bloco: "não evolui de nenhum outro" precisa virar
  `evolution stage = 1`; por isso o enunciado dá a dica.
- Na forma B das questões de filtro, o diagrama precisa mostrar o valor que
  justifica cada entidade. Uma lista de Pokémon sem os valores é
  **parcial**: mostra o resultado, mas não que ele atende à pergunta.

#### Pré-visualização e exploração em etapas

Questões com duas etapas, em que *Find matching values* e o *Possible
graph* ajudam a escolher e conferir os valores. Aqui a forma B é natural:
escolher os valores na pré-visualização e levá-los ao grafo com *Assume*.

| # | Enunciado (como o participante vê) | Etapas | Resultado esperado | Exemplo aceito na forma B |
|---|---|---|---|---|
| NP1 | Em quais Pokémon o Eevee evolui, e qual item (*evolution item*) é usado em cada evolução? | Pokémon → item | Vaporeon (Water Stone), Jolteon (Thunder Stone), Flareon (Fire Stone) | Vaporeon, Jolteon e Flareon, cada um com *evolves from* → Eevee e *evolution item* → sua pedra |
| NP2 | Quais Pokémon evoluem usando a Moon Stone, e de qual Pokémon cada um evolui? | Pokémon → pré-evolução | Nidoqueen ← Nidorina, Nidoking ← Nidorino, Clefable ← Clefairy, Wigglytuff ← Jigglypuff | os 4 pares, cada um com *evolution item* → Moon Stone e *evolves from* → a pré-evolução |
| NP3 | A quais tipos os Pokémon do tipo Dragão (*Dragon*) são fracos (*weak to*)? | Pokémon → tipo | Dragon, Fairy, Ice (os três Dragões); Rock (só Dragonite) | Dratini, Dragonair e Dragonite ligados por *weak to* aos tipos; mostrar só os 4 tipos sem os Pokémon é **parcial** |
| NP4 | De quais Pokémon evoluem os Pokémon do tipo Venenoso (*Poison*) com o maior ataque (*Attack*)? | MAX (empate) + pré-evolução | Muk ← Grimer e Victreebel ← Weepinbell (ataque 105): **combina filtro e preview** (desafio) | Muk e Victreebel com *Attack* → 105, *has type* → Poison e *evolves from* → Grimer/Weepinbell |

Na NP3, a resposta é o conjunto de tipos; o preview mostra de que Pokémon
vem cada fraqueza. Na NP4, a resposta são as pré-evoluções (Grimer e
Weepinbell), e o diagrama deve mostrar por que elas foram escolhidas.

### 5.5 Diagramas de referência (forma A)

Para desenhar no `/admin/tasks/new`. Nomes de variáveis livres; os rótulos
são os do app.

```
NF1  ?pokémon --has type--> Electric
     ?pokémon --Speed--> ?velocidade          [At least 100]
NF2  ?pokémon --height (m)--> ?altura         [Between 2 and 3]
NF3  ?pokémon --weight (kg)--> ?peso          [MIN]
NF4  ?pokémon --has type--> Psychic
     ?pokémon --Sp. Atk--> ?ataque            [MAX]
NF5  ?pokémon --category--> ?categoria        [Contains "Bird"]
NF6  ?pokémon --category--> ?categoria        [Starts with "Poison"]
NF7  ?pokémon --has type--> Water
     ?pokémon --Defense--> ?defesa            [At least 80]
     ?pokémon --Speed--> ?velocidade          [At least 80]
NF8  ?pokémon --evolution stage--> 1          (valor literal)
     ?pokémon --base stat total--> ?total     [At least 500]
NP1  ?pokémon --evolves from--> Eevee
     ?pokémon --evolution item--> ?item
NP2  ?pokémon --evolution item--> Moon Stone
     ?pokémon --evolves from--> ?pré
NP3  ?pokémon --has type--> Dragon
     ?pokémon --weak to--> ?tipo
NP4  ?pokémon --has type--> Poison
     ?pokémon --Attack--> ?ataque             [MAX]
     ?pokémon --evolves from--> ?pré
```

Limitação conhecida (STUDY-016): uma resposta na forma B nunca bate no
`auto_check` estrutural com uma referência na forma A, porque as triplas da
referência têm variáveis. O `auto_check` = `no_match` nesse caso não indica
erro; a nota é dada pela rubrica (§5.3).

### 5.6 Como sortear

Para replicar o desenho da dissertação (cinco questões sorteadas de um
banco) e cobrir as novas funcionalidades:

- **Cinco tarefas por participante**, sorteadas por estrato: duas de
  filtros, duas de pré-visualização e uma "básica", sem filtro nem preview
  (ver o passo 3 de §8).
- Os grupos de participantes do app (STUDY-006) dão um conjunto fixo e
  ordenado de tarefas a cada grupo. O sorteio pode ser feito ao montar os
  grupos (por exemplo, quatro grupos com combinações diferentes).
- O item 2 do questionário aceita até 20 no app, então seis tarefas também
  funcionam.

## 6. Novos itens do questionário (SUS e Física das Notações)

Os itens 1–15 ficam **inalterados**, para que as pontuações continuem
comparáveis com 57/70 e 15,9/20. Os novos itens entram depois do 15, em
quatro blocos. Cada bloco pode ser aplicado ou retirado sem afetar os
outros.

Mesma forma dos itens 5–12: "Como você avaliaria a afirmação de que…",
escala de Likert de 1 ("Discordo fortemente") a 5 ("Concordo fortemente").
Positivos (+) pontuam `q − 1` e negativos (–) `5 − q`, como em §4.5 da
dissertação. Cada bloco tem pelo menos um item negativo, como no SUS, para
reduzir a tendência de concordar com tudo.

### 6.1 O que falta do SUS e da Física das Notações

- **SUS.** A dissertação usou 7 dos 10 itens do SUS (Brooke, 1995):

  | Item SUS (Brooke) | Pol. | Item da dissertação |
  |---|---|---|
  | 1. Gostaria de usar o sistema com frequência | + | — |
  | 2. Achei o sistema desnecessariamente complexo | – | — |
  | 3. Achei o sistema fácil de usar | + | 3 |
  | 4. Precisaria de suporte técnico | – | 5 |
  | 5. Funções bem integradas | + | 6 |
  | 6. Muita inconsistência | – | 7 |
  | 7. A maioria aprenderia rápido | + | 8 |
  | 8. Achei o sistema muito trabalhoso | – | — |
  | 9. Me senti confiante | + | 9 |
  | 10. Precisei aprender muitas coisas antes | – | 10 |

  Faltam os itens 1, 2 e 8. Com eles, o SUS fica completo (0–100) e pode
  ser comparado diretamente com o corte de 68 de Lewis (2018) e com outros
  estudos, sem a normalização para 47,6.
- **Física das Notações.** Os itens 11–15 cobrem 5 dos 9 princípios
  (discernimento perceptivo, transparência semântica, economia gráfica,
  clareza semiótica e gerenciamento de complexidade). Ficam de fora a
  **integração cognitiva**, a **expressividade visual**, a **codificação
  dupla** e o **ajuste cognitivo**. A explicação de cada princípio está em
  [[Física das Notações (Moody, 2009)]].

### 6.2 Bloco "SUS complementar" (itens 16–18)

| # | Item proposto | Pol. | Item SUS | Princípio relacionado (indireto) |
|---|---|---|---|---|
| 16 | Como você avaliaria a afirmação de que você gostaria de usar esta ferramenta com frequência, sempre que precisasse consultar uma base de dados como a dos Pokémon? | + | 1 | — (satisfação/intenção de uso) |
| 17 | Como você avaliaria a afirmação de que a ferramenta é desnecessariamente complexa? | – | 2 | economia gráfica, gerenciamento de complexidade |
| 18 | Como você avaliaria a afirmação de que a ferramenta é muito trabalhosa de usar? | – | 8 | gerenciamento de complexidade |

O SUS mede a usabilidade da **ferramenta**, não da notação. A coluna
"princípio relacionado" serve só para a discussão; esses itens não entram
na pontuação de notação.

### 6.3 Bloco "Notação complementar" (itens 19–25)

Um item por princípio que os itens 11–15 não cobrem, e dois que reforçam
princípios cobertos de forma parcial.

| # | Item proposto | Pol. | Princípio | O que mede |
|---|---|---|---|---|
| 19 | Como você avaliaria a afirmação de que todas as condições da sua consulta (relações, valores e filtros) estavam visíveis no diagrama, sem nada escondido? | + | clareza semiótica | déficit de símbolos (o item 14 cobre redundância e ambiguidade) |
| 20 | Como você avaliaria a afirmação de que as cores dos nós e das setas ajudaram a reconhecer rapidamente o papel de cada elemento na consulta? | + | expressividade visual | uso de mais de uma variável visual (cor além da forma) |
| 21 | Como você avaliaria a afirmação de que os textos junto aos símbolos (nomes dos nós, das relações e dos filtros) ajudaram a entender o diagrama? | + | codificação dupla | texto complementando o gráfico |
| 22 | Como você avaliaria a afirmação de que havia tipos diferentes de símbolos demais para lembrar o que cada um significa? | – | economia gráfica | número de **tipos** de símbolo; o item 13 mede a quantidade de elementos na tela |
| 23 | Como você avaliaria a afirmação de que é possível construir uma consulta sem conhecer termos técnicos de SPARQL ou de RDF? | + | ajuste cognitivo | adequação do dialeto ao público leigo |
| 24 | Como você avaliaria a afirmação de que foi fácil relacionar o diagrama construído com a lista de resultados obtida? | + | integração cognitiva | integração conceitual entre duas representações (diagrama e resultados) |
| 25 | Como você avaliaria a afirmação de que a direção das setas deixa claro o sentido de cada relação (por exemplo, qual Pokémon evolui de qual)? | + | transparência semântica | relações semanticamente transparentes (o item 12 trata dos símbolos dos nós) |

### 6.4 Bloco "Filtros" (itens 26–30)

| # | Item proposto | Pol. | Princípio |
|---|---|---|---|
| 26 | Como você avaliaria a afirmação de que os nomes dos tipos de filtro (por exemplo *At least*, *Between*, *Contains*, *MAX*) deixam claro o que cada filtro faz? | + | ajuste cognitivo, transparência semântica |
| 27 | Como você avaliaria a afirmação de que o histograma e a lista de entidades mantidas ajudaram a escolher o valor de um filtro? | + | expressividade visual, codificação dupla |
| 28 | Como você avaliaria a afirmação de que o selo "mantidos / total" sobre um nó filtrado mostra claramente o efeito do filtro? | + | codificação dupla |
| 29 | Como você avaliaria a afirmação de que o funil de filtros (*Filter funnel*) ajudou a entender como cada filtro reduziu o resultado? | + | gerenciamento de complexidade, integração cognitiva (monitoramento de rota) |
| 30 | Como você avaliaria a afirmação de que foi difícil distinguir, no grafo, os nós com filtro dos nós sem filtro? | – | discernimento perceptivo |

### 6.5 Bloco "Pré-visualização" (itens 31–35)

| # | Item proposto | Pol. | Princípio |
|---|---|---|---|
| 31 | Como você avaliaria a afirmação de que a execução em etapas (*Find matching values*), com as variáveis numeradas, deixou claro em que etapa da consulta você estava? | + | integração cognitiva (orientação), gerenciamento de complexidade (modularização) |
| 32 | Como você avaliaria a afirmação de que a pré-visualização do grafo (*Possible graph*), ao passar o mouse sobre um valor, ajudou a decidir qual valor escolher? | + | integração cognitiva (escolha de rota) |
| 33 | Como você avaliaria a afirmação de que é fácil relacionar o grafo da pré-visualização com o grafo da consulta no editor? | + | integração cognitiva (integração perceptiva, *visual momentum*) |
| 34 | Como você avaliaria a afirmação de que a pré-visualização e os painéis de filtro deixaram a tela sobrecarregada? | – | economia gráfica, gerenciamento de complexidade |
| 35 | Como você avaliaria a afirmação de que conseguiu conferir se o diagrama mostrava a resposta certa (pelo funil, pelos selos ou pela pré-visualização) antes de salvá-lo? | + | integração cognitiva (reconhecimento do destino) |

O item 35 ganhou importância com a DEC-020: sem correção visível, os
recursos de conferência são o único retorno que o participante tem.

### 6.6 Itens de contexto (não pontuados)

- **36.** Quais destes recursos você usou durante as tarefas? (múltipla
  escolha: histograma do filtro, sugestões de texto, selos, funil,
  *Find matching values*, *Possible graph*, *Assume*, *View SPARQL*,
  nenhum).
- **37.** Quão seguro você está de que os diagramas que salvou respondem
  corretamente às perguntas? (1 "Nada seguro" a 5 "Totalmente seguro").

Quem não usou um recurso dá uma nota pouco informativa no item
correspondente; na análise, separar as médias de quem usou e de quem não
usou. O item 37, comparado com a nota manual (§5.3), mostra se a confiança
do participante corresponde ao acerto. É o mesmo cuidado que o item 2 pede
agora (§7).

### 6.7 Pontuação

| Pontuação | Itens | Fórmula | Faixa | Aceitável |
|---|---|---|---|---|
| Usabilidade (dissertação) | 3, 5–10 | `2,5 · (Σ₍₅,₇,₁₀₎(5 − q) + Σ₍₃,₆,₈,₉₎(q − 1))` | 0–70 | ≥ 47,6 |
| **SUS completo** | 3, 5–10, 16–18 | `2,5 · (Σ₍₅,₇,₁₀,₁₇,₁₈₎(5 − q) + Σ₍₃,₆,₈,₉,₁₆₎(q − 1))` | 0–100 | ≥ 68 (Lewis, 2018) |
| Notação (dissertação) | 11–15 | `Σ₍₁₁–₁₅₎(q − 1)` | 0–20 | > 10 |
| **Notação complementar** | 19–25 | `Σ₍₁₉,₂₀,₂₁,₂₃,₂₄,₂₅₎(q − 1) + (5 − q₂₂)` | 0–28 | > 14 |
| **Notação completa** (9 princípios) | 11–15, 19–25 | soma das duas anteriores | 0–48 | > 24 |
| **Filtros** | 26–30 | `Σ₍₂₆–₂₉₎(q − 1) + (5 − q₃₀)` | 0–20 | > 10 |
| **Pré-visualização** | 31–35 | `Σ₍₃₁–₃₃,₃₅₎(q − 1) + (5 − q₃₄)` | 0–20 | > 10 |

O critério "metade da escala" é o mesmo da dissertação para a notação; não
há base teórica no SUS para um corte de notação.

### 6.8 Princípios avaliados por item

Cobertura dos nove princípios de Moody por todos os itens pontuados (os da
dissertação e os propostos). **Negrito** = item principal do princípio.

| Princípio | Itens da dissertação | Itens propostos | Itens SUS (relação indireta) |
|---|---|---|---|
| 1. Clareza semiótica | **14** | **19** | 7 (inconsistências) |
| 2. Discernimento perceptivo | **11** | 30 | — |
| 3. Transparência semântica | **12** | **25**, 26 | 8, 10 (aprendizado) |
| 4. Gerenciamento de complexidade | **15** | 29, 31, 34 | 17, 18 |
| 5. Integração cognitiva | — | **24**, 29, 31, 32, 33, 35 | 6 (funções integradas) |
| 6. Expressividade visual | — | **20**, 27 | — |
| 7. Codificação dupla | — | **21**, 27, 28 | — |
| 8. Economia gráfica | **13** | **22**, 34 | 17 |
| 9. Ajuste cognitivo | — | **23**, 26 | 3, 10 (facilidade para leigos) |

Leitura por item:

| Item | Princípio(s) |
|---|---|
| 11 | discernimento perceptivo |
| 12 | transparência semântica |
| 13 | economia gráfica (a dissertação atribui à clareza semiótica, ver §1) |
| 14 | clareza semiótica (redundância e ambiguidade/sobrecarga) |
| 15 | gerenciamento de complexidade |
| 16 | — (SUS 1, intenção de uso) |
| 17 | SUS 2; indiretamente economia gráfica e gerenciamento de complexidade |
| 18 | SUS 8; indiretamente gerenciamento de complexidade |
| 19 | clareza semiótica (déficit de símbolos) |
| 20 | expressividade visual |
| 21 | codificação dupla |
| 22 | economia gráfica |
| 23 | ajuste cognitivo |
| 24 | integração cognitiva (conceitual) |
| 25 | transparência semântica (relações) |
| 26 | ajuste cognitivo, transparência semântica |
| 27 | expressividade visual, codificação dupla |
| 28 | codificação dupla |
| 29 | gerenciamento de complexidade, integração cognitiva (monitoramento de rota) |
| 30 | discernimento perceptivo |
| 31 | integração cognitiva (orientação), gerenciamento de complexidade |
| 32 | integração cognitiva (escolha de rota) |
| 33 | integração cognitiva (integração perceptiva) |
| 34 | economia gráfica, gerenciamento de complexidade |
| 35 | integração cognitiva (reconhecimento do destino) |

Com os itens propostos, todos os nove princípios têm pelo menos um item
principal, e só o discernimento perceptivo continua com um único item
geral (11) mais um específico dos filtros (30).

## 7. Ameaças à validade (para a discussão)

- **Viés de aquiescência:** a dissertação reconhece (§5.2) que as boas
  notas podem refletir o bom desempenho nas tarefas. Os itens negativos 17,
  18, 22, 30 e 34 e o item de contexto 36 reduzem esse risco.
- **Item 2 sem correção visível:** desde a DEC-020, o participante não sabe
  se acertou, então o item 2 ("quantidade de consultas que conseguiu
  realizar") mede a conclusão **percebida**. Comparar com a nota manual
  (§5.3) e com o item 37, em vez de tratá-lo como acerto.
- **Correção manual:** a nota depende de quem corrige. Usar a rubrica de
  §5.3, corrigir as tarefas antes de olhar o questionário do mesmo
  participante e, se possível, ter um segundo avaliador (ou uma IA) em uma
  amostra, registrando a concordância.
- **Tamanho do questionário:** com os blocos novos são 37 itens (eram 15).
  Se o tempo for um problema, os blocos de §6.2–§6.5 podem ser aplicados
  separadamente; os itens 1–15 ficam sempre.
- **Efeito do vídeo:** se o vídeo demonstra o preview e o funil, as notas
  medem também a qualidade da demonstração. Manter o item 4 e registrar a
  versão do vídeo usada.
- **Dificuldade desigual:** questões sorteadas de bancos diferentes têm
  dificuldades diferentes. Sortear por estrato (§5.6) e registrar quais
  questões cada participante recebeu (o app já registra as tarefas e as
  tentativas).

## 8. Implementação no app (próximos passos, não autorizados ainda)

1. Questões de §5 como tarefas propostas do grupo de teste PokemonGen1,
   desenhadas pelo admin (`/admin/tasks/new`; formato de dados como o de
   `frontend/src/lib/domain/fixtures/demo-study/brasileirao-2023.json`,
   STUDY-013), com os enunciados de §5.4 e os diagramas de referência de
   §5.5. O servidor guarda o resultado esperado; conferir que ele bate com
   §5.4. A correção é manual (§5.3), no `/admin/submissions` ou no ZIP.
2. Itens 16–37: nova versão `usability.v3.json`, o mesmo versionamento de
   STUDY-015. As respostas v2 continuam válidas e exportáveis. Colunas
   novas no CSV (`sus_score`, `notation_extra_score`, `filters_score`,
   `preview_score`) junto a `DissertationScores`. O item 36 usa o tipo
   `multiple_choice`, que o motor de formulários já tem (STUDY-009).
3. Opcional, para comparar com 2025: escrever no PokemonGen1 questões
   **básicas** com a mesma estrutura das 13 originais (uma entidade e uma
   relação, um valor booleano, uma contagem, um MAX) e usá-las como estrato
   "básico" do sorteio.

## 9. Proveniência

As respostas foram calculadas em 28/10/2026 com Jena 6.2 (a mesma
biblioteca do backend), por consultas SPARQL equivalentes: §2 e Apêndice A
sobre `src/main/resources/futebol_completo.ttl`; §5 sobre
`src/main/resources/pokemon_gen1.ttl`. As consultas estão abaixo, prontas
para virar grafos de referência.

### 9.1 PokemonGen1 (§5)

```sparql
PREFIX pk: <http://easyquery.example.org/pokemon#>

# NF1
SELECT ?p WHERE { ?p pk:hasType pk:ElectricType ; pk:speed ?s FILTER(?s >= 100) }
# NF2
SELECT ?p WHERE { ?p pk:heightMeters ?h FILTER(?h >= 2 && ?h <= 3) }
# NF3 (MIN)
SELECT ?p WHERE { ?p pk:weightKilograms ?w
  { SELECT (MIN(?x) AS ?w) WHERE { ?k pk:weightKilograms ?x } } }
# NF4 (MAX entre os Psíquicos)
SELECT ?p WHERE { ?p pk:hasType pk:PsychicType ; pk:specialAttack ?a
  { SELECT (MAX(?x) AS ?a) WHERE { ?k pk:hasType pk:PsychicType ; pk:specialAttack ?x } } }
# NF5
SELECT ?p WHERE { ?p pk:category ?c FILTER(CONTAINS(STR(?c), "Bird")) }
# NF6
SELECT ?p WHERE { ?p pk:category ?c FILTER(STRSTARTS(STR(?c), "Poison")) }
# NF7
SELECT ?p WHERE { ?p pk:hasType pk:WaterType ; pk:defense ?d ; pk:speed ?s FILTER(?d >= 80 && ?s >= 80) }
# NF8
SELECT ?p WHERE { ?p pk:evolutionStage 1 ; pk:baseStatTotal ?t FILTER(?t >= 500) }
# NP1
SELECT ?p ?item WHERE { ?p pk:evolvesFrom pk:Eevee ; pk:evolutionItem ?item }
# NP2
SELECT ?p ?pre WHERE { ?p pk:evolutionItem pk:MoonStone ; pk:evolvesFrom ?pre }
# NP3
SELECT DISTINCT ?tipo WHERE { ?p pk:hasType pk:DragonType ; pk:weakTo ?tipo }
# NP4
SELECT ?pre WHERE { ?p pk:hasType pk:PoisonType ; pk:attack ?a ; pk:evolvesFrom ?pre
  { SELECT (MAX(?x) AS ?a) WHERE { ?k pk:hasType pk:PoisonType ; pk:attack ?x } } }
```

### 9.2 Brasileirão 2023 (Apêndice A)

As datas são texto (`"2023-04-15T16:00:00"`), por isso filtros de data
usam *Starts with*.

```sparql
PREFIX fut: <http://futebol.usp.br#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

# BF1
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:incluiPontuacao ?p FILTER(?p >= 60) }
# BF2
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:incluiSaldoGols ?s FILTER(?s <= -1) }
# BF3
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:incluiVitorias ?v FILTER(?v >= 10 && ?v <= 12) }
# BF4 (MIN)
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:incluiGolsContra ?g
  { SELECT (MIN(?x) AS ?g) WHERE { ?k fut:incluiGolsContra ?x } } }
# BF5 (MAX)
SELECT ?partida WHERE { ?partida fut:placarVisitante ?g
  { SELECT (MAX(?x) AS ?g) WHERE { ?k fut:placarVisitante ?x } } }
# BF6
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:rebaixado true ; fut:incluiGolsPro ?g FILTER(?g >= 40) }
# BF7
SELECT ?equipe WHERE { ?c fut:indicaPosicao ?equipe ; fut:incluiPontuacao ?p ; fut:incluiGolsContra ?g
  FILTER(?p >= 50 && ?g >= 45) }
# BF8
SELECT ?partida WHERE { ?partida fut:empate true ; fut:ocorreEm ?r . ?r fut:possuiNumero ?n FILTER(?n <= 5) }
# BF9
SELECT ?partida ?rodada WHERE { ?partida fut:placarMandante ?g ; fut:ocorreEm ?rodada FILTER(?g >= 5) }
# BP1
SELECT ?atleta WHERE { ?partida fut:possuiPlacar "Goiás 4x6 Bahia"@en .
  ?gol fut:marcadoEm ?partida ; fut:marcadoPor ?atleta }
# BP2
SELECT ?atleta WHERE { ?atleta fut:competePor fut:EquipeFLA .
  ?gol fut:marcadoPor ?atleta ; fut:marcadoNoPrimeiroTempo true }
# BP3
SELECT ?estadio WHERE { ?c fut:rebaixado true ; fut:indicaPosicao ?equipe .
  ?partida fut:temMandante ?equipe ; fut:realizadaEm ?estadio }
```

## Apêndice A. Banco alternativo no Brasileirão 2023 (treino)

Questões com o mesmo foco, na base da dissertação e do vídeo. **Não usar no
teste** (a base é a mesma do vídeo, ver §5). Servem como tarefas de treino
(STUDY-013) ou para repetir o estudo na base da dissertação. São diferentes
das 13 originais e das perguntas P1–P12 do vídeo.

### A.1 Filtros

| # | Questão proposta | Recursos exigidos | Funil esperado | Resposta |
|---|---|---|---|---|
| BF1 | Quais equipes terminaram o campeonato com pelo menos 60 pontos? | *At least* + histograma | 20 → 6 | Palmeiras (70), Grêmio (68), Atlético-MG (66), Flamengo (66), Botafogo (64), Bragantino (62) |
| BF2 | Quais equipes terminaram o campeonato com saldo de gols negativo? | *At most* (−1) | 20 → 7 | América-MG (−39), Coritiba (−32), Santos (−25), Goiás (−17), Vasco (−10), Bahia (−3), Corinthians (−1) |
| BF3 | Quais equipes venceram entre 10 e 12 partidas? | *Between* (controle deslizante) | 20 → 5 | Cruzeiro, Santos (11); Bahia, Corinthians, Vasco (12) |
| BF4 | Qual equipe sofreu o menor número de gols? | **MIN** com empate | 20 → 2 | Atlético-MG e Cruzeiro (32) |
| BF5 | Qual partida teve o maior número de gols do time visitante? | **MAX** sobre partidas | 380 → 1 | Goiás 4x6 Bahia |
| BF6 | Quais equipes rebaixadas marcaram pelo menos 40 gols? | booleano + *At least*; **funil** de 2 passos | 20 → 4 → 2 | América-MG (42), Coritiba (41) |
| BF7 | Quais equipes somaram pelo menos 50 pontos e sofreram pelo menos 45 gols? | dois filtros numéricos; **funil** | 20 → 13 → 4 | Grêmio, Fluminense, Internacional, Corinthians |
| BF8 | Quais partidas das cinco primeiras rodadas terminaram empatadas? | *At most* (rodada ≤ 5) + booleano; **funil** | 380 → 50 → 11 | 11 partidas |
| BF9 | Em quais partidas o mandante marcou pelo menos 5 gols, e em que rodada? | *At least* + segunda variável | 380 → 5 | Grêmio 5x1 Coritiba (12ª), Vasco 5x1 Coritiba (24ª), Internacional 7x1 Santos (28ª), Fluminense 5x3 Goiás (29ª), Palmeiras 5x0 São Paulo (29ª) |

Na BF4 e na BF5, MAX/MIN só se aplica a um **valor literal**, não a uma
variável de valor literal (nota do vídeo, F20); o enunciado da tarefa não
precisa dizer isso, mas a dificuldade é maior.

### A.2 Pré-visualização e exploração em etapas

Questões com duas ou mais variáveis, em que *Find matching values* e o
*Possible graph* ajudam a escolher e conferir os valores etapa por etapa.

| # | Questão proposta | Etapas (variáveis) | Resposta |
|---|---|---|---|
| BP1 | Quais atletas marcaram gols na partida Goiás 4x6 Bahia? | gol → atleta | 7 atletas: Everaldo (3 gols), Guilherme Marques (2), Gilberto, Matheus Babi, João Magno, Rafael Ratão, Gabriel Teixeira |
| BP2 | Quais atletas do Flamengo marcaram gol no primeiro tempo? | atleta → gol (booleano `marcadoNoPrimeiroTempo`) | 11: Arrascaeta, Ayrton Lucas, David Luiz, Everton, Gabriel, Gerson, Luiz Araújo, Marinho, Matheus França, Pedro, Pulgar |
| BP3 | Em quais estádios as equipes rebaixadas mandaram seus jogos? | equipe (rebaixada) → partida → estádio | 7: Independência, Mineirão, Parque do Sabiá (América-MG); Couto Pereira, Durival Britto (Coritiba); Serrinha (Goiás); Vila Belmiro (Santos) |
| BP4 | Quais atletas marcaram gol na partida de maior placar do visitante? | MAX (BF5) + gol → atleta | igual à BP1, mas sem dizer qual é a partida: **combina filtro e preview** (desafio) |

BP1 e BP4 têm a mesma resposta de propósito: no mesmo sorteio, sortear só
uma das duas. A BP4 é a questão "difícil" do banco, comparável a P11 do
vídeo.
