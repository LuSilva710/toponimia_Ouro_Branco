# State Machine do ROVIS

## Estados canonicos

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

## Transicoes validas

- `INTAKE -> PLANNING`
- `PLANNING -> AWAITING_APPROVAL`
- `AWAITING_APPROVAL -> ARCHITECTING`
- `ARCHITECTING -> CONTRACT_READY`
- `CONTRACT_READY -> BACKEND_IMPLEMENTING`
- `CONTRACT_READY -> FRONTEND_IMPLEMENTING`
- `BACKEND_IMPLEMENTING -> VALIDATING`
- `FRONTEND_IMPLEMENTING -> VALIDATING`
- `VALIDATING -> REVIEWING`
- `REVIEWING -> DONE`

Transicoes auxiliares:
- qualquer estado -> `BLOCKED`
- `DONE -> QA_ONLY` quando houver rodada de testes pos-entrega
- `INTAKE -> QA_ONLY` quando o pedido for apenas teste

## Regras de leitura

- Se houver implementacao: obrigatorio passar por `PLANNING` e
  `AWAITING_APPROVAL`.
- Se houver endpoint: obrigatorio passar por `ARCHITECTING` e `CONTRACT_READY`.
- `QA_ONLY` nao autoriza implementacao.

## Precedencia de automacoes

1. PM-first
2. Contrato antes de endpoint
3. Memory update
4. AI-TESTING

## Mapeamento por modo

- `ROVIS`: todos os estados canonicos
- `ROVIS-FE`: usa os estados canonicos e pode detalhar subtarefas internas
- `ROVIS-BE`: usa os estados canonicos e pode detalhar subtarefas internas
- `QA_ONLY`: usa `QA_ONLY -> VALIDATING -> DONE`
