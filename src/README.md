# Estrutura `src/` (migração React)

```
src/
  main.jsx / App.jsx     Entry React (páginas migradas)
  components/            UI reutilizável
  pages/                 Telas React
  features/              Domínio (ex.: ONIM)
  lib/                   Infra (Supabase, AI client)
  hooks/                 Hooks React (futuro)
  styles/                CSS global / por domínio
  legacy/                JS das páginas ainda em HTML multi-page
    pages/
    games/
    services/
```

## Estado da migração

| Página | Status |
|--------|--------|
| Sobre (`about.html`) | React |
| Admin (`admin.html`) | React |
| Estatísticas (`estatisticas.html`) | React |
| Dicionário (`index.html`) | React (ONIM ainda via `features/onim`) |
| Mapa (`mapa.html`) | React |
| Portal / Jogos hub (`portaleducativo.html`) | React |
| Quiz, Associação, Ranking | React |
| Cruzadinha | Legacy (`src/legacy/games/cruzadinha.js`) |

## Aliases Vite

- `@` → `src/`
- `@lib`, `@features`, `@components`, `@pages`, `@styles`, `@legacy`

## ROVIS

Governança do Cursor em `.cursor/` (memória operacional em `.cursor/memory/`).  
O pacote `ROVIS-Lite/` é a cópia master local; o runtime ativo é a `.cursor/` da raiz.  
Ativar no chat: `modo ROVIS` ou `modo ROVIS-FE`.
