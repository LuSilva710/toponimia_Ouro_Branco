# Contexto do Projeto

## Produto
**Toponímia Urbana de Ouro Branco** — dicionário de nomes de ruas, mapa, estatísticas, portal educativo (jogos) e assistente ONIM (chatbot com LangChain).

## Stack
- **Frontend:** Vite 6 + React 19 (migração gradual multi-page HTML → React)
- **Backend/BaaS:** Supabase (Postgres, Auth, RLS, RPC `match_ruas`)
- **IA:** Gemini / OpenAI via `src/lib/ai-client.js` + LangChain (`src/features/onim/`)
- **Deploy:** GitHub Actions → GitHub Pages (`base`: `/toponimia_Ouro_Branco/`)
- **Branch default:** `main`

## Estrutura de código (`src/`)
```
src/
  pages/          # Telas React (Home, Admin, Estatisticas, About)
  components/     # UI compartilhada (Navbar, Footer)
  features/onim/  # Chatbot ONIM (ainda DOM imperativo)
  lib/            # supabase.js, ai-client.js
  styles/         # CSS por domínio
  legacy/         # Páginas/jogos ainda não migrados
  *.jsx           # Entries: home, admin, estatisticas, main (about)
```

## Aliases Vite
`@lib`, `@features`, `@components`, `@pages`, `@styles`, `@legacy` **antes** de `@` (senão `@pages` quebra).

## Env obrigatório
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ secrets Gemini/OpenAI para ONIM).  
CI: secrets no workflow `deploy.yml`.

## Schema (resumo)
Tabelas principais: `ruas`, `bairros`, `perfis`, `audit_log`, `contribuicoes_chatbot`, gamificação.  
Migrations: `supabase/migrations/` (01–06).

## ROVIS
Instalado em `.cursor/` (a partir de `ROVIS-Lite/`). Pacote Lite permanece como referência/master local; a memória operacional ativa é **esta** `.cursor/memory/`.
