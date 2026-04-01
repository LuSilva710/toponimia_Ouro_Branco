-- ============================================================
-- SCRIPT DE CORREÇÃO: COORDENADAS E BAIRRO (CENTRO)
-- ============================================================

-- 1. CORREÇÃO DA RUA SANTO ANTÔNIO
UPDATE ruas 
SET lat = -20.517300, lng = -43.700100 
WHERE nome_oficial = 'Santo Antônio' 
AND bairro_id = '9c8117d6-07b7-4439-b62b-989822abfb1e'; -- ID Bairro Centro

-- 2. CORREÇÃO DA RUA SAFIRA (Bairro Centro)
UPDATE ruas 
SET lat = -20.515100, lng = -43.689700, bairro_id = '9c8117d6-07b7-4439-b62b-989822abfb1e'
WHERE nome_oficial = 'Rua Safira';

-- 3. CORREÇÃO DA RUA ESMERALDA (Bairro Centro)
UPDATE ruas 
SET lat = -20.514400, lng = -43.690100, bairro_id = '9c8117d6-07b7-4439-b62b-989822abfb1e'
WHERE nome_oficial = 'Rua Esmeralda';

-- Nota: Execute este script no SQL Editor do seu projeto no Supabase.
