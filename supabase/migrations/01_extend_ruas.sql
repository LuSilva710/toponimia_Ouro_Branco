-- ============================================
-- 01: Extender tabela ruas com novos campos
-- ============================================

ALTER TABLE ruas
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS categoria_toponimica TEXT,
  ADD COLUMN IF NOT EXISTS genero_homenageado TEXT,
  ADD COLUMN IF NOT EXISTS tipo_homenageado TEXT,
  ADD COLUMN IF NOT EXISTS decada_nomeacao INTEGER;

-- Comentários para documentação
COMMENT ON COLUMN ruas.lat IS 'Latitude do ponto central da rua';
COMMENT ON COLUMN ruas.lng IS 'Longitude do ponto central da rua';
COMMENT ON COLUMN ruas.categoria_toponimica IS 'Categoria toponímica: antropotoponimo, fitotoponimo, ergotoponimo, axiotoponimo, hagiotoponimo, outro';
COMMENT ON COLUMN ruas.genero_homenageado IS 'Gênero do homenageado: masculino, feminino, neutro';
COMMENT ON COLUMN ruas.tipo_homenageado IS 'Tipo do homenageado: politico, religioso, militar, educador, etc.';
COMMENT ON COLUMN ruas.decada_nomeacao IS 'Década de nomeação da rua (ex: 1980)';
