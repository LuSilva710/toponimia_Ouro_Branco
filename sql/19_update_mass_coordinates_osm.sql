-- SCRIPT DE ATUALIZAÇÃO MASSIVA VIA OSM
-- =======================================

-- 1. Limpeza preventiva de ruas fora de MG
UPDATE ruas SET lat = NULL, lng = NULL WHERE (lat > -20.4 OR lat < -20.6 OR lng > -43.6 OR lng < -43.8) AND lat IS NOT NULL;

UPDATE ruas SET lat = -20.5460123, lng = -43.6883083 WHERE id = 'b37724ef-6ad5-46c2-bfb2-65c11ab12716'; -- Rua Rui Barbosa
