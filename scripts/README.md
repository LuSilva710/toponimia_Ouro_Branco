# Scripts de manutenção

Ferramentas **offline** (não fazem parte do site em produção).

```
scripts/
  ai/            Classificação por IA e embeddings
  geo/           Georreferenciamento (OSM / GeoJSON)
  maintenance/   Utilitários (listar modelos, ruas sem geometria)
```

## Uso comum

```bash
npm run ai:build
npm run ai:classify:dry
npm run ai:classify
```

Outputs gerados (JSON/SQL) ficam na pasta do script e **não** entram no Git.

Schema do banco: ver `supabase/migrations/`.
