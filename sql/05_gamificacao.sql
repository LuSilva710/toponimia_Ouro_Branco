-- ============================================
-- 05: Tabelas de gamificação
-- ============================================

-- Pontuações dos jogos
CREATE TABLE IF NOT EXISTS pontuacoes (
  id           BIGSERIAL PRIMARY KEY,
  jogador_nome TEXT NOT NULL,
  jogo         TEXT CHECK (jogo IN ('quiz','associacao','cruzadinha')),
  pontos       INTEGER NOT NULL,
  sala_id      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Salas de aula (modo turma)
CREATE TABLE IF NOT EXISTS salas (
  id         TEXT PRIMARY KEY,
  professor  TEXT NOT NULL,
  jogo       TEXT NOT NULL,
  ativa      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Palavras cruzadas (migrar dados hardcoded)
CREATE TABLE IF NOT EXISTS palavras_cruzadas (
  id        SERIAL PRIMARY KEY,
  word      TEXT NOT NULL,
  clue      TEXT NOT NULL,
  start_row INTEGER,
  start_col INTEGER,
  direction TEXT CHECK (direction IN ('horizontal','vertical')),
  tema      TEXT DEFAULT 'escolas'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pontuacoes_jogo ON pontuacoes(jogo);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_pontos ON pontuacoes(pontos DESC);
CREATE INDEX IF NOT EXISTS idx_pontuacoes_sala ON pontuacoes(sala_id);

-- RLS para pontuações
ALTER TABLE pontuacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert scores"
  ON pontuacoes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Auth can insert scores"
  ON pontuacoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view scores"
  ON pontuacoes FOR SELECT
  TO anon, authenticated
  USING (true);

-- RLS para salas
ALTER TABLE salas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active rooms"
  ON salas FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated can create rooms"
  ON salas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update own rooms"
  ON salas FOR UPDATE
  TO authenticated
  USING (true);

-- RLS para palavras cruzadas
ALTER TABLE palavras_cruzadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read crossword"
  ON palavras_cruzadas FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage crossword"
  ON palavras_cruzadas FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM perfis WHERE id = auth.uid() AND role = 'admin')
  );

-- Habilitar Realtime para pontuacoes (ranking ao vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE pontuacoes;
