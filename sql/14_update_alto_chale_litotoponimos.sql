-- Atualiza todas as ruas do Bairro Alto Chalé para 'Litotopônimo'

UPDATE ruas
SET categoria_toponimica = 'Litotopônimo'
WHERE bairro_id = (
  SELECT id FROM bairros WHERE nome ILIKE '%Alto Chalé%' OR nome ILIKE '%Alto Chale%' LIMIT 1
);
