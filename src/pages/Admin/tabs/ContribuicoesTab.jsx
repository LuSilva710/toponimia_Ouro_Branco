import { encontrarRuaPorNome } from '../adminApi.js'

const FILTERS = [
  { id: 'pendente', label: 'Pendentes' },
  { id: 'aprovado', label: 'Aprovadas' },
  { id: 'rejeitado', label: 'Rejeitadas' },
]

export function ContribuicoesTab({
  status,
  items,
  error,
  ruas,
  onFilter,
  onModerar,
}) {
  return (
    <div className="tab-content active">
      <div className="tab-header">
        <h2 className="page-title">Moderação de Contribuições</h2>
        <div className="btn-group">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn btn-outline-secondary btn-sm${status === f.id ? ' active' : ''}`}
              onClick={() => onFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-muted">{error}</p>}
      {!error && !items.length && <p className="text-muted">Nenhuma contribuição {status}.</p>}

      {items.map((c) => {
        const ruaMatch = encontrarRuaPorNome(ruas, c.nome_rua)
        return (
          <div className="contrib-card" key={c.id}>
            <div className="contrib-header">
              <span className="contrib-rua"><i className="bi bi-signpost-2 me-1" aria-hidden="true" />{c.nome_rua}</span>
              <span className={`contrib-status ${c.status}`}>{c.status}</span>
            </div>
            <div className="contrib-text">{c.contribuicao}</div>
            <div className="contrib-meta">
              <i className="bi bi-person me-1" aria-hidden="true" />
              {c.autor_nome || 'Anônimo'} · {new Date(c.created_at).toLocaleDateString('pt-BR')}
              {ruaMatch ? (
                <span className="contrib-match text-success">
                  <i className="bi bi-link-45deg" aria-hidden="true" /> Vinculada a: {ruaMatch.nome_oficial}
                </span>
              ) : (
                <span className="contrib-match text-warning">
                  <i className="bi bi-exclamation-triangle" aria-hidden="true" /> Rua não encontrada no cadastro
                </span>
              )}
            </div>
            {c.status === 'pendente' && (
              <div className="contrib-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  disabled={!ruaMatch}
                  title={ruaMatch ? undefined : 'Cadastre a rua antes de aplicar'}
                  onClick={() => onModerar(c, 'aprovado', true)}
                >
                  <i className="bi bi-check2-all" aria-hidden="true" /> Aprovar e aplicar no significado
                </button>
                <button type="button" className="btn btn-sm btn-outline-success" onClick={() => onModerar(c, 'aprovado', false)}>
                  <i className="bi bi-check-lg" aria-hidden="true" /> Só aprovar
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onModerar(c, 'rejeitado', false)}>
                  <i className="bi bi-x-lg" aria-hidden="true" /> Rejeitar
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
