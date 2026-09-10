import { useCallback, useEffect, useRef } from 'react'
import {
  CORES_CATEGORIA,
  CORES_GENERO,
  DEFAULT_ZOOM,
  OURO_BRANCO_CENTER,
  buildBasemapOptions,
  normalizarCategoria,
  normalizarNomeRua,
  popupHtml,
} from './mapUtils.js'

/**
 * Motor Leaflet (mapa + cluster + geojson + heatmap).
 * Depende de L, L.markerClusterGroup e L.heatLayer no global (CDN).
 */
export function useMapEngine({
  containerRef,
  ruasFiltradas,
  bairrosById,
  streetsGeoJSON,
  visualMode,
  showHeatmap,
  basemapId = 'osm',
  ready,
}) {
  const mapRef = useRef(null)
  const baseLayerRef = useRef(null)
  const markersLayerRef = useRef(null)
  const geojsonLayerRef = useRef(null)
  const heatFemRef = useRef(null)
  const heatMascRef = useRef(null)
  const layersPorRuaRef = useRef({})
  const markersByNomeRef = useRef({})
  const visualModeRef = useRef(visualMode)
  visualModeRef.current = visualMode

  // Init map once
  useEffect(() => {
    const L = globalThis.L
    const el = containerRef.current
    if (!L || !el || mapRef.current) return undefined

    const map = L.map(el, {
      center: OURO_BRANCO_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const basemaps = buildBasemapOptions()
    const initial = basemaps[basemapId] || basemaps.osm
    const baseLayer = L.tileLayer(initial.url, initial.options).addTo(map)
    baseLayerRef.current = baseLayer

    const markersLayer = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction() {
        return L.divIcon({
          html: '<div class="custom-cluster-circle"></div>',
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        })
      },
    })
    map.addLayer(markersLayer)

    const geojsonLayer = L.geoJSON(null, {
      style: () => ({ color: '#333', weight: 3, opacity: 0.6 }),
    }).addTo(map)

    mapRef.current = map
    markersLayerRef.current = markersLayer
    geojsonLayerRef.current = geojsonLayer

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => map.invalidateSize({ animate: false }))
        : null
    const mapContainer = el.closest('.map-container') || el
    if (ro) ro.observe(mapContainer)

    requestAnimationFrame(() => map.invalidateSize({ animate: false }))

    return () => {
      if (ro) ro.disconnect()
      map.remove()
      mapRef.current = null
      baseLayerRef.current = null
      markersLayerRef.current = null
      geojsonLayerRef.current = null
      heatFemRef.current = null
      heatMascRef.current = null
      layersPorRuaRef.current = {}
    }
    // basemapId is applied in a separate effect after init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  // Swap basemap tiles
  useEffect(() => {
    const L = globalThis.L
    const map = mapRef.current
    if (!L || !map) return

    const basemaps = buildBasemapOptions()
    const next = basemaps[basemapId] || basemaps.osm
    const prev = baseLayerRef.current
    if (prev) map.removeLayer(prev)

    const layer = L.tileLayer(next.url, next.options).addTo(map)
    baseLayerRef.current = layer
    layer.bringToBack?.()
  }, [basemapId])

  // Sync navbar offset
  useEffect(() => {
    function sync() {
      const nav = document.querySelector('header .navbar.fixed-top')
      if (nav) {
        document.documentElement.style.setProperty('--map-navbar-offset', `${nav.offsetHeight}px`)
      }
      mapRef.current?.invalidateSize({ animate: false })
    }
    sync()
    window.addEventListener('resize', sync)
    return () => window.removeEventListener('resize', sync)
  }, [])

  // Render layers when filters/data change
  useEffect(() => {
    const L = globalThis.L
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    const geojsonLayer = geojsonLayerRef.current
    if (!ready || !L || !map || !markersLayer || !geojsonLayer) return

    const mode = visualModeRef.current

    function destacarRua(nomeNorm) {
      const layer = layersPorRuaRef.current[nomeNorm]
      if (!layer) return
      layer.setStyle({ weight: 10, opacity: 1, dashArray: '' })
      layer.bringToFront()
    }

    function removerDestaqueRua(nomeNorm) {
      const layer = layersPorRuaRef.current[nomeNorm]
      if (!layer?.ruaData) return
      const cat = normalizarCategoria(layer.ruaData.categoria_toponimica)
      const gen = layer.ruaData.genero_homenageado || 'neutro'
      const cor = mode === 'genero' ? CORES_GENERO[gen] : CORES_CATEGORIA[cat]
      layer.setStyle({ color: cor || '#6b7280', weight: 8, opacity: 0.8 })
    }

    function criarMarcador(rua) {
      if (!rua.lat || !rua.lng) return null
      const categoria = normalizarCategoria(rua.categoria_toponimica)
      const genero = rua.genero_homenageado || 'neutro'
      const corCat = CORES_CATEGORIA[categoria] || CORES_CATEGORIA.outro
      const corGen = CORES_GENERO[genero] || CORES_GENERO.neutro
      const corFinal = mode === 'genero' ? corGen : corCat
      const nomeNorm = normalizarNomeRua(rua.nome_oficial)

      const icon = L.divIcon({
        className: 'premium-marker',
        html: `
          <div class="marker-container" data-nome-rua="${nomeNorm}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="8" fill="white" fill-opacity="0.2" stroke="${corFinal}" stroke-width="2"/>
              <circle cx="12" cy="12" r="3" fill="${corFinal}"/>
            </svg>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const marker = L.marker([rua.lat, rua.lng], { icon })
      marker.on('mouseover', () => destacarRua(nomeNorm))
      marker.on('mouseout', () => removerDestaqueRua(nomeNorm))

      const bairroNome = bairrosById[rua.bairro_id]?.nome || ''
      marker.bindPopup(popupHtml(rua, bairroNome, mode), {
        maxWidth: 300,
        className: 'premium-popup',
      })
      return marker
    }

    markersLayer.clearLayers()
    markersByNomeRef.current = {}
    ruasFiltradas.forEach((rua) => {
      const marker = criarMarcador(rua)
      if (marker) {
        markersLayer.addLayer(marker)
        markersByNomeRef.current[normalizarNomeRua(rua.nome_oficial)] = marker
      }
    })

    // GeoJSON
    geojsonLayer.clearLayers()
    layersPorRuaRef.current = {}
    if (streetsGeoJSON?.features) {
      const mapaRuas = new Map()
      ruasFiltradas.forEach((r) => mapaRuas.set(normalizarNomeRua(r.nome_oficial), r))

      const features = streetsGeoJSON.features.filter((f) =>
        mapaRuas.has(normalizarNomeRua(f.properties?.name)),
      )
      geojsonLayer.addData(features)

      geojsonLayer.eachLayer((layer) => {
        const nomeNorm = normalizarNomeRua(layer.feature?.properties?.name)
        const ruaData = mapaRuas.get(nomeNorm)
        if (!ruaData) return

        const cat = normalizarCategoria(ruaData.categoria_toponimica)
        const gen = ruaData.genero_homenageado || 'neutro'
        const cor = mode === 'genero' ? CORES_GENERO[gen] : CORES_CATEGORIA[cat]
        layer.ruaData = ruaData
        layersPorRuaRef.current[nomeNorm] = layer
        layer.setStyle({
          color: cor || '#6b7280',
          weight: 8,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        })

        layer.on('mouseover', () => {
          layer.setStyle({ weight: 10, opacity: 1 })
          document
            .querySelector(`.marker-container[data-nome-rua="${nomeNorm}"]`)
            ?.classList.add('highlight-pulse')
        })
        layer.on('mouseout', () => {
          layer.setStyle({ weight: 6, opacity: 0.7 })
          document
            .querySelector(`.marker-container[data-nome-rua="${nomeNorm}"]`)
            ?.classList.remove('highlight-pulse')
        })

        const bairroNome = bairrosById[ruaData.bairro_id]?.nome || ''
        layer.bindPopup(popupHtml(ruaData, bairroNome, mode), {
          maxWidth: 300,
          className: 'premium-popup',
        })
      })
    }

    // Heatmap
    if (heatFemRef.current) {
      map.removeLayer(heatFemRef.current)
      heatFemRef.current = null
    }
    if (heatMascRef.current) {
      map.removeLayer(heatMascRef.current)
      heatMascRef.current = null
    }
    if (showHeatmap && typeof L.heatLayer === 'function') {
      const pontosFem = ruasFiltradas
        .filter((r) => r.lat && r.lng && r.genero_homenageado === 'feminino')
        .map((r) => [r.lat, r.lng, 1])
      const pontosMasc = ruasFiltradas
        .filter((r) => r.lat && r.lng && r.genero_homenageado === 'masculino')
        .map((r) => [r.lat, r.lng, 1])

      if (pontosFem.length) {
        heatFemRef.current = L.heatLayer(pontosFem, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          gradient: { 0.4: '#fbcfe8', 0.65: '#f43f5e', 1: '#be123c' },
        }).addTo(map)
      }
      if (pontosMasc.length) {
        heatMascRef.current = L.heatLayer(pontosMasc, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          gradient: { 0.4: '#bfdbfe', 0.65: '#3b82f6', 1: '#1d4ed8' },
        }).addTo(map)
      }
    }

    requestAnimationFrame(() => map.invalidateSize({ animate: false }))
  }, [ready, ruasFiltradas, bairrosById, streetsGeoJSON, visualMode, showHeatmap])

  const invalidate = useCallback(() => {
    mapRef.current?.invalidateSize({ animate: false })
    setTimeout(() => mapRef.current?.invalidateSize({ animate: false }), 150)
  }, [])

  const focusRua = useCallback((rua) => {
    const map = mapRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !rua?.lat || !rua?.lng) return false

    map.setView([rua.lat, rua.lng], 17, { animate: true })

    const nomeNorm = normalizarNomeRua(rua.nome_oficial)
    const marker = markersByNomeRef.current[nomeNorm]
    if (marker && markersLayer?.zoomToShowLayer) {
      markersLayer.zoomToShowLayer(marker, () => {
        marker.openPopup()
      })
      return true
    }
    if (marker) {
      marker.openPopup()
      return true
    }
    return false
  }, [])

  return { invalidate, focusRua }
}
