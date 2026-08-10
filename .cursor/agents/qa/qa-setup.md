# QA — Setup e execucao

## Pre-requisitos

1. Node.js 20+
2. Provider de IA configurado (`OPENAI_API_KEY` ou `GEMINI_API_KEY`)
3. App rodando em `TARGET_BASE_URL` (opcional para API/browser)

---

## Setup interativo (recomendado na primeira vez)

```powershell
powershell -ExecutionPolicy Bypass -File .cursor/testing-module/scripts/Setup-AIEngine.ps1
```

Pergunta: provider, chave API, URL, usuario/senha, modo. Instala npm + Playwright.

Reset: `Setup-AIEngine.ps1 -Reset`

---

## Comandos de execucao

| Modo | Comando |
|---|---|
| Full | `Run-AIEngine.ps1` |
| API | `Run-AIEngine.ps1 -Mode api` |
| Browser | `Run-AIEngine.ps1 -Mode browser` |
| Generate only | `Run-AIEngine.ps1 -Mode generate` |
| Smart (so diff) | `Run-AIEngine.ps1 -Mode smart` |
| Custom target | `Run-AIEngine.ps1 -Mode api -TargetBaseUrl "https://..." -GeminiApiKey "..."` |
| Pipeline integrado | `$env:USE_AI_ENGINE="true"; Run-TestModule.ps1` |
| Status rapido | `.cursor/scripts/Get-RovisQAStatus.ps1` |
| Status com diff | `.cursor/scripts/Get-RovisQAStatus.ps1 -Diff` |
| Compactar relatorios | `.cursor/scripts/Compress-RovisQAReports.ps1` |

---

## Providers

| Provider | Env | Modelo | MCP |
|---|---|---|---|
| OpenAI / Codex CLI (padrao) | `AI_PROVIDER=openai` | `gpt-4o-mini` | `codex` |
| Google Gemini | `AI_PROVIDER=gemini` | `gemini-2.0-flash` | `gemini` |

`.env`:
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Via parametro:
```powershell
.\Run-AIEngine.ps1 -Provider openai -OpenAIApiKey "sk-..."
.\Run-AIEngine.ps1 -Provider gemini -GeminiApiKey "AIza..."
```

---

## Engine layout

```
.cursor/testing-module/ai-engine/
  src/
    index.ts                          # Entry pipeline
    types/index.ts
    config/aiProvider.ts              # Provider unificado (codex/gemini)
    config/geminiConfig.ts
    config/codexCliConfig.ts
    generators/contractReader.ts
    generators/aiTestGenerator.ts
    generators/swaggerReader.ts
    executors/testRunner.ts
    executors/playwrightExecutor.ts
    executors/apiExecutor.ts
    validators/aiResultValidator.ts
    reporters/qualityReporter.ts
    reporters/htmlReporter.ts
  package.json
  .env.example
```

Todos os modulos importam IA via `aiProvider.ts` — troca de provider sem mudar codigo.

---

## Tipos de caso

| Tipo | Descricao |
|---|---|
| `api` | HTTP + status + body |
| `browser_flow` | Playwright Chromium (sempre headed) |
| `field_validation` | Regras de form (required, minLength) |
| `mask_validation` | Regex em campos formatados (CPF, telefone) |
| `contract_smoke` | Endpoint reachable (status < 500) |

---

## Acoes de browser_flow

navigate, click, double_click, fill, type_slow, clear, select, hover, press_key, scroll_to, screenshot, assert_text, assert_visible, assert_not_visible, assert_url, assert_count, assert_value, wait, wait_for_response, login, assert_authenticated, save_session.

Headed por padrao. Para CI: `HEADED=0` no `.env`.
