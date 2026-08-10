import { useCallback, useMemo, useState } from 'react'
import {
  CATEGORIAS,
  GENEROS,
  filtrarRuas,
  filtrosComRuaVisivel,
  normalizarCategoria,
} from './mapUtils.js'

/**
 * Estado e ações dos filtros do mapa.
 * Semântica: lista vazia em uma dimensão = 0 resultados nessa dimensão.
 */
export function useMapFilters(ruas) {
  const [filtros, setFiltros] = useState({
    categorias: [...CATEGORIAS],
    generos: [...GENEROS],
    bairros: [],
  })

  const syncBairros = useCallback((ids) => {
    const strIds = ids.map(String)
    setFiltros((f) => {
      if (f.bairros.length === 0) {
        return { ...f, bairros: strIds }
      }
      const kept = f.bairros.filter((id) => strIds.includes(id))
      return { ...f, bairros: kept.length ? kept : strIds }
    })
  }, [])

  const ruasFiltradas = useMemo(() => filtrarRuas(ruas, filtros), [ruas, filtros])

  const emptyDimensions = useMemo(() => {
    const empty = []
    if (filtros.bairros.length === 0) empty.push('bairro')
    if (filtros.categorias.length === 0) empty.push('categoria')
    if (filtros.generos.length === 0) empty.push('gênero')
    return empty
  }, [filtros])

  const toggle = useCallback((key, value, allValues) => {
    setFiltros((f) => {
      const current = f[key]
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return {
        ...f,
        [key]: allValues.filter((v) => next.includes(v)),
      }
    })
  }, [])

  const selectAll = useCallback((key, allValues) => {
    setFiltros((f) => ({ ...f, [key]: [...allValues] }))
  }, [])

  const selectNone = useCallback((key) => {
    setFiltros((f) => ({ ...f, [key]: [] }))
  }, [])

  const resetAll = useCallback((bairroIds = []) => {
    setFiltros({
      categorias: [...CATEGORIAS],
      generos: [...GENEROS],
      bairros: bairroIds.map(String),
    })
  }, [])

  /** Amplia filtros o mínimo necessário para a rua aparecer. */
  const revealRua = useCallback((rua) => {
    let result = { adjusted: false, added: [] }
    setFiltros((f) => {
      const cat = normalizarCategoria(rua.categoria_toponimica)
      const gen = rua.genero_homenageado || 'neutro'
      const bId = rua.bairro_id != null ? String(rua.bairro_id) : null
      const added = []
      if (!f.categorias.includes(cat)) added.push('categoria')
      if (!f.generos.includes(gen)) added.push('gênero')
      if (bId && !f.bairros.includes(bId)) added.push('bairro')
      result = { adjusted: added.length > 0, added }
      return filtrosComRuaVisivel(f, rua)
    })
    return result
  }, [])

  return {
    filtros,
    ruasFiltradas,
    emptyDimensions,
    syncBairros,
    toggle,
    selectAll,
    selectNone,
    resetAll,
    revealRua,
  }
}
