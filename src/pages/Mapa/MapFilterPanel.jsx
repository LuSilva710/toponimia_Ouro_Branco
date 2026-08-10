import { CATEGORIAS, GENEROS, ROTULO_CATEGORIA } from './mapUtils.js'
import { FilterGroupActions } from './FilterGroupActions.jsx'

export function MapFilterPanel({
  bairros,
  filtros,
  onToggle,
  onSelectAll,
  onSelectNone,
  emptyDimensions,
  emptyMessage,
  onResetAll,
}) {
  const bairroIds = bairros.map((b) => String(b.id))

  return (
    <>
      {emptyMessage && (
        <div className="map-filter-empty" role="status">
          <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
          {emptyMessage}
          <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={onResetAll}>
            Restaurar filtros
          </button>
        </div>
      )}

      <div className="filter-group">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="filter-title mb-0">
            <i className="bi bi-geo-alt me-1" aria-hidden="true" />
            Bairro
            {emptyDimensions.includes('bairro') && (
              <span className="filter-empty-badge">vazio</span>
            )}
          </h3>
          <FilterGroupActions
            selectedCount={filtros.bairros.length}
            totalCount={bairros.length}
            onSelectAll={() => onSelectAll('bairros', bairroIds)}
            onSelectNone={() => onSelectNone('bairros')}
          />
        </div>
        <div id="filtro-bairros" className="filter-options">
          {bairros.map((b) => (
            <label className="filter-checkbox" key={b.id}>
              <input
                type="checkbox"
                value={b.id}
                checked={filtros.bairros.includes(String(b.id))}
                onChange={() => onToggle('bairros', String(b.id), bairroIds)}
              />{' '}
              {b.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="filter-title mb-0">
            <i className="bi bi-tags me-1" aria-hidden="true" />
            Categoria
            {emptyDimensions.includes('categoria') && (
              <span className="filter-empty-badge">vazio</span>
            )}
          </h3>
          <FilterGroupActions
            selectedCount={filtros.categorias.length}
            totalCount={CATEGORIAS.length}
            onSelectAll={() => onSelectAll('categorias', CATEGORIAS)}
            onSelectNone={() => onSelectNone('categorias')}
          />
        </div>
        <div id="filtro-categorias" className="filter-options">
          {CATEGORIAS.map((cat) => (
            <label className="filter-checkbox" key={cat}>
              <input
                type="checkbox"
                value={cat}
                checked={filtros.categorias.includes(cat)}
                onChange={() => onToggle('categorias', cat, CATEGORIAS)}
              />{' '}
              {ROTULO_CATEGORIA[cat]}
            </label>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h3 className="filter-title mb-0">
            <i className="bi bi-people me-1" aria-hidden="true" />
            Gênero
            {emptyDimensions.includes('gênero') && (
              <span className="filter-empty-badge">vazio</span>
            )}
          </h3>
          <FilterGroupActions
            selectedCount={filtros.generos.length}
            totalCount={GENEROS.length}
            onSelectAll={() => onSelectAll('generos', GENEROS)}
            onSelectNone={() => onSelectNone('generos')}
          />
        </div>
        <div id="filtro-genero" className="filter-options">
          {GENEROS.map((g) => (
            <label className="filter-checkbox" key={g}>
              <input
                type="checkbox"
                value={g}
                checked={filtros.generos.includes(g)}
                onChange={() => onToggle('generos', g, GENEROS)}
              />{' '}
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
