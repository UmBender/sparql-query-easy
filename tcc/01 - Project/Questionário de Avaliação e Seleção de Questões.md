# Questionário de avaliação e seleção de questões (vídeo e pesquisa)

> Seleciona **5 questões para o vídeo** (Brasileirão 2023) e **5 para a
> pesquisa real** (PokemonGen1), cada conjunto com 2 fáceis, 2 médias e
> 1 difícil, e monta o questionário final: o `Questionario.docx` (5 itens de
> notação) mais o **SUS completo**. Todas as questões vêm de bancos já
> verificados em [[Questões do Estudo de Avaliação]] (PokemonGen1 §5,
> Brasileirão no Apêndice A) e de [[Base do Vídeo de Apresentação]] (P1–P12),
> com respostas calculadas na base. Termo de aceite:
> [[Termos de Uso da Pesquisa]].

## 1. Os cinco tópicos

São os cinco princípios da Física das Notações (Moody, 2009) que o
`Infografico.png` classifica como **Suportados** pela notação da SPARQL
EasyQuery e que o `Questionario.docx` pergunta. Os outros quatro não entram
(codificação dupla: *não suportado*; integração cognitiva: *não aplicável*;
gerenciamento da complexidade e adequação cognitiva: *não aplicáveis ao
escopo atual*).

| Sigla | Tópico | O que a questão exige do participante |
|---|---|---|
| **CS** | Clareza semiótica | interpretar cada símbolo sem confundir o que ele representa |
| **DP** | Discernimento perceptivo | distinguir tipos de elementos (classe, variável, valor, nó de resultado, nó filtrado) |
| **TS** | Transparência semântica | entender, pela aparência, o que o símbolo ou a relação significa (por exemplo, a direção de uma seta) |
| **EV** | Expressividade visual | usar forma, cor, tamanho ou posição que carregam informação (selo, histograma, numeração) |
| **EG** | Economia gráfica | lidar com vários tipos de símbolo ao mesmo tempo sem se perder |

**Legenda:** ● tópico principal da questão; ○ tópico secundário. A marcação é
um julgamento meu a partir dos passos da solução de cada questão; vale
revisar com o orientador. Todos os cinco tópicos têm pelo menos um ● em cada
conjunto.

## 2. Questões do vídeo (Brasileirão 2023)

Escolhidas entre P1–P12 da nota do vídeo. Ficaram de fora **P1** e **P5**
porque a nota já aponta que repetem as questões de competência C4 e C3 da
dissertação, e o vídeo não pode antecipar as tarefas do teste (§4.1 da
dissertação). Respostas conferidas em 28/10/2026.

| # | Dif. | Questão | Resposta | Recursos mostrados | CS | DP | TS | EV | EG |
|---|---|---|---|---|---|---|---|---|---|
| **V1** (P2) | fácil | Quais estádios têm "Arena" no nome? | 8 estádios | classe, *Contains* com sugestões, selo 8/29 | ● | ● | | ○ | |
| **V2** (P3) | fácil | Quais atletas têm nome começando com "Gabriel"? | 7 atletas | caixa verde de valor, *Connect with defined predicate*, *Starts with* | ○ | ● | ○ | | |
| **V3** (P4) | média | Quais times terminaram entre o 5º e o 10º lugar? | 6 times: Botafogo, Bragantino, Fluminense, Athletico-PR, Internacional, Fortaleza | *Edit value*, *Between*, histograma | ○ | | ○ | ● | |
| **V4** (P8) | média | Em quais jogos o Flamengo perdeu em casa? | 4 jogos | *Run Query*, *Possible graph*, *Assume*, *Undo*; relação `eMandante`, nó cinza | | ○ | ● | ○ | |
| **V5** (P9) | difícil | Em quais estádios o Palmeiras venceu como visitante? | 6 estádios | duas variáveis, *Change order*, *Export/Upload Query* | ○ | ○ | | | ● |

Passos e consultas de cada uma estão em P2, P3, P4, P8 e P9 da
[[Base do Vídeo de Apresentação]]. A V4 é a que mostra o preview, a
funcionalidade mais nova; a V5 fecha o vídeo com o caso mais cheio de
elementos.

## 3. Questões da pesquisa (PokemonGen1)

Escolhidas entre NF1–NF8 e NP1–NP4 (§5.4 do banco). A base do teste é
diferente da do vídeo, como a dissertação exige, e nenhuma delas é o
exemplo da Help (Fogo com *speed* ≥ 90) nem as consultas do STUDY-012.
Como em §5.1 do banco (DEC-020), o participante **salva o diagrama**
(*Save answer*), não vê certo ou errado e não precisa usar variáveis; a
correção é manual pela rubrica de §5.3.

| # | Dif. | Enunciado (como o participante vê) | Resposta esperada | Caminho esperado | CS | DP | TS | EV | EG |
|---|---|---|---|---|---|---|---|---|---|
| **R1** (NF5) | fácil | Quais Pokémon têm uma categoria (*category*) que contém a palavra "Bird"? | Pidgey, Pidgeotto, Pidgeot, Spearow, Doduo, Dodrio (6) | *Contains* + sugestões; funil 151 → 6 | ● | | ○ | | |
| **R2** (NF1) | fácil | Quais Pokémon do tipo Elétrico (*Electric*) têm velocidade (*Speed*) de pelo menos 100? | Electrode, Jolteon, Raichu, Electabuzz, Voltorb, Zapdos (6) | tipo fixo + *At least* + histograma; 151 → 9 → 6 | | ● | | ○ | |
| **R3** (NF7) | média | Quais Pokémon do tipo Água (*Water*) têm defesa (*Defense*) e velocidade (*Speed*) de pelo menos 80? | Kabutops, Seadra, Starmie (3) | tipo + dois *At least*; funil 151 → 32 → 16 → 3 | | ○ | | ● | ○ |
| **R4** (NP1) | média | Em quais Pokémon o Eevee evolui, e qual item (*evolution item*) é usado em cada evolução? | Vaporeon (Water Stone), Jolteon (Thunder Stone), Flareon (Fire Stone) | duas etapas: Pokémon → item; relação *evolves from* | ○ | ○ | ● | | |
| **R5** (NP4) | difícil | De quais Pokémon evoluem os Pokémon do tipo Venenoso (*Poison*) com o maior ataque (*Attack*)? | Muk ← Grimer e Victreebel ← Weepinbell (ataque 105) | tipo + **MAX** com empate + pré-evolução; mistura filtro e preview | ○ | | ○ | ○ | ● |

**Por que esta dificuldade.**

- **Fáceis (R1, R2):** um tipo ou categoria e um único filtro; o resultado
  cabe no funil de um ou dois passos.
- **Médias (R3, R4):** R3 junta tipo e dois filtros em um funil de três
  passos; R4 pede duas etapas, de Pokémon para item, e exige ler a direção
  de *evolves from*.
- **Difícil (R5):** MAX com empate, filtro de tipo e salto até a
  pré-evolução; o enunciado não diz qual é o maior ataque. A nota do banco
  já a chama de "desafio".

**Rubrica e diagrama de referência (forma A):**

```
R1  ?pokémon --category--> ?categoria        [Contains "Bird"]
R2  ?pokémon --has type--> Electric
    ?pokémon --Speed--> ?velocidade          [At least 100]
R3  ?pokémon --has type--> Water
    ?pokémon --Defense--> ?defesa            [At least 80]
    ?pokémon --Speed--> ?velocidade          [At least 80]
R4  ?pokémon --evolves from--> Eevee
    ?pokémon --evolution item--> ?item
R5  ?pokémon --has type--> Poison
    ?pokémon --Attack--> ?ataque             [MAX]
    ?pokémon --evolves from--> ?pré
```

Correta, parcial e incorreta seguem §5.3 do banco. Um diagrama de R5 sem o
tipo Venenoso é **parcial**.

## 4. Questionário de avaliação

Escala de 1 a 5 em todos os itens (rótulos do `Questionario.docx`):
1 Discordo totalmente, 2 Discordo parcialmente, 3 Nem concordo nem
discordo, 4 Concordo parcialmente, 5 Concordo totalmente. Uma resposta por
item. Instrução: "Com base em sua experiência utilizando a SPARQL
EasyQuery, indique seu grau de concordância com cada afirmação."

### Bloco A. Perfil (não pontuado)

Itens 1, 2 e 4 da dissertação (§3 do banco), para comparar com os 32
participantes de 2025. O TCLE já prevê as perguntas de perfil.

| # | Item | Escala |
|---|---|---|
| A1 | Qual é o seu nível de conhecimento sobre SPARQL/RDF? | 1 nenhum a 5 avançado |
| A2 | Quantas das cinco tarefas você conseguiu realizar? | 0 a 5 |
| A3 | Quão útil foi o vídeo de demonstração para aprender a usar a ferramenta? | 1 nada útil a 5 muito útil |

### Bloco B. SUS completo (10 itens)

Formulação das afirmações como na dissertação ("Como você avaliaria a
afirmação de que…"), agora com os 10 itens de Brooke (1995). A dissertação
usou só 7; entram os itens 1, 2 e 8, que permitem a pontuação 0–100 e a
comparação direta com o corte de 68 (Lewis, 2018).

| # | Afirmação | Pol. |
|---|---|---|
| S1 | Eu gostaria de usar esta ferramenta com frequência, sempre que precisasse consultar uma base de dados. | + |
| S2 | A ferramenta é desnecessariamente complexa. | – |
| S3 | A ferramenta é fácil de usar. | + |
| S4 | Eu precisaria de suporte técnico para conseguir usar plenamente a ferramenta. | – |
| S5 | As diferentes funcionalidades da ferramenta estão bem integradas. | + |
| S6 | Existem muitas inconsistências na ferramenta. | – |
| S7 | A maioria das pessoas aprenderia a usar esta ferramenta rapidamente. | + |
| S8 | A ferramenta é muito trabalhosa de usar. | – |
| S9 | Eu me senti muito confiante usando a ferramenta. | + |
| S10 | Eu precisei aprender muitas coisas antes de começar a usar a ferramenta. | – |

### Bloco C. Notação (`Questionario.docx`, 5 itens, todos positivos)

Texto exatamente como no documento.

| # | Afirmação | Tópico |
|---|---|---|
| N1 | Os elementos gráficos da ferramenta possuem significados claros, sem gerar confusão sobre o que representam. | Clareza semiótica |
| N2 | Consegui distinguir facilmente os diferentes tipos de elementos gráficos utilizados na construção das consultas. | Discernimento perceptivo |
| N3 | A aparência dos elementos gráficos me ajudou a compreender o que eles representam na consulta. | Transparência semântica |
| N4 | A utilização de diferentes características visuais, como formas e cores, facilitou a compreensão das consultas. | Expressividade visual |
| N5 | A quantidade de símbolos gráficos diferentes utilizados na ferramenta não dificultou sua compreensão. | Economia gráfica |

Fechamento: "Obrigado por sua participação."

### Pontuação

| Pontuação | Itens | Fórmula | Faixa | Aceitável |
|---|---|---|---|---|
| **SUS** | S1–S10 | `2,5 · (Σ₍S1,S3,S5,S7,S9₎(q − 1) + Σ₍S2,S4,S6,S8,S10₎(5 − q))` | 0–100 | ≥ 68 (Lewis, 2018) |
| **Notação** | N1–N5 | `Σ(q − 1)` | 0–20 | > 10 (metade da escala, critério da dissertação) |
| Por tópico | N1…N5 | média do item, 1–5 | 1–5 | > 3 |

Os itens do bloco A não entram em nenhuma pontuação.

### Ligação entre as questões e os itens N1–N5

Cada tópico tem um ● em pelo menos uma questão de cada conjunto (§2 e §3).
Na análise, a nota de N1–N5 pode ser lida junto com as questões que mais
exercitam cada tópico: N1 com V1/R1, N2 com V2/R2, N3 com V4/R4, N4 com
V3/R3 e N5 com V5/R5.

## 5. Limites e o que não está decidido

- **Comparação com 2025.** O bloco C tem 5 itens novos (os de 2025 eram
  11–15, com outro texto e cobertura), então a nota de notação (0–20) da
  dissertação, 15,9, **não é diretamente comparável**. O SUS de 10 itens é
  comparável com a literatura, e o de 7 itens pode ser recalculado a partir
  de S3, S4, S5, S6, S7, S9, S10 para comparar com 2025.
- **Itens de preview e filtros.** O plano anterior (§6.3–6.5 do banco)
  propunha itens sobre codificação dupla, integração cognitiva, filtros e
  preview. Eles **não entram** nesta versão: o infográfico não classifica
  esses princípios como suportados. A nota continua lá para uma versão
  futura.
- **Nenhum item negativo na notação.** Os cinco itens do documento são
  positivos; isso favorece a concordância automática (§7 do banco). Os
  itens negativos do SUS (S2, S4, S6, S8, S10) ajudam só nesse bloco. Se o
  orientador permitir, a N5 já tem a forma "não dificultou".
- **Marcação dos tópicos por questão** é julgamento (§1); não foi validada
  com o orientador.
- **Respostas** do vídeo e da pesquisa foram conferidas em 28/10/2026 pelo
  banco; não foram refeitas nesta sessão.
- **Implementação no app** (formulário v3 com SUS completo, itens N1–N5 e
  as cinco tarefas R1–R5 no grupo de teste) não foi feita nem autorizada.
