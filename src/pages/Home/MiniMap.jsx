import { useEffect, useRef } from 'react'

/**
 * Mini-mapa Leaflet (CDN global `L`). Desmonta o mapa no cleanup.
 */
export function MiniMap({ ruaId, lat, lng, nome, localizacao, mapaFallback }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    const L = globalThis.L
    if (!L || !containerRef.current || lat == null || lng == null) return undefined

    try {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
        dragging: !L.Browser.mobile,
        tap: !L.Browser.mobile,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<b>${nome || ''}</b><br>${localizacao || ''}`)
        .openPopup()

      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 150)
    } catch (err) {
      console.error('Erro ao inicializar mini-mapa:', err)
      if (mapaFallback && containerRef.current) {
        containerRef.current.innerHTML = `<iframe src="${mapaFallback}" width="100%" height="380" style="border:0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      }
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {
          /* ignore */
        }
        mapRef.current = null
      }
    }
  }, [ruaId, lat, lng, nome, localizacao, mapaFallback])

  return <div ref={containerRef} id={`mini-map-${ruaId}`} className="mini-map" />
}
