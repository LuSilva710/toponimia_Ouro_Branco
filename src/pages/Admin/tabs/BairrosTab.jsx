export function BairrosTab({ bairros, onNovo, onEdit, onDelete }) {
  return (
    <div className="tab-content active">
      <div className="tab-header">
        <h2 className="page-title">Gerenciar Bairros</h2>
        <button type="button" className="btn btn-primary" onClick={onNovo}>
          <i className="bi bi-plus-lg" aria-hidden="true" /> Novo Bairro
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Slug</th>
              <th>Descrição</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {bairros.map((b) => (
              <tr key={b.id}>
                <td>{b.nome}</td>
                <td><code>{b.slug}</code></td>
                <td>{(b.descricao || '').substring(0, 60)}{(b.descricao || '').length > 60 ? '...' : ''}</td>
                <td>
                  <button type="button" className="btn-action edit" aria-label={`Editar ${b.nome}`} onClick={() => onEdit(b)}>
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <button type="button" className="btn-action delete" aria-label={`Excluir ${b.nome}`} onClick={() => onDelete(b)}>
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
