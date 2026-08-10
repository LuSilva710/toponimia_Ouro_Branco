# Agent Scorecard (Padrao Unificado)

Este arquivo define o padrao minimo obrigatorio para todos os agentes.
Fonte canonica complementar:
- `.cursor/governance/handoff-contract.json`
- `.cursor/governance/stage-score-rules.json`

## 1) Entrada obrigatoria por etapa

- Objetivo da etapa em 1-2 frases.
- Escopo (inclui / nao inclui).
- Fonte de verdade citada (contrato, planning-log, backlog, regra).
- Estado atual e agente ativo.

## 2) Saida obrigatoria por etapa

- Resultado objetivo da etapa.
- Arquivos alterados.
- Comandos executados.
- Riscos e pendencias.
- Proxima acao clara.

## 3) Gate de execucao

Antes de qualquer acao tecnica:

| # | Verificacao | Status |
|---|---|---|
| 1 | Estado correto no dashboard | [ OK / FALHA ] |
| 2 | Agente correto para a etapa | [ OK / FALHA ] |
| 3 | Memoria quente lida (context, session, workset) | [ OK / FALHA ] |
| 4 | Contrato existente quando aplicavel | [ OK / N/A ] |
| 5 | Encoding UTF-8 validado | [ OK / FALHA ] |

## 4) Handoff padrao

O handoff e CONDICIONAL ao tipo de transicao:

### Handoff resumido (troca interna no mesmo modo)

```text
[HANDOFF-LITE]
De:
Para:
Motivo:
```

Usar quando:
- troca entre etapas dentro do mesmo modo (ex: ROVIS → ROVIS no proximo estado)
- troca entre PM/ARCH/REV no mesmo dominio

### Handoff completo (troca de modo ou de dominio)

Use este bloco ao transferir responsabilidade entre modos ou para QA:

```text
[HANDOFF]
De:
Para:
Objetivo:
Fonte de verdade:
Arquivos em foco:
Riscos:
Proxima acao:

Scorecard de saida:
- state_compliance:            [ OK / FALHA ]
- source_of_truth_declared:    [ OK / FALHA ]
- memory_updated:              [ OK / FALHA ]
- test_validation_executed:    [ OK / N/A   ]
- handoff_quality:             [ OK / FALHA ]
- encoding_utf8_validated:     [ OK / FALHA ]
```

Regras:
- usar este bloco sempre que houver troca real de agente
- nao encerrar etapa com troca de agente sem esse bloco
- o handoff deve respeitar `.cursor/governance/handoff-contract.json`

## 5) Scorecard por execucao

Preencher ao encerrar qualquer etapa com entrega:

```text
[SCORECARD]
Etapa:
Data:
Agente:

Criterios:
- state_compliance:            [ OK / FALHA ] — estado correto durante toda execucao
- source_of_truth_declared:    [ OK / FALHA ] — fonte de verdade declarada
- memory_updated:              [ OK / FALHA ] — memoria atualizada conforme contrato
- test_validation_executed:    [ OK / N/A   ] — QA executado quando aplicavel
- handoff_quality:             [ OK / FALHA ] — handoff preenchido quando houve troca
- encoding_utf8_validated:     [ OK / FALHA ] — arquivos em UTF-8
- session_metrics_updated:     [ OK / FALHA ] — chamou Update-RovisSessionMetrics.ps1
- workset_updated:             [ OK / FALHA ] — chamou Update-RovisWorkset.ps1 no inicio
- checkpoint_registered:       [ OK / FALHA ] — chamou Update-RovisCheckpoint.ps1 apos cada batch

Hooks obrigatorios em toda execucao tecnica:
```
# inicio
powershell -ExecutionPolicy Bypass -File .cursor/scripts/Update-RovisWorkset.ps1 -Task "<resumo>" -Mode <X> -Agent <Y>

# apos cada batch (ferramentas/edits/scripts)
powershell -ExecutionPolicy Bypass -File .cursor/scripts/Update-RovisCheckpoint.ps1 -Action "<o que fiz>" -Agent <X>

# fim
powershell -ExecutionPolicy Bypass -File .cursor/scripts/Update-RovisSessionMetrics.ps1 -Source <agent>
```

Hook obrigatorio ao final de cada execucao:
```
powershell -ExecutionPolicy Bypass -File .cursor/scripts/Update-RovisSessionMetrics.ps1 -Source "<agent-id>" -QualityScore <N> -Regression <bool> -Flaky <N>
```
Para agentes nao-QA, usar `-QualityScore -1 -Regression $false -Flaky 0`.

Falhas criticas (bloqueia encerramento):
- [ ] Nenhuma falha critica detectada
- [ ] FALHA: descrever aqui

Resultado:
- APROVADO / BLOQUEADO
```

Motor de etapa:
- validar os itens acima contra `.cursor/governance/stage-score-rules.json`
- considerar falha critica quando um item exigido pela etapa estiver ausente ou `FALHA`

## 6) Criterio de aprovacao de etapa

Uma etapa so pode ser considerada concluida quando:

- [ ] backlog e implementation-log atualizados
- [ ] validacao executada (quando aplicavel)
- [ ] scorecard sem falhas criticas
- [ ] handoff preenchido quando houve troca de agente
