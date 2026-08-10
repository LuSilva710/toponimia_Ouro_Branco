/** Ações Todos / Nenhum para um grupo de filtros. */
export function FilterGroupActions({ selectedCount, totalCount, onSelectAll, onSelectNone }) {
  const allSelected = totalCount > 0 && selectedCount === totalCount
  const noneSelected = selectedCount === 0

  return (
    <div className="filter-group-actions">
      <button
        type="button"
        className="btn btn-link btn-sm text-decoration-none p-0 text-muted"
        style={{ fontSize: '0.8rem' }}
        disabled={allSelected}
        onClick={onSelectAll}
      >
        Todos
      </button>
      <span className="filter-group-actions-sep" aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        className="btn btn-link btn-sm text-decoration-none p-0 text-muted"
        style={{ fontSize: '0.8rem' }}
        disabled={noneSelected}
        onClick={onSelectNone}
      >
        Nenhum
      </button>
    </div>
  )
}
