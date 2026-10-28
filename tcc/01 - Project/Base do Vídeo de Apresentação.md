# Base do vídeo de apresentação — SPARQL EasyQuery no Brasileirão 2023

> Nota-base para escrever o roteiro do vídeo de apresentação da ferramenta.
> Pode ser colada inteira em um assistente (Claude no navegador). Ela traz o
> que é a ferramenta, todas as funcionalidades a mostrar, o fluxo de conta e de
> envio de soluções, perguntas de exemplo com a consulta e a resposta
> esperadas, e uma ordem de cenas sugerida.
> Tarefa: DOC-009. As respostas foram conferidas em 27/10/2026 (ver
> "Proveniência").

## 1. O que é a ferramenta

**SPARQL EasyQuery** é um construtor visual de consultas sobre grafos de
conhecimento (dados RDF). Em vez de escrever SPARQL, a pessoa **desenha a
pergunta como um grafo**: cada nó é uma coisa (uma entidade fixa, um valor ou
uma incógnita) e cada seta é uma relação que as respostas precisam ter. O
editor transforma o desenho em uma consulta SPARQL, executa-a no endpoint
escolhido e mostra as respostas.

- **Para quem:** pessoas que conhecem o assunto dos dados mas não sabem
  SPARQL nem o modelo RDF.
- **Ideia central:** "consulta por exemplo". Começa-se de um caso concreto
  (por exemplo, a classificação do Santos), exploram-se as relações dele e
  depois **generaliza-se**: o que era fixo vira variável e ganha filtros.
- **Fontes de dados:** conjuntos embutidos (`CampeonatoBrasileiro2023`,
  `PokemonGen1`), qualquer endpoint SPARQL (por exemplo, Wikidata) ou um
  arquivo `.ttl` enviado pelo usuário.
- **Contexto no TCC:** a ferramenta é avaliada em um **estudo com usuários**.
  Participantes criam conta, aceitam o termo de consentimento, respondem a um
  questionário de perfil, resolvem **consultas propostas** desenhando cada
  resposta no editor e enviando-a, e respondem no fim a um questionário de
  usabilidade. O servidor confere cada resposta automaticamente.
- **Por que o vídeo usa o Brasileirão:** o teste com usuários usa o conjunto
  PokemonGen1. Para não enviesar o teste, o vídeo mostra as mesmas
  funcionalidades em outro domínio: o Campeonato Brasileiro de 2023.
- **Tecnologia (se for citada):** backend em Kotlin + Ktor com Apache Jena;
  frontend em SvelteKit com Cytoscape.js para o grafo; PostgreSQL para contas
  e estudo; implantação com Docker Compose.

A interface está em inglês. Os nomes de botões abaixo são os da tela.

## 2. Conceitos em uma frase cada (para a narração)

- **Grafo RDF:** dados guardados como triplas *sujeito → predicado → objeto*
  (ex.: *Partida Flamengo x Santos → temMandante → Flamengo*).
- **Entidade:** uma coisa identificada por um IRI (um time, um jogador, um
  estádio).
- **Classe:** um tipo de coisa (Equipe, Atleta, Partida…).
- **Valor literal:** número, texto, data ou verdadeiro/falso (ex.: 66 pontos).
- **Variável:** uma incógnita que a consulta procura ("qual time…?").
- **Predicado:** o nome da relação na seta (ex.: `indicaPosicao`).
- **SPARQL:** a linguagem de consulta de grafos RDF que a ferramenta gera.

## 3. O conjunto de dados `CampeonatoBrasileiro2023`

Arquivo `futebol_completo.ttl`, embutido na aplicação. No campo **SPARQL
endpoint** ele aparece como *Campeonato Brasileiro 2023*. Prefixo dos IRIs
como a ferramenta os mostra: `fut: <http://futebol.usp.br/#>`.

| Classe | Quantidade | O que é | Exemplo de rótulo |
|---|---|---|---|
| `Campeonato` | 1 | o campeonato | "Brasileirão 2023" |
| `Equipe` | 20 | times | "Flamengo" |
| `Classificacao` | 20 | linha da tabela final de cada time | "Classificação do Flamengo no Brasileirão 2023" |
| `Rodada` | 38 | rodadas | "34a Rodada" |
| `Partida` | 380 | jogos | "Flamengo x Santos" |
| `Gol` | 946 | gols | "Gol do Pedro ao 44:05 do 1 tempo de Fortaleza x Flamengo" |
| `Atleta` | 331 | jogadores que marcaram gol | "Pedro" |
| `Estadio` | 29 | estádios | "Maracanã" |

Predicados principais (rótulo como aparece no editor):

- **Classificacao:** `indicaPosicao` (→ Equipe), `indicaColocacao`
  (posição 1–20), `incluiPontuacao`, `incluiVitorias`, `incluiEmpates`,
  `incluiDerrotas`, `incluiGolsPro`, `incluiGolsContra`, `incluiSaldoGols`,
  `classificadoLibertadores`, `classificadoSulamericana`, `rebaixado`
  (verdadeiro/falso), `refereSeA` (→ Campeonato).
- **Equipe:** `possuiClassificacao`, `eMandante` / `eVisitante` (→ Partida),
  `formadaPor` (→ Atleta), `participaDe`, `possuiNome`.
- **Partida:** `temMandante` / `temVisitante` (→ Equipe), `placarMandante`,
  `placarVisitante`, `vitoriaMandante`, `vitoriaVisitante`, `empate`,
  `possuiPlacar` (texto "Flamengo 1x2 Santos"), `realizadaEm` (→ Estadio),
  `realizadaNaData` (texto "2023-11-01T20:00:00"), `ocorreEm` (→ Rodada),
  `tem` (→ Gol).
- **Gol:** `marcadoPor` (→ Atleta), `marcadoEm` (→ Partida), `foiContra`,
  `marcadoNoPrimeiroTempo`, `marcadoNoMinuto` (texto).
- **Atleta:** `competePor` (→ Equipe), `marcaGol` (→ Gol), `possuiNome`.
- **Rodada:** `possuiNumero`, `possuiIdentificacao`, `contem` (→ Partida),
  `ocorreDurante` (→ Campeonato).

Muitas relações existem nos dois sentidos (`temMandante` ↔ `eMandante`,
`marcaGol` ↔ `marcadoPor`, `tem` ↔ `marcadoEm`). Por isso uma pergunta pode
ser desenhada a partir de qualquer ponta.

Tabela final (para conferir respostas e fazer comentários no vídeo):

| Pos. | Time | Pts | V | E | D | GP | GC | SG | Liberta. | Sul-Am. | Rebaixado |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Palmeiras | 70 | 20 | 10 | 8 | 64 | 33 | 31 | sim | | |
| 2 | Grêmio | 68 | 21 | 5 | 12 | 63 | 56 | 7 | sim | | |
| 3 | Atlético-MG | 66 | 19 | 9 | 10 | 52 | 32 | 20 | sim | | |
| 4 | Flamengo | 66 | 19 | 9 | 10 | 56 | 42 | 14 | sim | | |
| 5 | Botafogo | 64 | 18 | 10 | 10 | 58 | 37 | 21 | sim | | |
| 6 | Bragantino | 62 | 17 | 11 | 10 | 49 | 35 | 14 | sim | | |
| 7 | Fluminense | 56 | 16 | 8 | 14 | 51 | 47 | 4 | sim | | |
| 8 | Athletico-PR | 56 | 14 | 14 | 10 | 51 | 43 | 8 | | sim | |
| 9 | Internacional | 55 | 15 | 10 | 13 | 46 | 45 | 1 | | sim | |
| 10 | Fortaleza | 54 | 15 | 9 | 14 | 45 | 44 | 1 | | sim | |
| 11 | São Paulo | 53 | 14 | 11 | 13 | 40 | 38 | 2 | sim | | |
| 12 | Cuiabá | 51 | 14 | 9 | 15 | 40 | 39 | 1 | | sim | |
| 13 | Corinthians | 50 | 12 | 14 | 12 | 47 | 48 | -1 | | sim | |
| 14 | Cruzeiro | 47 | 11 | 14 | 13 | 35 | 32 | 3 | | sim | |
| 15 | Vasco | 45 | 12 | 9 | 17 | 41 | 51 | -10 | | | |
| 16 | Bahia | 44 | 12 | 8 | 18 | 50 | 53 | -3 | | | |
| 17 | Santos | 43 | 11 | 10 | 17 | 39 | 64 | -25 | | | sim |
| 18 | Goiás | 38 | 9 | 11 | 18 | 36 | 53 | -17 | | | sim |
| 19 | Coritiba | 30 | 8 | 6 | 24 | 41 | 73 | -32 | | | sim |
| 20 | América-MG | 24 | 5 | 9 | 24 | 42 | 81 | -39 | | | sim |

Curiosidades úteis para a narração: o São Paulo, 11º colocado, está marcado
como classificado para a Libertadores (vaga da Copa do Brasil). O maior número
de gols de um atleta no conjunto é do Paulinho (Atlético-MG, 20). Há 21 gols
contra e 98 empates.

## 4. Mapa da tela do editor

- **Barra superior:** logotipo *EasyQuery*, **View SPARQL**, **Help**,
  **Undo** / **Redo**, botão de tema claro/escuro e a conta (**Log in**, ou o
  nome do usuário com **Log out**; administradores veem também **Admin**).
- **Barra de controles:** **Auto Layout** (liga/desliga), **Search nodes**,
  **Limit**, **SPARQL endpoint**, **New Query**, **Add Variable**,
  **Add Literal Value Variable**, botões de arquivo (**Upload Triples**,
  **Export Query**, **Upload Query**), **Filter funnel**, a ordem das
  variáveis (nomes numerados com **Change order**) e **Run Query**.
- **Canvas:** onde o grafo é desenhado. Num canto fica a **legenda**; noutro,
  os botões de zoom (**Zoom in**, **Fit graph**, **Zoom out**).
- **Painéis:** a lista de ações do nó, a tabela de resultados (com caixa
  *Filter…*), o editor de filtro, o painel *Find matching values* com a janela
  *Possible graph*, o painel do funil e o diálogo do SPARQL.

### Tipos de nó e de predicado (legenda)

Regra de cores: elementos fixos mantêm a própria cor; variáveis são verdes.
A legenda tem três colunas.

| Coluna | Elemento | Aparência | Significado |
|---|---|---|---|
| Nodes | **Entity** | círculo azul | coisa fixa (Flamengo, Maracanã) |
| Nodes | **Node variable** (`?`) | círculo verde | entidade desconhecida que a consulta procura |
| Nodes | **Class** | círculo | tipo de coisa (Estadio, Atleta) |
| Nodes | **Multiple results** | círculo cinza "N results" | uma relação que leva a vários valores. Funciona como variável |
| Literals | **Literal value** | caixa rosa | número/texto/data fixo (66, "true") |
| Literals | **Literal value variable** | caixa verde | número/texto/data desconhecido. Pode ter filtro |
| Predicates | **Defined predicate** | seta na cor padrão com rótulo | relação escolhida (`temMandante`) |
| Predicates | **Variable predicate** | seta verde | qualquer relação (`?predicate_1`) |

> Nomes conforme FE-057 e FE-059, que estavam sendo implementadas em
> 27/10/2026. Nomes antigos: *Value* → **Literal value**; *Value variable* /
> *Add Value Variable* → **Literal value variable** / **Add Literal Value
> Variable**; *Variable* → **Node variable**; *Many results* →
> **Multiple results**. Grave o vídeo depois que essas tarefas entrarem.

## 5. Funcionalidades a apresentar

Lista para conferir no roteiro. A coluna "Pergunta" aponta os exemplos da
seção 7 que mostram cada funcionalidade.

| # | Funcionalidade | Onde / como | Pergunta |
|---|---|---|---|
| F1 | Escolher o endpoint | campo **SPARQL endpoint**: *Campeonato Brasileiro 2023*, *Pokémon (generation 1)*, *Wikidata* ou uma URL | todas |
| F2 | **Limit** | quantos resultados cada consulta devolve no máximo | P12 |
| F3 | **Search nodes** | digitar parte do nome. Clicar num resultado adiciona a entidade ao grafo | P1, P2, P8 |
| F4 | Lista de ações do nó | clicar num nó abre a lista. Clicar no fundo fecha | todas |
| F5 | **Explore relationships** | numa entidade, lista as relações dela (tabela com caixa *Filter…*). Escolher uma adiciona o valor: um valor vira nó; vários viram um nó cinza **Multiple results** | P1, P4, P7, P8 |
| F6 | **Explore values** | numa classe, lista os membros dela | P2 |
| F7 | **Convert to variable** | transforma uma entidade ou um valor fixo em variável: o passo de "generalizar o exemplo" | P1, P2, P4 |
| F8 | **Add Variable** | adiciona um nó `?` vazio pela barra de controles | P3, P9, P10 |
| F9 | **Add Literal Value Variable** | adiciona uma variável de valor literal (caixa verde) | P3 |
| F10 | **Connect with defined predicate** | liga dois nós escolhendo a relação numa lista; depois clica-se no nó de destino | P3, P9, P11 |
| F11 | **Connect with variable predicate** | liga dois nós por "qualquer relação" (`?predicate_n`) | P10 |
| F12 | **Convert relation to variable** / **Remove relation** | clicar numa seta | P10 (variação) |
| F13 | Alt + arrastar | desenha uma relação nova de um nó para outro | opcional |
| F14 | **Remove** | apaga um nó | P9 |
| F15 | **Toggle Boolean value** | troca *true*/*false* num valor booleano | P1 |
| F16 | **Add value filter** | numa variável, escolhe uma relação de valor e cria uma variável de valor literal com filtro | P2, P7, P8 |
| F17 | **Edit filter** / **Edit value** | abre o editor de filtro de uma variável de valor literal / de um valor literal | P4, P5, P6 |
| F18 | Filtros de texto | *Exact match*, *Starts with*, *Contains*, com sugestões ao digitar | P2, P3, P12 |
| F19 | Filtros numéricos | *At least (≥)*, *At most (≤)*, *Between* (com histograma e controle deslizante) | P4, P5, P11 |
| F20 | **MAX / MIN** | só num valor literal (não numa variável de valor literal). Mantém todos os empates | P6 |
| F21 | Histograma e entidades mantidas | o editor mostra a distribuição real dos valores e percorre as entidades que o filtro mantém | P4, P5 |
| F22 | Selos (*badges*) | "mantidos / total" acima do nó filtrado. Com sujeito fixo, mostra o valor real com ✓/✗ | P2, P5 |
| F23 | **Filter funnel** | como cada filtro reduz o resultado, passo a passo. Desmarcar um passo só pré-visualiza | P5 |
| F24 | **Run Query** em etapas | as variáveis são exploradas uma por vez, na ordem numerada. O painel *Find matching values* lista só os valores compatíveis com os já escolhidos | P8, P9 |
| F25 | **Change order** | reordena as etapas (arrastar ou setas) | P9 |
| F26 | Pré-visualização *Possible graph* | passar o mouse sobre um valor mostra o grafo concreto a que ele leva | P8, P9 |
| F27 | **Assume** / **Apply to graph** / **Change** | **Assume** aplica um valor ao grafo na hora; **Apply to graph** aplica os valores escolhidos; **Change** volta a uma etapa | P8, P9 |
| F28 | **Run query** (na lista de ações) | consulta só aquela variável e mostra a tabela de resultados | P10 |
| F29 | **View SPARQL** | mostra o SPARQL gerado, com **Copy** | P2, P5, P9 |
| F30 | **Export Query** / **Upload Query** | salva grafo, endpoint e ordem num `.json` e reabre depois | P9 |
| F31 | **Upload Triples** | envia um `.ttl` e consulta-o como base local (seção 7, extra) | extra |
| F32 | **Auto Layout**, zoom, **Fit graph** | arruma o grafo; zoom pelos botões ou pela roda do mouse | todas |
| F33 | **Undo** / **Redo** (Ctrl+Z / Ctrl+Y), **New Query** | desfaz, refaz, limpa | P8 |
| F34 | Tema claro/escuro | botão lua/sol | opcional |
| F35 | **Help** e tour guiado | página `/help` com exemplo; **Start the tour** reinicia o tour | abertura |
| F36 | Conta e estudo | **Log in**, criar conta, consentimento, questionários, tarefas, **Submit answer**, tentativas, **Finish the study** | seção 6 |

## 6. Conta, estudo e envio de soluções

### 6.1 Participante

1. **Convite:** o participante recebe o endereço da página de tarefas
   (`/study`). O editor (`/`) funciona sem conta; o link **Study** na barra
   do editor também abre `/study` (FE-061). Quem abre `/study` sem sessão vai
   para o login e volta depois.
2. **Login / criar conta** (`/login`): *Username* e *Password*; **Create an
   account** troca para o cadastro (*Repeat the password*), que já entra na
   conta. Não há recuperação de senha. *Continue without an account* volta
   ao editor.
3. **Consentimento:** tela *Consent to take part* com o termo. **I agree to
   take part** registra o aceite (versão do termo e horário). **I do not
   agree** não guarda nada, e o editor continua disponível. Nada do estudo é
   gravado antes do aceite.
4. **Questionário de perfil** ("Before the proposed queries, please answer a
   few questions about yourself."): obrigatório antes das tarefas. Pode ter
   várias páginas, e o progresso fica no navegador. Só pode ser enviado uma
   vez.
5. **Lista de tarefas** (*Proposed queries*): as tarefas do grupo do
   participante, na ordem definida pelo pesquisador. Cada uma tem título e
   resumo. Também há *Back to the editor*, *Log out* e **Finish the study**.
6. **Tela da tarefa** (`/study/<chave>`): à direita, título e enunciado; à
   esquerda, o editor completo, já no endpoint da tarefa (travado) e, se
   houver, com um grafo inicial. O participante desenha a resposta como em
   qualquer consulta. No topo do painel, **← Proposed queries** volta à
   lista (o Voltar do navegador também funciona).
7. **Answer variable:** botões de opção com as variáveis de nó (`?`) do
   grafo; escolhe-se a que contém a resposta. Variáveis de valor literal e
   predicados variáveis não podem ser a resposta.
8. **Submit answer:** o navegador envia o grafo e a consulta derivada dele. O
   servidor executa a consulta no endpoint da tarefa, compara os valores da
   variável de resposta com o resultado esperado (como conjunto) e responde
   só o veredito e as contagens, nunca a resposta esperada:
   - `Correct: all N expected results.` Abaixo aparecem *Back to the tasks*
     e, se houver uma tarefa seguinte na ordem do grupo, **Next task**.
   - `Incorrect: M of N expected results; X extra.`
   - `The query could not run: …` (tentativa inválida, também registrada).
   Erros de desenho aparecem antes do envio (ex.: *Draw at least one
   relation before submitting.*, *Choose the variable that holds the
   answer.*).
9. **Your attempts:** histórico com número, veredito, tempo desde a primeira
   abertura da tarefa (m:ss) e a mensagem. As tentativas são ilimitadas até a
   submissão final.
10. **Finish the study** → diálogo *Finish the study?* → **Finish and
    submit** (ou *Keep working*). Depois disso as tarefas ficam fechadas.
11. **Questionário de usabilidade** ("You made your final submission. One
    last questionnaire about using the editor."), depois a tela **Study
    finished**.

O que fica gravado por tentativa: grafo, consulta, SPARQL gerado, variável de
resposta, termos retornados e contagens, veredito, revisão da tarefa e tempo
gasto.

### 6.1.1 Tarefas de treino na stack local (STUDY-013)

As perguntas P1, P2, P4, P5, P6, P8, P9 e P10 existem como tarefas no grupo
**Demo Brasileirão 2023**. Para usá-las como um testador, na stack Compose
local: [[../07 - Operations/Docker Compose Stack#Brasileirão demo tasks (STUDY-013)]]
(`npm --prefix frontend run demo:seed`, depois login e `/study`).

### 6.2 Pesquisador (administrador), opcional no vídeo

- Contas de administrador são definidas na configuração do servidor
  (`EASYQUERY_ADMIN_USERNAMES`). O botão **Admin** leva a `/admin`.
- **Criar tarefa** (`/admin/tasks/new`): chave, título, enunciado, endpoint
  embutido, grafo inicial opcional e a **consulta de referência desenhada no
  mesmo editor**. Escolhe-se a variável de resposta, usa-se *Preview expected
  result* e salva-se. O servidor executa a referência e guarda o resultado
  esperado. Tarefas podem ser desativadas, mas nunca são apagadas.
- **Grupos** (`/admin/groups`): cada participante fica em um grupo; cada grupo
  tem suas tarefas em ordem.
- `/admin` também baixa as respostas dos questionários em CSV.

## 7. Perguntas de exemplo (fácil → difícil)

Convenções:

- Endpoint sempre *Campeonato Brasileiro 2023*.
- "SPARQL esperado" é a forma que **View SPARQL** mostra, sem as linhas
  `OPTIONAL { ?x rdfs:label ?xLabel … }` que o editor acrescenta para exibir
  os nomes. `PREFIX fut: <http://futebol.usp.br/#>`; nas consultas reais o
  editor escreve os IRIs completos.
- As respostas valem com **Limit** padrão ou maior. Todas as respostas são
  conjuntos (sem ordem e sem repetição).
- Os passos usam só ações que existem no editor. Os passos de busca usam
  termos que de fato trazem a entidade (ver "Cuidados").

### P1 — Quais times foram rebaixados? (fácil)

Funcionalidades: F3, F5, F7, F15, valor booleano, consulta por exemplo.

Passos:
1. **Search nodes** → "Classificação do Santos" → clicar no resultado.
2. Clicar no nó → **Explore relationships** → `rebaixado` (adiciona o valor
   literal `true`).
3. De novo **Explore relationships** → `indicaPosicao` (adiciona a entidade
   *Santos*).
4. **Convert to variable** na classificação e em *Santos*.
5. **Run Query** (ou **Submit answer** com a variável do time).
   Para mostrar F15: **Toggle Boolean value** no `true` lista quem **não**
   caiu (16 times). Volte para `true`.

```sparql
SELECT DISTINCT ?equipe WHERE {
  ?classificacao fut:rebaixado ?literalValue1 .
  FILTER (str(?literalValue1) = "true") .
  ?classificacao fut:indicaPosicao ?equipe .
}
```

Resposta (4): **América-MG, Coritiba, Goiás, Santos**.

### P2 — Quais estádios têm "Arena" no nome? (fácil)

Funcionalidades: F3, F5 (classe por `rdf:type`), F6, F7, F16, F18
*Contains* com sugestões, F22, F29.

Passos:
1. **Search nodes** → "Maracanã".
2. **Explore relationships** → linha `…#type` (sem rótulo; use *Filter…*
   com "type") → adiciona a classe **Estadio**.
3. Na classe: **Explore values** lista os 29 estádios (só para mostrar).
4. *Maracanã* → **Convert to variable**.
5. Na variável → **Add value filter** → `possuiNome` → *Contains* → digitar
   "Arena" (aparecem sugestões) → **Apply**. O selo mostra 8 / 29.
6. **View SPARQL**, depois **Run Query**.

```sparql
SELECT DISTINCT ?estadio WHERE {
  ?estadio rdf:type fut:Estadio .
  ?estadio fut:possuiNome ?nome .
  FILTER (isLiteral(?nome) && CONTAINS(STR(?nome), "Arena"))
}
```

Resposta (8): **Arena Barueri, Arena Corinthians, Arena MRV, Arena
Palmeiras, Arena Pantanal, Arena da Baixada, Arena do Grêmio, Arena do
Jacaré**.

### P3 — Quais atletas têm nome começando com "Gabriel"? (fácil)

Funcionalidades: F8/F9 pela barra de controles, F10, F17, F18 *Starts with*.

Passos:
1. **Search nodes** → "Endrick" → **Explore relationships** → `…#type` →
   classe **Atleta**. *Endrick* → **Convert to variable**.
2. **Add Literal Value Variable** (caixa verde).
3. Na variável do atleta → **Connect with defined predicate** → `possuiNome`
   → clicar na caixa verde.
4. Na caixa verde → **Edit filter** → *Starts with* → "Gabriel" → **Apply**.

```sparql
SELECT DISTINCT ?atleta WHERE {
  ?atleta rdf:type fut:Atleta .
  ?atleta fut:possuiNome ?nome .
  FILTER (isLiteral(?nome) && STRSTARTS(STR(?nome), "Gabriel"))
}
```

Resposta (7): **Gabriel, Gabriel Menino, Gabriel Moscardo, Gabriel Neves,
Gabriel Pec, Gabriel Pirani, Gabriel Teixeira**.

### P4 — Quais times terminaram entre o 5º e o 10º lugar? (médio)

Funcionalidades: F5, F7, F17 **Edit value**, F19 *Between*, F21 histograma.

Passos:
1. **Search nodes** → "Classificação do Botafogo".
2. **Explore relationships** → `indicaPosicao` (Botafogo) e
   `indicaColocacao` (valor `5`).
3. **Convert to variable** na classificação e em *Botafogo*.
4. No valor `5` → **Edit value** → *Between* → ajustar o controle deslizante
   no histograma para `5..10` → **Apply** (o rótulo vira `5–10`).

```sparql
SELECT DISTINCT ?equipe WHERE {
  ?classificacao fut:indicaPosicao ?equipe .
  ?classificacao fut:indicaColocacao ?colocacao .
  FILTER (?colocacao >= 5 && ?colocacao <= 10)
}
```

Resposta (6): **Botafogo, Bragantino, Fluminense, Athletico-PR,
Internacional, Fortaleza**.

### P5 — Quais times foram à Libertadores com menos de 60 pontos? (médio)

Funcionalidades: F7, F15, F19 *At most*, F21, F22 selos, **F23 funil**, F29.

Passos:
1. **Search nodes** → "Classificação do Fluminense" → **Explore
   relationships** → `indicaPosicao`, `classificadoLibertadores` (`true`) e
   `incluiPontuacao` (`56`).
2. **Convert to variable** na classificação e em *Fluminense*.
3. No `56` → **Edit value** → *At most (≤)* → `59` → **Apply**.
4. **Filter funnel**: 20 → 8 com Libertadores = true → 2 com pontos ≤ 59.
   Desmarcar um passo e marcar de novo.
5. Curiosidade para a narração: o São Paulo (11º) aparece por ter a vaga da
   Copa do Brasil.

```sparql
SELECT DISTINCT ?equipe WHERE {
  ?classificacao fut:indicaPosicao ?equipe .
  ?classificacao fut:classificadoLibertadores ?literalValue1 .
  FILTER (str(?literalValue1) = "true") .
  ?classificacao fut:incluiPontuacao ?pontos .
  FILTER (?pontos <= 59)
}
```

Resposta (2): **Fluminense, São Paulo**.

### P6 — Quais times mais empataram? (médio — MAX com empate)

Funcionalidades: F17, **F20 MAX** mantendo todos os empatados.

Passos:
1. **Search nodes** → "Classificação do Cruzeiro" → **Explore
   relationships** → `indicaPosicao` e `incluiEmpates` (`14`).
2. **Convert to variable** na classificação e em *Cruzeiro*.
3. No `14` → **Edit value** → *MAX* → **Apply**.

```sparql
SELECT DISTINCT ?equipe WHERE {
  ?classificacao fut:indicaPosicao ?equipe .
  ?classificacao fut:incluiEmpates ?empates .
  { SELECT (MAX(?e) AS ?maximo) WHERE {
      ?c fut:indicaPosicao ?t . ?c fut:incluiEmpates ?e . } }
  FILTER (?empates = ?maximo)
}
```

Resposta (3, empatados com 14): **Athletico-PR, Corinthians, Cruzeiro**.
Variações de uma resposta só: *MAX* em `incluiGolsPro` → **Palmeiras** (64);
*MIN* em `incluiSaldoGols` → **América-MG** (−39).

> Desde o BUG-012, **View SPARQL** mostra o MAX/MIN real (a subconsulta com
> `MAX(...)`/`MIN(...)` e `FILTER (?literalValue0 = ?__extreme0)`).

### P7 — Quais atletas marcaram gol contra? (médio — dois saltos)

Funcionalidades: F5 com **Multiple results**, F16 numa variável cinza, F18
*Exact match*, F7.

Passos:
1. **Search nodes** → "Hulk" → **Explore relationships** → `marcaGol` →
   aparece o nó cinza **15 results** (os gols dele).
2. No nó cinza → **Add value filter** → `foiContra` → *Exact match* → `true`
   → **Apply**.
3. *Hulk* → **Convert to variable**. Resposta: a variável do atleta.

```sparql
SELECT DISTINCT ?atleta WHERE {
  ?atleta fut:marcaGol ?gol .
  ?gol fut:foiContra ?contra .
  FILTER (isLiteral(?contra) && str(?contra) = "true")
}
```

Resposta (21): **Alan Empereur, Brítez, Guga, Jean Lucas, Jemerson, João
Basso, João Pedro, Kanu, Kevyson, Léo Ortiz, Marlon, Marlon Freitas,
Murillo, Nicolás Hernández, Piquerez, Rafinha, Rikelme, Sidimar, Tobias
Figueiredo, Victor Luis, Éder**.

### P8 — Em quais jogos o Flamengo perdeu em casa? (médio — exploração em etapas)

Funcionalidades: F3, F5, F16, **F24 Run Query**, **F26 Possible graph**,
**F27 Assume / Apply**, F33 Undo.

Passos:
1. **Search nodes** → "Flamengo" → escolher o time *Flamengo* (a lista
   também traz jogos e gols).
2. **Explore relationships** → `eMandante` → nó cinza **19 results**.
3. No nó cinza → **Add value filter** → `vitoriaVisitante` → *Exact match*
   → `true`.
4. **Run Query** → *Find matching values* lista 4 jogos. Passar o mouse sobre
   um jogo mostra o *Possible graph*. **Assume** num jogo coloca-o no grafo;
   **Undo** volta.

```sparql
SELECT DISTINCT ?partida WHERE {
  fut:EquipeFLA fut:eMandante ?partida .
  ?partida fut:vitoriaVisitante ?vitoria .
  FILTER (isLiteral(?vitoria) && str(?vitoria) = "true")
}
```

Resposta (4): **Flamengo x Athletico-PR, Flamengo x Atlético-MG, Flamengo x
Botafogo, Flamengo x Santos**. Com `temMandante` a partir de uma variável
de partida, a resposta é a mesma.

### P9 — Em quais estádios o Palmeiras venceu como visitante? (difícil — duas variáveis)

Funcionalidades: F14, F8, F10, **F24/F25** (ordem das etapas), F26, F27,
F29, **F30 Export/Upload Query**.

Passos:
1. **Search nodes** → "Classificação do Palmeiras" → **Explore
   relationships** → `indicaPosicao` (Palmeiras). Na classificação →
   **Remove**.
2. *Palmeiras* → **Explore relationships** → `eVisitante` → **19 results**.
3. No nó cinza → **Add value filter** → `vitoriaVisitante` → *Exact match*
   `true`.
4. **Add Variable**. No nó cinza → **Connect with defined predicate** →
   `realizadaEm` → clicar na nova variável.
5. A ordem numerada mostra as duas variáveis (jogo e estádio). **Change
   order** põe o estádio primeiro. **Run Query**: escolher um estádio e ver na
   etapa seguinte só os jogos compatíveis. **Change** volta, **Apply to graph**
   aplica.
6. **Export Query** salva o `.json`, **New Query** limpa e **Upload Query**
   reabre o mesmo grafo.

```sparql
SELECT DISTINCT ?estadio WHERE {
  fut:EquipePAL fut:eVisitante ?partida .
  ?partida fut:vitoriaVisitante ?vitoria .
  FILTER (isLiteral(?vitoria) && str(?vitoria) = "true")
  ?partida fut:realizadaEm ?estadio .
}
```

Resposta (6 estádios): **Arena Pantanal, Couto Pereira, Independência,
Morumbi, Nilton Santos (Engenhão), Serrinha**. Com a variável do jogo como
resposta: América-MG x Palmeiras, Botafogo x Palmeiras, Coritiba x
Palmeiras, Cuiabá x Palmeiras, Goiás x Palmeiras, São Paulo x Palmeiras.

### P10 — Quais jogos do Santos terminaram empatados, em casa ou fora? (difícil — predicado variável)

Funcionalidades: **F11 Connect with variable predicate**, F28, F16, F12.

Passos:
1. **Search nodes** → "Classificação do Santos" → **Explore
   relationships** → `indicaPosicao` (Santos). Na classificação → **Remove**.
2. **Add Variable** (o jogo). Nela → **Connect with variable predicate** →
   clicar em *Santos*. Surge a seta verde `?predicate_1`: "qualquer relação
   com o Santos".
3. Didático: **Run query** na variável sem filtro traz **56** resultados (38
   jogos, a classificação do Santos e 17 atletas). Um predicado variável pega
   qualquer relação.
4. Na variável → **Add value filter** → `empate` → *Exact match* `true` →
   10 resultados. No **Run Query** em etapas, a etapa do predicado lista
   `temMandante` e `temVisitante`.
5. Variação F12: desenhar com `temMandante` e usar **Convert relation to
   variable** na seta.

```sparql
SELECT DISTINCT ?partida WHERE {
  ?partida ?predicate_1 fut:EquipeSAN .
  ?partida fut:empate ?empate .
  FILTER (isLiteral(?empate) && str(?empate) = "true")
}
```

Resposta (10): **Botafogo x Santos, Corinthians x Santos, Coritiba x
Santos, Santos x Athletico-PR, Santos x Atlético-MG, Santos x Botafogo,
Santos x Cuiabá, Santos x Internacional, Santos x Palmeiras, Santos x São
Paulo** (os 10 empates do Santos na tabela).

### P11 — Quem marcou gol no Maracanã em jogos em que o mandante fez 3 ou mais gols? (desafio — três saltos)

Funcionalidades: cadeia de variáveis, F10, F19 *At least*, F24.

Passos:
1. **Search nodes** → "Flamengo x Coritiba" → **Explore relationships** →
   `realizadaEm` (Maracanã), `placarMandante` (`3`) e `tem` (nó cinza com os
   gols do jogo).
2. **Add Variable** (o atleta). No nó cinza → **Connect with defined
   predicate** → `marcadoPor` → clicar na nova variável.
3. Jogo → **Convert to variable**. No `3` → **Edit value** → *At least (≥)*
   `3`.
4. Resposta: a variável do atleta.

```sparql
SELECT DISTINCT ?atleta WHERE {
  ?partida fut:tem ?gol .
  ?gol fut:marcadoPor ?atleta .
  ?partida fut:realizadaEm fut:Estadio19 .   # Maracanã
  ?partida fut:placarMandante ?placar .
  FILTER (?placar >= 3)
}
```

Resposta (13): **Arias, Arrascaeta, Ayrton Lucas, Bruno Henrique, Co,
Everton, Felipe Azevedo, Fábio Santos, Gabriel, John Kennedy, Lima, Pedro,
Yuri Alberto**. Os jogos são Flamengo 3x0 Coritiba, Flamengo 3x0 Grêmio,
Flamengo 3x0 Palmeiras, Fluminense 3x1 América-MG e Fluminense 3x3
Corinthians. A lista inclui atletas visitantes e quem fez gol contra.

### P12 — Quais jogos foram em dezembro de 2023? (extra — data como texto)

Funcionalidades: F18 *Starts with* num valor literal, F2 **Limit**.

Passos:
1. **Search nodes** → "Flamengo x Cuiabá" → **Explore relationships** →
   `realizadaNaData`.
2. Jogo → **Convert to variable**. Na data → **Edit value** → *Starts with*
   `2023-12`.
3. Opcional: **Limit** = 10 mostra o corte no número de resultados.

```sparql
SELECT DISTINCT ?partida WHERE {
  ?partida fut:realizadaNaData ?data .
  FILTER (STRSTARTS(STR(?data), "2023-12"))
}
```

Resposta (20 jogos): América-MG x Bahia, Athletico-PR x Santos,
Atlético-MG x São Paulo, Bahia x Atlético-MG, Botafogo x Cruzeiro,
Bragantino x Coritiba, Corinthians x Internacional, Coritiba x Corinthians,
Cruzeiro x Palmeiras, Cuiabá x Athletico-PR, Flamengo x Cuiabá,
Fluminense x Grêmio, Fortaleza x Goiás, Goiás x América-MG, Grêmio x Vasco,
Internacional x Botafogo, Palmeiras x Fluminense, Santos x Fortaleza, São
Paulo x Flamengo, Vasco x Bragantino.

### Extra — Upload Triples com um arquivo pequeno

Salve como `selecoes.ttl` e envie com **Upload Triples**. O endpoint passa a
ser a base enviada. A busca exige rótulos `@en` e entidades cujo tipo é uma
`owl:Class`.

```turtle
@prefix ex:   <http://example.org/copa#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .

ex:Selecao a owl:Class ; rdfs:label "Seleção"@en .
ex:Continente a owl:Class ; rdfs:label "Continente"@en .
ex:titulosMundiais a owl:DatatypeProperty ; rdfs:label "titulosMundiais"@en .
ex:continente a owl:ObjectProperty ; rdfs:label "continente"@en .
ex:AmericaDoSul a ex:Continente ; rdfs:label "América do Sul"@en .
ex:Europa a ex:Continente ; rdfs:label "Europa"@en .
ex:Brasil a ex:Selecao ; rdfs:label "Brasil"@en ; ex:titulosMundiais 5 ; ex:continente ex:AmericaDoSul .
ex:Argentina a ex:Selecao ; rdfs:label "Argentina"@en ; ex:titulosMundiais 3 ; ex:continente ex:AmericaDoSul .
ex:Uruguai a ex:Selecao ; rdfs:label "Uruguai"@en ; ex:titulosMundiais 2 ; ex:continente ex:AmericaDoSul .
ex:Alemanha a ex:Selecao ; rdfs:label "Alemanha"@en ; ex:titulosMundiais 4 ; ex:continente ex:Europa .
ex:Italia a ex:Selecao ; rdfs:label "Itália"@en ; ex:titulosMundiais 4 ; ex:continente ex:Europa .
ex:Franca a ex:Selecao ; rdfs:label "França"@en ; ex:titulosMundiais 2 ; ex:continente ex:Europa .
```

Pergunta: *seleções sul-americanas com pelo menos 3 títulos* → buscar
"Brasil", **Explore relationships** → `continente` e `titulosMundiais`,
**Convert to variable** em *Brasil*, *At least* `3` no `5`. Resposta:
**Brasil, Argentina**.

### Resumo

| P | Nível | Pergunta | Resposta | Destaques |
|---|---|---|---|---|
| P1 | fácil | rebaixados | 4 | busca, Explore relationships, Convert to variable, booleano |
| P2 | fácil | estádios "Arena" | 8 | classe, Explore values, Contains, selo |
| P3 | fácil | atletas "Gabriel…" | 7 | Add Literal Value Variable, Connect with defined predicate, Starts with |
| P4 | médio | 5º a 10º lugar | 6 | Between, histograma |
| P5 | médio | Libertadores com < 60 pts | 2 | At most, funil, View SPARQL |
| P6 | médio | mais empates | 3 | MAX com empates |
| P7 | médio | gols contra | 21 | Multiple results, Add value filter |
| P8 | médio | Flamengo perdeu em casa | 4 | Run Query, Possible graph, Assume, Undo |
| P9 | difícil | estádios das vitórias do Palmeiras fora | 6 | duas variáveis, Change order, Export/Upload Query |
| P10 | difícil | empates do Santos | 10 | predicado variável |
| P11 | desafio | gols no Maracanã com mandante ≥ 3 | 13 | três saltos, At least |
| P12 | extra | jogos em dezembro | 20 | Starts with em data-texto, Limit |

Sugestão para as tarefas do estudo de teste (STUDY-013): P1, P2, P4, P5, P6,
P8, P9 e P10.

## 8. Roteiro sugerido (cerca de 10–12 minutos)

1. **Abertura (0:30):** problema (dados abertos em RDF exigem SPARQL) e a
   proposta (desenhar a pergunta). Mostrar a tela inicial.
2. **Tour e ajuda (0:45):** o tour guiado em poucos passos e a página Help.
   Escolher *Campeonato Brasileiro 2023* no endpoint.
3. **O conjunto de dados (0:30):** classes e o que dá para perguntar.
4. **Primeira consulta por exemplo — P1 (1:30):** busca, Explore
   relationships, Convert to variable, legenda, Toggle Boolean value, Run
   Query.
5. **Classes e filtros de texto — P2 e/ou P3 (1:30):** Explore values, Add
   value filter com Contains e sugestões, Add Literal Value Variable e
   Connect with defined predicate, selos, View SPARQL.
6. **Filtros numéricos — P4, P5, P6 (2:00):** Between no histograma, At
   most, funil desmarcando passos, MAX mantendo empates.
7. **Exploração em etapas — P8/P9 (2:00):** Multiple results, Run Query com a
   ordem numerada, Change order, Possible graph, Assume, Apply to graph,
   Undo/Redo, Export/Upload Query.
8. **Predicado variável — P10 (1:00):** "qualquer relação" e por que o
   filtro reduz de 56 para 10.
9. **Arquivos e outros endpoints (0:45):** Upload Triples com o arquivo pequeno
   e menção a Wikidata, auto layout, zoom e tema.
10. **O estudo (1:30):** criar conta, consentimento, questionário de perfil,
    lista de tarefas, abrir uma tarefa (ex.: P5), desenhar, escolher a
    *Answer variable*, **Submit answer** com uma tentativa errada (sem o
    filtro de pontos → `Incorrect: 2 of 2 expected results; 6 extra.`) e
    depois a certa (`Correct: all 2 expected results.`), histórico,
    **Finish the study**, questionário final.
11. **Fechamento (0:20):** resumo e convite para o teste.

## 9. Cuidados ao gravar

- **Busca com limite de 20:** **Search nodes** traz no máximo 20 entidades
  cujo rótulo contém o texto. Desde o BUG-011 o rótulo igual ao texto vem
  primeiro, depois os que começam com ele: "Santos", "Palmeiras" e "Grêmio"
  trazem o time no topo. Antes da correção só vinham gols e jogos; se gravar
  numa versão anterior, use "Classificação do <time>" ou um jogo
  ("Palmeiras x Santos").
- **Classes não aparecem na busca:** chega-se a elas por `…#type` em
  **Explore relationships**. Essa linha não tem rótulo; use a caixa
  *Filter…*.
- **View SPARQL e filtros:** corrigido pelo BUG-012 (2026-10-28). Antes,
  num valor literal, **View SPARQL** mostrava qualquer filtro (MAX/MIN
  inclusive) como igualdade (`str(?x) = "14"`), herança da versão C#; agora
  mostra o filtro que **Run Query** aplica.
- **MAX/MIN** só aparecem no editor de um **valor literal** (via **Edit
  value**), não numa variável de valor literal. O texto atual do tour sugere o
  contrário.
- **Datas são texto** (`realizadaNaData`): use *Starts with*/*Contains*.
  *At least*/*Between* não se aplicam a elas.
- **Predicado variável pega tudo:** sem outro filtro, `?p Santos` traz jogos,
  atletas e a classificação (é o ponto didático de P10).
- **Respostas são variáveis de nó:** no estudo, a *Answer variable* precisa
  ser um nó `?` ou cinza, nunca uma caixa verde.
- **Nomes de tela:** grave depois de FE-057/FE-059 (nomes novos e legenda de
  três colunas) e confira os nomes na tela final.

## 10. Proveniência

- Dados: `src/main/resources/futebol_completo.ttl` (o mesmo arquivo do
  endpoint `CampeonatoBrasileiro2023`; DATA-001).
- Conferência em 27/10/2026, sem serviços externos:
  1. Backend local (`./gradlew run`, sem banco de dados). Cada pergunta foi
     enviada a `POST /api/query` no formato que o editor gera, o mesmo serviço
     que confere as respostas do estudo. A busca, a exploração de relações e o
     envio de `.ttl` também foram testados.
  2. Consultas SPARQL independentes, escritas à mão e executadas com Apache
     Jena sobre o arquivo `.ttl`. Todas as contagens bateram.
- Fontes dos nomes e fluxos: `frontend/src/routes/help/+page.svelte`,
  `frontend/src/lib/features/editor/editor-toolbar.svelte`,
  `frontend/src/lib/domain/legacy/graph-actions.ts`,
  `frontend/src/lib/features/filters/filter-form.ts`,
  `frontend/src/lib/features/utilities/tour-steps.ts`,
  `frontend/src/lib/features/study/`, `frontend/src/routes/study/`, os cartões
  FE-057, FE-059 e STUDY-001 a STUDY-012 e
  [[../09 - Decisions/Current Contracts]].
