import { createClient } from '@supabase/supabase-js'

/** Ignora strings vazias do build CI (Vite embute "" quando o secret não existe). */
function envValue(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const SUPABASE_URL = envValue(import.meta.env?.VITE_SUPABASE_URL)
  || envValue(typeof window !== 'undefined' ? window.__ENV?.SUPABASE_URL : '')

const SUPABASE_ANON_KEY = envValue(import.meta.env?.VITE_SUPABASE_ANON_KEY)
  || envValue(typeof window !== 'undefined' ? window.__ENV?.SUPABASE_ANON_KEY : '')

export const supabaseConfigError =
  !SUPABASE_URL || !SUPABASE_ANON_KEY
    ? 'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copie .env.example para .env e preencha as chaves do projeto no Supabase (Settings → API). Depois reinicie o npm run dev.'
    : null

function rejectedResult() {
  return Promise.resolve({ data: null, error: new Error(supabaseConfigError), count: null })
}

/** Query builder mínimo encadeável quando não há .env (evita tela branca). */
function createMissingConfigQuery() {
  const api = {}
  const chain = () => api
  ;[
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'is', 'in', 'contains', 'containedBy', 'rangeGt', 'rangeGte',
    'rangeLt', 'rangeLte', 'rangeAdjacent', 'overlaps', 'textSearch',
    'match', 'not', 'or', 'filter', 'order', 'limit', 'range',
    'abortSignal', 'single', 'maybeSingle', 'csv', 'geojson',
    'explain', 'rollback', 'returns',
  ].forEach((method) => {
    api[method] = chain
  })
  api.then = (onFulfilled, onRejected) => rejectedResult().then(onFulfilled, onRejected)
  api.catch = (onRejected) => rejectedResult().catch(onRejected)
  return api
}

/** Cliente real ou stub que falha de forma previsível. */
export const supabase = supabaseConfigError
  ? {
      from() {
        return createMissingConfigQuery()
      },
      rpc() {
        return rejectedResult()
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: () => rejectedResult(),
        signOut: () => Promise.resolve({ error: null }),
      },
    }
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

if (typeof window !== 'undefined' && !supabaseConfigError) {
  window.supabase = supabase
}
