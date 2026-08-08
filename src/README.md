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
| Dicionário, Mapa, Estatísticas, Admin, Jogos | Legacy (HTML + `src/legacy`) |

## Aliases Vite

- `@` → `src/`
- `@lib`, `@features`, `@components`, `@pages`, `@styles`, `@legacy`
