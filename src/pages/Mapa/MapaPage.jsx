import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { Navbar } from '@components/layout/Navbar.jsx'
import { MapSidebar } from './MapSidebar.jsx'
import {
  buildBasemapOptions,
  loadSavedBasemapId,
  mensagemFiltrosVazios,
  saveBasemapId,
} from './mapUtils.js'
import { useMapEngine } from './useMapEngine.js'
import { useMapFilters } from './useMapFilters.js'

export default function MapaPage() {
  const mapElRef = useRef(null)
  const [bairros, setBairros] = useState([])
  const [ruas, setRuas] = useState([])
  const [streetsGeoJSON, setStreetsGeoJSON] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [visualMode, setVisualMode] = useState('genero')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [basemapId, setBasemapId] = useState(() => loadSavedBasemapId('osm'))
  const [pendingFocus, setPendingFocus] = useState(null)
  const [searchNotice, setSearchNotice] = useState('')

  const basemapMeta = useMemo(() => buildBasemapOptions()[basemapId], [basemapId])

  const {
    filtros,
    ruasFiltradas,
    emptyDimensions,
    syncBairros,
    toggle,
    selectAll,
    selectNone,
    resetAll,
    revealRua,
  } = useMapFilters(ruas)

  const emptyMessage = useMemo(
    () => mensagemFiltrosVazios(emptyDimensions),
    [emptyDimensions],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const geoUrl = `${import.meta.env.BASE_URL}data/ouro_branco_streets.json`
        const [bairrosRes, ruasRes, geoRes] = await Promise.all([
          supabase.from('bairros').select('id, nome, slug').order('nome'),
          supabase.from('ruas').select('*').order('nome_oficial'),
          fetch(geoUrl),
        ])
        if (cancelled) return
        if (bairrosRes.error) throw bairrosRes.error
        if (ruasRes.error) throw ruasRes.error

        const listaBairros = bairrosRes.data || []
        setBairros(listaBairros)
        setRuas(ruasRes.data || [])
        syncBairros(listaBairros.map((b) => b.id))

        if (geoRes.ok) {
          setStreetsGeoJSON(await geoRes.json())
        } else {
          console.warn('GeoJSON não carregou:', geoRes.status)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Não foi possível carregar o mapa. Verifique a conexão e tente novamente.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [syncBairros])

  const bairrosById = useMemo(() => {
    const map = {}
    bairros.forEach((b) => {
      map[b.id] = b
    })
    return map
  }, [bairros])

  const { invalidate, focusRua } = useMapEngine({
    containerRef: mapElRef,
    ruasFiltradas,
    bairrosById,
    streetsGeoJSON,
    visualMode,
    showHeatmap,
    basemapId,
    ready: !loading && !error,
  })

  useEffect(() => {
    if (!pendingFocus) return undefined
    const visible = ruasFiltradas.some((r) => r.id === pendingFocus.id)
    if (!visible) return undefined

    const t = setTimeout(() => {
      focusRua(pendingFocus)
      setPendingFocus(null)
    }, 120)
    return () => clearTimeout(t)
  }, [pendingFocus, ruasFiltradas, focusRua])

  function closeSidebar() {
    setSidebarOpen(false)
    invalidate()
  }

  function openSidebar() {
    setSidebarOpen(true)
    invalidate()
  }

  function changeVisualMode(mode) {
    setVisualMode(mode)
    invalidate()
  }

  function changeBasemap(id) {
    setBasemapId(id)
    saveBasemapId(id)
  }

  function handleSelectRua(rua) {
    if (!(rua.lat && rua.lng)) {
      setSearchNotice(
        `"${rua.nome_oficial}" não tem coordenadas no mapa. Veja no Dicionário.`,
      )
      setPendingFocus(null)
      return
    }

    const { adjusted, added } = revealRua(rua)
    if (adjusted) {
      setSearchNotice(
        `Filtros ampliados (${added.join(', ')}) para exibir a rua selecionada.`,
      )
    } else {
      setSearchNotice('')
    }

    setPendingFocus(rua)
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 991.98px)').matches) {
      setSidebarOpen(false)
      invalidate()
    }
  }

  function handleResetAll() {
    resetAll(bairros.map((b) => b.id))
    setSearchNotice('')
  }

  return (
    <>
      <a href="#map" className="skip-link">
        Pular para o mapa
      </a>
      <Navbar active="mapa" />

      <div className="map-layout" aria-busy={loading || undefined}>
        <MapSidebar
          open={sidebarOpen}
          onClose={closeSidebar}
          bairros={bairros}
          bairrosById={bairrosById}
          todasRuas={ruas}
          filtros={filtros}
          emptyDimensions={emptyDimensions}
          emptyMessage={emptyMessage}
          onToggle={toggle}
          onSelectAll={selectAll}
          onSelectNone={selectNone}
          onResetAll={handleResetAll}
          visualMode={visualMode}
          onVisualMode={changeVisualMode}
          showHeatmap={showHeatmap}
          onHeatmap={setShowHeatmap}
          basemapId={basemapId}
          onBasemap={changeBasemap}
          ruasFiltradas={ruasFiltradas}
          loading={loading}
          onSelectRua={handleSelectRua}
          searchNotice={searchNotice}
        />

        <div className="map-container">
          <button
            type="button"
            className="btn-toggle-sidebar d-lg-none"
            id="btn-open-sidebar"
            aria-label="Abrir filtros"
            onClick={openSidebar}
          >
            <i className="bi bi-funnel" aria-hidden="true" />
          </button>

          <div className="basemap-floating-toggle" role="group" aria-label="Fundo do mapa">
            <button
              type="button"
              className={basemapId === 'osm' ? 'active' : ''}
              onClick={() => changeBasemap('osm')}
              title="OpenStreetMap (sem chave)"
            >
              OSM
            </button>
            <button
              type="button"
              className={basemapId === 'carto' ? 'active' : ''}
              onClick={() => changeBasemap('carto')}
              title="CARTO Light (requer VITE_CARTO_API_KEY)"
            >
              CARTO
            </button>
          </div>

          {basemapId === 'carto' && !basemapMeta?.ready && (
            <div className="basemap-banner" role="status">
              CARTO sem chave — adicione <code>VITE_CARTO_API_KEY</code> no `.env` ou use OSM.
            </div>
          )}

          {error && (
            <div className="alert alert-danger m-3" role="alert">
              {error}
            </div>
          )}

          <div
            id="map"
            ref={mapElRef}
            role="application"
            aria-label="Mapa interativo das ruas de Ouro Branco"
          />
        </div>
      </div>
    </>
  )
}
