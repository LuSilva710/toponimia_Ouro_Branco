import { supabase } from '@lib/supabase.js'

/**
 * Grava a pontuação no ranking. Limites espelham o RLS de 07_harden_gamificacao.sql.
 * O insert do Supabase não lança exceção: o erro vem em { error }, então é verificado aqui.
 * @returns {Promise<boolean>} true se gravou
 */
export async function salvarPontuacao({ jogo, nome, pontos, salaId = null }) {
  const { error } = await supabase.from('pontuacoes').insert({
    jogador_nome: String(nome ?? '').trim().slice(0, 40) || 'Anônimo',
    jogo,
    pontos: Math.max(0, Math.round(pontos)),
    sala_id: String(salaId ?? '').trim().slice(0, 40) || null,
  })
  if (error) {
    console.warn(`[ranking] pontuação de ${jogo} não gravada:`, error.message)
    return false
  }
  return true
}
