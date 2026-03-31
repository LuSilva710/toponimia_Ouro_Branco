-- Atualiza todas as ruas do Bairro das Flores para 'Fitotopônimo'

UPDATE ruas
SET categoria_toponimica = 'Fitotopônimo'
WHERE bairro_id = (
  SELECT id FROM bairros WHERE nome ILIKE '%Flores%' LIMIT 1
);
