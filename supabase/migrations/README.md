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

Updates one-shot de dados (classificação, coordenadas, significados) **não** ficam versionados aqui — use o painel admin ou scripts em `scripts/` quando necessário.
