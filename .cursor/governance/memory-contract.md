# Contrato de Memoria do ROVIS

Use `.cursor/memory/` como unica memoria operacional oficial.

## Modelo hot/cold

### Memoria quente

Arquivos que devem ser pequenos e lidos primeiro:
- `index.md`
- `11-session-summary.md`
- `12-active-workset.md`
- `10-checkpoint.md`
- `00-context.md`

### Memoria fria

Arquivos que guardam historico detalhado e devem ser lidos sob demanda:
- `03-backlog.md`
- `04-planning-log.md`
- `06-implementation-log.md`
- `07-testing-log.md`
- `09-done.md`
- `archive/*`

## Arquivos e quando atualizar

### `index.md`
Atualize quando:
- houver mudanca relevante no conjunto de memoria quente
- a estrutura de arquivos mudar
- um compactador regenerar os resumos

### `11-session-summary.md`
Atualize quando:
- a sessao mudar de objetivo
- o checkpoint mudar de forma relevante
- um compactador regenerar o resumo atual

### `12-active-workset.md`
Atualize quando:
- mudarem objetivo, foco, riscos ou proxima acao
- um novo pedido virar foco ativo
- um compactador regenerar o workset

Campo opcional `valido_ate`:
- Formato: `valido_ate: YYYY-MM-DD`
- Quando presente e a data tiver passado, tratar o workset como desatualizado.
- Workset desatualizado exige releitura de `10-checkpoint.md` antes de qualquer acao.
- Quando o compactador regenerar o workset, definir `valido_ate` como 7 dias a partir da data atual.

### `03-backlog.md`
Atualize quando:
- uma nova demanda entra
- o status da demanda muda
- contrato fica pronto
- a entrega muda de dono ou fila

### `04-planning-active.md`
Atualize quando:
- o PM fizer um plano novo (adicionar entrada)
- o plano for concluido ou cancelado (remover entrada)
- o status do plano mudar

Contem apenas planos pendentes ou em execucao. Nunca historico.

### `04-planning-log.md`
Atualize quando:
- o PM fizer um plano (copiar tambem para planning-active)
- o plano for ajustado
- o plano for aprovado
- o plano for encerrado (remover do planning-active, manter aqui)

### `06-implementation-log.md`
Atualize quando:
- houve execucao real no workspace
- houve implementacao, refatoracao, configuracao ou automacao

### `07-testing-log.md`
Atualize quando:
- houve build
- houve teste manual
- houve teste automatizado
- houve QA formal

### `09-done.md`
Atualize quando:
- uma entrega terminou de fato
- o estado final ficou claro para a proxima pessoa/agente

### `10-checkpoint.md`
Atualize quando:
- a sessao muda de fase
- existe handoff
- e preciso consolidar o estado atual e a proxima acao

## Regras de escrita

- Escrever em UTF-8.
- Nao usar redirecionamento sem encoding explicito.
- Preferir automacao via `.cursor/scripts/Write-RovisMemory.ps1`.
- Preferir regenerar memoria quente via `.cursor/scripts/Compress-RovisMemory.ps1`.
- Nao duplicar o mesmo evento em todos os arquivos; registrar so onde faz sentido.
- Leitura inicial deve priorizar memoria quente; memoria fria so entra quando necessario.

## Minimo por tipo de trabalho

Planejamento puro:
- `11-session-summary.md`
- `12-active-workset.md`
- `03-backlog.md`
- `04-planning-log.md`
- `10-checkpoint.md` quando houver mudanca de estado relevante

Implementacao:
- `11-session-summary.md`
- `12-active-workset.md`
- `03-backlog.md`
- `06-implementation-log.md`
- `10-checkpoint.md`
- `09-done.md` se concluiu

Teste:
- `11-session-summary.md`
- `07-testing-log.md`
- `10-checkpoint.md`
- `09-done.md` se concluiu entrega de QA

## Regra de compactacao

Quando `03-backlog.md`, `04-planning-log.md`, `06-implementation-log.md` ou `09-done.md`
ficarem grandes o suficiente para atrapalhar leitura, executar
`.cursor/scripts/Compress-RovisMemory.ps1`.

O compactador deve:
- criar snapshots em `archive/`
- regenerar `index.md`
- regenerar `11-session-summary.md`
- regenerar `12-active-workset.md`
- nunca apagar historico sem instrucao explicita
