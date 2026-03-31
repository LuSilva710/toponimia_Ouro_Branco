-- Script para corrigir a categoria das ruas que são Hagiotopônimos (Santos/Santas)
-- Aplica-se às 3 ocorrências identificadas que são homenagens diretas.

UPDATE ruas 
SET categoria_toponimica = 'hagiotoponimo'
WHERE nome_oficial IN ('São José', 'Santo Antônio', 'Rua Santa Olímpia');

-- Verificação opcional:
-- SELECT nome_oficial, categoria_toponimica FROM ruas WHERE categoria_toponimica = 'hagiotoponimo';
