import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL
  ?? window.__ENV?.SUPABASE_URL
  ?? 'https://vtsuctcmycaiooeubjnk.supabase.co'

const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY
  ?? window.__ENV?.SUPABASE_ANON_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0c3VjdGNteWNhaW9vZXViam5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxMTI5MjYsImV4cCI6MjA3MjY4ODkyNn0.YvkjnpNLF-BZALghTD3fTJ7bQbzqc1_ZNlLCb0rUq3Y'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
window.supabase = supabase
