-- Atualiza a categoria toponímica para 'zootoponimo' nas ruas do bairro Serra com nomes de animais
UPDATE ruas 
SET categoria_toponimica = 'zootoponimo' 
WHERE bairro_id IN (SELECT id FROM bairros WHERE nome = 'Serra')
AND (
  nome_oficial ILIKE 'Rua Beija-Flor' OR
  nome_oficial ILIKE 'Rua Bem-Te-Vi' OR
  nome_oficial ILIKE 'Rua Cardeal' OR
  nome_oficial ILIKE 'Rua Faisão' OR
  nome_oficial ILIKE 'Rua Gaivota' OR
  nome_oficial ILIKE 'Rua Sabiá' OR
  nome_oficial ILIKE 'Rua Rouxinol' OR
  nome_oficial ILIKE 'Rua Tucano'
);

-- Nota: Certifique-se de executar este script no editor SQL do Supabase.
