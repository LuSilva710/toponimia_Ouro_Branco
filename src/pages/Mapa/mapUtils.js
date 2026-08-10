export const OURO_BRANCO_CENTER = [-20.5185, -43.692]
export const DEFAULT_ZOOM = 15

export const CORES_CATEGORIA = {
  antropotoponimo: '#2563eb',
  fitotoponimo: '#16a34a',
  axiotoponimo: '#9333ea',
  hagiotoponimo: '#ca8a04',
  litotoponimo: '#94530d',
  zootoponimo: '#facc15',
  corotoponimo: '#fb7185',
  sociotoponimo: '#C5CB81',
  outro: '#6b7280',
}

export const ROTULO_CATEGORIA = {
  antropotoponimo: 'Antropotopônimo',
  fitotoponimo: 'Fitotopônimo',
  axiotoponimo: 'Axiotopônimo',
  hagiotoponimo: 'Hagiotopônimo',
  corotoponimo: 'Corotopônimo',
  zootoponimo: 'Zootopônimo',
  litotoponimo: 'Litotopônimo',
  sociotoponimo: 'Sociotopônimo',
  outro: 'Outro',
}

export const CATEGORIAS = Object.keys(CORES_CATEGORIA)

export const CORES_GENERO = {
  masculino: '#06b6d4',
  feminino: '#a855f7',
  neutro: '#94a3b8',
}

export const GENEROS = ['masculino', 'feminino', 'neutro']

export function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  let n = String(cat)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  n = n.replace(/[-_\s\u00a0]+/g, '')
  while (n.endsWith('toponimos')) n = n.slice(0, -1)
  const chaves = CATEGORIAS.filter((k) => k !== 'outro')
  return chaves.includes(n) ? n : 'outro'
}

export function normalizarNomeRua(nome) {
  if (!nome) return ''
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(rua|avenida|travessa|alameda|pca|praca|r\.|av\.)\b/gi, '')
    .trim()
}

export function removerAcentos(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Busca local por nome / significado / localização (máx. `limit` resultados). */
export function buscarRuasPorQuery(ruas, query, limit = 8) {
  const q = removerAcentos(query.trim().toLowerCase())
  if (!q || q.length < 2) return []

  const scored = []
  for (const rua of ruas) {
    const nome = removerAcentos((rua.nome_oficial || '').toLowerCase())
    const nomeCurto = normalizarNomeRua(rua.nome_oficial)
    const sig = removerAcentos((rua.significado || '').toLowerCase())
    const loc = removerAcentos((rua.localizacao || '').toLowerCase())

    let score = 0
    if (nome.startsWith(q) || nomeCurto.startsWith(q)) score = 3
    else if (nome.includes(q) || nomeCurto.includes(q)) score = 2
    else if (sig.includes(q) || loc.includes(q)) score = 1
    if (score > 0) scored.push({ rua, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || (a.rua.nome_oficial || '').localeCompare(b.rua.nome_oficial || '', 'pt'))
    .slice(0, limit)
    .map((s) => s.rua)
}

/** Garante que categoria/gênero/bairro da rua estejam nos filtros ativos. */
export function filtrosComRuaVisivel(filtros, rua) {
  const cat = normalizarCategoria(rua.categoria_toponimica)
  const gen = rua.genero_homenageado || 'neutro'
  const bId = rua.bairro_id != null ? String(rua.bairro_id) : null

  return {
    categorias: filtros.categorias.includes(cat) ? filtros.categorias : [...filtros.categorias, cat],
    generos: filtros.generos.includes(gen) ? filtros.generos : [...filtros.generos, gen],
    bairros:
      !bId || filtros.bairros.includes(bId) ? filtros.bairros : [...filtros.bairros, bId],
  }
}

export function filtrarRuas(todasRuas, { categorias, generos, bairros }) {
  // Lista vazia em qualquer dimensão = nenhum resultado (AND entre dimensões).
  if (!categorias.length || !generos.length || !bairros.length) return []

  return todasRuas.filter((rua) => {
    const categ = normalizarCategoria(rua.categoria_toponimica)
    const genero = rua.genero_homenageado || 'neutro'
    return (
      categorias.includes(categ) &&
      generos.includes(genero) &&
      bairros.includes(String(rua.bairro_id))
    )
  })
}

/** Texto de feedback quando há dimensão sem seleção. */
export function mensagemFiltrosVazios(emptyDimensions) {
  if (!emptyDimensions?.length) return ''
  if (emptyDimensions.length === 1) {
    return `Nenhum ${emptyDimensions[0]} selecionado — 0 ruas no mapa.`
  }
  return `Filtros vazios (${emptyDimensions.join(', ')}) — 0 ruas no mapa.`
}

export function contarPorCategoria(ruas) {
  const contagem = {}
  CATEGORIAS.forEach((c) => {
    contagem[c] = 0
  })
  ruas.forEach((r) => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (contagem[cat] !== undefined) contagem[cat]++
    else contagem.outro++
  })
  return contagem
}

export function contarPorGenero(ruas) {
  const contagem = { masculino: 0, feminino: 0, neutro: 0 }
  ruas.forEach((r) => {
    const gen = r.genero_homenageado || 'neutro'
    if (contagem[gen] !== undefined) contagem[gen]++
    else contagem.neutro++
  })
  return contagem
}

export function popupHtml(rua, bairroNome, visualMode) {
  const categoria = normalizarCategoria(rua.categoria_toponimica)
  const genero = rua.genero_homenageado || 'neutro'
  const corCat = CORES_CATEGORIA[categoria] || CORES_CATEGORIA.outro
  const corGen = CORES_GENERO[genero] || CORES_GENERO.neutro
  const significado = rua.significado || ''
  const sigPreview = significado.length > 150 ? `${significado.substring(0, 150)}...` : significado
  const badge =
    visualMode === 'genero'
      ? genero.charAt(0).toUpperCase() + genero.slice(1)
      : ROTULO_CATEGORIA[categoria]
  const badgeBg = visualMode === 'genero' ? corGen : corCat

  return `
    <div class="mapa-popup">
      <div class="popup-header" style="border-left: 4px solid ${corGen}">
        <h4>${rua.nome_oficial || ''}</h4>
        <span class="badge" style="background: ${badgeBg}">${badge}</span>
      </div>
      <div class="popup-body">
        ${bairroNome ? `<p class="popup-bairro"><i class="bi bi-geo-alt"></i> ${bairroNome}</p>` : ''}
        ${sigPreview ? `<p class="popup-sig">${sigPreview}</p>` : ''}
        <div class="popup-meta">
          <span class="genero-tag ${genero}"><i class="bi bi-person"></i> ${genero}</span>
        </div>
        <a href="./index.html" class="popup-link">Ver detalhes →</a>
      </div>
    </div>
  `
}
