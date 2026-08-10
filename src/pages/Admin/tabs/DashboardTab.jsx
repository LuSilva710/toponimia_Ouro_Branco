export function DashboardTab({ stats }) {
  const cards = [
    { icon: 'bi-signpost-2', value: stats.ruas, label: 'Total de Ruas' },
    { icon: 'bi-geo-alt', value: stats.bairros, label: 'Bairros' },
    { icon: 'bi-chat-square-text', value: stats.contribuicoes, label: 'Contribuições Pendentes' },
    { icon: 'bi-people', value: stats.usuarios, label: 'Usuários' },
  ]

  return (
    <div className="tab-content active">
      <h2 className="page-title">Dashboard</h2>
      <div className="stats-cards">
        {cards.map((c) => (
          <div className="stat-card" key={c.label}>
            <div className="stat-icon"><i className={`bi ${c.icon}`} aria-hidden="true" /></div>
            <div className="stat-info">
              <span className="stat-value">{c.value ?? '--'}</span>
              <span className="stat-label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
