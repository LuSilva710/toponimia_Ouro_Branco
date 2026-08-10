# QA — Relatorios para usuario final

Toda execucao do AI-TESTING gera, alem dos relatorios tecnicos, uma pasta consolidada para a pessoa usuaria.

---

## Estrutura obrigatoria

`.cursor/qa-reports/<YYYY-MM-DD>-<escopo>/`

```
README.md
screenshots/
json/
html/
plans/         (quando houver planejamento de bateria)
```

---

## Regras

- Copiar screenshots, evidencias e prints responsivos para `screenshots/`
- Copiar JSONs relevantes para `json/`
- Copiar HTMLs relevantes para `html/`
- `README.md` em linguagem simples, focado na pessoa usuaria
- `README.md` deve conter: ambiente testado, usuario usado, resumo, resultado geral, lista de erros, impacto pratico, onde ver evidencias, proxima acao
- HTML visual em portugues dentro de `html/` baseado no README, com cards, lista de erros, impacto, galeria com modal
- Padrao visual: `.cursor/qa-reports/2026-04-06-admin-adm1/html/relatorio-executivo-admin.html`
- Contrato detalhado: `.cursor/qa-reports/templates/qa-html-report-standard.md`
- Cada erro detalhado deve ter: ID, severidade, status, area, pre-condicoes, passos, esperado, obtido, sintoma, evidencia, impacto, hipotese, proxima acao
- Atualizar `.cursor/qa-reports/index.html` (cronologico, renderiza HTML selecionado)
- Planejamento de bateria: `<escopo>/plans/`
- Antes da bateria, ler `.cursor/qa-reports/config/environment.json` e confirmar URLs
- Apos gerar arquivos, abrir `index.html` (e o HTML especifico quando fizer sentido)
- Repeticao no mesmo escopo: atualizar mesma pasta ou criar `<escopo>-rerun-NN`
- Sempre mencionar a pasta no encerramento da resposta
