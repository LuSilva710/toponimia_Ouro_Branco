# Roadmap

## Fase atual — Migração React multi-page
1. ~~About~~ → React
2. ~~Admin~~ → React
3. ~~Estatísticas~~ → React (+ loading/skeleton)
4. ~~Dicionário (Home)~~ → React (ONIM ainda via `features/onim` DOM)
5. ~~Mapa~~ → React
6. ~~Jogos / Portal~~ → React (hub, quiz, associação, ranking; cruzadinha legado)
7. **Cruzadinha** → React
8. **ONIM** → componente React
9. **SPA única** (React Router) — opcional após 7–8

## Em paralelo
- Contratos Supabase em `.cursor/contracts/`
- Smoke QA (ROVIS QA_ONLY) nas URLs locais
- Limpeza `deploy.yml` (remover branch morta `novo-branch` se ainda listada)
- Code-index ROVIS (`Build-RovisCodeIndex.ps1`)

## Depois
- PWA refinements / performance (chunk do Home+ONIM ainda grande)
- Embeddings / classificação IA (`ai-provider-kit`, scripts `ai:classify`)
