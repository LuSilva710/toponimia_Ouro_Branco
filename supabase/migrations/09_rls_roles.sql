-- ============================================
-- 09: Consolidação de RLS por papel
--   * Políticas que consultavam perfis dentro de perfis (recursão) → has_role()/is_admin()
--   * handle_new_user (SECURITY DEFINER) com search_path fixo
--   * contribuicoes_chatbot: leitura só admin/editor; insert com limites
--   * audit_log: insert só em nome do próprio usuário (admin/editor)
--   * UPDATE com WITH CHECK em todas as tabelas de escrita
-- Requer 07_harden_gamificacao.sql (is_admin).
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfis WHERE id = auth.uid() AND role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(TEXT[]) TO anon, authenticated;

-- ---------- trigger de novo usuário ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.perfis (id) VALUES (new.id);
  RETURN new;
END;
$$;

-- ---------- perfis ----------
DROP POLICY IF EXISTS "Admins can view all profiles" ON perfis;
DROP POLICY IF EXISTS "Admins can update profiles" ON perfis;

CREATE POLICY "Admins can view all profiles"
  ON perfis FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin não altera o próprio papel (evita ficar sem nenhum admin por engano)
CREATE POLICY "Admins can update profiles"
  ON perfis FOR UPDATE
  TO authenticated
  USING (public.is_admin() AND id <> auth.uid())
  WITH CHECK (public.is_admin() AND id <> auth.uid());

-- ---------- audit_log ----------
DROP POLICY IF EXISTS "Admins can read audit log" ON audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON audit_log;

CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Staff insert own audit entries"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (user_email IS NULL OR user_email = auth.jwt() ->> 'email')
    AND public.has_role(ARRAY['admin', 'editor'])
  );

-- ---------- contribuicoes_chatbot ----------
DROP POLICY IF EXISTS "anon_insert" ON contribuicoes_chatbot;
DROP POLICY IF EXISTS "auth_insert" ON contribuicoes_chatbot;
DROP POLICY IF EXISTS "admin_select" ON contribuicoes_chatbot;
DROP POLICY IF EXISTS "admin_update" ON contribuicoes_chatbot;

CREATE POLICY "Public insert pending contributions"
  ON contribuicoes_chatbot FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'
    AND char_length(btrim(nome_rua)) BETWEEN 1 AND 200
    AND char_length(btrim(contribuicao)) BETWEEN 1 AND 2000
    AND (autor_nome IS NULL OR char_length(autor_nome) <= 100)
  );

CREATE POLICY "Staff read contributions"
  ON contribuicoes_chatbot FOR SELECT
  TO authenticated
  USING (public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Staff update contributions"
  ON contribuicoes_chatbot FOR UPDATE
  TO authenticated
  USING (public.has_role(ARRAY['admin', 'editor']))
  WITH CHECK (public.has_role(ARRAY['admin', 'editor']));

-- ---------- bairros ----------
DROP POLICY IF EXISTS "Admin/Editor write bairros" ON bairros;
DROP POLICY IF EXISTS "Admin/Editor update bairros" ON bairros;
DROP POLICY IF EXISTS "Admin delete bairros" ON bairros;

CREATE POLICY "Admin/Editor write bairros"
  ON bairros FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Admin/Editor update bairros"
  ON bairros FOR UPDATE
  TO authenticated
  USING (public.has_role(ARRAY['admin', 'editor']))
  WITH CHECK (public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Admin delete bairros"
  ON bairros FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------- ruas ----------
DROP POLICY IF EXISTS "Admin/Editor write ruas" ON ruas;
DROP POLICY IF EXISTS "Admin/Editor update ruas" ON ruas;
DROP POLICY IF EXISTS "Admin delete ruas" ON ruas;

CREATE POLICY "Admin/Editor write ruas"
  ON ruas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Admin/Editor update ruas"
  ON ruas FOR UPDATE
  TO authenticated
  USING (public.has_role(ARRAY['admin', 'editor']))
  WITH CHECK (public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Admin delete ruas"
  ON ruas FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------- palavras_cruzadas ----------
DROP POLICY IF EXISTS "Admins can manage crossword" ON palavras_cruzadas;

CREATE POLICY "Admins can manage crossword"
  ON palavras_cruzadas FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
