import { supabase } from '../../lib/supabase.js'

export const SUGESTOES = [
  { text: 'Quem foi Amaro Lanari?', icon: 'bi-person-badge' },
  { text: 'História do Centro', icon: 'bi-bank' },
  {
    text: 'O que é toponímia?',
    icon: 'bi-info-circle',
    response:
      '<strong>Toponímia</strong> é o estudo dos nomes próprios de lugares (nomes geográficos) e suas origens. No nosso dicionário, focamos nos nomes das ruas de Ouro Branco para preservar a história local.',
  },
  {
    text: 'Quantas ruas tem?',
    icon: 'bi-hash',
    response:
      'Atualmente, o nosso sistema conta com mais de <strong>1.500 ruas</strong> registradas em diversos bairros de Ouro Branco!',
  },
]

const STOPWORDS = new Set([
  'de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma',
  'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre',
  'rua', 'ruas', 'avenida', 'bairro', 'quem', 'foi', 'nome', 'historia', 'história',
])

export function onimLog(etapa, detalhe) {
  const estilos = {
    INTENCAO: 'color:#4ade80; font-weight:bold',
    FERRAMENTA: 'color:#60a5fa; font-weight:bold',
    CONTEXTO: 'color:#facc15; font-weight:bold',
    DECISAO: 'color:#f472b6; font-weight:bold',
    RESPOSTA: 'color:#a78bfa; font-weight:bold',
    AVISO: 'color:#fb923c; font-weight:bold',
  }
  console.log(`%c[ONIM · ${etapa}] ${detalhe}`, estilos[etapa] || 'color:#e2e8f0')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function horaAtual() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function loadHistorico() {
  try {
    return JSON.parse(sessionStorage.getItem('chatbot_historico') || '[]')
  } catch {
    return []
  }
}

export function saveHistorico(historico) {
  sessionStorage.setItem('chatbot_historico', JSON.stringify(historico))
}

/**
 * Se o mesmo nome de rua existir em >1 bairro, devolve HTML de esclarecimento
 * e o nomeFormatado para pendingQuery.
 */
export async function detectarAmbiguidade(pergunta) {
  onimLog('FERRAMENTA', '[BUSCA SEMÂNTICA] Verificando ambiguidade de logradouro...')

  const keywords = pergunta
    .toLowerCase()
    .split(/\s+/)
    // Remove caracteres com significado na sintaxe de filtro do PostgREST (.or())
    .map((w) => w.replace(/[,()%*\\."':]/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))

  if (!keywords.length) return null

  const orFilter = keywords.map((k) => `nome_oficial.ilike.%${k}%`).join(',')
  const { data: resultados, error } = await supabase
    .from('ruas')
    .select('nome_oficial, bairros(nome)')
    .or(orFilter)
    .limit(10)

  if (error || !resultados?.length) return null

  const grupos = {}
  for (const r of resultados) {
    const nomePadrao = r.nome_oficial?.toLowerCase() || ''
    if (!grupos[nomePadrao]) grupos[nomePadrao] = []
    const bairro = r.bairros?.nome || 'Bairro desconhecido'
    if (!grupos[nomePadrao].includes(bairro)) grupos[nomePadrao].push(bairro)
  }

  for (const [nome, bairros] of Object.entries(grupos)) {
    if (bairros.length > 1) {
      const nomeFormatado =
        resultados.find((r) => r.nome_oficial?.toLowerCase() === nome)?.nome_oficial || nome
      onimLog('DECISAO', `Ambiguidade detectada: "${nomeFormatado}"`)
      const bairrosList = bairros.map((b) => `<strong>${escapeHtml(b)}</strong>`).join(' ou ')
      return {
        pendingName: nomeFormatado,
        html: `Encontrei <strong>"${escapeHtml(nomeFormatado)}"</strong> em mais de um local: ${bairrosList}.<br>Sobre qual desses bairros você gostaria de conhecer a história?`,
      }
    }
  }
  return null
}

/** Lê o corpo JSON de erro devolvido pela Edge Function (FunctionsHttpError.context é a Response). */
async function lerErroFuncao(error) {
  try {
    return (await error?.context?.json?.()) ?? {}
  } catch {
    return {}
  }
}

/**
 * Consulta o agente ONIM na Edge Function `onim-chat` (supabase/functions/onim-chat).
 * As chaves de LLM ficam no servidor; o navegador só envia a pergunta e o histórico curto.
 */
export async function consultarAgente(pergunta, historico) {
  onimLog('INTENCAO', `Nova pergunta para o Agente: "${pergunta}"`)

  const historicoCurto = historico
    .filter((m) => m.role === 'user' || m.role === 'bot')
    .slice(-4)
    .map((m) => ({ role: m.role, text: String(m.text ?? '').slice(0, 1500) }))

  const { data, error } = await supabase.functions.invoke('onim-chat', {
    body: { pergunta: pergunta.slice(0, 500), historico: historicoCurto },
  })

  if (!error && data?.html) {
    onimLog('RESPOSTA', `Agente respondeu (${data.provider ?? 'servidor'}).`)
    return data.html
  }

  const detalhe = error ? await lerErroFuncao(error) : {}
  console.error('[ONIM] Erro na Edge Function onim-chat:', error ?? data, detalhe)

  if (detalhe.code === 'rate_limited' || detalhe.code === 'provider_rate_limited') {
    return (
      '<p>Recebi muitas perguntas em pouco tempo e atingi o <strong>limite de uso</strong>.</p>' +
      '<p>Aguarde alguns minutos e tente novamente.</p>'
    )
  }
  if (detalhe.code === 'too_long') {
    return 'Sua pergunta ficou muito longa. Tente resumi-la em poucas frases.'
  }
  return 'Tive um problema ao processar sua pergunta. Tente novamente em instantes.'
}

export async function enviarContribuicao(nomeRua, contribuicao) {
  const { error } = await supabase
    .from('contribuicoes_chatbot')
    // Limites espelham o RLS de 09_rls_roles.sql
    .insert({ nome_rua: String(nomeRua).trim().slice(0, 200), contribuicao: String(contribuicao).trim().slice(0, 2000) })
  if (error) throw error
}
