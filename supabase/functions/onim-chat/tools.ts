// ONIM — ferramentas do agente (portadas de src/features/onim/onim-tools.js).
// Rodam no servidor com a chave anon: o RLS de leitura continua valendo.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

/** Mesmo modelo das ruas indexadas em scripts/ai/generate-embeddings.mjs (1536 dims) */
const GEMINI_EMBEDDING_MODEL = 'models/gemini-embedding-2'

const STOPWORDS = new Set(['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'rua', 'avenida', 'quem', 'foi'])

/** Formato OpenAI de tool calling (também aceito pelo endpoint OpenAI-compatible do Gemini). */
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'historical_search',
      description: 'Busca informações detalhadas sobre ruas, praças ou biografias de Ouro Branco.',
      parameters: {
        type: 'object',
        properties: { termo: { type: 'string', description: 'O nome da rua ou termo de busca (obrigatório)' } },
        required: ['termo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_statistics',
      description: 'Retorna o total de ruas, bairros e a distribuição por categoria.',
      parameters: {
        type: 'object',
        properties: { confirmar: { type: 'boolean', description: 'Confirmar execução (sempre true)' } },
        required: ['confirmar'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'neighborhood_info',
      description:
        'Busca a história, detalhes e estatísticas (como quantidade de ruas e divisão por gênero) de um bairro específico.',
      parameters: {
        type: 'object',
        properties: { bairro: { type: 'string', description: 'O nome do bairro (obrigatório)' } },
        required: ['bairro'],
      },
    },
  },
]

/** Remove caracteres com significado na sintaxe de filtro do PostgREST. */
function cleanTerm(value: string): string {
  return String(value ?? '').replace(/[,()%*\\."':]/g, '').trim().slice(0, 80)
}

async function embedQuery(termo: string, geminiKey: string | undefined): Promise<number[] | null> {
  if (!geminiKey || !termo.trim()) return null
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          model: GEMINI_EMBEDDING_MODEL,
          taskType: 'RETRIEVAL_QUERY',
          output_dimensionality: 1536,
          content: { parts: [{ text: termo.trim() }] },
        }),
      },
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.warn('[onim-chat] embedding falhou:', response.status, data?.error?.message ?? '')
      return null
    }
    const values = data?.embedding?.values
    return Array.isArray(values) ? values : null
  } catch (e) {
    console.warn('[onim-chat] sem embedding vetorial:', (e as Error)?.message ?? e)
    return null
  }
}

async function historicalSearch(db: SupabaseClient<any>, termo: string, geminiKey?: string): Promise<string> {
  const embedding = await embedQuery(termo, geminiKey)

  let vetoriais: any[] = []
  if (embedding) {
    const { data } = await db.rpc('match_ruas', {
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: 5,
    })
    vetoriais = data || []
  }

  const keywords = termo
    .toLowerCase()
    .split(/\s+/)
    .map(cleanTerm)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))

  let textuais: any[] = []
  if (keywords.length > 0) {
    const orFilter = keywords.map((k) => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%`).join(',')
    const { data } = await db
      .from('ruas')
      .select('id, nome_oficial, categoria_toponimica, significado, bairros(nome)')
      .or(orFilter)
      .limit(5)
    textuais = data || []
  }

  const mapa = new Map<string, any>()
  ;[...textuais, ...vetoriais].forEach((r) => {
    if (!mapa.has(r.nome_oficial)) mapa.set(r.nome_oficial, r)
  })

  const finais = Array.from(mapa.values())
  if (finais.length === 0) return 'Nenhum registro oficial encontrado.'

  return finais
    .map(
      (r) =>
        `--- LOGRADOURO ENCONTRADO ---\n` +
        `CONTEÚDO DO ACERVO OFICIAL: ${r.significado || 'Pesquisa em andamento.'}\n` +
        `Nome: ${r.nome_oficial}\n` +
        `Bairro: ${r.bairros?.nome || 'Desconhecido'}\n` +
        `Categoria: ${r.categoria_toponimica || 'Não classificada'}\n`,
    )
    .join('\n')
}

async function getStatistics(db: SupabaseClient<any>): Promise<string> {
  const [resRuas, resBairros, resTopCat] = await Promise.all([
    db.from('ruas').select('*', { count: 'exact', head: true }),
    db.from('bairros').select('*', { count: 'exact', head: true }),
    db.from('ruas').select('categoria_toponimica'),
  ])

  const totalRuas = resRuas.count || 0
  const totalBairros = resBairros.count || 0

  const contagem: Record<string, number> = {}
  resTopCat.data?.forEach((r: any) => {
    const cat = r.categoria_toponimica || 'Não classificada'
    contagem[cat] = (contagem[cat] || 0) + 1
  })

  const categorias = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, qtd]) => `- ${cat}: ${qtd} ruas (${totalRuas ? ((qtd / totalRuas) * 100).toFixed(1) : '0'}%)`)
    .join('\n')

  return `Estatísticas Reais do Acervo:\n- Total de ruas: ${totalRuas}\n- Total de bairros: ${totalBairros}\n- Distribuição por Categoria:\n${categorias}`
}

async function neighborhoodInfo(db: SupabaseClient<any>, bairro: string): Promise<string> {
  const termo = cleanTerm(bairro)
  if (!termo) return 'Bairro não encontrado.'

  const { data: bairros } = await db
    .from('bairros')
    .select('id, nome, titulo, descricao')
    .ilike('nome', `%${termo}%`)
    .limit(1)

  if (!bairros || bairros.length === 0) return 'Bairro não encontrado.'
  const b = bairros[0]

  const { data: ruas, count } = await db
    .from('ruas')
    .select('genero_homenageado', { count: 'exact' })
    .eq('bairro_id', b.id)

  let masc = 0
  let fem = 0
  let neutro = 0
  ruas?.forEach((r: any) => {
    const gen = (r.genero_homenageado || '').toLowerCase()
    if (gen === 'feminino') fem++
    else if (gen === 'masculino') masc++
    else neutro++
  })

  return `Bairro: ${b.nome}\nTítulo: ${b.titulo || 'N/A'}\nHistória: ${b.descricao || 'Sem descrição disponível.'}\nQuantidade de ruas registradas no acervo: ${count || 0}\nEstatísticas de gênero dos logradouros: ${fem} nomes femininos, ${masc} masculinos, ${neutro} neutros/outros.`
}

export async function runTool(
  name: string,
  rawArgs: string,
  db: SupabaseClient<any>,
  geminiKey?: string,
): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    return 'Argumentos inválidos para a ferramenta.'
  }

  try {
    switch (name) {
      case 'historical_search':
        return await historicalSearch(db, String(args.termo ?? ''), geminiKey)
      case 'get_statistics':
        return await getStatistics(db)
      case 'neighborhood_info':
        return await neighborhoodInfo(db, String(args.bairro ?? ''))
      default:
        return `Ferramenta desconhecida: ${name}`
    }
  } catch (e) {
    console.error(`[onim-chat] ferramenta ${name} falhou:`, e)
    return 'Erro ao consultar o acervo.'
  }
}
