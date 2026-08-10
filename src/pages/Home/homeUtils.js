export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export function normalizePath(path) {
  if (!path) return ''
  let p = path.trim()
  p = p.replace(/^\.\//, '')
  p = p.replace(/^\//, '')
  p = p.replace(/^assets\//, '')
  return p
}

export function assetUrl(path) {
  const p = normalizePath(path)
  if (!p) return ''
  if (/^https?:\/\//i.test(p)) return p
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${p}`
}

export function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function idDetalhesRua(nome) {
  return 'detalhes-' + String(nome).replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase()
}

/** Agrupa mapa nome→detalhes por letra (após remover prefixos comuns). */
export function agruparRuasPorLetra(ruasMap) {
  const ruasPorLetra = {}
  for (const nomeRua of Object.keys(ruasMap)) {
    const nomeSemPrefixo = nomeRua.replace(/^(Rua|Antônio|Ana)\s+/i, '').trim()
    const primeiraLetra = nomeSemPrefixo.charAt(0).toUpperCase()
    if (!ruasPorLetra[primeiraLetra]) ruasPorLetra[primeiraLetra] = []
    ruasPorLetra[primeiraLetra].push({ nome: nomeRua, detalhes: ruasMap[nomeRua] })
  }
  return ruasPorLetra
}

export function adaptRua(rua) {
  const adaptada = { ...rua, imagemHomenageado: rua.imagemhomenageado }
  delete adaptada.imagemhomenageado
  return { nome: rua.nome_oficial, detalhes: adaptada }
}

export function filtrarRuasPorQuery(todasRuas, query) {
  const queryLower = removerAcentos(query.trim().toLowerCase())
  if (!queryLower || queryLower.length < 2) return null

  const resultados = {}
  todasRuas.forEach(({ nome, detalhes }) => {
    const nomeNorm = removerAcentos(nome.toLowerCase())
    const sigNorm = detalhes.significado ? removerAcentos(detalhes.significado.toLowerCase()) : ''
    const nomeMatch = nomeNorm.includes(queryLower)
    const significadoMatch = sigNorm.includes(queryLower)
    const localizacaoMatch =
      detalhes.localizacao &&
      removerAcentos(detalhes.localizacao.toLowerCase()).includes(queryLower)

    if (nomeMatch || significadoMatch || localizacaoMatch) {
      resultados[nome] = detalhes
    }
  })
  return resultados
}
