# Intent Router do ROVIS

Este arquivo define como o ROVIS deve classificar mensagens de entrada antes de agir.

## Ordem de decisao

1. Detectar troca explicita de modo
2. Detectar intent de teste
3. Classificar intake como `PM-LIGHT` ou `PM-FULL`
4. Decidir se a resposta fica em planejamento ou se existe gate de aprovacao

## 1. Troca de modo

Se a mensagem contiver qualquer entrada canonica do manifesto de modos, ativar esse modo.

Entradas canonicas:
- `modo ROVIS`
- `modo ROVIS-FE`
- `modo ROVIS-BE`
- `modo QA_ONLY`
- `Ative o modo ROVIS`
- `Ative o modo ROVIS-FE`
- `Ative o modo ROVIS-BE`
- `Ative o modo QA_ONLY`

Ao ativar modo:
- carregar `.cursor/bootstrap.md`
- carregar `.cursor/governance/state-machine.md`
- carregar `.cursor/governance/memory-contract.md`
- carregar `.cursor/governance/mode-manifest.json`
- carregar memoria quente obrigatoria
- carregar o agente do modo, quando aplicavel

## 2. Intent de teste

Se a mensagem pedir teste explicitamente, classificar como `QA_ONLY` para esta demanda,
sem iniciar implementacao.

Indicadores:
- `testa`
- `testar`
- `teste`
- `rodar teste`
- `roda o engine`
- `executa os testes`
- `valida`
- `verifica`

Regras:
- pedido explicito de teste ativa AI-TESTING
- intent de teste nao autoriza implementacao
- se houver implementacao pendente, manter o gate de aprovacao separado

## 3. Intake

Usar `PM-SPIKE` quando:
- a demanda for exploracao de ideia sem compromisso de execucao
- o pedido for ambiguo e precisar de hipoteses antes de virar plano
- o usuario quiser entender opcoes sem gate de aprovacao
- Nao exige registro formal de plano nem `aprovado`

Usar `PM-LIGHT` quando:
- a demanda for analise
- a demanda for planejamento
- a demanda for esclarecimento
- nao houver execucao tecnica imediata

Usar `PM-FULL` quando:
- houver codigo
- houver contrato
- houver QA formal
- houver multiplas etapas
- houver alteracao de governanca, memoria ou automacao

## 4. Gate de aprovacao

| Intake | Exige aprovado? |
|--------|-----------------|
| PM-SPIKE | NAO — so explora |
| PM-LIGHT | NAO — so informa |
| PM-FULL | SEMPRE — qualquer alteracao tecnica, simples ou complexa |

Regras fixas:
- PM-SPIKE e PM-LIGHT: nunca exigem aprovacao.
- PM-FULL: sempre exige `aprovado` explicito, independente do tamanho da mudanca.
- Pedido tecnico = PM-FULL = gate obrigatorio.

## Saida minima esperada

Toda classificacao deve explicitar:
- `mode`
- `intake` — PM-SPIKE | PM-LIGHT | PM-FULL
- `state`
- `requiresApproval` — false para PM-SPIKE/PM-LIGHT, true para PM-FULL
- `activateTesting`
- `sourceOfTruth`

## Roteador executavel

Quando houver automacao, usar:

```powershell
powershell -ExecutionPolicy Bypass -File .cursor/scripts/Get-RovisRouting.ps1 -Text "<mensagem do usuario>"
```

Esse script deve refletir este arquivo e o manifesto de modos sem criar uma segunda
politica concorrente.
