---
id: DEV-001
title: Tornar o desenvolvimento econômico, autônomo e verificável
status: DONE
priority: P0
type: development
depends_on: []
human_gate: false
created: 2026-09-28
updated: 2026-09-28
---
# DEV-001 — Tornar o desenvolvimento do TCC econômico, autônomo e verificável

## Execution record

**Conclusion (2026-09-28):** Implemented in the completion commit for DEV-001.
The specification below remains historical input; operational policy now lives
in root AGENTS and the linked canonical notes, not in the proposed sample text.

- [x] Root AGENTS addresses extension work, sequential ownership and automatic
  selective local task commits; 78 lines, with no mandatory full-vault read.
- [x] Seven repository skills validated by skill-creator's `quick_validate.py`.
  Direct local Codex `skills/list` discovered all seven as enabled. The
  `tcc-frontend-audit` procedure was read and used for the actual audit.
- [x] Operational Map (75 lines), Current Contracts and Development Workflow
  own commands, active decisions and policy. Worker/document/template and
  vault home links are reconciled. Historical migration evidence is retained.
- [x] Backend, frontend, fullstack and planning requests route to distinct main
  skills; auxiliary procedures load only for the relevant phase.
- [x] Frontend audit compares three approaches against two backlog features
  and two fixed regressions. It recommends small native-module extractions;
  official module/TypeScript/Vite docs were checked, no stack was installed.
- [x] QUAL-003, FE-011 and FE-012 are new BACKLOG cards. DEV-002 is superseded;
  feature dependencies point to DEV-001 and product gate DEC-008 remains.
- [x] Calibration table is ready for the next three real tasks; no cost or
  performance measurements were invented.
- [x] Product code, test configuration, capture bodies and goldens unchanged.
  Unrelated `.idea/` and Obsidian workspace changes excluded from staging.

Verification performed:

- `node scripts/check-project-docs.mjs`: 46 task records/dependencies/index
  entries and changed-document links checked. The initial run correctly
  rejected five missing/stale index entries; regeneration resolved them.
- `node scripts/check-skill-discovery.mjs`: all seven repository skills
  discovered/enabled via local app-server API; no thread/model request.
- `python3 /home/bender/.codex/skills/.system/skill-creator/scripts/quick_validate.py <skill-folder>`:
  all seven passed (the validator is an environment tool, not a repo dependency).
- `node --check scripts/check-project-docs.mjs` and
  `node --check scripts/check-skill-discovery.mjs`: passed.
- `git diff --check`: passed. The Mermaid flow was manually inspected;
  `mmdc` is unavailable, so no automated Mermaid syntax result is claimed.
- Read-only Node child-process checks initially hit sandbox EPERM; approved
  execution outside the sandbox succeeded. The first discovery checker
  expected absolute paths from a diagnostic that uses aliases; replacing it
  with `skills/list` resolved the verification mismatch.
- The staged diff check caught trailing blank lines in the seven new skills
  (untracked files were not covered by the earlier worktree diff); removed
  the blank lines and reran the staged check before committing.
- No product gate was rerun because changes are documentation/skills/support
  scripts only. Browser CSS/font egress remains the explicitly planned QUAL-003.

Main artifacts: `AGENTS.md`, `.agents/skills/`, `scripts/check-project-docs.mjs`,
`scripts/check-skill-discovery.mjs`,
[[../../06 - Development/Operational Map]],
[[../../09 - Decisions/Current Contracts]],
[[../../09 - Decisions/Development Workflow]],
[[../../04 - Frontend/Frontend Evolution Audit]], and the task index/cards.

- 2026-09-28: User authorized implementation after committing and pushing the
  proposal. Proposal published to `main` as `d4276fa`. Initial unrelated
  changes: `tcc/.obsidian/workspace.json` and `.idea/`; preserve both.
- Source inspection confirms root AGENTS migration rules conflict with the
  requested extension workflow. No nested AGENTS or repository skills found.
  The supplied proposal below is retained as specification/history.

## Resumo do pedido

O backend foi migrado de C# para Kotlin/Ktor. O foco agora é estender o SPARQL EasyQuery. O ciclo atual exige intervenção para commits, consome contexto com documentação dispersa e dificulta mudanças no frontend concentrado em HTML. O objetivo é aumentar a entrega útil dentro do limite de uso do agente, mantendo regressões sob controle.

Interpretação operacional: “comportamento tão paralelizável” foi entendido como paralelização excessiva/fragmentação indesejada. Adotar um agente e execução sequencial por padrão. Se a intenção era aumentar a paralelização, alterar somente essa política antes da aplicação.

Entregável deste documento: tarefa executável, proposta de AGENTS.md e especificação operacional de sete skills para o agente do repositório materializar. Não representa instalação de skills, alteração do repositório ou análise já executada sobre seu código.

## Prompt de execução

Você está no repositório do meu TCC, SPARQL EasyQuery. Execute DEV-001 até concluir os artefatos e os commits locais. Não pare após apresentar um plano. Este pedido autoriza atualizar as instruções do projeto, criar skills locais ao repositório, ajustar documentação operacional e adicionar scripts pequenos de suporte. Também autoriza commits locais dessas mudanças depois de verificadas, sem nova confirmação.

Prioridade: reduzir consumo de contexto e retrabalho por funcionalidade aceita. Não otimizar apenas número de tokens sacrificando a correção ou transferindo trabalho repetitivo para mim.

Nesta tarefa, não implementar funcionalidades do produto nem migrar o frontend. Produzir a análise do frontend e suas tarefas de execução. Não instalar estas skills globalmente nem publicá-las em um catálogo pessoal: elas pertencem ao repositório e devem acompanhar sua versão.

Não realizar push, deploy, reescrita de histórico, exclusão de evidência de compatibilidade ou mudança de contrato do produto como consequência implícita desta tarefa. Aproveitar autorizações explícitas da sessão, se existirem, sem pedi-las novamente.

### 1. Diagnóstico inicial direcionado

1. Inspecionar branch, status e diff inicial. Preservar alterações existentes; registrar arquivos que não pertencem à tarefa.
2. Ler os AGENTS.md aplicáveis e localizar skills existentes, índices de tarefas, decisões vigentes e comandos de build/teste. Usar buscas por nomes/símbolos e trechos relevantes; não carregar todo o vault.
3. Confirmar no código/configuração os caminhos mencionados aqui. Não transformar os documentos anexados em evidência de uma execução de testes atual.
4. Fazer uma auditoria única dos conflitos entre instruções atuais: migração versus extensão; validação a cada edição versus por tarefa; atualização duplicada de histórico; aprovações já resolvidas; instruções locais que contradizem a raiz.
5. Reaproveitar estruturas do vault `tcc/` e skills existentes. Não criar outro sistema concorrente de tarefas. Os nomes e caminhos abaixo são propostas; resolver os caminhos definitivos nesta etapa e usar links reais nos artefatos.

### 2. Estrutura e orçamento de contexto

Criar ou adaptar três pontos de entrada, com responsabilidades distintas:

- `AGENTS.md`: política global, invariantes essenciais, roteamento para skills e encerramento. Meta aproximada: até 120 linhas úteis.
- Um mapa operacional no vault: caminhos de código por responsabilidade, comandos confirmados, links para contratos atuais e tarefas. Meta: até 150 linhas; tabelas curtas. Não reproduzir um manual de arquitetura.
- Um registro de contratos atuais: apenas decisões em vigor relevantes ao desenvolvimento. Reutilizar o existente, se houver. Apontar para os IDs de decisões e evidências históricos; não copiar o histórico inteiro.

Manter MIGRATION.md e MIGRATION_REPORT.md como evidência histórica. Corrigir apenas apontamentos/estado atual necessários, sem apagar registros nem recapturar goldens. Não exigir leitura integral ou atualização desses arquivos em cada feature. Uma mudança em compatibilidade deve atualizar a decisão/contrato pertinente e, quando necessário, a nota de migração relacionada.

Entrada normal de uma tarefa: AGENTS aplicáveis + cartão da tarefa + uma skill principal. Consultar mapa, contrato e trechos de código conforme necessário. Backend/frontend auxiliares só quando a tarefa realmente os atravessar. Não carregar todas as skills. As metas de tamanho são indicadores, não limites que autorizam omitir contratos importantes.

### 3. Política proposta para AGENTS.md

Adaptar o texto abaixo ao repositório real. Esta tarefa autoriza substituir as regras globais de migração que mandam atualizar o histórico por toda tarefa ou repetir todos os gates após cada edição. Preservar as garantias de compatibilidade nos escopos em que se aplicam.

```markdown
# Desenvolvimento do SPARQL EasyQuery

## Objetivo e contexto
- O foco atual é estender a aplicação Kotlin/JVM + Ktor e seu frontend.
- Confirmar caminhos e comandos no mapa operacional indicado abaixo.
- MIGRATION.md e MIGRATION_REPORT.md registram histórico/evidência; consultar
  somente as seções relevantes à tarefa ou a uma dúvida de compatibilidade.

## Execução
- Executar uma tarefa ou fatia funcional por vez, com um agente por padrão.
- Não criar subagentes sem pedido explícito. Leituras independentes podem ser
  agrupadas; edições, gates e commits devem respeitar suas dependências.
- Após autorização da tarefa, concluir implementação, validação, documentação
  afetada e commit local. Não perguntar a cada etapa se pode continuar.
- Resolver escolhas locais reversíveis por julgamento técnico. Perguntar apenas
  quando faltar uma decisão que altere o resultado esperado ou o escopo autorizado.
- Planejar brevemente apenas quando houver múltiplas etapas/dependências reais.
- Usar rg e ler trechos direcionados. Expandir a investigação conforme evidências.
- Não refatorar partes não relacionadas. Documentação/análise não autoriza
  modificar código de produção.

## Contratos e evidências
- Preservar contratos observáveis, salvo mudança expressamente autorizada na tarefa
  ou em decisão vigente. Registrar e testar a mudança aprovada.
- Manter tipos Jena no pacote de infraestrutura RDF; usar tipos da aplicação
  nas fronteiras. Manter contexto de endpoint isolado por requisição.
- Não usar renderização padrão de Jena como formato público de nós RDF.
- Preservar corpora de captura, proveniência, multiplicidade e termos RDF.
- Não atualizar goldens para silenciar falhas. Investigar implementação e oráculo.
- Comparar resultados sem ORDER BY como multiconjuntos onde aplicável; não
  impor ordenação nova para facilitar snapshots.
- Testes ordinários não acessam Wikidata/serviços externos. Testes ao vivo
  devem ser separados, opt-in e dispensáveis ao gate normal.
- Consultar o contrato atual ao tocar rotas, JSON, erros, SPARQL ou interações
  gráficas. Não reabrir decisões já aprovadas sem evidência de conflito.

## Validação
- Durante a edição, executar o menor teste que detecta a mudança ou regressão.
- Antes do commit, executar o gate obrigatório para a área/risco, conforme mapa.
- Reexecutar checks quando o código que validaram mudar. Não repetir gates
  idênticos em um estado sem alterações relevantes só por ritual.
- Uma falha pertinente bloqueia DONE; investigar sem enfraquecer asserções.
- Distinguir falha preexistente, nova falha e indisponibilidade do ambiente.
- Atualizar testes junto de comportamento novo e bugs corrigidos; mudanças
  puramente documentais não exigem testes do produto.

## Encerramento e Git
- Inspecionar o estado inicial. Não incluir alterações alheias no commit.
- Após cumprir os critérios e o gate, revisar o diff, fazer staging seletivo e
  criar automaticamente um commit local por tarefa/fatia coerente.
- Não usar git add . indiscriminadamente, amend, reset destrutivo, force-push
  ou bypass de hooks. Não alterar configuração global do Git.
- Se houver mudanças misturadas no mesmo trecho, preservar o trabalho existente
  e explicitar o bloqueio; não descartá-lo para conseguir commitar.
- Commit automático não implica push, merge ou deploy.
- Falha de teste, hook ou identidade Git deve ser relatada com causa concreta;
  não declarar tarefa concluída nem fabricar um commit bem-sucedido.
- Atualizar apenas a tarefa e a fonte canônica afetada; evitar relatórios duplicados.
- Responder com resultado, validação, hash do commit e pendências reais.

## Roteamento
- Especificação/backlog: tcc-plan-task.
- Kotlin/API/RDF: tcc-backend.
- Interface/interações gráficas: tcc-frontend.
- Funcionalidade atravessando API e interface: tcc-fullstack.
- Refatoração preparatória: tcc-refactor.
- Regressão/gates/testes: tcc-test.
- Escolha de arquitetura/ferramentas frontend: tcc-frontend-audit.
- Mapa operacional e contratos atuais: inserir links reais ao aplicar DEV-001.
```

### 4. Criar a suíte de skills do repositório

Usar o local de descoberta de skills suportado pelo agente instalado no repositório. Confirmar esse local antes de gravar; não presumir que uma pasta arbitrária será descoberta. Cada skill tem `SKILL.md` com frontmatter `name` e `description`, gatilho específico e instruções imperativas. Meta: 40–90 linhas por skill, sem README/CHANGELOG interno redundante. Usar referências somente para conteúdo especializado; não duplicar AGENTS.md.

Se houver skill de criação disponível nesse agente, seguir seu fluxo compatível com skills do repositório. Verificar descoberta em uma nova sessão ou pelo mecanismo local disponível. “Arquivo criado” e “skill descoberta” são resultados diferentes.

#### tcc-plan-task

Descrição/gatilho: converter especificações de extensão do SPARQL EasyQuery em tarefas pequenas, verificáveis e prontas para execução; usar para planejar funcionalidades, decompor requisitos e atualizar backlog, sem implementar o produto.

Procedimento:
1. Extrair comportamento esperado, casos de erro, restrições e critérios observáveis da especificação.
2. Separar fatos confirmados, suposições reversíveis e decisões de produto ainda necessárias. Não inventar requisitos ausentes.
3. Consultar tarefas existentes por tema/ID e evitar duplicação. Inspecionar somente os pontos de entrada relevantes do código.
4. Dividir por fatias funcionais aceitas pelo usuário; evitar tarefas artificiais por camada quando isso não gera entrega verificável.
5. Registrar dependências e ordem sequencial; só propor refatoração preparatória se houver benefício para uma tarefa conhecida.
6. Produzir cartões no sistema existente com o modelo da seção 5. Incluir teste/oráculo e mudança de contrato autorizada, quando houver.
7. Atualizar o índice de tarefas existente; não criar backlog paralelo.

Saída: cartões executáveis, ordem e decisões realmente bloqueantes. Exemplo de acionamento: “Transforme esta especificação de exploração em duas variáveis em tarefas”.

#### tcc-backend

Descrição/gatilho: implementar ou corrigir comportamento Kotlin/Ktor, serviços, RDF/SPARQL, cache e transporte do SPARQL EasyQuery.

Procedimento:
1. Localizar rota ou serviço de entrada, contrato específico, implementação e teste mais próximo.
2. Mapear DTO → conversão/validação → serviço → executor → projeção → HTTP apenas no caminho afetado.
3. Implementar a menor fatia; manter regras fora de handlers, tipos Jena isolados, recursos fechados e resultados materializados antes do fechamento.
4. Preservar isolamento de requisições, cancelamento e política de execução bloqueante; seguir padrões existentes em vez de inventar nova infraestrutura.
5. Para bugs, criar reprodução mínima. Para comportamento novo, testar critérios de aceitação e fronteiras relevantes: unbound, duplicatas, léxico, URI, erros ou cache conforme a alteração.
6. Usar fakes/fixtures/servidor local para transporte. Não recapturar C# nem chamar Wikidata por conveniência.
7. Atualizar OpenAPI/contrato somente se afetado. Executar gate da área e encerrar conforme AGENTS.md.

Saída: comportamento implementado, evidência do teste e commit. Exemplo: “Corrija a resposta de erro da rota de relacionamentos”.

#### tcc-frontend

Descrição/gatilho: implementar ou corrigir interface, estado, ações Cytoscape, formulários, consultas e comunicação HTTP do frontend SPARQL EasyQuery.

Procedimento:
1. Localizar o fluxo evento → estado/grafo → montagem da consulta → transporte → resultado → aplicação no grafo, e o teste mais próximo.
2. Confirmar os invariantes da interação afetada. Nos fluxos conhecidos: distinguir nós e arestas, reconhecer variável pelo valor inteiro, preservar topologia/metadados ao vincular predicado e respeitar seleção de componente.
3. Separar cálculo puro de efeitos apenas no trecho necessário, reaproveitando limites existentes; evitar grandes extrações como efeito colateral de uma feature.
4. Tratar loading, erro, resultado vazio, ações canceladas e respostas assíncronas obsoletas quando relevantes. Evitar duplicar listeners ou manter referências inválidas a elementos removidos.
5. Preservar acessibilidade por teclado, foco, Escape e dismiss quando afetados.
6. Testar transformações puras de forma determinística e interações importantes com browser/API simulada. Não produzir snapshots gigantes como único oráculo.
7. Não trocar biblioteca HTTP, bundler ou framework sem tarefa específica. Atualizar apenas documentação afetada e concluir o gate.

Saída: interação implementada, regressão coberta e commit. Exemplo: “Ao escolher um predicado, atualize a aresta sem criar um nó”.

#### tcc-fullstack

Descrição/gatilho: entregar uma mesma funcionalidade do SPARQL EasyQuery que demande mudanças coordenadas na API e no frontend.

Procedimento:
1. Escrever o contrato mínimo da fatia: entrada, saída, erros e sequência da interação. Identificar autorização da mudança.
2. Escolher a menor entrega vertical com um critério de aceitação visível ao usuário.
3. Consultar procedimentos backend e frontend somente nas etapas pertinentes; não criar agentes separados nem copiar toda a documentação de ambas as áreas.
4. Implementar serviço/API e teste de contrato; conectar o cliente; verificar integração com resposta real local e falhas simuladas pertinentes.
5. Evitar divergência entre mock do browser, DTO e OpenAPI. Adicionar verificação de fronteira se houver risco concreto.
6. Rodar a união dos gates afetados uma única vez para o estado final e fazer commit coerente da fatia.

Saída: fluxo integrado, contratos atualizados, validação e commit. Exemplo: “Adicione consulta de candidatos à exploração em etapas”.

#### tcc-refactor

Descrição/gatilho: preparar código do SPARQL EasyQuery para uma extensão conhecida ou remover acoplamento que dificulta uma tarefa identificada, preservando comportamento.

Procedimento:
1. Vincular a refatoração a uma tarefa futura concreta ou a um defeito de manutenção demonstrado. Explicar o ponto de dificuldade e o benefício esperado.
2. Localizar contratos e cobertura existentes; criar caracterização somente onde há risco sem cobertura adequada.
3. Definir fronteiras e uma sequência pequena de extrações. Evitar misturar mudança de stack, comportamento e estrutura.
4. Executar uma extração por vez preservando ordem de scripts/eventos, serialização e estado quando aplicáveis.
5. Validar cada fronteira de risco e executar o gate final. Não “melhorar” comportamento legado silenciosamente.
6. Parar quando a tarefa motivadora estiver facilitada; não perseguir arquitetura genérica para funcionalidades hipotéticas.

Saída: estrutura menor e testável, comportamento preservado, links para a tarefa motivadora e commit. Exemplo: “Extraia a montagem dos filtros antes da nova exploração de variáveis”.

#### tcc-test

Descrição/gatilho: diagnosticar testes falhando, adicionar regressões ou selecionar/executar validação para mudanças do SPARQL EasyQuery; não exige sua leitura em toda tarefa trivial.

Procedimento:
1. Relacionar o diff aos riscos observáveis e aos testes existentes. Escolher o nível mínimo que realmente detecta o defeito.
2. Reproduzir o bug antes da correção quando possível e confirmar que o teste falha pelo motivo esperado.
3. Distinguir unitário, contrato, compatibilidade e browser; não duplicar o mesmo caso em todos os níveis sem risco de fronteira.
4. Preservar independência de rede externa, fixtures, multiplicidade e regras de ordenação. Falhar explicitamente se uma requisição de rede inesperada escapar do mock.
5. Rodar testes focados durante o trabalho, depois o gate obrigatório pertinente. Reutilizar resultados válidos para arquivos inalterados.
6. Reportar comando, resultado, falhas preexistentes e limitações. Não afirmar execução a partir de relatório histórico.

Saída: reprodução/diagnóstico ou validação verificável; commit se houver mudanças. Exemplo: “Crie a regressão para resposta atrasada aplicada à aresta já removida”.

#### tcc-frontend-audit

Descrição/gatilho: analisar a arquitetura e as ferramentas do frontend SPARQL EasyQuery para reduzir custo de mudanças por agentes e regressões; usar antes de decidir modularização ou migração de stack.

Procedimento:
1. Inspecionar o HTML autoritativo, scripts, dependências, estilos, estado global, eventos, Ajax, Cytoscape, build, recursos Ktor e testes. Medir tamanho e concentração por responsabilidade sem assumir que número de linhas prova má arquitetura.
2. Escolher duas extensões conhecidas do backlog e dois bugs documentados como cenários de avaliação; não inventar requisitos para justificar ferramentas.
3. Mapear responsabilidades propostas: domínio do grafo, extração de consulta, ações, estado da interface, transporte, renderização e inicialização.
4. Comparar no máximo três caminhos: modularização mantendo a stack; módulos com tipagem/build incremental; framework de componentes somente se houver justificativa concreta. Identificar ferramentas candidatas após a inspeção.
5. Consultar documentação oficial atual apenas das candidatas finalistas para validar integração, versões e limitações. Se não houver acesso, registrar a incerteza e não afirmar compatibilidade validada.
6. Avaliar com a matriz da seção 7. AJAX é um mecanismo assíncrono; sua existência não é motivo suficiente para reescrita ou prova da presença de jQuery.
7. Explicar quem controla o DOM e a instância Cytoscape, como listeners são descartados e como estado e respostas obsoletas serão tratados em cada opção.
8. Recomendar uma alternativa, com custos de transição, primeira fatia, critérios de sucesso e retorno à versão anterior. Uma recomendação pode ser manter a stack e modularizar.
9. Produzir decisão proposta e tarefas; não alterar produção nem instalar dependências neste diagnóstico.

Saída: mapa com evidências, comparação, recomendação e plano incremental. Exemplo: “Qual estrutura facilita estender propriedades e evitar regressões neste frontend?”.

### 5. Modelo único de cartão de tarefa

Adaptar ao formato existente no vault. Não tornar todos os campos burocraticamente obrigatórios para uma correção de uma linha.

```markdown
# <ID> — <resultado observável>
Status: TODO | IN_PROGRESS | BLOCKED | DONE
Tipo/skill principal:
Objetivo e motivação:
Comportamento esperado / exemplos:
Escopo e exclusões:
Pontos de entrada: caminhos + símbolos confirmados
Contrato/decisão relevante: link direto, somente se aplicável
Dependências:
Critérios de aceitação: resultados verificáveis
Validação: comandos existentes + oráculo dos casos novos
Decisões pendentes: somente as que mudam a solução
Conclusão: resultado, comandos/resultados, limitações e commit
```

Não escrever plano detalhado de implementação quando o código ainda não foi inspecionado. Para evitar autorreferência de hash, a nota incluída no commit pode dizer “commit de conclusão desta tarefa”; informar o hash na resposta ou índice posterior sem criar um segundo commit apenas para inserir o próprio hash.

### 6. Gates e suporte determinístico

Confirmar comandos existentes antes de documentá-los. Os documentos fornecidos registram Gradle wrapper, ktlintCheck, detekt, test, installDist e npm run test:browser. Não inventar filtros ou scripts npm que o repositório não oferece.

| Mudança | Durante o desenvolvimento | Antes de concluir |
|---|---|---|
| Documentação/skills | Referências e formato dos arquivos alterados | Diff, links, validade das skills e ausência de instruções contraditórias |
| Kotlin | Testes focados | ktlintCheck, detekt e test; adicionar installDist se packaging/recursos forem afetados |
| Frontend | Regressão focada e sintaxe/tipagem disponível | Suíte browser existente e checks frontend configurados; validar Ktor quando integração/recursos forem afetados |
| Contrato/fullstack | Testes de fronteira | União dos gates das áreas afetadas, incluindo OpenAPI/compatibilidade quando pertinente |
| Build/dependências/recursos | Check específico | Gates afetados e smoke da distribuição quando pertinente |

Não suprimir gates mandatórios por economia. Consolidar execuções redundantes e aproveitar a incrementalidade do build; não rodar clean por padrão.

Adicionar um único wrapper de validação apenas se remover repetição real. Se criado, deve ter perfis documentados, mostrar comandos, propagar código de saída não zero e não instalar dependências, acessar upstream, editar goldens ou commitar. Não criar uma ferramenta de roteamento complexa.

Confirmar a limitação offline de CSS/fonts já registrada nos testes browser. Criar tarefa pequena para eliminar essas dependências de rede, se ainda existir; não declarar a suíte completamente offline sem verificar o bloqueio de egress.

### 7. Executar a análise de frontend nesta tarefa

Usar tcc-frontend-audit assim que a skill existir. Não parar apenas na criação da skill: produzir a análise com o código disponível no repositório.

| Critério | Pergunta verificável |
|---|---|
| Custo inicial | Quantos fluxos/arquivos e etapas de build precisam mudar? |
| Contexto por tarefa | Uma extensão típica pode ser entendida lendo poucos módulos delimitados? |
| Localidade | Uma mudança de propriedade fica concentrada em uma responsabilidade? |
| Testabilidade | Transformações do grafo/consulta podem ser testadas sem abrir o browser? |
| Prevenção de bugs | Como são detectados tipos inconsistentes, listeners duplicados e respostas obsoletas? |
| Cytoscape | Há dono claro da instância, DOM, eventos e lifecycle? |
| Contratos | Como DTO, mock e API real permanecem alinhados? |
| Operação | Como frontend gerado entra na distribuição Ktor e funciona sem CDN? |
| Prazo do TCC | Qual opção libera a próxima funcionalidade com menor custo total? |

Usar evidências e estimativas identificadas como estimativas. Não fabricar benchmarks nem atribuir pontuação com falsa precisão. Não prometer eliminação de bugs ou redução percentual de tokens sem medição.

### 8. Propagar as atualizações

1. Atualizar AGENTS.md da raiz e reconciliar os locais aplicáveis. Usar instruções locais apenas quando houver regras próprias daquela área.
2. Criar/atualizar skills e apontar o roteamento para seus nomes reais.
3. Atualizar o mapa operacional, o índice existente de tarefas e o ponto de entrada do vault. Remover orientações operacionais obsoletas ou substituí-las por links para a fonte canônica.
4. Preservar cronologia e evidências de MIGRATION.md/MIGRATION_REPORT.md. Diferenciar cabeçalhos de “estado atual” de afirmações históricas; não resolver divergências apagando o passado.
5. Registrar a nova política de desenvolvimento em uma decisão curta, incluindo commits automáticos e validação por tarefa/risco.
6. Criar tarefas concretas da análise frontend na ordem recomendada, com critérios de aceitação e sem iniciar a migração de framework automaticamente.
7. Verificar que cada link e comando operacional existe e que as skills são descobertas pelo agente. Registrar qualquer limitação de verificação.

### 9. Critérios de aceitação de DEV-001

- AGENTS.md orienta extensão pós-migração e permite concluir tarefas com commit local automático.
- Não exige leitura do vault inteiro nem releitura do histórico para uma alteração comum.
- Sete skills têm gatilhos distintos e procedimentos úteis, sem duplicar política global.
- Um caso de backend, um de frontend, um fullstack e um de planejamento podem ser roteados sem carregar a suíte inteira.
- Contratos importantes continuam protegidos; goldens e registros de origem permanecem intactos.
- O agente distingue testes focados durante edição de gates necessários ao encerramento.
- Há análise frontend baseada no código, recomendação fundamentada e tarefas incrementais; nenhuma stack foi imposta sem inspeção.
- Política de documentação tem uma fonte para cada fato atual e preserva histórico.
- Alterações alheias foram preservadas; mudanças desta tarefa estão verificadas e commitadas localmente.
- Resposta final informa arquivos principais, verificações, hashes e limitações reais.

### 10. Calibrar custo nas próximas três tarefas reais

Registrar em uma linha por tarefa: ID, arquivos/documentos efetivamente necessários, execuções de gates, correções após validação, intervenções humanas e tempo aproximado. Se houver métrica de tokens/uso disponível, registrá-la; não estimá-la como se fosse faturamento medido.

Comparar tarefas de complexidade semelhante. Ajustar instruções que levaram a leitura redundante, teste inútil ou bloqueio desnecessário. Não criar uma plataforma de telemetria. O critério é funcionalidade correta entregue por custo total, incluindo retrabalho.

## Fontes e limites desta proposta

- AGENTS.md fornecido: linhas 13–20 exigem testes/validação por mudança e atualização de MIGRATION.md por fase; linhas 25–45 definem fronteiras e compatibilidade a preservar.
- MIGRATION.md fornecido: linhas 1890–1907 registram a remoção de C#; linhas 1643–1694 descrevem contrato e evolução do frontend; linhas 1872–1880 registram gates e limitação de CSS/fonts externos.
- MIGRATION_REPORT.md fornecido: linhas 123–146 distinguem defeitos preservados, mudanças intencionais e decisões de segurança ainda necessárias; linhas 238–259 separam retirada do C# e implantação.
- Não foi disponibilizado o código da aplicação nesta conversa. Os caminhos, comandos e conclusões sobre execução devem ser confirmados pelo agente no repositório. Não há evidência aqui de desempenho real do agente ou de vantagem de um framework específico.
