import { supabase } from '@lib/supabase.js'

/** Números do acervo e de partidas para o topo do portal. Falhas viram null (o card some). */
export async function fetchNumerosPortal() {
  const contar = async (tabela) => {
    const { count, error } = await supabase.from(tabela).select('id', { count: 'exact', head: true })
    return error ? null : count
  }
  const [ruas, bairros, partidas] = await Promise.all([contar('ruas'), contar('bairros'), contar('pontuacoes')])
  return { ruas, bairros, partidas }
}

/** Melhores pontuações de todos os jogos (as escalas vão até 800–1000 pontos em cada jogo). */
export async function fetchTopJogadores(limite = 5) {
  const { data, error } = await supabase
    .from('pontuacoes')
    .select('id, jogador_nome, jogo, pontos')
    .order('pontos', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data || []
}

/**
 * "Rua do dia": uma rua com história registrada, a mesma para todos durante o dia.
 * @returns {Promise<null | { nome, bairro, bairroSlug, categoria, trecho }>}
 */
export async function fetchRuaDoDia(data = new Date()) {
  const { data: ruas, error } = await supabase
    .from('ruas')
    .select('nome_oficial, significado, categoria_toponimica, bairros(nome, slug)')
    .not('significado', 'is', null)
    .order('nome_oficial', { ascending: true })
  if (error) throw error

  const comHistoria = (ruas || []).filter((r) => (r.significado || '').trim().length > 60)
  if (!comHistoria.length) return null

  const dia = Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / 86_400_000)
  const r = comHistoria[dia % comHistoria.length]
  return {
    nome: r.nome_oficial,
    bairro: r.bairros?.nome?.replace(/^Bairro\s+/i, '') || null,
    bairroSlug: r.bairros?.slug || null,
    categoria: r.categoria_toponimica,
    trecho: resumir(r.significado, 240),
  }
}

/** Corta no fim de uma palavra e acrescenta reticências. */
function resumir(texto, max) {
  const limpo = String(texto).replace(/\s+/g, ' ').trim()
  if (limpo.length <= max) return limpo
  const corte = limpo.slice(0, max)
  return `${corte.slice(0, corte.lastIndexOf(' '))}…`
}
