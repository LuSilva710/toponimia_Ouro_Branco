export function SearchResults({ query, resultados, bairrosById, onClear, onSelect }) {
  if (!query || query.trim().length < 2) return null

  const entries = Object.entries(resultados || {})
  const quantidade = entries.length
  const plural = quantidade === 1 ? 'resultado' : 'resultados'
  const countText =
    quantidade === 0
      ? `Nenhum resultado encontrado para "${query}"`
      : `${quantidade} ${plural} para "${query}"`

  return (
    <div className="search-results-info">
      <div className="search-results-header">
        <div className="search-results-count">
          <i className="bi bi-search" aria-hidden="true" />
          {countText}
        </div>
        <button type="button" className="clear-search-btn" onClick={onClear}>
          <i className="bi bi-x-circle" aria-hidden="true" />
          Limpar busca
        </button>
      </div>
      {quantidade > 0 && (
        <div className="search-results-list">
          {entries.map(([nome, detalhes]) => {
            const bairro = bairrosById[detalhes.bairro_id]
            const nomeBairro = bairro?.nome || 'Sem Bairro'
            return (
              <button
                key={nome}
                type="button"
                className="search-result-card"
                aria-label={`Ir para ${nome}${bairro ? ` no bairro ${nomeBairro}` : ''}`}
                onClick={() => onSelect(bairro?.slug, nome)}
              >
                <span className="search-result-card-header">
                  <span className="search-result-card-title">
                    <i className="bi bi-signpost-2" aria-hidden="true" /> {nome}
                  </span>
                  <span className="search-result-card-bairro">
                    <i className="bi bi-geo-alt-fill" aria-hidden="true" /> {nomeBairro}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
