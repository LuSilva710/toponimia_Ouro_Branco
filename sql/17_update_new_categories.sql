-- ============================================================
-- SCRIPT DE ATUALIZAÇÃO: CATEGORIAS ZOOTOPÔNIMOS E COROTOPÔNIMOS
-- ============================================================

-- 1. ATUALIZAÇÃO DE ZOOTOPÔNIMOS (BAIRRO SERRA)
UPDATE ruas 
SET categoria_toponimica = 'zootoponimo' 
WHERE bairro_id IN (SELECT id FROM bairros WHERE nome = 'Bairro Serra')
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

-- 2. ATUALIZAÇÃO DE COROTOPÔNIMOS (BAIRRO 1º DE MAIO)
UPDATE ruas 
SET categoria_toponimica = 'corotoponimo' 
WHERE bairro_id IN (SELECT id FROM bairros WHERE nome = 'Bairro 1º de Maio')
AND (
  nome_oficial ILIKE 'Avenida Conselheiro Lafaiete' OR
  nome_oficial ILIKE 'Avenida Ouro Preto' OR
  nome_oficial ILIKE 'Avenida Congonhas' OR
  nome_oficial ILIKE 'Rua Amarantina' OR
  nome_oficial ILIKE 'Rua Cachoeira do Campo' OR
  nome_oficial ILIKE 'Rua Caranaíba' OR
  nome_oficial ILIKE 'Rua Casa Grande' OR
  nome_oficial ILIKE 'Rua Catas Altas da Noruega' OR
  nome_oficial ILIKE 'Rua Cristais' OR
  nome_oficial ILIKE 'Rua Cristiano Otoni' OR
  nome_oficial ILIKE 'Rua Desterro de Entre Rios' OR
  nome_oficial ILIKE 'Rua Engenheiro Corrêa' OR
  nome_oficial ILIKE 'Rua Entre Rios de Minas' OR
  nome_oficial ILIKE 'Rua Itaverava' OR
  nome_oficial ILIKE 'Rua Jeceaba' OR
  nome_oficial ILIKE 'Rua Lamim' OR
  nome_oficial ILIKE 'Rua Miguel Burnier' OR
  nome_oficial ILIKE 'Rua Moeda' OR
  nome_oficial ILIKE 'Rua Piedade dos Gerais' OR
  nome_oficial ILIKE 'Rua Piranga' OR
  nome_oficial ILIKE 'Rua Queluzito' OR
  nome_oficial ILIKE 'Rua Rio Espera' OR
  nome_oficial ILIKE 'Rua Santana dos Montes' OR
  nome_oficial ILIKE 'Rua Santo Antônio do Leite' OR
  nome_oficial ILIKE 'Rua São Brás do Suaçuí' OR
  nome_oficial ILIKE 'Rua Senhora de Oliveira'
);

-- Nota: Execute este script no SQL Editor do seu projeto no Supabase.
