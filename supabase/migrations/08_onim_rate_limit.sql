-- ============================================
-- 08: Rate limit do chatbot ONIM (Edge Function onim-chat)
-- Contadores por cliente (hash do IP) em janelas de 1 minuto e 1 dia.
-- Só a service role (usada pela Edge Function) acessa.
-- ============================================

CREATE TABLE IF NOT EXISTS onim_rate_limit (
  bucket       TEXT        NOT NULL,
  janela       TEXT        NOT NULL CHECK (janela IN ('minuto', 'dia')),
  inicio       TIMESTAMPTZ NOT NULL,
  contador     INTEGER     NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, janela, inicio)
);

CREATE INDEX IF NOT EXISTS idx_onim_rate_limit_inicio ON onim_rate_limit(inicio);

-- RLS ligado sem políticas: anon/authenticated não leem nem escrevem
ALTER TABLE onim_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.onim_consume_quota(
  p_bucket       TEXT,
  p_limit_minute INTEGER,
  p_limit_day    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_minuto INTEGER;
  v_dia    INTEGER;
BEGIN
  INSERT INTO public.onim_rate_limit AS r (bucket, janela, inicio, contador)
  VALUES (p_bucket, 'minuto', date_trunc('minute', now()), 1)
  ON CONFLICT (bucket, janela, inicio) DO UPDATE SET contador = r.contador + 1
  RETURNING contador INTO v_minuto;

  INSERT INTO public.onim_rate_limit AS r (bucket, janela, inicio, contador)
  VALUES (p_bucket, 'dia', date_trunc('day', now()), 1)
  ON CONFLICT (bucket, janela, inicio) DO UPDATE SET contador = r.contador + 1
  RETURNING contador INTO v_dia;

  -- Limpeza oportunista de janelas antigas
  IF random() < 0.01 THEN
    DELETE FROM public.onim_rate_limit WHERE inicio < now() - interval '2 days';
  END IF;

  RETURN v_minuto <= p_limit_minute AND v_dia <= p_limit_day;
END;
$$;

REVOKE ALL ON FUNCTION public.onim_consume_quota(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onim_consume_quota(TEXT, INTEGER, INTEGER) TO service_role;
