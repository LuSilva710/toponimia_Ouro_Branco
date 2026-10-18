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
| IA / ONIM | Supabase Edge Function `onim-chat` → Gemini / OpenAI-compatível (Groq, OpenRouter…) |
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
| `SUPABASE_SERVICE_ROLE_KEY` | Não | Só scripts de embeddings (nunca no Vite) |
| `AI_PROVIDER` / `GEMINI_API_KEY` | Não | Scripts `ai-provider-kit` (Node) |

As chaves de IA do chatbot ONIM **não** são variáveis do Vite: ficam como secrets da Edge Function `onim-chat`. Ver [`supabase/functions/README.md`](supabase/functions/README.md).

> **Aviso de segurança:** qualquer `VITE_*` entra no bundle do browser (Pages). Nunca coloque chaves de LLM ou service role em `VITE_*`.

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
- `src/lib/` — cliente Supabase  
- `supabase/functions/onim-chat/` — agente ONIM (servidor)  

Aliases (`vite.config.js` / `jsconfig.json`): `@lib`, `@features`, `@components`, `@pages`, `@styles` **antes** de `@`.

Detalhes: `src/README.md`.

## Deploy (GitHub Pages)

Workflow: `.github/workflows/deploy.yml` (branch `main`).

Secrets/vars necessários no repositório:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- IA: **não** vai no GitHub — configure os secrets da Edge Function (`supabase secrets set`)
- Opcional mapa: `VITE_CARTO_API_KEY` (se não houver, o toggle OSM cobre)

## Troubleshooting

| Sintoma | Causa / ação |
|---------|----------------|
| Tela branca ou erro de dados na Home | Falta `.env` com Supabase — `cp .env.example .env` e reinicie o Vite |
| Mapa com “API KEY REQUIRED” | Use toggle **OSM** ou configure `VITE_CARTO_API_KEY` |
| ONIM não responde | Função `onim-chat` sem deploy ou sem secrets — veja `supabase functions logs onim-chat` e o console `[ONIM]` |
| `npm install` com conflito peer | Use `npm install --legacy-peer-deps` (há `.npmrc`) |
| Preview 404 em `/about.html` | Use prefixo `/toponimia_Ouro_Branco/` no `vite preview` |
| `ai:classify` falha no import | Rode `npm run ai:build` antes |
| Build falha em `html-proxy` / CSS | Não use `<style>` inline nos HTML de entry do Vite MPA — CSS via `src/styles/` |

## Funcionalidades

- Dicionário de ruas, mapa, estatísticas (+ PDF), admin  
- Portal educativo: quiz, associação, cruzadinha, ranking  
- Chatbot ONIM (React + Edge Function com tool calling)  
- PWA  

## Licença

MIT — ver `LICENSE`.
