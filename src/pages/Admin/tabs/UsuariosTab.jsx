export function UsuariosTab({ users, error, onRoleChange }) {
  return (
    <div className="tab-content active">
      <h2 className="page-title">Gestão de Usuários</h2>
      <div className="table-responsive">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {error && <tr><td colSpan={4} className="text-muted">{error}</td></tr>}
            {!error && !users.length && <tr><td colSpan={4} className="text-muted">Nenhum usuário.</td></tr>}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email || u.id}</td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    style={{ width: 140, display: 'inline-block', background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                    value={u.role || 'viewer'}
                    onChange={(e) => onRoleChange(u.id, e.target.value)}
                  >
                    <option value="viewer">Leitor</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{u.created_at ? new Date(u.created_at).toLocaleDateString('pt-BR') : '–'}</td>
                <td>–</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
