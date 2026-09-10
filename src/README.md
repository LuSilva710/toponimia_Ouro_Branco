# Estrutura `src/` (React MPA)

```
src/
  *.jsx                  Entries por página (home, admin, mapa, jogos…)
  pages/                 Telas React
  components/            UI (Navbar, Footer, GameChrome)
  features/              Domínio (onim/, pdf/)
  lib/                   supabase.js, ai-client.js
  styles/                CSS por domínio
  App.jsx                DEPRECATED — shell SPA P2 (não usado no runtime MPA)
```

## Estado da migração

| Página | Status |
|--------|--------|
| Sobre, Admin, Estatísticas, Dicionário | React |
| Mapa | React (+ toggle OSM/CARTO) |
| Portal / Quiz / Associação / Ranking / Cruzadinha | React |
| ONIM | React (`OnimChatbot.jsx`) |

## Aliases Vite

`@lib`, `@features`, `@components`, `@pages`, `@styles` **antes** de `@`.

## Troubleshooting rápido

- Sem `VITE_SUPABASE_*` → mensagem na Home (não tela branca).
- Mapa CARTO sem chave → use OSM no toggle.
- ONIM sem IA → UI abre; respostas falham até configurar `.env`.
- Jogos gravam em `pontuacoes` (Supabase + RLS).

## ROVIS

Governança em `.cursor/`. No chat: `modo ROVIS` ou `modo ROVIS-FE`.
