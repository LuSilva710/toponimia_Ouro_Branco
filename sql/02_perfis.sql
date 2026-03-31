-- ============================================
-- 02: Tabela de perfis (roles) + trigger
-- ============================================

CREATE TABLE IF NOT EXISTS perfis (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role       TEXT DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para criar perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO perfis (id) VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger se existir e recriar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- RLS para perfis
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON perfis FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON perfis FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update profiles"
  ON perfis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );
