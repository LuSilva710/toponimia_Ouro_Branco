-- ============================================
-- 07: Endurecimento de RLS da gamificação
-- Corrige 05_gamificacao.sql:
--   * pontuacoes aceitava qualquer valor (WITH CHECK (true))
--   * salas podia ser criada/alterada por qualquer usuário logado
-- ============================================

-- Helper de papel admin (SECURITY DEFINER evita recursão de RLS em perfis)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------- pontuacoes ----------
-- Limites = pontuação máxima possível em cada jogo:
--   quiz       10 perguntas × 100      (QuizPage.jsx)
--   associacao  8 pares     × 100      (AssociacaoPage.jsx)
--   cruzadinha  1000 − penalidades     (CruzadinhaPage.jsx)
-- NOT VALID: vale para novas linhas sem falhar em dados antigos.
ALTER TABLE pontuacoes
  ADD CONSTRAINT pontuacoes_jogo_obrigatorio CHECK (jogo IS NOT NULL) NOT VALID,
  ADD CONSTRAINT pontuacoes_pontos_faixa CHECK (
    pontos >= 0 AND pontos <= CASE jogo
      WHEN 'quiz'       THEN 1000
      WHEN 'associacao' THEN 800
      WHEN 'cruzadinha' THEN 1000
      ELSE 0
    END
  ) NOT VALID,
  ADD CONSTRAINT pontuacoes_nome_tamanho
    CHECK (char_length(btrim(jogador_nome)) BETWEEN 1 AND 40) NOT VALID,
  ADD CONSTRAINT pontuacoes_sala_tamanho
    CHECK (sala_id IS NULL OR char_length(sala_id) <= 40) NOT VALID;

-- Pontuação é imutável depois de gravada; só admin limpa o ranking
CREATE POLICY "Admins can delete scores"
  ON pontuacoes FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------- salas ----------
ALTER TABLE salas
  ADD COLUMN IF NOT EXISTS owner UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Authenticated can create rooms" ON salas;
DROP POLICY IF EXISTS "Authenticated can update own rooms" ON salas;

CREATE POLICY "Authenticated can create own rooms"
  ON salas FOR INSERT
  TO authenticated
  WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can update own rooms"
  ON salas FOR UPDATE
  TO authenticated
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

CREATE POLICY "Owners can delete own rooms"
  ON salas FOR DELETE
  TO authenticated
  USING (owner = auth.uid());

-- Salas antigas (owner NULL) ficam sob gestão do admin
CREATE POLICY "Admins can manage rooms"
  ON salas FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
