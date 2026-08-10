# Bootstrap do ROVIS

Este arquivo e a fonte principal de governanca do ROVIS.
Se houver conflito com outro arquivo operacional, este arquivo prevalece.

## Objetivo

Garantir um fluxo previsivel para planejamento, contrato, implementacao, validacao,
handoff e memoria, com regras simples o suficiente para automacao.

## Fonte de verdade

Arquivos obrigatorios de leitura inicial:
- `.cursor/memory/index.md`
- `.cursor/memory/11-session-summary.md`
- `.cursor/memory/12-active-workset.md`
- `.cursor/memory/10-checkpoint.md` quando existir
- `.cursor/memory/00-context.md`
- `.cursor/governance/state-machine.md`
- `.cursor/governance/memory-contract.md`
- `.cursor/governance/mode-manifest.json`
- `.cursor/governance/intent-router.md`
- `.cursor/governance/agent-capabilities.json`
- `.cursor/governance/handoff-contract.json`
- `.cursor/governance/stage-score-rules.json`
- `.cursor/governance/closeout-contract.json`
- `.cursor/governance/qa-targets-contract.json`
- `.cursor/governance/runtime-executor.json`
- `.cursor/governance/runtime-targets-contract.json`

## Ativacao curta de modo

Ativacao de modo deve aceitar comando curto do usuario, sem exigir repeticao do prompt completo.

Entradas canonicas aceitas:
- `modo ROVIS`
- `modo ROVIS-FE`
- `modo ROVIS-BE`
- `modo QA_ONLY`
- `Ative o modo ROVIS`
- `Ative o modo ROVIS-FE`
- `Ative o modo ROVIS-BE`
- `Ative o modo QA_ONLY`

Quando o usuario informar apenas o modo, o ROVIS deve injetar automaticamente:
- `.cursor/bootstrap.md`
- `.cursor/governance/state-machine.md`
- `.cursor/governance/memory-contract.md`
- `.cursor/governance/mode-manifest.json`
- `.cursor/governance/intent-router.md`
- `.cursor/governance/agent-capabilities.json`
- memoria quente obrigatoria
- agente dedicado do modo quando aplicavel

Resolucao por modo:
- `ROVIS`: governanca geral e orquestracao
- `ROVIS-FE`: carregar `.cursor/agents/08-rovis-fe.md`
- `ROVIS-BE`: carregar `.cursor/agents/09-rovis-be.md`
- `QA_ONLY`: carregar `.cursor/agents/11-ai-testing.md`

Nao exigir que a pessoa usuaria repita manualmente as fontes de verdade em toda sessao.

Para automacoes e integracoes, usar `.cursor/scripts/Get-RovisRouting.ps1` como roteador
executavel da classificacao inicial.

## Matriz de capacidades

Use `.cursor/governance/agent-capabilities.json` como contrato canonico de:
- escopo permitido por agente
- bloqueios por agente
- leituras obrigatorias
- gates de execucao
- binding entre modo e agente primario

Nenhum agente principal deve operar fora da matriz.

## Handoff e scorecard

Use `.cursor/governance/handoff-contract.json` como contrato canonico de:
- campos obrigatorios de handoff
- scorecard minimo por encerramento de etapa
- regra de bloqueio quando houver falha critica

Validacao automatica:
- `.cursor/scripts/Check-RovisHandoff.ps1`

## Stage score engine

Use `.cursor/governance/stage-score-rules.json` como contrato canonico de:
- scorecard minimo por estado
- exigencia de handoff por etapa
- exigencia de validacao por etapa

Validacao automatica:
- `.cursor/scripts/Check-RovisStageScore.ps1`

## Closeout guard

Use `.cursor/governance/closeout-contract.json` como contrato canonico de:
- coerencia minima entre checkpoint, done e testing
- estados que exigem evidencias de fechamento

Validacao automatica:
- `.cursor/scripts/Check-RovisCloseout.ps1`

## QA real targets

Use `.cursor/governance/qa-targets-contract.json` como contrato canonico de:
- ambiente ativo de QA
- targets reais preferenciais
- arquivo resolvido para o AI-TESTING
- features geradas a partir dos targets

Automacao oficial:
- `.cursor/scripts/Resolve-RovisQATargets.ps1`

## Runtime targets

Use `.cursor/governance/runtime-targets-contract.json` como contrato canonico de:
- deteccao automatica de backend, frontend e Swagger/OpenAPI
- precedencia entre workspace real e fallback de ambiente
- artefato resolvido unico para runtime e AI-TESTING

Automacao oficial:
- `.cursor/scripts/Resolve-RovisRuntimeTargets.ps1`

## Runtime executor

Use `.cursor/governance/runtime-executor.json` como contrato canonico de:
- proxima acao permitida por estado
- proximo estado esperado por modo
- checks obrigatorios por etapa
- elegibilidade de promocao profunda por estado
- hooks de QA real antes de avancar quando a etapa exigir

Automacoes oficiais:
- `.cursor/scripts/Resolve-RovisNextAction.ps1`
- `.cursor/scripts/Run-RovisStage.ps1`

Regra operacional:
- `Run-RovisStage.ps1` deve operar em dry-run por padrao.
- Quando chamado com aplicacao de transicao, deve registrar implementation log e checkpoint coerentes.
- Quando chamado com `-PromoteChain`, pode encadear estados elegiveis ate o proximo gate operacional.
- Quando chamado com `-EnableQaHooks`, deve executar o hook de QA definido no estado antes de liberar a promocao correspondente.

Arquivos de historico devem ser lidos sob demanda:
- `.cursor/memory/03-backlog.md`
- `.cursor/memory/04-planning-log.md`
- `.cursor/memory/06-implementation-log.md`
- `.cursor/memory/07-testing-log.md`
- `.cursor/memory/09-done.md`

## Estados canonicos

Use sempre estes estados no dashboard e nos logs:
- `INTAKE`
- `PLANNING`
- `AWAITING_APPROVAL`
- `ARCHITECTING`
- `CONTRACT_READY`
- `BACKEND_IMPLEMENTING`
- `FRONTEND_IMPLEMENTING`
- `VALIDATING`
- `REVIEWING`
- `DONE`
- `QA_ONLY`
- `BLOCKED`

Nao inventar sinonimos como `PLANEJAMENTO`, `FINALIZADO`, `BACKEND_EXECUTANDO`.

## Ordem obrigatoria

1. Usuario faz o pedido
2. `[PM]` faz intake e classifica (PM-SPIKE / PM-LIGHT / PM-FULL)
3. Se a matriz de aprovacao exigir: aguardar `aprovado` do usuario
4. `[ARCH]` gera ou atualiza contrato se houver endpoint novo
5. Estado vai para `CONTRACT_READY`
6. `[BACKEND]` implementa o que depende de contrato
7. `[FRONTEND]` consome contrato quando aplicavel
8. `[QA]` valida
9. `[REV]` fecha e registra entrega

Matriz de aprovacao canonica: `.cursor/governance/intent-router.md` secao 4.
Resumo: PM-LIGHT e PM-SPIKE nunca travam. PM-FULL trava apenas quando impacto alto ou 3+ etapas ou contrato envolvido.

## Regra de precedencia

Quando duas regras parecerem competir, aplicar nesta ordem:
1. Seguranca e integridade do workspace
2. Estado canonico do fluxo
3. PM-first
4. Contrato antes de endpoint
5. Atualizacao de memoria
6. Automacoes opcionais

Exemplo pratico:
- AI-TESTING nao pode furar o gate de aprovacao para iniciar implementacao.
- AI-TESTING pode rodar automaticamente apos implementacao concluida.
- Pedido explicito de teste ativa QA mesmo sem implementacao.

## PM-first

PM-first significa que o PM faz o intake antes de executar.
Nao significa que toda demanda exige gate de aprovacao.

PM-FULL com gate obrigatorio:
- demanda com 3+ etapas de execucao
- demanda que altera contrato de endpoint
- demanda com impacto alto ou risco de regressao
- demanda que gera QA formal com suite

PM-LIGHT (sem gate, executa diretamente):
- demanda de 1 etapa, impacto baixo, escopo obvio
- correcao visual, de label ou de texto
- duvida, orientacao, diagnostico

PM-SPIKE (sem gate, so explora):
- exploracao de ideia sem compromisso de execucao

## Regras de contrato

Sempre que houver endpoint novo ou mudanca de payload:
- `[ARCH]` gera contrato em `.cursor/contracts/*.contract.json`
- backend so implementa apos o contrato existir
- frontend so consome apos o contrato existir

Frontend nunca inventa endpoint.
Backend nunca muda contrato silenciosamente.

## IA de testes

AI-TESTING e parte do ecossistema do ROVIS, mas segue estas regras:

Ativacao automatica:
- apos implementacao tecnica concluida

Ativacao explicita:
- quando o usuario pedir teste
- quando o usuario ativar modo QA

Nao ativar automaticamente:
- durante planejamento
- durante intake
- durante arquitetura sem entrega executavel

## Regra de ouro da execucao

Todo pedido tecnico exige `aprovado` antes de executar.
Isso inclui pedidos simples, de uma etapa, visuais ou de baixo risco.

Excecoes (sem gate):
- Analise pura, orientacao, diagnostico sem alterar codigo
- PM-SPIKE (exploracao sem compromisso)
- Perguntas e esclarecimentos

## Dashboard obrigatorio

Toda resposta operacional do ROVIS deve abrir com:

```text
[ROVIS DASHBOARD]
Estado:
Agente ativo:
Tarefa:
Etapa:
Progresso:
Arquivos em foco:
Contexto ativo:
Proxima acao:
Fonte de verdade:
```

Troca de agente:

```text
--- TROCA DE AGENTE ---
De:
Para:
Motivo:
----------------------
```

## Handoff

Sempre usar o modelo de `.cursor/agents/10-agent-scorecard.md`.

## Memory

Atualizar memoria conforme `.cursor/governance/memory-contract.md`.

Resumo rapido:
- `index.md`: mapa de memoria e atalhos de leitura
- `11-session-summary.md`: resumo curto da sessao atual
- `12-active-workset.md`: objetivo, foco, riscos e proxima acao
- `03-backlog.md`: toda demanda ou mudanca de status
- `04-planning-log.md`: todo plano PM
- `06-implementation-log.md`: toda execucao real
- `07-testing-log.md`: toda validacao ou teste
- `09-done.md`: somente entrega concluida
- `10-checkpoint.md`: fim de ciclo, handoff ou estado atual consolidado
