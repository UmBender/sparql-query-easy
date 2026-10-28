# Questões do estudo de avaliação — atuais e propostas (preview e filtros)

> Reúne todas as questões usadas nos testes da dissertação (as 13 questões
> de competência e os 15 itens do questionário) e propõe questões novas para
> avaliar as funcionalidades de **pré-visualização (preview)** e de
> **filtros**, que surgiram depois da avaliação da dissertação. As propostas
> seguem a mesma metodologia da dissertação e os princípios da Física das
> Notações (Moody, 2009).
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

Critérios, os mesmos da dissertação mais três:

1. Enunciado em linguagem comum, sem termos de SPARQL, como em §4.2.
2. Diferentes dos exemplos que o participante já vê: o exemplo da Help e do
   tour (Fogo com *speed* ≥ 90) e as consultas de teste do STUDY-012
   ("Fast-growing Water fish" e "Toughest Fire Pokémon").
3. Cada questão **exige** pelo menos um filtro ou a exploração em etapas com
   preview. A resposta foi conferida na base (§9).
4. Respostas pequenas (até ~10 valores), para que a correção pelo app
   (`set`, DEC-019) e a leitura pelo participante sejam simples.

Os nomes de tipos e itens aparecem em inglês no app (*Electric*, *Moon
Stone*). O enunciado pode usar os dois: "tipo Elétrico (*Electric*)".

### 5.1 Filtros

| # | Questão proposta | Recursos exigidos | Funil esperado | Resposta |
|---|---|---|---|---|
| NF1 | Quais Pokémon do tipo Elétrico têm velocidade de pelo menos 100? | *At least* + histograma | 151 → 9 → 6 | Electrode (150), Jolteon (130), Raichu (110), Electabuzz (105), Voltorb (100), Zapdos (100) |
| NF2 | Quais Pokémon medem entre 2 e 3 metros de altura? | *Between* com decimais (controle deslizante) | 151 → 9 | Ekans, Exeggutor, Mewtwo, Moltres, Venusaur (2,0); Snorlax (2,1); Dragonite, Kangaskhan (2,2); Lapras (2,5) |
| NF3 | Qual é o Pokémon mais leve? | **MIN** com empate | 151 → 2 | Gastly e Haunter (0,1 kg) |
| NF4 | Qual Pokémon do tipo Psíquico tem o maior ataque especial? | tipo fixo + **MAX** | 151 → 14 → 1 | Mewtwo (154) |
| NF5 | Quais Pokémon têm uma categoria que contém a palavra "Bird"? | *Contains* + sugestões de texto | 151 → 6 | Pidgey, Pidgeotto, Pidgeot, Spearow, Doduo, Dodrio |
| NF6 | Quais Pokémon têm uma categoria que começa com "Poison"? | *Starts with* | 151 → 8 | Nidoran♀, Nidorina, Nidoran♂, Nidorino, Beedrill, Venomoth, Koffing, Weezing |
| NF7 | Quais Pokémon do tipo Água têm defesa e velocidade de pelo menos 80? | tipo + dois *At least*; **funil** de 3 passos | 151 → 32 → 16 → 3 | Kabutops, Seadra, Starmie |
| NF8 | Quais Pokémon que não evoluem de nenhum outro (estágio de evolução 1) têm total de atributos de pelo menos 500? | filtro exato (estágio 1) + *At least*; **funil** | 151 → 79 → 10 | Mewtwo, Mew, Articuno, Moltres, Zapdos, Snorlax, Lapras, Aerodactyl, Pinsir, Scyther |

Notas:

- NF3 e NF4: MAX/MIN só se aplica a um **valor literal**, não a uma variável
  de valor literal (nota do vídeo, F20). O empate da NF3 testa se o
  participante entende que MIN mantém todos os empates.
- NF4: os 14 Pokémon Psíquicos incluem os de tipo secundário (`hasType`).
- NF8 é a mais difícil do bloco: "não evolui de nenhum outro" precisa virar
  `evolutionStage = 1`. Na Help, isso pode exigir uma dica no enunciado
  ("estágio de evolução 1").

### 5.2 Pré-visualização e exploração em etapas

Questões com duas variáveis, em que *Find matching values* e o *Possible
graph* ajudam a escolher e conferir os valores etapa por etapa.

| # | Questão proposta | Etapas (variáveis) | Resposta |
|---|---|---|---|
| NP1 | Em quais Pokémon o Eevee evolui, e qual item é usado em cada evolução? | Pokémon → item | Vaporeon (Water Stone), Jolteon (Thunder Stone), Flareon (Fire Stone) |
| NP2 | Quais Pokémon evoluem usando a Moon Stone, e de qual Pokémon cada um evolui? | Pokémon → pré-evolução | Nidoqueen ← Nidorina, Nidoking ← Nidorino, Clefable ← Clefairy, Wigglytuff ← Jigglypuff |
| NP3 | A quais tipos os Pokémon do tipo Dragão são fracos? | Pokémon → tipo | Dragon, Fairy, Ice (os três); Rock (só Dragonite) |
| NP4 | De quais Pokémon evoluem os Pokémon do tipo Venenoso com o maior ataque? | MAX (empate) + pré-evolução | Muk ← Grimer e Victreebel ← Weepinbell (ataque 105): **combina filtro e preview** (desafio) |

Na NP3, a resposta pedida é o conjunto de tipos (variável de resposta: o
tipo). O preview mostra, para cada Pokémon, de onde vem cada fraqueza. Na
NP4, a variável de resposta é a pré-evolução.

### 5.3 Como sortear

Para replicar o desenho da dissertação (cinco questões sorteadas de um
banco) e cobrir as novas funcionalidades:

- **Cinco tarefas por participante**, sorteadas por estrato: duas de §5.1,
  duas de §5.2 e uma "básica", sem filtro nem preview (ver o passo 3 de
  §8).
- Os grupos de participantes do app (STUDY-006) dão um conjunto fixo e
  ordenado de tarefas a cada grupo. O sorteio pode ser feito ao montar os
  grupos (por exemplo, quatro grupos com combinações diferentes).
- O item 2 do questionário aceita até 20 no app, então seis tarefas também
  funcionam.

## 6. Novos itens do questionário (mesma metodologia)

Os itens 1–15 ficam **inalterados**, para que as pontuações continuem
comparáveis com 57/70 e 15,9/20. Os novos itens entram depois do 15, em
dois blocos de cinco, cada um com a mesma forma do bloco de notação (0–20,
aceitável acima de 10).

Cada bloco tem um item negativo (–), como no SUS, para reduzir a tendência
de concordar com tudo. Para replicar exatamente o bloco de notação (só
positivos), basta reescrever o item negativo na forma positiva indicada.

### 6.1 Bloco "Filtros" (itens 16–20)

| # | Item proposto | Pol. | Princípio |
|---|---|---|---|
| 16 | Como você avaliaria a afirmação de que os nomes dos tipos de filtro (por exemplo *At least*, *Between*, *Contains*, *MAX*) deixam claro o que cada filtro faz? | + | ajuste cognitivo / transparência semântica |
| 17 | Como você avaliaria a afirmação de que o histograma e a lista de entidades mantidas ajudaram a escolher o valor de um filtro? | + | expressividade visual / codificação dupla |
| 18 | Como você avaliaria a afirmação de que o selo "mantidos / total" sobre um nó filtrado mostra claramente o efeito do filtro? | + | codificação dupla |
| 19 | Como você avaliaria a afirmação de que o funil de filtros (*Filter funnel*) ajudou a entender como cada filtro reduziu o resultado? | + | gerenciamento de complexidade / integração cognitiva (monitoramento de rota) |
| 20 | Como você avaliaria a afirmação de que foi difícil distinguir, no grafo, os nós com filtro dos nós sem filtro? | – | discernimento perceptivo (positivo: "…é fácil distinguir…") |

### 6.2 Bloco "Pré-visualização" (itens 21–25)

| # | Item proposto | Pol. | Princípio |
|---|---|---|---|
| 21 | Como você avaliaria a afirmação de que a execução em etapas (*Find matching values*), com as variáveis numeradas, deixou claro em que etapa da consulta você estava? | + | integração cognitiva (orientação) / gerenciamento de complexidade (modularização) |
| 22 | Como você avaliaria a afirmação de que a pré-visualização do grafo (*Possible graph*), ao passar o mouse sobre um valor, ajudou a decidir qual valor escolher? | + | integração cognitiva (escolha de rota) |
| 23 | Como você avaliaria a afirmação de que é fácil relacionar o grafo da pré-visualização com o grafo da consulta no editor? | + | integração cognitiva (integração perceptiva, *visual momentum*) |
| 24 | Como você avaliaria a afirmação de que a pré-visualização e os painéis de filtro deixaram a tela sobrecarregada? | – | economia gráfica / gerenciamento de complexidade (positivo: "…não sobrecarregam…") |
| 25 | Como você avaliaria a afirmação de que conseguiu conferir se a consulta estava certa (pelo funil, pelos selos ou pela pré-visualização) antes de enviar a resposta? | + | integração cognitiva (reconhecimento do destino) |

Rótulos da escala: "1 – Discordo fortemente" … "5 – Concordo fortemente",
como os itens 5–12.

### 6.3 Pontuação

Seguindo a fórmula de §4.5, com positivos `q − 1` e negativos `5 − q`:

- **Filtros** = `(q16 − 1) + (q17 − 1) + (q18 − 1) + (q19 − 1) + (5 − q20)`,
  de 0 a 20, aceitável acima de 10;
- **Pré-visualização** = `(q21 − 1) + (q22 − 1) + (q23 − 1) + (5 − q24) + (q25 − 1)`,
  de 0 a 20, aceitável acima de 10.

Como no item 4 (vídeo), um item de **contexto não pontuado** ajuda a
interpretar os blocos:

- **26.** Quais destes recursos você usou durante as tarefas? (múltipla
  escolha: histograma do filtro, sugestões de texto, selos, funil,
  *Find matching values*, *Possible graph*, *Assume*, *View SPARQL*,
  nenhum).

Quem marca "nenhum" num recurso tem uma nota pouco informativa no item
correspondente. Na análise, separar as médias de quem usou e de quem não
usou o recurso.

## 7. Ameaças à validade (para a discussão)

- **Viés de aquiescência:** a dissertação reconhece (§5.2) que as boas
  notas podem refletir o bom desempenho nas tarefas. Os itens negativos 20 e
  24 e o item de contexto 26 reduzem esse risco.
- **Efeito do vídeo:** se o vídeo demonstra o preview e o funil, as notas
  medem também a qualidade da demonstração. Manter o item 4 e registrar a
  versão do vídeo usada.
- **Dificuldade desigual:** questões sorteadas de bancos diferentes têm
  dificuldades diferentes. Sortear por estrato (§5.3) e registrar quais
  questões cada participante recebeu (o app já registra as tarefas e as
  tentativas).

## 8. Implementação no app (próximos passos, não autorizados ainda)

1. Questões de §5 como tarefas propostas do grupo de teste PokemonGen1,
   desenhadas pelo admin (`/admin/tasks/new`; formato de dados como o de
   `frontend/src/lib/domain/fixtures/demo-study/brasileirao-2023.json`,
   STUDY-013). O servidor guarda a resposta esperada; conferir que ela bate
   com §5.
2. Itens 16–26: nova versão `usability.v3.json`, o mesmo versionamento de
   STUDY-015. As respostas v2 continuam válidas e exportáveis. Duas colunas
   novas no CSV (`filters_score`, `preview_score`) junto a `DissertationScores`.
   O item 26 usa o tipo `multiple_choice`, que o motor de formulários já tem
   (STUDY-009).
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
