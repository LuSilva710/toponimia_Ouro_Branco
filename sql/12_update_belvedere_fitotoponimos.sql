-- Atualiza todas as ruas do Bairro Belvedere para 'Fitotopônimo'

UPDATE ruas
SET categoria_toponimica = 'Fitotopônimo'
WHERE bairro_id = (
  SELECT id FROM bairros WHERE nome ILIKE '%Belvedere%' LIMIT 1
);
