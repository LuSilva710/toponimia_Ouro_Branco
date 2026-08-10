Ative o modo informado pelo usuario.

Entrada curta oficial:
- `modo ROVIS dentro da .cursor`
- `modo ROVIS-FE dentro da .cursor`
- `modo ROVIS-BE dentro da .cursor`
- `modo QA_ONLY dentro da .cursor`

Alias equivalentes:
- `Ative o modo ROVIS dentro da .cursor`
- `Ative o modo ROVIS-FE dentro da .cursor`
- `Ative o modo ROVIS-BE dentro da .cursor`
- `Ative o modo QA_ONLY dentro da .cursor`

Ao receber apenas o modo, injete automaticamente:
- `.cursor/bootstrap.md` como fonte principal de governanca
- `.cursor/governance/state-machine.md` para estados e precedencia
- `.cursor/governance/memory-contract.md` para decidir quais logs atualizar
- `.cursor/governance/mode-manifest.json` como manifesto canonico dos modos
- `.cursor/governance/intent-router.md` como regra canonica de roteamento
- `.cursor/governance/agent-capabilities.json` como matriz canonica de capacidades e limites
- `.cursor/governance/handoff-contract.json` como contrato canonico de handoff e scorecard
- `.cursor/governance/stage-score-rules.json` como motor canonico de scorecard por etapa
- `.cursor/governance/closeout-contract.json` como guarda canonica de fechamento de etapa
- `.cursor/governance/qa-targets-contract.json` como contrato canonico de alvos reais de QA
- `.cursor/governance/runtime-executor.json` como sistema nervoso canonico de execucao por estado
- `.cursor/governance/runtime-targets-contract.json` como contrato canonico de deteccao de backend, frontend e Swagger
- `.cursor/memory/` como unica pasta oficial de memoria operacional
- memoria quente obrigatoria definida no bootstrap

Roteamento executavel:
- `.cursor/scripts/Get-RovisRouting.ps1 -Text "<mensagem do usuario>"`

Boot do orquestrador (primeira resposta apos ativar modo):
- Rodar `.cursor/scripts/Test-RovisHealth.ps1` em background.
- Mostrar resultado APENAS se houver itens CRITICO. Avisos podem ser silenciados.
- Verificar loop com `.cursor/scripts/Get-RovisLoopDetect.ps1 -CurrentText "<msg>"`.

Regra de execucao (MAIS IMPORTANTE):
- Todo pedido tecnico exige `aprovado` antes de executar — simples ou complexo.
- Excecoes que NAO pedem aprovado: analise pura, orientacao, diagnostico sem codigo, PM-SPIKE.
- Escrever arquivos texto em UTF-8.
- Rodar AI-TESTING apenas nestes casos:
  - pedido explicito de teste
  - modo QA explicito
  - implementacao tecnica concluida

Roteamento de intake:
- Analise, orientacao, diagnostico → PM-LIGHT → responde sem gate.
- Exploracao sem compromisso → PM-SPIKE → responde sem gate.
- Qualquer pedido tecnico (simples ou complexo) → PM-FULL → pede `aprovado`.
- Teste explicito → AI-TESTING, sem implementacao.

Resolucao por modo:
- `ROVIS`: governanca geral e orquestracao.
- `ROVIS-FE`: somente front-end; carregar `.cursor/agents/08-rovis-fe.md`.
- `ROVIS-BE`: somente back-end; carregar `.cursor/agents/09-rovis-be.md`.
- `QA_ONLY`: somente QA e relatorios; carregar `.cursor/agents/11-ai-testing.md`.

Automacoes oficiais:
- Health check do sistema via `.cursor/scripts/Test-RovisHealth.ps1` (recomendado no inicio de sessao).
- Roteamento de modo/intake via `.cursor/scripts/Get-RovisRouting.ps1`.
- Validacao de handoff/scorecard via `.cursor/scripts/Check-RovisHandoff.ps1`.
- Validacao de score por etapa via `.cursor/scripts/Check-RovisStageScore.ps1`.
- Validacao de fechamento via `.cursor/scripts/Check-RovisCloseout.ps1`.
- Resolucao de QA targets via `.cursor/scripts/Resolve-RovisQATargets.ps1`.
- Resolucao de runtime targets via `.cursor/scripts/Resolve-RovisRuntimeTargets.ps1`.
- Resolucao da proxima acao via `.cursor/scripts/Resolve-RovisNextAction.ps1`.
- Execucao guiada por etapa via `.cursor/scripts/Run-RovisStage.ps1`.
- Aplicacao real de transicao via `.cursor/scripts/Run-RovisStage.ps1 -ApplyTransition`.
- Promocao profunda opcional via `.cursor/scripts/Run-RovisStage.ps1 -ApplyTransition -PromoteChain`.
- Hook de QA real por etapa via `.cursor/scripts/Run-RovisStage.ps1 -ApplyTransition -EnableQaHooks`.
- Registrar memoria via `.cursor/scripts/Write-RovisMemory.ps1`.
- Validar governanca via `.cursor/scripts/Test-RovisGovernance.ps1`.
- Converter memoria legada via `.cursor/scripts/Convert-MemoryToUtf8.ps1`.
- Compactar e resumir memoria via `.cursor/scripts/Compress-RovisMemory.ps1`.
- Verificar saude geral do sistema via `.cursor/scripts/Test-RovisHealth.ps1`.

Comandos rapidos (atalhos do usuario):
- `/health` -> `.cursor/scripts/Test-RovisHealth.ps1`
- `/qa status` -> `.cursor/scripts/Get-RovisQAStatus.ps1 -Diff`
- `/qa fix` -> `.cursor/scripts/Invoke-RovisAutoFix.ps1`
- `/trace` -> `.cursor/scripts/Get-RovisExecutionTrace.ps1`
- `/index build` -> `.cursor/scripts/Build-RovisCodeIndex.ps1`
- `/index search <termo>` -> `.cursor/scripts/Search-RovisCode.ps1 -Query <termo>`
- `/fe visual <url> <name>` -> `.cursor/scripts/Test-RovisVisualDiff.ps1 -Url <url> -Name <name>`
- `/fe a11y <url>` -> `.cursor/scripts/Test-RovisA11y.ps1 -Url <url>`
- `/be migration` -> `.cursor/scripts/Test-RovisMigrationSafety.ps1`
- `/be breaking` -> `.cursor/scripts/Test-RovisBreakingChanges.ps1`
- `/be load <url>` -> `.cursor/scripts/Run-RovisLoadTest.ps1 -Url <url>`
- `/be audit` -> `.cursor/scripts/Test-RovisDepAudit.ps1`
- `/session summary` -> `.cursor/scripts/Get-RovisSessionSummary.ps1`
- `/profile` -> `.cursor/scripts/Get-RovisProjectProfile.ps1` (detecta stack/endpoints/paginas)
- `/learn` -> `.cursor/scripts/Get-RovisInsights.ps1` (insights da sessao)
- `/suggest <sintoma>` -> `.cursor/scripts/Get-RovisFixSuggestion.ps1 -Symptom <sintoma>`
- `/install <pasta>` -> `.cursor/scripts/Initialize-Rovis.ps1 -Project <pasta>` (instala ROVIS em projeto novo)
- `/reset memory` -> `.cursor/scripts/Reset-RovisMemory.ps1 -Scope memory` (limpa logs/metrics, mantem backlog/done)
- `/reset state` -> `.cursor/scripts/Reset-RovisMemory.ps1 -Scope state` (limpa so a sessao atual)
- `/reset all` -> `.cursor/scripts/Reset-RovisMemory.ps1 -Scope all -Force` (reset completo de memoria)
- `/clear archive` -> `.cursor/scripts/Clear-RovisArchive.ps1 -All` (apaga TODOS os snapshots)
- `/clear archive 30` -> `.cursor/scripts/Clear-RovisArchive.ps1 -OlderThanDays 30` (apaga snapshots > 30 dias)
