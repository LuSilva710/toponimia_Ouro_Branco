export function AuditoriaTab({ rows, error, filtroAcao, filtroTabela, onFiltroAcao, onFiltroTabela, onVer }) {
  return (
    <div className="tab-content active">
      <h2 className="page-title">Log de Auditoria</h2>
      <div className="audit-filters mb-3">
        <select className="form-select form-select-sm" style={{ maxWidth: 200, display: 'inline-block' }} value={filtroAcao} onChange={(e) => onFiltroAcao(e.target.value)}>
          <option value="">Todas as ações</option>
          <option value="INSERT">Inserção</option>
          <option value="UPDATE">Edição</option>
          <option value="DELETE">Exclusão</option>
        </select>
        {' '}
        <select className="form-select form-select-sm" style={{ maxWidth: 200, display: 'inline-block' }} value={filtroTabela} onChange={(e) => onFiltroTabela(e.target.value)}>
          <option value="">Todas as tabelas</option>
          <option value="bairros">Bairros</option>
          <option value="ruas">Ruas</option>
        </select>
      </div>
      <div className="table-responsive">
        <table className="table table-hover table-sm">
          <thead>
            <tr>
              <th>Data</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Tabela</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {error && <tr><td colSpan={5} className="text-muted">{error}</td></tr>}
            {!error && !rows.length && <tr><td colSpan={5} className="text-muted">Nenhum registro.</td></tr>}
            {rows.map((a) => (
              <tr key={a.id || `${a.created_at}-${a.tabela}-${a.acao}`}>
                <td>{new Date(a.created_at).toLocaleString('pt-BR')}</td>
                <td>{a.user_email || '--'}</td>
                <td>
                  <span className={`badge bg-${a.acao === 'INSERT' ? 'success' : a.acao === 'DELETE' ? 'danger' : 'primary'}`}>
                    {a.acao}
                  </span>
                </td>
                <td>{a.tabela}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onVer(a)}>
                    Ver
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
