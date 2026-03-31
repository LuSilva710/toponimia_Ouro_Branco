-- ============================================
-- 06: RLS Policies para tabelas existentes
-- ============================================

-- Habilitar RLS nas tabelas existentes
ALTER TABLE ruas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bairros ENABLE ROW LEVEL SECURITY;

-- BAIRROS: Todos podem ler, admin/editor podem escrever
CREATE POLICY "Public read bairros"
  ON bairros FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin/Editor write bairros"
  ON bairros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

CREATE POLICY "Admin/Editor update bairros"
  ON bairros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

CREATE POLICY "Admin delete bairros"
  ON bairros FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

-- RUAS: Todos podem ler, admin/editor podem escrever
CREATE POLICY "Public read ruas"
  ON ruas FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin/Editor write ruas"
  ON ruas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

CREATE POLICY "Admin/Editor update ruas"
  ON ruas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','editor'))
  );

CREATE POLICY "Admin delete ruas"
  ON ruas FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );
