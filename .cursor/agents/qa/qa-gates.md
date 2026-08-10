# QA — Matriz de bloqueio (Quality Gates)

Documenta `.cursor/testing-module/config/quality-gates.json` e quando cada gate dispara bloqueio.

---

## Gates atuais

| Campo | Valor | Significado | Bloqueia? |
|---|---|---|---|
| `failOnFailed` | `true` | Falhar build se houver caso failed | sim |
| `maxFailed` | `0` | Maximo de cases failed permitidos | sim se > 0 |
| `maxSkipped` | `0` | Maximo de cases skipped permitidos | sim se > 0 |
| `minPassRate` | `1.0` | Pass rate minimo (0.0 a 1.0) | sim se < threshold |
| `minTotalCases` | `4` | Minimo de cases gerados (evita falso verde) | sim |
| `minRealCommandCases` | `2` | Minimo de casos reais (nao smoke) | sim |
| `requireRealTargetsInCi` | `true` | CI exige targets reais (nao mock) | sim em CI |

---

## Matriz de bloqueio por etapa

| Etapa | Gate | Acao se falhar |
|---|---|---|
| Pre-flight | targets nao resolvidos | BLOQUEAR — pedir env |
| Pre-flight | quality-gates ausente | BLOQUEAR — usar default |
| Generating | < `minTotalCases` | BLOQUEAR — IA gerou pouco, retry |
| Generating | < `minRealCommandCases` | BLOQUEAR — so smoke nao basta |
| Executing | regressao > -20 pontos | BLOQUEAR — pedir analise |
| Reporting | passRate < `minPassRate` | BLOQUEAR — falhas reais |
| Reporting | flaky >= 50% dos failed | AVISAR — nao bloqueia (instabilidade) |
| Reporting | score < 50 | BLOQUEAR via MCP (qa-mcp.md) |

---

## Override em desenvolvimento

Para rodar sem bloqueios (apenas dev local):
```powershell
$env:QA_BYPASS_GATES = "true"
powershell -File .cursor/testing-module/scripts/Run-AIEngine.ps1
```

Em CI o `QA_BYPASS_GATES` e ignorado.

---

## Regressao

Ver `.cursor/agents/11-ai-testing.md` secao "Inteligencia da execucao".

| Delta vs run anterior | Acao |
|---|---|
| >= 0 | OK |
| -1 a -10 | AVISAR |
| -11 a -20 | AVISAR + flag `regressionDetected: true` |
| < -20 | BLOQUEAR + pedir analise |
