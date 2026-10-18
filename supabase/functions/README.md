# Edge Functions

## `onim-chat` — agente do chatbot ONIM

Proxy entre o site (GitHub Pages) e os provedores de LLM. As chaves de IA ficam **só** aqui,
como secrets do Supabase. O navegador envia a pergunta e as últimas 4 mensagens, e recebe o HTML da resposta.

O agente usa *tool calling* (formato OpenAI) com 3 ferramentas que leem o banco com a chave `anon`
(o RLS continua valendo): `historical_search` (texto + vetorial via `match_ruas`), `get_statistics`
e `neighborhood_info`.

Proteções: limite de 500 caracteres por pergunta, rate limit por IP (hash) via
`onim_consume_quota` (migration `08_onim_rate_limit.sql`) e CORS restrito a `ALLOWED_ORIGINS`.

### Deploy

Pré-requisito: [Supabase CLI](https://supabase.com/docs/guides/cli) e a migration `08` aplicada.

```bash
supabase login
supabase link --project-ref vtsuctcmycaiooeubjnk

supabase secrets set \
  GEMINI_API_KEY=... \
  GEMINI_MODEL=gemini-2.0-flash \
  ALLOWED_ORIGINS=https://lusilva710.github.io,http://localhost:5173,http://127.0.0.1:4173 \
  RATE_LIMIT_SALT=$(openssl rand -hex 16)

# Opcional: fallback OpenAI-compatível (Groq, OpenRouter…) quando o Gemini der 429
supabase secrets set \
  OPENAI_API_KEY=... \
  OPENAI_BASE_URL=https://api.groq.com/openai/v1 \
  OPENAI_MODEL=llama-3.3-70b-versatile

supabase functions deploy onim-chat
```

### Secrets

| Secret | Default | Uso |
|--------|---------|-----|
| `GEMINI_API_KEY` | — | Chat (endpoint OpenAI-compatível do Gemini) + embeddings da busca vetorial |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo de chat |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL` | — / OpenAI / `gpt-4o-mini` | Provider alternativo |
| `AI_PROVIDER` | `gemini` | Primário (`gemini` ou `openai`); o outro só entra em erro de cota |
| `ALLOWED_ORIGINS` | *(vazio = qualquer origem)* | Origens aceitas, separadas por vírgula |
| `RATE_LIMIT_PER_MINUTE` / `RATE_LIMIT_PER_DAY` | `6` / `60` | Perguntas por IP |
| `RATE_LIMIT_SALT` | `onim` | Sal do hash do IP |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados pela plataforma.

### Teste rápido

```bash
curl -X POST "https://vtsuctcmycaiooeubjnk.supabase.co/functions/v1/onim-chat" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pergunta":"Quem foi Amaro Lanari?"}'
```

Logs: `supabase functions logs onim-chat`.

### Depois do deploy

As chaves que estavam em `VITE_GEMINI_API_KEY` / `VITE_OPENAI_API_KEY` foram publicadas em builds
anteriores do site, então devem ser **revogadas e recriadas**. Apague também esses secrets do
repositório no GitHub (Settings → Secrets and variables → Actions).
