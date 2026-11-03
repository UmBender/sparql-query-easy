# A Física das Notações (Moody, 2009) — explicação

> Explicação do artigo MOODY, D. L. *The "Physics" of Notations: Toward a
> Scientific Basis for Constructing Visual Notations in Software
> Engineering*. IEEE Transactions on Software Engineering, v. 35, n. 6,
> p. 756–779, 2009. PDF: `tcc/PDF/The “Physics” of Notations.pdf`.
> Tarefa: DOC-010. Os exemplos são da notação do SPARQL EasyQuery.
> Relacionadas: [[Questões do Estudo de Avaliação]] (uso dos princípios no
> questionário), §2.5 e §3.1 da dissertação do Vinicius.

## 1. O problema que o artigo ataca

Na engenharia de software, as notações visuais (UML, DER, DFD, BPMN…) são
avaliadas quase só pela **semântica**: o que cada construção significa. A
forma gráfica, ou **sintaxe visual**, é tratada como detalhe estético,
escolhida por gosto, tradição ou comitê, sem justificativa. Moody mostra
que essa escolha não é neutra: a mesma informação, desenhada de jeitos
diferentes, é entendida com velocidade e precisão muito diferentes,
principalmente por **leigos**.

O objetivo do artigo é transformar o desenho de notações de um "ofício"
(feito por intuição) em uma **disciplina de projeto**, com princípios
explícitos, baseados em evidências e testáveis. O nome "física" indica que o
foco está nas propriedades **físicas e perceptivas** dos símbolos (forma,
cor, posição, tamanho), não nas propriedades lógicas.

## 2. Conceitos de base

### 2.1 O que é uma notação visual

- **Vocabulário visual:** o conjunto de símbolos gráficos (no EasyQuery:
  entidade, variável de nó, valor literal, variável de valor literal,
  predicado definido, predicado variável).
- **Gramática visual:** as regras de composição (uma seta liga dois nós;
  um filtro só fica em uma variável de valor literal).
- **Definições semânticas:** o que cada símbolo significa.
- **Diagrama (sentença visual):** um desenho válido, montado com instâncias
  dos símbolos de acordo com a gramática. No EasyQuery, o diagrama é a
  própria consulta.

### 2.2 Variável dependente: eficácia cognitiva

A meta de projeto é a **eficácia cognitiva**: a velocidade, a facilidade e a
precisão com que uma pessoa processa a representação. Não é beleza nem
"intuição" do projetista. Como é definida operacionalmente, pode ser medida
em experimentos (tempo, erros, compreensão), o que torna os princípios
**falseáveis**.

### 2.3 Teoria descritiva: como uma notação comunica

Moody adapta a teoria da comunicação de Shannon e Weaver. O projetista
**codifica** uma mensagem no diagrama e o leitor a **decodifica**. Há,
portanto, dois lados:

1. **Espaço de projeto (codificação).** As oito **variáveis visuais** de
   Bertin, os "átomos" de qualquer símbolo:
   - planares: posição horizontal e posição vertical;
   - retinais: forma, tamanho, cor, brilho, orientação e textura.

   Um símbolo é uma combinação de valores dessas variáveis
   (forma = retângulo, cor = verde). A **notação primária** é o
   significado formal dos símbolos. A **notação secundária** é o uso
   informal de variáveis livres (como posição e destaque) para reforçar o
   significado. O **ruído visual** é a variação acidental que atrapalha a
   leitura.
2. **Espaço de solução (decodificação).** Um modelo do processamento humano
   em duas fases: a **percepção**, automática, rápida e paralela, e a
   **cognição**, consciente, lenta e sequencial. A vantagem dos diagramas
   vem do **descarregamento computacional**: eles transferem trabalho da
   cognição para a percepção. As etapas são:
   - discriminação perceptiva (separar os elementos do fundo);
   - configuração perceptiva (inferir estrutura pelas leis da Gestalt);
   - gerenciamento da atenção (o que entra primeiro na memória de trabalho);
   - memória de trabalho (capacidade muito limitada, o gargalo);
   - memória de longo prazo (integração com o conhecimento prévio; aqui
     aparecem as diferenças entre especialistas e novatos).

Cada princípio da seção 3 atua sobre uma ou mais dessas etapas.

### 2.4 Teoria prescritiva: os princípios

Os princípios formam uma estrutura modular em "favo de mel": podem ser
acrescentados ou retirados por pesquisas futuras. Cada um tem nome
positivo, uma definição teórica ("a notação deve…"), uma definição
operacional (como avaliar ou medir), estratégias de projeto e exemplos bons
e ruins. Por isso servem tanto para **avaliar** uma notação como para
**projetá-la**.

## 3. Os nove princípios do design cognitivo de notações

| # | Princípio (original) | Enunciado | Etapa cognitiva principal |
|---|---|---|---|
| 1 | Clareza semiótica (*Semiotic Clarity*) | Um símbolo para cada construção semântica, e vice-versa | memória de longo prazo |
| 2 | Discernimento perceptivo (*Perceptual Discriminability*) | Símbolos diferentes devem ser claramente distinguíveis | discriminação perceptiva |
| 3 | Transparência semântica (*Semantic Transparency*) | A aparência deve sugerir o significado | memória de longo prazo |
| 4 | Gerenciamento de complexidade (*Complexity Management*) | Mecanismos explícitos para lidar com diagramas grandes | memória de trabalho |
| 5 | Integração cognitiva (*Cognitive Integration*) | Mecanismos para integrar informação de vários diagramas | memória de trabalho e de longo prazo |
| 6 | Expressividade visual (*Visual Expressiveness*) | Usar toda a gama das variáveis visuais | discriminação perceptiva |
| 7 | Codificação dupla (*Dual Coding*) | Usar texto para complementar os gráficos | memória de trabalho e de longo prazo |
| 8 | Economia gráfica (*Graphic Economy*) | Número de símbolos diferentes cognitivamente gerenciável | memória de trabalho |
| 9 | Ajuste cognitivo (*Cognitive Fit*) | Dialetos visuais diferentes para tarefas e públicos diferentes | memória de longo prazo |

### 3.1 Clareza semiótica

Deve haver correspondência **um para um** entre construções semânticas e
símbolos gráficos (vem da teoria dos símbolos de Goodman). Quando isso falha,
surgem quatro anomalias:

- **Redundância de símbolos** (sinônimos gráficos): vários símbolos para a
  mesma construção. Obriga quem desenha a escolher e quem lê a decorar as
  alternativas.
- **Sobrecarga de símbolos** (homônimos gráficos): o mesmo símbolo para
  construções diferentes. É a pior anomalia, porque gera ambiguidade.
- **Excesso de símbolos:** símbolos que não correspondem a nenhuma
  construção. Ocupam memória de trabalho sem informar nada.
- **Déficit de símbolos:** construções sem símbolo. Às vezes é aceitável
  (resolvido por texto), e pode até ser estratégia de economia gráfica.

*No EasyQuery:* cada tipo de nó tem um único símbolo, e um filtro aparece
sempre no nó da variável de valor literal que ele restringe. Uma anomalia a
vigiar: o nó cinza "múltiplos resultados" é um estado, não um tipo; se o
leitor o confundir com um tipo, há sobrecarga.

### 3.2 Discernimento perceptivo

Símbolos diferentes precisam ser **fáceis de distinguir**. É o primeiro
passo da leitura: sem distinguir, não há interpretação. Estratégias:

- **Distância visual:** quantas variáveis visuais diferem entre dois
  símbolos e quanto diferem.
- **Primazia da forma:** a forma é a variável mais importante para
  reconhecer objetos; símbolos devem diferir na forma, não só em detalhes.
- **Codificação redundante:** distinguir por mais de uma variável ao mesmo
  tempo (forma **e** cor), o que aumenta a robustez, inclusive para
  daltônicos.
- **Destaque perceptivo (*pop-out*):** um valor único numa variável faz o
  símbolo "saltar" sem busca serial.
- **Diferenciação textual:** distinguir só por texto (fonte, rótulo) é
  fraco, porque o texto é lido, não percebido.

*No EasyQuery:* entidades, variáveis (verdes) e valores literais diferem em
cor e forma; predicados definidos são setas azuis e predicados variáveis
setas verdes; um nó filtrado ganha o selo "mantidos / total".

### 3.3 Transparência semântica

A **aparência deve sugerir o significado**, para que um novato o adivinhe
ou o aprenda facilmente. Moody classifica os símbolos numa escala:

- **semanticamente imediato:** o novato infere o significado (um boneco
  para "pessoa");
- **semanticamente opaco:** relação arbitrária (o retângulo do DER);
- **semanticamente perverso:** sugere o significado errado ou o oposto.

Estratégias: **ícones** (semelhança perceptiva) e **relações
semanticamente transparentes**, em que a disposição espacial já comunica a
relação (uma seta indica direção; conter algo indica "faz parte de";
encostar indica ligação).

*No EasyQuery:* o rótulo `?` da variável sugere "incógnita"; a seta indica a
direção da relação (Vaporeon *evolves from* Eevee, e não o contrário).

### 3.4 Gerenciamento de complexidade

Diagramas grandes excedem a memória de trabalho (o limite clássico de
Miller). A notação deve ter **mecanismos explícitos** para isso:

- **Modularização:** dividir o diagrama em partes menores e tratáveis uma
  de cada vez;
- **Estruturação hierárquica:** organizar as partes em níveis, do resumo ao
  detalhe (decomposição *top-down*).

Moody diferencia a **complexidade do diagrama** (quantos elementos ele tem,
assunto deste princípio) da **complexidade gráfica** (quantos *tipos* de
símbolo a notação tem, assunto da economia gráfica).

*No EasyQuery:* a disposição automática/manual, a execução da consulta em
etapas (uma variável por vez, *Find matching values*) e o funil de filtros,
que divide a consulta em passos.

### 3.5 Integração cognitiva

Quando a informação está **em vários diagramas**, o leitor precisa juntá-la
mentalmente. A notação deve ajudar com:

- **Integração conceitual:** montar uma visão única a partir das partes
  (diagrama-resumo, mostrar o contexto de cada parte);
- **Integração perceptiva:** pistas que facilitam a navegação entre
  diagramas (*visual momentum*), nas quatro etapas da navegação:
  1. **orientação** — "onde estou?";
  2. **escolha de rota** — "para onde posso ir?";
  3. **monitoramento de rota** — "estou no caminho certo?";
  4. **reconhecimento do destino** — "cheguei?".

*No EasyQuery:* etapas numeradas (orientação), pré-visualização *Possible
graph* ao passar o mouse sobre um valor (escolha de rota), funil e selos
(monitoramento), resultado final e *Assume*, que leva os valores ao grafo
(reconhecimento do destino e junção dos dois diagramas).

### 3.6 Expressividade visual

Usar **toda a capacidade das variáveis visuais**. O número de variáveis
usadas para codificar informação são os **graus de liberdade visual**: de
0 (notação só textual) a 8 (visualmente saturada). Moody observa que as
notações de engenharia de software usam quase só forma, desperdiçando cor,
tamanho, brilho etc. Regras:

- **cor** é das variáveis mais eficazes, mas não deve ser a única pista
  (impressão em preto e branco, daltonismo);
- **a forma segue o conteúdo:** cada variável tem um "poder" (nominal,
  ordinal, intervalar). Tamanho e posição servem para quantidades; forma e
  cor, para categorias;
- usar **gráficos em vez de texto** quando possível, respeitando os limites
  da economia gráfica.

*No EasyQuery:* cor e forma para o tipo de nó; o histograma do filtro usa
posição e tamanho (barras) para codificar a distribuição dos valores.

### 3.7 Codificação dupla

Usar **texto junto com os gráficos**, não no lugar deles. Pela teoria da
codificação dupla de Paivio, informação verbal e visual são guardadas em
sistemas de memória separados; apresentá-las juntas reforça as duas.
Formas:

- **anotações:** texto explicativo junto ao elemento a que se refere
  (contiguidade espacial);
- **símbolos híbridos:** gráfico e texto no mesmo símbolo (ícone + rótulo).

O texto deve **complementar**, nunca ser o único meio de distinguir
símbolos (isso violaria o discernimento perceptivo).

*No EasyQuery:* cada nó tem cor/forma **e** rótulo; cada seta tem o nome da
propriedade; o selo do filtro junta número e símbolo; a legenda repete as
cores com nomes.

### 3.8 Economia gráfica

O número de **tipos de símbolo** (complexidade gráfica) deve ser
gerenciável. A capacidade humana de distinguir categorias absolutas é de
cerca de **seis** (Miller, *span of absolute judgment*). A UML de classes,
por exemplo, tem mais de 40. Estratégias quando há símbolos demais:

- **reduzir ou particionar a complexidade semântica** (menos construções,
  ou dividi-las em sublinguagens);
- **introduzir déficit de símbolos** de propósito, expressando algumas
  construções por texto;
- **aumentar a expressividade visual**, para que cada símbolo seja mais
  fácil de distinguir.

Afeta mais os novatos que os especialistas.

*No EasyQuery:* seis tipos de nó/seta na legenda (entidade, variável de nó,
valor literal, variável de valor literal, predicado definido, predicado
variável), mais o estado "múltiplos resultados". Fica perto do limite de
seis.

### 3.9 Ajuste cognitivo

Usar **dialetos visuais diferentes** para tarefas e públicos diferentes. O
ajuste cognitivo vem da interação entre a representação, a tarefa e as
habilidades da pessoa. Dois casos:

- **novatos x especialistas:** novatos precisam de símbolos transparentes,
  poucos tipos e texto de apoio; especialistas preferem densidade e
  podem achar a transparência excessiva;
- **meio de representação:** desenhar à mão (quadro, papel) pede símbolos
  simples; ferramentas computacionais permitem cor, ícones e interação.

*No EasyQuery:* o diagrama é o dialeto para leigos, *View SPARQL* é o
dialeto textual para quem conhece SPARQL, e os filtros usam nomes em
linguagem comum (*At least*, *Between*) em vez de `FILTER(?x >= 60)`.

## 4. Interações entre os princípios

Os princípios não são independentes. O artigo (Fig. 36) aponta:

- a clareza semiótica pode aumentar ou reduzir a complexidade gráfica:
  excesso e redundância a aumentam; sobrecarga e déficit a reduzem;
- discernimento perceptivo e expressividade visual se reforçam;
- aumentar a expressividade reduz o efeito da complexidade gráfica, mas a
  economia gráfica limita quanta informação dá para codificar graficamente;
- mais símbolos (economia gráfica) dificultam distingui-los (discernimento);
- discernimento, gerenciamento de complexidade, transparência semântica,
  economia gráfica e codificação dupla ajudam sobretudo os **novatos**; a
  transparência pode atrapalhar especialistas (ajuste cognitivo);
- transparência e expressividade podem dificultar o desenho à mão.

Projetar uma notação é, portanto, **equilibrar** os princípios, e não
maximizar todos.

## 5. Como o artigo se aplica a este trabalho

- **Avaliação.** Cada princípio vira um critério que pode ser medido.
  O questionário da dissertação mede cinco deles (itens 11–15); a proposta
  de [[Questões do Estudo de Avaliação#6. Novos itens do questionário (SUS e Física das Notações)|§6 das questões]]
  cobre os nove.
- **Projeto.** As funcionalidades novas (filtros, histograma, funil,
  pré-visualização) foram justificadas pelos princípios na
  [[Questões do Estudo de Avaliação#4. O que ainda não foi avaliado: preview e filtros|§4 das questões]].
- **Limitações.** Os princípios são uma síntese de teoria e evidências,
  e Moody os apresenta como modulares e revisáveis por pesquisas futuras.
  Questionários medem a
  **percepção** do usuário, não a eficácia cognitiva em si; por isso o
  estudo combina o questionário com as tarefas (diagramas salvos e
  avaliados à mão, DEC-020).
- **Uma correção à dissertação.** O item 13 (quantidade de símbolos) foi
  ligado à clareza semiótica, mas, pela definição de Moody, mede a
  **economia gráfica**.
