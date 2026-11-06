-- ============================================
-- 11: Bucket de imagens do painel admin (fotos de ruas, homenageados e bairros)
-- Leitura pública (as imagens aparecem no site); envio e alteração só para admin/editor.
-- Limites também valem no servidor: até 5 MB, somente PNG, JPEG e WebP (SVG ficaria sujeito a XSS).
-- Requer 09_rls_roles.sql (has_role). Pode ser rodada de novo sem erro.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('imagens', 'imagens', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read imagens" ON storage.objects;
DROP POLICY IF EXISTS "Staff upload imagens" ON storage.objects;
DROP POLICY IF EXISTS "Staff update imagens" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete imagens" ON storage.objects;

CREATE POLICY "Public read imagens"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'imagens');

CREATE POLICY "Staff upload imagens"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'imagens' AND public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Staff update imagens"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'imagens' AND public.has_role(ARRAY['admin', 'editor']))
  WITH CHECK (bucket_id = 'imagens' AND public.has_role(ARRAY['admin', 'editor']));

CREATE POLICY "Admin delete imagens"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'imagens' AND public.is_admin());
