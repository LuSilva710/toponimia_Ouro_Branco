# Migrations (schema)

Scripts de **estrutura** do banco Supabase já aplicados (ou a aplicar) no projeto.

| Arquivo | Conteúdo |
|---------|----------|
| `01_extend_ruas.sql` | Campos extras em `ruas` (lat/lng, categoria, gênero…) |
| `02_perfis.sql` | Perfis / roles de usuários |
| `03_audit_log.sql` | Log de auditoria do painel admin |
| `04_contribuicoes_chatbot.sql` | Contribuições do chatbot |
| `05_gamificacao.sql` | Tabelas de gamificação |
| `06_rls_policies.sql` | Políticas RLS |
| `07_harden_gamificacao.sql` | `is_admin()`, limites de pontuação e salas com dono |
| `08_onim_rate_limit.sql` | Rate limit da Edge Function `onim-chat` |
| `09_rls_roles.sql` | `has_role()`, RLS de perfis/auditoria/contribuições/ruas/bairros |
| `10_configuracao_ia.sql` | Chaves de IA editáveis no painel admin (aba Inteligência Artificial) |

Updates one-shot de dados (classificação, coordenadas, significados) **não** ficam versionados aqui — use o painel admin ou scripts em `scripts/` quando necessário.
