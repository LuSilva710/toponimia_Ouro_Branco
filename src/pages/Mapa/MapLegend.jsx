import {
  CATEGORIAS,
  CORES_CATEGORIA,
  CORES_GENERO,
  GENEROS,
  ROTULO_CATEGORIA,
  buildBasemapOptions,
  contarPorCategoria,
  contarPorGenero,
} from './mapUtils.js'

export function MapBasemapToggle({ basemapId, onBasemap }) {
  const options = buildBasemapOptions()
  const carto = options.carto

  return (
    <div className="filter-group">
      <h3 className="filter-title">
        <i className="bi bi-layers me-1" aria-hidden="true" />
        Fundo do mapa
      </h3>
      <div className="visual-mode-toggle mb-2" role="group" aria-label="Escolher fundo do mapa">
        <input
          type="radio"
          className="btn-check"
          name="basemap"
          id="basemap-osm"
          checked={basemapId === 'osm'}
          onChange={() => onBasemap('osm')}
          autoComplete="off"
        />
        <label className="btn btn-outline-dark btn-sm w-50" htmlFor="basemap-osm">
          OSM
        </label>
        <input
          type="radio"
          className="btn-check"
          name="basemap"
          id="basemap-carto"
          checked={basemapId === 'carto'}
          onChange={() => onBasemap('carto')}
          autoComplete="off"
        />
        <label className="btn btn-outline-dark btn-sm w-50" htmlFor="basemap-carto">
          CARTO
        </label>
      </div>
      {basemapId === 'carto' && !carto.ready && (
        <p className="basemap-hint mb-0" role="note">
          <i className="bi bi-key me-1" aria-hidden="true" />
          Sem chave CARTO no `.env` (`VITE_CARTO_API_KEY`). OSM funciona sem chave.
        </p>
      )}
    </div>
  )
}

export function MapViewControls({ visualMode, onVisualMode, showHeatmap, onHeatmap }) {
  return (
    <div className="filter-group">
      <h3 className="filter-title">
        <i className="bi bi-eye me-1" aria-hidden="true" />
        Modo de Visualização
      </h3>
      <div className="visual-mode-toggle mb-3">
        <input
          type="radio"
          className="btn-check"
          name="visual-mode"
          id="mode-genero"
          value="genero"
          checked={visualMode === 'genero'}
          onChange={() => onVisualMode('genero')}
          autoComplete="off"
        />
        <label className="btn btn-outline-dark btn-sm w-50" htmlFor="mode-genero">
          Gênero
        </label>
        <input
          type="radio"
          className="btn-check"
          name="visual-mode"
          id="mode-categoria"
          value="categoria"
          checked={visualMode === 'categoria'}
          onChange={() => onVisualMode('categoria')}
          autoComplete="off"
        />
        <label className="btn btn-outline-dark btn-sm w-50" htmlFor="mode-categoria">
          Categoria
        </label>
      </div>
      <label className="filter-checkbox">
        <input
          type="checkbox"
          id="toggle-heatmap"
          checked={showHeatmap}
          onChange={(e) => onHeatmap(e.target.checked)}
        />{' '}
        Heatmap de Gênero
      </label>
    </div>
  )
}

export function MapLegend({ visualMode, ruasFiltradas }) {
  const contagemCat = contarPorCategoria(ruasFiltradas)

  return (
    <div className="filter-group">
      <h3 className="filter-title">
        <i className="bi bi-palette me-1" aria-hidden="true" />
        <span id="legend-title">{visualMode === 'genero' ? 'Gêneros' : 'Categorias'}</span>
      </h3>
      <div className="legend" id="legenda">
        {visualMode === 'genero' ? (
          <div id="legenda-genero">
            <div className="legend-item">
              <span className="legend-color" style={{ background: CORES_GENERO.feminino }} /> Feminino
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: CORES_GENERO.masculino }} /> Masculino
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ background: CORES_GENERO.neutro }} /> Neutro
            </div>
          </div>
        ) : (
          <div id="legenda-categorias">
            {CATEGORIAS.map((cat) => (
              <div className="legend-item" key={cat}>
                <span className="legend-color" style={{ background: CORES_CATEGORIA[cat] }} />
                {ROTULO_CATEGORIA[cat]}{' '}
                <span className="legend-count">{contagemCat[cat] || 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function MapPanorama({ visualMode, ruasFiltradas }) {
  const total = ruasFiltradas.length
  const contagemCat = contarPorCategoria(ruasFiltradas)
  const contagemGen = contarPorGenero(ruasFiltradas)
  const comCoords = ruasFiltradas.filter((r) => r.lat && r.lng).length

  return (
    <>
      <div className="sidebar-stats" id="sidebar-stats">
        <p>
          <strong id="total-marcadores">{comCoords}</strong> ruas no mapa
          {total !== comCoords ? ` · ${total} filtradas` : ''}
        </p>
      </div>

      <div className="filter-group border-0" id="panorama-container">
        <h3 className="filter-title">
          <i className="bi bi-bar-chart-line me-1" aria-hidden="true" />
          <span id="panorama-title">
            {visualMode === 'genero' ? 'Panorama de Gênero' : 'Panorama de Categorias'}
          </span>
        </h3>

        {visualMode === 'genero' ? (
          <div className="gender-stats-container" id="panorama-genero">
            {GENEROS.map((gen) => {
              const count = contagemGen[gen] || 0
              const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
              const icon =
                gen === 'feminino'
                  ? 'bi-gender-female text-danger'
                  : gen === 'masculino'
                    ? 'bi-gender-male text-primary'
                    : 'bi-gender-ambiguous text-muted'
              return (
                <div className="stat-item" id={`stat-${gen}`} key={gen}>
                  <div className="stat-info">
                    <span className="stat-label">
                      <i className={`bi ${icon}`} aria-hidden="true" />{' '}
                      {gen.charAt(0).toUpperCase() + gen.slice(1)}
                    </span>
                    <span className="stat-values">
                      {count} ({percent}%)
                    </span>
                  </div>
                  <div className="stat-bar-bg">
                    <div className={`stat-bar-fill ${gen}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="category-stats-container" id="panorama-categorias">
            <div id="stats-list-categorias" className="mt-2">
              {CATEGORIAS.map((cat) => {
                const count = contagemCat[cat] || 0
                const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
                return (
                  <div className="stat-item" key={cat}>
                    <div className="stat-info">
                      <span className="stat-label">{ROTULO_CATEGORIA[cat]}</span>
                      <span className="stat-values">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="stat-bar-bg">
                      <div
                        className="stat-bar-fill"
                        style={{ width: `${percent}%`, background: CORES_CATEGORIA[cat] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
