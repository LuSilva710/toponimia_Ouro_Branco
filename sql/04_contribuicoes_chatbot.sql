-- ============================================
-- 04: Tabela de contribuições do chatbot
-- ============================================

CREATE TABLE IF NOT EXISTS contribuicoes_chatbot (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_rua     TEXT NOT NULL,
  contribuicao TEXT NOT NULL,
  autor_nome   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  status       TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado'))
);

-- RLS
ALTER TABLE contribuicoes_chatbot ENABLE ROW LEVEL SECURITY;

-- Anônimos podem inserir contribuições
CREATE POLICY "anon_insert"
  ON contribuicoes_chatbot FOR INSERT
  TO anon
  WITH CHECK (true);

-- Autenticados podem inserir também
CREATE POLICY "auth_insert"
  ON contribuicoes_chatbot FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins/editors podem ver e gerenciar tudo
CREATE POLICY "admin_select"
  ON contribuicoes_chatbot FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_update"
  ON contribuicoes_chatbot FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role IN ('admin','editor'))
  );
