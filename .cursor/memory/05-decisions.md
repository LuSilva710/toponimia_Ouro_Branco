# Decisões

## D-001 — Multi-page Vite + React incremental
**Decisão:** Cada HTML tem seu entry (`home.jsx`, `admin.jsx`, `estatisticas.jsx`, `main.jsx` para About).  
**Por quê:** Deploy Pages já é multi-page; migração sem big-bang.  
**Status:** Ativo.

## D-002 — Ordem dos aliases Vite
**Decisão:** Registrar `@lib`, `@pages`, etc. **antes** de `@`.  
**Por quê:** Alias `@` “comia” `@pages` e quebrava imports. Entries críticos usam path relativo como rede de segurança.  
**Status:** Ativo.

## D-003 — Backend = Supabase only
**Decisão:** Sem API .NET; domínio em Postgres + client JS. Refs ROVIS `agents/back-end/Ref_*` **não** são o padrão deste repo.  
**Por quê:** Stack atual e escopo de TCC/pesquisa.  
**Status:** Ativo.

## D-004 — Chart.js / Leaflet / jsPDF via CDN nas páginas
**Decisão:** Estatísticas e Home carregam libs pelo HTML (global `Chart`, `L`, jspdf).  
**Por quê:** Compatibilidade com legado; mini-mapa e PDF já dependiam disso.  
**Status:** Ativo (revisável na SPA).

## D-005 — PDF sob demanda na Estatísticas
**Decisão:** `PdfGeneratorService` via `import()` dinâmico.  
**Por quê:** Reduzir custo inicial da página e separar loading de dados.  
**Status:** Ativo.

## D-006 — Loading explícito em Estatísticas
**Decisão:** Banner + skeleton nos cards/gráficos; query `ruas.select('*')`; `finally` sempre encerra loading.  
**Por quê:** Fetch ~2s com 500+ ruas; `--` sem feedback parecia erro.  
**Status:** Ativo.

## D-007 — ONIM ainda imperativo
**Decisão:** Home React chama `initChatbot()`; chatbot continua em `features/onim/chatbot.js` (DOM). Guard contra double-init.  
**Por quê:** Desacoplar migração da página da reescrita do agente.  
**Status:** Temporário (backlog P1).

## D-009 — Filtros do mapa: vazio = zero resultados
**Decisão:** Em cada dimensão (bairro/categoria/gênero), lista vazia exclui todas as ruas. Botões **Todos** / **Nenhum** (não toggle ambíguo). Hook `useMapFilters` + painéis separados.  
**Por quê:** “Desmarcar todos” antes era tratado como “sem restrição” (= mostrar tudo).  
**Status:** Ativo.

