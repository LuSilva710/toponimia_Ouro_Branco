# 🗺️ Toponímia Urbana de Ouro Branco

[![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-green)]()
[![License](https://img.shields.io/badge/License-MIT-blue)]()
[![PWA](https://img.shields.io/badge/PWA-Ready-orange)]()

Plataforma de catalogação, preservação e análise dos nomes de logradouros de **Ouro Branco/MG**. Trabalho acadêmico (TCC) — IFMG Campus Ouro Branco.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | **Vite 6 + React 19** (MPA: um HTML por tela) |
| Dados | **Supabase** (Postgres, Auth, RLS) |
| Mapa | Leaflet (CDN) + GeoJSON em `public/data/` |
| IA / ONIM | LangChain + Gemini / OpenAI-compatível (Groq, OpenRouter…) |
| Deploy | GitHub Actions → GitHub Pages (`base`: `/toponimia_Ouro_Branco/`) |

**Node recomendado:** 20.x (igual ao CI). Node 22+ costuma funcionar.

## Setup rápido (novo desenvolvedor)

```bash
git clone https://github.com/LuSilva710/toponimia_Ouro_Branco.git
cd toponimia_Ouro_Branco
cp .env.example .env
# Edite .env — no mínimo VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install --legacy-peer-deps
npm run dev
```

Abra `http://localhost:5173/` (Dicionário). Outras telas: `/mapa.html`, `/estatisticas.html`, `/admin.html`, `/portaleducativo.html`, `/games/*.html`.

## Variáveis de ambiente

| Variável | Obrigatória? | Para quê |
|----------|--------------|----------|
| `VITE_SUPABASE_URL` | **Sim** | App inteiro |
| `VITE_SUPABASE_ANON_KEY` | **Sim** | App inteiro (chave `anon` pública do projeto) |
| `VITE_CARTO_API_KEY` | Não | Basemap CARTO no mapa (default: OSM via toggle) |
| `VITE_AI_PROVIDER` | Não* | ONIM (`gemini` / `openai` / `openrouter`) |
| `VITE_GEMINI_API_KEY` | Não* | Chat + embeddings do agente |
| `VITE_GEMINI_MODEL` | Não | Ex.: `gemini-2.0-flash` |
| `VITE_OPENAI_API_KEY` | Não* | Groq / OpenAI / OpenRouter (compatível) |
| `VITE_OPENROUTER_API_KEY` | Não* | Alias aceito se `VITE_OPENAI_API_KEY` estiver vazia |
| `VITE_OPENAI_BASE_URL` | Não | Ex.: `https://api.groq.com/openai/v1` |
| `VITE_OPENAI_MODEL` | Não | Modelo do provider OpenAI-compatível |
| `VITE_OLLAMA_URL` / `VITE_OLLAMA_MODEL` | Não | Fallback local |
| `SUPABASE_SERVICE_ROLE_KEY` | Não | Só scripts de embeddings (nunca no Vite) |
| `AI_PROVIDER` / `GEMINI_API_KEY` | Não | Scripts `ai-provider-kit` (Node) |

\* Sem chaves de IA a UI sobe, mas o chatbot ONIM não responde.

> **Aviso de segurança:** qualquer `VITE_*` entra no bundle do browser (Pages). Não use service role no front. Rotacione chaves de IA se vazar no deploy.

## Scripts npm

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desenvolvimento (porta 5173) |
| `npm run build` | Build de produção → `dist/` |
| `npm run preview` | Serve `dist/` (porta 4173) — URL: `/toponimia_Ouro_Branco/` |
| `npm run smoke` | Smoke Playwright nas 10 páginas MPA (precisa `preview` rodando) |
| `npm run ai:build` | Compila `ai-provider-kit` |
| `npm run ai:classify` | Classifica ruas via IA (precisa kit buildado + env) |

### Smoke (checklist de handoff)

```bash
npm run build
npm run preview   # outro terminal
npx playwright install chromium   # 1ª vez
npm run smoke
```

## Arquitetura frontend

MPA Vite: cada `*.html` monta um entry `src/*.jsx`.

- `src/pages/` — telas React  
- `src/components/` — Navbar, Footer, GameChrome  
- `src/features/` — ONIM, PDF  
- `src/lib/` — supabase, ai-client  

Aliases (`vite.config.js` / `jsconfig.json`): `@lib`, `@features`, `@components`, `@pages`, `@styles` **antes** de `@`.

Detalhes: `src/README.md`.

## Deploy (GitHub Pages)

Workflow: `.github/workflows/deploy.yml` (branch `main`).

Secrets/vars necessários no repositório:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Opcional IA: `VITE_AI_PROVIDER`, `VITE_GEMINI_API_KEY`, `VITE_GEMINI_MODEL`, `VITE_OPENAI_*`
- Opcional mapa: `VITE_CARTO_API_KEY` (se não houver, o toggle OSM cobre)

## Troubleshooting

| Sintoma | Causa / ação |
|---------|----------------|
| Tela branca ou erro de dados na Home | Falta `.env` com Supabase — `cp .env.example .env` e reinicie o Vite |
| Mapa com “API KEY REQUIRED” | Use toggle **OSM** ou configure `VITE_CARTO_API_KEY` |
| ONIM não responde | Configure provider + chave; veja console `[ONIM]` |
| `npm install` com conflito peer | Use `npm install --legacy-peer-deps` (há `.npmrc`) |
| Preview 404 em `/about.html` | Use prefixo `/toponimia_Ouro_Branco/` no `vite preview` |
| `ai:classify` falha no import | Rode `npm run ai:build` antes |
| Build falha em `html-proxy` / CSS | Não use `<style>` inline nos HTML de entry do Vite MPA — CSS via `src/styles/` |

## Funcionalidades

- Dicionário de ruas, mapa, estatísticas (+ PDF), admin  
- Portal educativo: quiz, associação, cruzadinha, ranking  
- Chatbot ONIM (React + LangChain)  
- PWA  

## Licença

MIT — ver `LICENSE`.
