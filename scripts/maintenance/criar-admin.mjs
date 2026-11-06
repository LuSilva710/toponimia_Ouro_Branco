/**
 * criar-admin.mjs — cadastra (por convite) e promove um e-mail a admin do painel.
 *
 * Uso:
 *   npm run admin:criar -- toponimiaob@gmail.com
 *
 * O que faz:
 *   1. Se o e-mail ainda não tem conta, envia um CONVITE do Supabase: a pessoa recebe
 *      um e-mail e cria a própria senha (nenhuma senha passa por este script).
 *   2. Grava role = 'admin' em public.perfis (cria o perfil se não existir).
 *   Rodar de novo é seguro: conta existente só é promovida.
 *
 * Requer no .env da raiz (NÃO commitar, NÃO usar VITE_):
 *   VITE_SUPABASE_URL=...            (já existe)
 *   SUPABASE_SERVICE_ROLE_KEY=...    Dashboard → Project Settings → API Keys → service_role / secret
 * Apague a SUPABASE_SERVICE_ROLE_KEY do .env depois de usar.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const email = String(process.argv[2] || '').trim().toLowerCase()
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Informe o e-mail: npm run admin:criar -- pessoa@exemplo.com')
  process.exit(1)
}
if (!url || !serviceKey) {
  console.error('Faltam VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env da raiz.')
  console.error('A service role fica em: Supabase → Project Settings → API Keys.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

/** Procura o usuário pelo e-mail (a API lista em páginas). */
async function buscarUsuario(alvo) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const achado = data.users.find((u) => (u.email || '').toLowerCase() === alvo)
    if (achado) return achado
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  let usuario = await buscarUsuario(email)

  if (usuario) {
    console.log(`• Conta já existe (${usuario.id}).`)
  } else {
    const siteUrl = 'https://lusilva710.github.io/toponimia_Ouro_Branco/admin.html'
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: siteUrl })
    if (error) throw error
    usuario = data.user
    console.log(`• Convite enviado para ${email}. A pessoa deve abrir o e-mail e criar a senha.`)
  }

  const { error: perfilErro } = await admin
    .from('perfis')
    .upsert({ id: usuario.id, role: 'admin' }, { onConflict: 'id' })
  if (perfilErro) throw perfilErro

  const { data: perfil, error: leituraErro } = await admin.from('perfis').select('role').eq('id', usuario.id).single()
  if (leituraErro) throw leituraErro
  console.log(`• Papel atual de ${email}: ${perfil.role}`)
  console.log('Pronto. Lembre-se de apagar a SUPABASE_SERVICE_ROLE_KEY do .env.')
}

main().catch((err) => {
  console.error('Erro:', err.message || err)
  process.exit(1)
})
