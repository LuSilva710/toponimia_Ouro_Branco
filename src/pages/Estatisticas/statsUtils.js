import { IDS_TAXES, OUTRO, corTaxe, normalizarTaxe, rotuloTaxe } from '@lib/taxonomiaDick.js'

// ============================================
// CATEGORIAS (taxonomia de Dick em src/lib/taxonomiaDick.js)
// ============================================

/** Cor de cada taxe nesta página (as 8 originais vêm da própria taxonomia). */
export const CORES = Object.fromEntries(IDS_TAXES.map((id) => [id, corTaxe(id)]))

export function rotuloCategoriaToponimica(chaveNormalizada) {
  return rotuloTaxe(chaveNormalizada)
}

/** Ordem da taxonomia (física, depois antropocultural), com "outro" no fim. */
export const ORDEM_CATEGORIAS = IDS_TAXES

/** Paleta da nuvem de palavras: as cores originais da página, independentes da taxonomia. */
const PALETA_NUVEM = ['#ED4A7B', '#109655', '#6B4B9A', '#29B6F6', '#FF7043', '#26A69A', '#607D8B', '#C5CB81']

export function contarPorCategoria(ruas) {
  const contagem = Object.fromEntries(IDS_TAXES.map((k) => [k, 0]))
  ruas.forEach((r) => {
    contagem[normalizarCategoria(r.categoria_toponimica)]++
  })
  return contagem
}

/** Categorias com pelo menos uma rua, na ordem da taxonomia ("outro" só se houver). */
export function categoriasPresentes(contagem) {
  return ORDEM_CATEGORIAS.filter((k) => contagem[k] > 0)
}

export function normalizarCategoria(cat) {
  return normalizarTaxe(cat)
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
  const paletaToponimia = PALETA_NUVEM

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

  const legend = categoriasPresentes(contagemCat).map((cat) => ({
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

// ============================================
// GÊNERO, BAIRROS E PROGRESSO DA PESQUISA
// ============================================

/**
 * Normaliza o gênero gravado no banco ("Feminina", "feminin", "MASCULINO"…).
 * @returns {'masculino' | 'feminino' | 'neutro' | null} null = ainda não classificado
 */
export function normalizarGenero(valor) {
  const g = String(valor ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!g) return null
  if (g.startsWith('fem')) return 'feminino'
  if (g.startsWith('masc')) return 'masculino'
  return 'neutro'
}

const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0)
const temTexto = (v, min = 1) => typeof v === 'string' && v.trim().length >= min

/** Nome do bairro sem o prefixo "Bairro " (economiza espaço em tabelas e eixos). */
export function nomeCurtoBairro(rua) {
  return (rua.bairros?.nome || 'Sem bairro').replace(/^Bairro\s+/i, '')
}

/**
 * Contagem geral e por período (ano da lei de denominação) das ruas que homenageiam pessoas.
 * Só entram ruas com gênero masculino/feminino; "neutro" (não homenageia pessoa) e não classificadas ficam à parte.
 */
export function buildGeneroData(ruas) {
  const contagem = { masculino: 0, feminino: 0, neutro: 0, naoClassificado: 0 }
  const porDecada = {}

  ruas.forEach((r) => {
    const g = normalizarGenero(r.genero_homenageado)
    if (!g) {
      contagem.naoClassificado++
      return
    }
    contagem[g]++
    if (g === 'neutro') return
    const decada = resolverDecada(r)
    if (decada == null) return
    if (!porDecada[decada]) porDecada[decada] = { masculino: 0, feminino: 0 }
    porDecada[decada][g]++
  })

  const pessoas = contagem.masculino + contagem.feminino
  const decadas = Object.keys(porDecada).map(Number).sort((a, b) => a - b)

  return {
    contagem,
    pessoas,
    pctFeminino: pct(contagem.feminino, pessoas),
    /** Em cada 10 pessoas homenageadas, quantas são mulheres (arredondado). */
    mulheresEm10: pessoas ? Math.round((contagem.feminino / pessoas) * 10) : 0,
    decadas,
    porDecada,
    pessoasComAno: decadas.reduce((s, d) => s + porDecada[d].masculino + porDecada[d].feminino, 0),
  }
}

/** Uma linha por bairro: tamanho, perfil toponímico, gênero e o quanto já foi pesquisado. */
export function buildBairroStats(ruas) {
  const grupos = {}
  ruas.forEach((r) => {
    const nome = nomeCurtoBairro(r)
    if (!grupos[nome]) grupos[nome] = []
    grupos[nome].push(r)
  })

  return Object.entries(grupos).map(([nome, lista]) => {
    const total = lista.length
    const cats = contarPorCategoria(lista)
    const classificadas = lista.filter((r) => r.categoria_toponimica)
    const catDominante = classificadas.length
      ? ORDEM_CATEGORIAS.filter((k) => k !== OUTRO.id).reduce((a, b) => (cats[b] > cats[a] ? b : a))
      : null

    const generos = lista.map((r) => normalizarGenero(r.genero_homenageado))
    const feminino = generos.filter((g) => g === 'feminino').length
    const masculino = generos.filter((g) => g === 'masculino').length
    const comSignificado = lista.filter((r) => temTexto(r.significado, 11)).length

    return {
      nome,
      total,
      catDominante: catDominante && cats[catDominante] > 0 ? catDominante : null,
      pctCatDominante: catDominante ? pct(cats[catDominante], total) : 0,
      feminino,
      pessoas: feminino + masculino,
      /** null quando o bairro ainda não tem nenhuma pessoa homenageada classificada */
      pctFeminino: feminino + masculino ? pct(feminino, feminino + masculino) : null,
      comSignificado,
      pctSignificado: pct(comSignificado, total),
    }
  })
}

/** Campos acompanhados no painel de progresso (rótulo, teste de preenchimento, dica para quem continuar). */
export const CAMPOS_PESQUISA = [
  { key: 'categoria', label: 'Categoria toponímica', ok: (r) => temTexto(r.categoria_toponimica) },
  { key: 'local', label: 'Localização no mapa', ok: (r) => r.lat != null && r.lng != null },
  { key: 'genero', label: 'Gênero do homenageado', ok: (r) => normalizarGenero(r.genero_homenageado) != null },
  { key: 'lei', label: 'Lei de denominação', ok: (r) => temTexto(r.legislacao) },
  { key: 'significado', label: 'História / significado', ok: (r) => temTexto(r.significado, 11) },
  { key: 'imagem', label: 'Imagem', ok: (r) => temTexto(r.imagem) || temTexto(r.imagemhomenageado) },
]

/**
 * Preenchimento de cada campo no acervo todo e por bairro (para a lista de pendências).
 * @returns {{ geral: Array<{key,label,feitas,total,pct}>, porBairro: Array<{nome,total,pendentes:Object}>, completas: number }}
 */
export function buildProgressoPesquisa(ruas) {
  const total = ruas.length
  const geral = CAMPOS_PESQUISA.map((c) => {
    const feitas = ruas.filter(c.ok).length
    return { key: c.key, label: c.label, feitas, total, pct: pct(feitas, total) }
  })

  const grupos = {}
  ruas.forEach((r) => {
    const nome = nomeCurtoBairro(r)
    if (!grupos[nome]) grupos[nome] = []
    grupos[nome].push(r)
  })
  const porBairro = Object.entries(grupos).map(([nome, lista]) => {
    const pendentes = {}
    CAMPOS_PESQUISA.forEach((c) => {
      pendentes[c.key] = lista.filter((r) => !c.ok(r)).length
    })
    return { nome, total: lista.length, pendentes }
  })

  const completas = ruas.filter((r) => CAMPOS_PESQUISA.every((c) => c.ok(r))).length
  return { geral, porBairro, completas }
}
