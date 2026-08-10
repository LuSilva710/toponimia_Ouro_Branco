# Padrao fixo do HTML de QA

Todo HTML visual de QA deve seguir esta estrutura, nesta ordem:

1. Hero executivo
- Nome da bateria.
- Data/hora.
- Ambiente testado.
- Usuario/perfil usado.
- Status final.
- Links para README, JSON tecnico e screenshots.

2. Cards de status
- Total de checks.
- Passaram.
- Falharam.
- Warnings.
- Screenshots.
- Quality score, quando existir.

3. Contexto da execucao
- Frontend.
- Backend/API.
- Navegador usado.
- Viewport.
- Credenciais/perfil, sem expor senha em texto aberto no HTML.
- Comando executado.

4. Matriz de checks
- ID do check.
- Nome.
- Status.
- Rota/tela.
- Resultado esperado resumido.
- Resultado obtido resumido.
- Evidencia associada.

5. Bugs detalhados para QA
- ID unico, por exemplo `QA-LOGIN-001`.
- Severidade: Critica, Alta, Media, Baixa.
- Status: Aberto, Em triagem, Bloqueado, Resolvido.
- Area/tela afetada.
- Perfil usado.
- Pre-condicoes.
- Massa de teste usada.
- Passos para reproduzir.
- Resultado esperado.
- Resultado obtido.
- Evidencia tecnica: rota, endpoint, status HTTP, console, screenshot e JSON.
- Impacto para a pessoa usuaria.
- Hipotese de causa provavel.
- Recomendacao tecnica.
- Regressao sugerida.

6. Eventos tecnicos
- Console errors.
- Requests failed.
- HTTP 4xx/5xx relevantes.
- Observacoes de ambiente.

7. Galeria de evidencias
- Cards com screenshots.
- Modal para ampliar dentro do proprio HTML.
- Nunca abrir PNG isolado como experiencia principal.

8. Arquivos tecnicos
- Links para JSONs.
- Links para logs.
- Links para relatorio tecnico do AI Engine, quando existir.

9. Proximas acoes
- Correcoes recomendadas.
- Bateria que deve ser reexecutada.
- Risco residual.

Regras visuais:
- HTML em portugues.
- Visual executivo consistente com `.cursor/qa-reports/2026-04-06-admin-adm1/html/relatorio-executivo-admin.html`.
- Sem usar a palavra "leigo".
- Usar "pessoa usuaria" quando precisar falar de quem usa o sistema.
- Modal obrigatorio para imagens.
- Erros devem ser agrupados como bugs rastreaveis, nao apenas lista crua de logs.
