import { MapSearch } from './MapSearch.jsx'
import { MapFilterPanel } from './MapFilterPanel.jsx'
import { MapLegend, MapPanorama, MapViewControls } from './MapLegend.jsx'

/** Shell da sidebar: busca + filtros + visualização + legenda/panorama. */
export function MapSidebar({
  open,
  onClose,
  bairros,
  bairrosById,
  todasRuas,
  filtros,
  emptyDimensions,
  emptyMessage,
  onToggle,
  onSelectAll,
  onSelectNone,
  onResetAll,
  visualMode,
  onVisualMode,
  showHeatmap,
  onHeatmap,
  ruasFiltradas,
  loading,
  onSelectRua,
  searchNotice,
}) {
  return (
    <aside className={`map-sidebar${open ? ' open' : ''}`} id="sidebar">
      <div className="sidebar-header">
        <h2>
          <i className="bi bi-funnel me-2" aria-hidden="true" />
          Filtros
        </h2>
        <button
          type="button"
          className="btn-toggle-sidebar d-lg-none"
          id="btn-close-sidebar"
          aria-label="Fechar filtros"
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="map-loading-hint" role="status">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Carregando dados do mapa…
        </div>
      )}

      <MapSearch
        ruas={todasRuas}
        bairrosById={bairrosById}
        disabled={loading}
        onSelect={onSelectRua}
      />

      {searchNotice && (
        <div className="map-search-notice" role="status">
          <i className="bi bi-info-circle me-1" aria-hidden="true" />
          {searchNotice}
        </div>
      )}

      <MapFilterPanel
        bairros={bairros}
        filtros={filtros}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onSelectNone={onSelectNone}
        emptyDimensions={emptyDimensions}
        emptyMessage={emptyMessage}
        onResetAll={onResetAll}
      />

      <MapViewControls
        visualMode={visualMode}
        onVisualMode={onVisualMode}
        showHeatmap={showHeatmap}
        onHeatmap={onHeatmap}
      />

      <MapLegend visualMode={visualMode} ruasFiltradas={ruasFiltradas} />
      <MapPanorama visualMode={visualMode} ruasFiltradas={ruasFiltradas} />
    </aside>
  )
}
