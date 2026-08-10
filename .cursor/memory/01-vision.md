# Visão do Produto

## Objetivo
Preservar e divulgar a memória toponímica de Ouro Branco (MG): significados dos nomes de ruas, homenageados, localização e legislação — com acesso público, curadoria admin e apoio de IA (ONIM).

## Públicos
1. **Cidadão / estudante** — consultar dicionário, mapa, estatísticas, jogos educativos
2. **Pesquisador / equipe do projeto** — enriquecer dados e gerar análises
3. **Admin** — CRUD de bairros/ruas, aprovar contribuições, auditoria

## Princípios
- Conteúdo histórico como prioridade (não “dashboard genérico”)
- Acessibilidade (skip-link, ARIA, feedback de loading)
- Migração React incremental sem quebrar Pages
- Backend = Supabase (sem API .NET própria)

## Norte técnico (médio prazo)
1. Completar migração React (Mapa → Jogos → ONIM componente)
2. Unificar em SPA (React Router) quando multi-page estiver estável
3. Contratos leves de domínio (tabelas/RPC) em `.cursor/contracts/`
4. QA smoke nas páginas públicas (`localhost` / Pages)

## Fora de escopo (por agora)
- Recriar backend em Clean Architecture .NET (refs ROVIS `back-end/Ref_*` são genéricos — **não** aplicar à risca)
- Trocar Supabase por outro BaaS
