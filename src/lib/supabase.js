import { createClient } from '@supabase/supabase-js'

/** Ignora strings vazias do build CI (Vite embute "" quando o secret não existe). */
function envValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const SUPABASE_URL = envValue(import.meta.env?.VITE_SUPABASE_URL)
  || envValue(window.__ENV?.SUPABASE_URL)

const SUPABASE_ANON_KEY = envValue(import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || envValue(window.__ENV?.SUPABASE_ANON_KEY)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[supabase-client] VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios.\n' +
    'Configure no .env local ou nos Secrets do GitHub Actions (deploy).'
  )
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.supabase = supabase
