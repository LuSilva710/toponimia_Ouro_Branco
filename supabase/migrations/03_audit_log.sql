-- ============================================
-- 03: Tabela de log de auditoria
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  user_id      UUID REFERENCES auth.users(id),
  user_email   TEXT,
  acao         TEXT NOT NULL,
  tabela       TEXT NOT NULL,
  registro_id  UUID,
  dados_antes  JSONB,
  dados_depois JSONB
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela ON audit_log(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_log_acao ON audit_log(acao);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Authenticated users can insert audit log"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
