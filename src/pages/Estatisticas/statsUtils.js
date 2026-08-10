// ============================================
// CHART COLORS
// ============================================
export const CORES = {
  antropotoponimo: '#ED4A7B', // Magenta Vibrante
  fitotoponimo: '#109655',    // Verde Limpo
  axiotoponimo: '#6B4B9A',    // Roxo App
  hagiotoponimo: '#29B6F6',   // Azul Celeste Suave (Agradável)
  corotoponimo: '#FF7043',    // Laranja Coral (Agradável)
  zootoponimo: '#26A69A',     // Verde-água Menta (Agradável)
  litotoponimo: '#607D8B',    // Azul Rochoso/Metálico (Agradável e semântico para litos=pedra)
  sociotoponimo: '#C5CB81',   // Verde musgo rgb(197, 203, 129)
  outro: '#DFDFDF',           // Cinza claro maciço
}

/** Rótulos acentuados para gráfico e legendas */
export const ROTULO_CATEGORIA = {
  antropotoponimo: 'Antropotopônimo',
  fitotoponimo: 'Fitotopônimo',
  axiotoponimo: 'Axiotopônimo',
  hagiotoponimo: 'Hagiotopônimo',
  corotoponimo: 'Corotopônimo',
  zootoponimo: 'Zootopônimo',
  litotoponimo: 'Litotopônimo',
  sociotoponimo: 'Sociotopônimo',
  outro: 'Outro / sem classificação',
}

export function rotuloCategoriaToponimica(chaveNormalizada) {
  return ROTULO_CATEGORIA[chaveNormalizada] || (chaveNormalizada.charAt(0).toUpperCase() + chaveNormalizada.slice(1))
}

/** Ordem fixa na legenda (todas as categorias aparecem, mesmo com contagem 0). */
export const ORDEM_CATEGORIAS = [
  'antropotoponimo', 'fitotoponimo', 'axiotoponimo', 'hagiotoponimo',
  'corotoponimo', 'zootoponimo', 'litotoponimo', 'sociotoponimo', 'outro',
]

export function contarPorCategoria(ruas) {
  const contagem = {}
  Object.keys(CORES).forEach((k) => {
    contagem[k] = 0
  })
  ruas.forEach((r) => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (contagem[cat] !== undefined) contagem[cat]++
    else contagem.outro++
  })
  return contagem
}

export function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  // Minúsculas, sem acento (ô = o), sem espaços/hífens internos — alinha com chaves em CORES
  let n = String(cat)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  n = n.replace(/[-_\s\u00a0]+/g, '')
  while (n.endsWith('toponimos')) n = n.slice(0, -1)
  if (CORES[n] !== undefined) return n
  return 'outro'
}

export const CORES_GENERO = {
  masculino: '#3b82f6',
  feminino: '#ec4899',
  neutro: '#8b5cf6',
}

export const STOPWORDS = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'na', 'no', 'ao', 'das', 'dos', 'foi', 'ser', 'seu', 'sua', 'ele', 'ela', 'são', 'era', 'isso', 'esse', 'essa', 'este', 'esta', 'muito', 'tem', 'entre', 'já', 'também', 'após', 'até', 'onde', 'quando', 'qual', 'quais', 'sobre', 'grande', 'cidade', 'ouro', 'branco', 'rua', 'nome', 'homenagem', 'filho', 'filha', 'nasceu', 'faleceu', 'ano', 'anos', 'dia', 'mês', 'idade', 'recebeu', 'homenageado', 'homenageada', 'local', 'histórico', 'história', 'pessoa', 'vida', 'suas', 'seus', 'pela', 'pelo', 'aos', 'teve', 'sendo', 'quem', 'foi', 'está']

/**
 * Resumo dos cards e alerta de cobertura.
 * @param {Array} ruas
 * @param {Array} [_bairros] reservado (total usa bairros com pelo menos uma rua)
 */
export function computeSummary(ruas, _bairros) {
  const idsBairrosComRua = new Set(ruas.filter((r) => r.bairro_id).map((r) => r.bairro_id))
  const totalBairros = idsBairrosComRua.size
  const totalRuas = ruas.length

  const comCategoria = ruas.filter((r) => r.categoria_toponimica)
  const homenageados = ruas.filter((r) => r.significado && r.significado.length > 10)
  const incompletas = ruas.filter((r) => !r.categoria_toponimica || !r.genero_homenageado)

  const coberturaBaixa = comCategoria.length < ruas.length * 0.5
  const textoCobertura = `Dados ainda sendo preenchidos pelo admin. ${comCategoria.length} de ${ruas.length} ruas classificadas.`

  return {
    totalRuas,
    totalBairros,
    homenageados: homenageados.length,
    incompletas: incompletas.length,
    comCategoria: comCategoria.length,
    coberturaBaixa,
    textoCobertura,
  }
}

/**
 * Itens da nuvem de palavras (sem DOM / Chart.js).
 * @returns {Array<{ word: string, count: number, size: number, color: string, opacity: number }>}
 */
export function buildWordCloudItems(ruas) {
  const freq = {}

  ruas.forEach((r) => {
    if (!r.significado) return
    const words = r.significado
      .toLowerCase()
      .replace(/[^\w\sáàâãéèêíïóôõúüç]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.includes(w))

    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1 })
  })

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 65)
  if (sorted.length === 0) return []

  const maxFreq = sorted[0][1]
  const paletaToponimia = Object.values(CORES).filter((c) => c !== CORES.outro)

  // Misturar aleatoriamente para que as palavras grandes não fiquem apenas no começo
  const scrambled = [...sorted].sort(() => Math.random() - 0.5)

  return scrambled.map(([word, count], idx) => {
    const size = 0.9 + ((count / maxFreq) * 2.6)
    const color = paletaToponimia[idx % paletaToponimia.length]
    const opacity = 0.6 + ((count / maxFreq) * 0.4)
    return { word, count, size, color, opacity }
  })
}

/**
 * Dados do panorama waffle (sem DOM).
 * @returns {{ ruasOrdenadas: Array, contagemCat: Object, legend: Array }}
 */
export function buildWaffleData(ruas) {
  const contagemCat = contarPorCategoria(ruas)

  const ruasOrdenadas = [...ruas]
    .sort((a, b) => {
      const catA = normalizarCategoria(a.categoria_toponimica)
      const catB = normalizarCategoria(b.categoria_toponimica)

      if (contagemCat[catB] !== contagemCat[catA]) {
        return contagemCat[catB] - contagemCat[catA]
      }

      if (catA !== catB) {
        return catA.localeCompare(catB)
      }

      return (a.nome_oficial || '').localeCompare(b.nome_oficial || '')
    })
    .map((r) => {
      const cat = normalizarCategoria(r.categoria_toponimica)
      const color = CORES[cat] || CORES.outro
      const label = r.categoria_toponimica
        ? rotuloCategoriaToponimica(cat)
        : 'Sem Categoria de Origem'
      return { ...r, cat, color, label }
    })

  const legend = ORDEM_CATEGORIAS.map((cat) => ({
    cat,
    count: contagemCat[cat],
    color: CORES[cat] || CORES.outro,
    label: rotuloCategoriaToponimica(cat),
  }))

  return { ruasOrdenadas, contagemCat, legend }
}

export function resolverDecada(rua) {
  const raw = rua.decada_nomeacao
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (!Number.isNaN(n)) {
      // Limitar a data para evitar erros de digitação (ex: 2050) e respeitar o limite de 2020
      if (n > 2020) return null
      if (n >= 1800) return Math.floor(n / 10) * 10
      return n
    }
  }
  if (rua.legislacao) {
    const match = String(rua.legislacao).match(/\b(19|20)\d{2}\b/)
    if (match) {
      const ano = parseInt(match[0], 10)
      if (ano > 2020) return null
      return Math.floor(ano / 10) * 10
    }
  }
  return null
}

/**
 * Dados da timeline por década × categoria (sem Chart.js).
 * @returns {null | { decadas, catsVisiveis, porDecadaCat, totaisPorDecada, dadosAcumulados, insight }}
 */
export function buildTimelineData(ruas) {
  const porDecadaCat = {}

  ruas.forEach((r) => {
    const decada = resolverDecada(r)
    if (decada == null) return
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (!porDecadaCat[decada]) porDecadaCat[decada] = {}
    porDecadaCat[decada][cat] = (porDecadaCat[decada][cat] || 0) + 1
  })

  const decadas = Object.keys(porDecadaCat)
    .map(Number)
    .sort((a, b) => a - b)

  if (decadas.length === 0) return null

  const catsVisiveis = ORDEM_CATEGORIAS.filter((k) =>
    decadas.some((d) => (porDecadaCat[d][k] || 0) > 0),
  )

  const totaisPorDecada = decadas.map((d) =>
    catsVisiveis.reduce((s, k) => s + (porDecadaCat[d][k] || 0), 0),
  )

  let acumulado = 0
  const dadosAcumulados = totaisPorDecada.map((v) => {
    acumulado += v
    return acumulado
  })

  const totalComDecada = acumulado

  let idxPico = 0
  totaisPorDecada.forEach((n, i) => {
    if (n > totaisPorDecada[idxPico]) idxPico = i
  })
  const decPico = decadas[idxPico]
  const nPico = totaisPorDecada[idxPico]
  const pctPico = totalComDecada ? ((nPico / totalComDecada) * 100).toFixed(0) : '0'

  let catDominantePico = catsVisiveis[0]
  let maxCat = 0
  catsVisiveis.forEach((k) => {
    const v = porDecadaCat[decPico][k] || 0
    if (v > maxCat) {
      maxCat = v
      catDominantePico = k
    }
  })

  return {
    decadas,
    catsVisiveis,
    porDecadaCat,
    totaisPorDecada,
    dadosAcumulados,
    insight: {
      decPico,
      nPico,
      pctPico,
      catDominantePico,
    },
  }
}
