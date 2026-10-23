-- ============================================
-- 10: Configuração de IA editável pelo painel admin
-- As chaves de LLM ficam numa tabela sem acesso para anon/authenticated:
--   * só a Edge Function onim-chat (service role) lê as chaves;
--   * admins gravam via admin_set_config_ia() e leem só metadados mascarados.
-- Assim o projeto não depende de quem fez o deploy (secrets da função viram fallback).
-- Requer 07 (is_admin) e 03 (audit_log).
-- ============================================

CREATE TABLE IF NOT EXISTS configuracao_ia (
  id                 SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider           TEXT        NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini', 'openai')),
  gemini_api_key     TEXT,
  gemini_model       TEXT,
  openai_api_key     TEXT,
  openai_base_url    TEXT,
  openai_model       TEXT,
  origens_permitidas TEXT,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO configuracao_ia (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS ligado e sem políticas: nenhum acesso pela API pública
ALTER TABLE configuracao_ia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON configuracao_ia FROM anon, authenticated;

-- ---------- leitura mascarada (admin) ----------
CREATE OR REPLACE FUNCTION public.admin_get_config_ia()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.configuracao_ia;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem ver a configuração de IA' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO c FROM public.configuracao_ia WHERE id = 1;

  RETURN json_build_object(
    'provider',           c.provider,
    'gemini_model',       c.gemini_model,
    'gemini_key_final',   CASE WHEN c.gemini_api_key IS NULL THEN NULL ELSE right(c.gemini_api_key, 4) END,
    'openai_base_url',    c.openai_base_url,
    'openai_model',       c.openai_model,
    'openai_key_final',   CASE WHEN c.openai_api_key IS NULL THEN NULL ELSE right(c.openai_api_key, 4) END,
    'origens_permitidas', c.origens_permitidas,
    'updated_at',         c.updated_at
  );
END;
$$;

-- ---------- gravação (admin) ----------
-- Chaves: NULL = manter a atual, '' = remover. Demais campos: '' = voltar ao padrão.
CREATE OR REPLACE FUNCTION public.admin_set_config_ia(
  p_provider           TEXT,
  p_gemini_api_key     TEXT,
  p_gemini_model       TEXT,
  p_openai_api_key     TEXT,
  p_openai_base_url    TEXT,
  p_openai_model       TEXT,
  p_origens_permitidas TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a configuração de IA' USING ERRCODE = '42501';
  END IF;

  IF p_provider NOT IN ('gemini', 'openai') THEN
    RAISE EXCEPTION 'Provedor inválido: %', p_provider;
  END IF;
  IF char_length(coalesce(p_gemini_api_key, '')) > 300
     OR char_length(coalesce(p_openai_api_key, '')) > 300
     OR char_length(coalesce(p_openai_base_url, '')) > 300
     OR char_length(coalesce(p_gemini_model, '')) > 100
     OR char_length(coalesce(p_openai_model, '')) > 100
     OR char_length(coalesce(p_origens_permitidas, '')) > 1000 THEN
    RAISE EXCEPTION 'Valor muito longo';
  END IF;
  IF nullif(btrim(p_openai_base_url), '') IS NOT NULL AND p_openai_base_url !~ '^https?://' THEN
    RAISE EXCEPTION 'A URL base deve começar com http:// ou https://';
  END IF;

  UPDATE public.configuracao_ia SET
    provider           = p_provider,
    gemini_api_key     = CASE WHEN p_gemini_api_key IS NULL THEN gemini_api_key
                              ELSE nullif(btrim(p_gemini_api_key), '') END,
    gemini_model       = nullif(btrim(p_gemini_model), ''),
    openai_api_key     = CASE WHEN p_openai_api_key IS NULL THEN openai_api_key
                              ELSE nullif(btrim(p_openai_api_key), '') END,
    openai_base_url    = nullif(btrim(p_openai_base_url), ''),
    openai_model       = nullif(btrim(p_openai_model), ''),
    origens_permitidas = nullif(btrim(p_origens_permitidas), ''),
    updated_at         = NOW(),
    updated_by         = auth.uid()
  WHERE id = 1;

  -- Auditoria sem expor as chaves
  INSERT INTO public.audit_log (user_id, user_email, acao, tabela, dados_depois)
  VALUES (
    auth.uid(),
    auth.jwt() ->> 'email',
    'UPDATE',
    'configuracao_ia',
    json_build_object(
      'provider', p_provider,
      'gemini_model', p_gemini_model,
      'gemini_key', CASE WHEN p_gemini_api_key IS NULL THEN 'mantida'
                         WHEN btrim(p_gemini_api_key) = '' THEN 'removida' ELSE 'alterada' END,
      'openai_base_url', p_openai_base_url,
      'openai_model', p_openai_model,
      'openai_key', CASE WHEN p_openai_api_key IS NULL THEN 'mantida'
                         WHEN btrim(p_openai_api_key) = '' THEN 'removida' ELSE 'alterada' END,
      'origens_permitidas', p_origens_permitidas
    )::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_config_ia() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_config_ia(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_config_ia() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_config_ia(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
