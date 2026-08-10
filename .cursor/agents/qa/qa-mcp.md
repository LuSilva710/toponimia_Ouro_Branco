# QA — MCP (chrome-devtools, codex, gemini)

Servidores MCP configurados em `.cursor/mcp.json`:
- `chrome-devtools` — abrir e inspecionar navegador
- `codex` — provider local padrao (geracao, root-cause, fixes)
- `gemini` — fallback opcional

---

## Quando usar (obrigatorio)

Sempre que algo novo for implementado, antes do engine standalone:

1. Abrir navegador via `chrome-devtools` (se houver UI)
2. Gerar cenarios via `codex` com o diff
3. Validar contratos via `codex`
4. Analisar falhas em tempo real via `codex`
5. Sugerir fixes via `codex`

---

## Protocolo

```
[AI-TESTING via Chrome DevTools + Codex MCP]

1. Ler diff da mudanca
2. Abrir navegador via chrome-devtools (se UI)
3. Chamar codex com prompt de geracao
4. Exibir casos no chat (ID, tipo, criterio)
5. Executar Run-AIEngine.ps1
6. Se falhar: enviar logs ao codex (root-cause)
7. Exibir analise + sugestoes
8. Reportar Quality Score
```

---

## Fallback

| Provider primario | Fallback 1 | Fallback 2 |
|---|---|---|
| codex | gemini | modo offline |

Detalhes de modo offline: ver `.cursor/agents/11-ai-testing.md` secao "Fallback de provider".

---

## Bloqueio via MCP

Se MCP detectar:
- Contrato quebrado: BLOQUEAR + reportar
- Validacao critica falhou: BLOQUEAR + sugerir fix
- Score < 50: BLOQUEAR entrega

---

## Formato de resposta com MCP

```
[CODEX MCP + CHROME DEVTOOLS MCP - AI-TESTING]
Ferramenta browser: chrome-devtools
Ferramenta analise: codex (ou gemini se fallback)
Prompt enviado: <resumo>
Cenarios gerados: X
Analise de falhas: <root cause>
Sugestao de fix: <texto>
Quality Score estimado: X/100
```

---

## Config

`.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "gemini": { "command": "npx", "args": ["-y", "@google/gemini-cli", "mcp"], "env": { "GEMINI_API_KEY": "${GEMINI_API_KEY}" } },
    "codex":  { "command": "codex", "args": ["--mcp-server"], "env": { "OPENAI_API_KEY": "${OPENAI_API_KEY}" } },
    "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest"] }
  }
}
```
