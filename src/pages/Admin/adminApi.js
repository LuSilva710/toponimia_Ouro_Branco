import { supabase } from '@lib/supabase.js'

export function gerarSlug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function normalizarNomeRua(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function encontrarRuaPorNome(ruas, nomeRua) {
  const alvo = normalizarNomeRua(nomeRua)
  if (!alvo) return null
  const exact = ruas.find((r) => normalizarNomeRua(r.nome_oficial) === alvo)
  if (exact) return exact
  return (
    ruas.find((r) => {
      const n = normalizarNomeRua(r.nome_oficial)
      return n.includes(alvo) || alvo.includes(n)
    }) || null
  )
}

export async function uploadImage(file, folder) {
  const fileName = `${folder}/${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage
    .from('imagens')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('imagens').getPublicUrl(data.path)
  return urlData.publicUrl
}

export async function registrarAuditoria(user, acao, tabela, registroId, dadosAntes, dadosDepois) {
  try {
    await supabase.from('audit_log').insert({
      user_id: user?.id,
      user_email: user?.email,
      acao,
      tabela,
      registro_id: registroId,
      dados_antes: dadosAntes || null,
      dados_depois: dadosDepois || null,
    })
  } catch (err) {
    console.warn('Auditoria não registrada:', err)
  }
}

export async function fetchDashboardStats() {
  const [ruasRes, bairrosRes] = await Promise.all([
    supabase.from('ruas').select('id', { count: 'exact', head: true }),
    supabase.from('bairros').select('id', { count: 'exact', head: true }),
  ])

  let contribuicoes = 0
  let usuarios = 0
  try {
    const contribRes = await supabase
      .from('contribuicoes_chatbot')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
    contribuicoes = contribRes.count ?? 0
  } catch { /* tabela pode não existir */ }

  try {
    const usersRes = await supabase.from('perfis').select('id', { count: 'exact', head: true })
    usuarios = usersRes.count ?? 0
  } catch { /* tabela pode não existir */ }

  return {
    ruas: ruasRes.count ?? 0,
    bairros: bairrosRes.count ?? 0,
    contribuicoes,
    usuarios,
  }
}

export const CATEGORIAS = [
  { value: 'antropotoponimo', label: 'Antropotopônimo' },
  { value: 'fitotoponimo', label: 'Fitotopônimo' },
  { value: 'axiotoponimo', label: 'Axiotopônimo' },
  { value: 'hagiotoponimo', label: 'Hagiotopônimo' },
  { value: 'corotoponimo', label: 'Corotopônimo' },
  { value: 'litotoponimo', label: 'Litotopônimo' },
  { value: 'zootoponimo', label: 'Zootopônimo' },
  { value: 'sociotoponimo', label: 'Sociotopônimo' },
  { value: 'outro', label: 'Outro' },
]

export const SIDEBAR_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
  { id: 'bairros', label: 'Bairros', icon: 'bi-geo-alt' },
  { id: 'ruas', label: 'Ruas', icon: 'bi-signpost-2' },
  { id: 'contribuicoes', label: 'Contribuições', icon: 'bi-chat-square-text' },
  { id: 'auditoria', label: 'Auditoria', icon: 'bi-journal-text' },
  { id: 'usuarios', label: 'Usuários', icon: 'bi-people' },
]
