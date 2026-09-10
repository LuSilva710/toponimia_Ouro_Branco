import { supabase } from '../../lib/supabase.js'
import { validateConfig, getProviderLabel } from '../../lib/ai-client.js'

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

export function bootOnimConfig() {
  try {
    validateConfig()
    onimLog('RESPOSTA', `Provider de IA ativo: ${getProviderLabel()}`)
  } catch (e) {
    console.warn('[ONIM] Aviso de configuração de IA:', e.message)
  }
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
      const bairrosList = bairros.map((b) => `<strong>${b}</strong>`).join(' ou ')
      return {
        pendingName: nomeFormatado,
        html: `Encontrei <strong>"${nomeFormatado}"</strong> em mais de um local: ${bairrosList}.<br>Sobre qual desses bairros você gostaria de conhecer a história?`,
      }
    }
  }
  return null
}

/** Consulta o agente LangChain (lazy import para não inflar o bundle inicial). */
export async function consultarAgente(pergunta, historico) {
  onimLog('INTENCAO', `Nova pergunta para o Agente: "${pergunta}"`)

  const [{ HumanMessage, AIMessage }, { executarAgenteONIM }] = await Promise.all([
    import('@langchain/core/messages'),
    import('./onim-chain.js'),
  ])

  const chatHistory = historico
    .map((m) => {
      if (m.role === 'user') return new HumanMessage(m.text)
      if (m.role === 'bot') return new AIMessage(m.text)
      return null
    })
    .filter(Boolean)

  try {
    const resposta = await executarAgenteONIM(pergunta, chatHistory)
    onimLog('RESPOSTA', 'Agente LangChain respondeu com sucesso.')
    return resposta
  } catch (err) {
    console.error('[ONIM] Erro no Agente LangChain:', err)
    const msg = String(err?.message ?? '')
    const nome = err?.name ?? ''
    const rateLimited =
      nome === 'RateLimitError' || msg.includes('429') || /rate limit/i.test(msg)
    if (rateLimited) {
      const retryMatch = msg.match(/try again in ([^.]+)/i)
      const tempoEspera = retryMatch ? retryMatch[1].trim() : 'alguns minutos'
      return (
        '<p>O serviço de IA (Groq) recusou a requisição por <strong>limite de uso</strong> ' +
        '(cotas diárias de tokens ou muitas chamadas seguidas).</p>' +
        `<p>Se a mensagem da API indicar tempo de espera, tente de novo em <strong>${tempoEspera}</strong>. ` +
        'No plano gratuito, o limite renova conforme a política da Groq; mais capacidade em ' +
        '<a href="https://console.groq.com/settings/billing" target="_blank" rel="noopener">console Groq → billing</a>.</p>'
      )
    }
    return 'Tive um problema ao processar sua pergunta com meu novo motor de inteligência. Tente novamente.'
  }
}

export async function enviarContribuicao(nomeRua, contribuicao) {
  const { error } = await supabase
    .from('contribuicoes_chatbot')
    .insert({ nome_rua: nomeRua, contribuicao })
  if (error) throw error
}
