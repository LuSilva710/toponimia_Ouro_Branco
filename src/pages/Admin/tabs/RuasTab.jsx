import { useMemo, useState } from 'react'

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function RuasTab({ ruas, bairros, onNovo, onEdit, onDelete }) {
  const [busca, setBusca] = useState('')
  const [bairroId, setBairroId] = useState('')

  const filtradas = useMemo(() => {
    const q = norm(busca.trim())
    return ruas.filter((r) => {
      if (bairroId && String(r.bairro_id) !== String(bairroId)) return false
      if (!q) return true
      return (
        norm(r.nome_oficial).includes(q) ||
        norm(r.localizacao).includes(q) ||
        norm(r.significado).includes(q) ||
        norm(r.bairros?.nome).includes(q) ||
        norm(r.categoria_toponimica).includes(q)
      )
    })
  }, [ruas, busca, bairroId])

  const contagem = busca || bairroId
    ? `${filtradas.length} de ${ruas.length} ruas`
    : `${ruas.length} ruas`

  return (
    <div className="tab-content active">
      <div className="tab-header">
        <h2 className="page-title">Gerenciar Ruas</h2>
        <button type="button" className="btn btn-primary" onClick={onNovo}>
          <i className="bi bi-plus-lg" aria-hidden="true" /> Nova Rua
        </button>
      </div>
      <div className="admin-toolbar mb-3">
        <div className="admin-search-wrap">
          <i className="bi bi-search" aria-hidden="true" />
          <input
            type="search"
            className="form-control"
            placeholder="Buscar por nome, localização ou significado..."
            aria-label="Buscar ruas"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="form-select" aria-label="Filtrar por bairro" value={bairroId} onChange={(e) => setBairroId(e.target.value)}>
          <option value="">Todos os bairros</option>
          {bairros.map((b) => (
            <option key={b.id} value={b.id}>{b.nome}</option>
          ))}
        </select>
        <span className="admin-filter-count text-muted" aria-live="polite">{contagem}</span>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nome Oficial</th>
              <th>Bairro</th>
              <th>Categoria</th>
              <th>Gênero</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {!filtradas.length ? (
              <tr><td colSpan={5} className="text-muted">Nenhuma rua encontrada com esses filtros.</td></tr>
            ) : filtradas.map((r) => (
              <tr key={r.id}>
                <td>{r.nome_oficial}</td>
                <td>{r.bairros?.nome || '--'}</td>
                <td>{r.categoria_toponimica || '--'}</td>
                <td>{r.genero_homenageado || '--'}</td>
                <td>
                  <button type="button" className="btn-action edit" aria-label={`Editar ${r.nome_oficial}`} onClick={() => onEdit(r)}>
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-action delete" aria-label={`Excluir ${r.nome_oficial}`} onClick={() => onDelete(r)}>
                    <i className="bi bi-trash" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
