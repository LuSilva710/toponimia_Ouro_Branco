import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { GameChrome } from '@components/layout/GameChrome.jsx'

const JOGOS = [
  { id: 'quiz', label: 'Quiz', icon: 'bi-question-circle' },
  { id: 'associacao', label: 'Associação', icon: 'bi-link-45deg' },
  { id: 'cruzadinha', label: 'Cruzadinha', icon: 'bi-grid-3x3' },
]

const PERIODOS = [
  { id: 'geral', label: 'Geral' },
  { id: 'semana', label: 'Esta Semana' },
  { id: 'hoje', label: 'Hoje' },
]

function medal(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return String(i + 1)
}

export default function RankingPage() {
  const [jogo, setJogo] = useState('quiz')
  const [periodo, setPeriodo] = useState('geral')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('pontuacoes')
        .select('*')
        .eq('jogo', jogo)
        .order('pontos', { ascending: false })
        .limit(20)

      if (periodo === 'hoje') {
        const hoje = new Date().toISOString().split('T')[0]
        query = query.gte('created_at', hoje)
      } else if (periodo === 'semana') {
        const semana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', semana)
      }

      const { data, error: err } = await query
      if (err) throw err
      setRows(data || [])
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o ranking.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [jogo, periodo])

  useEffect(() => {
    carregar()
  }, [carregar, tick])

  useEffect(() => {
    const channel = supabase
      .channel('ranking-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pontuacoes' }, () => {
        setTick((t) => t + 1)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <>
      <GameChrome />
      <div className="ranking-container">
        <div className="ranking-header">
          <h1>
            <i className="bi bi-trophy me-2" aria-hidden="true" />
            Ranking
          </h1>
          <p>Melhores pontuações dos jogos educativos</p>
        </div>

        <div className="ranking-tabs">
          {JOGOS.map((j) => (
            <button
              key={j.id}
              type="button"
              className={`ranking-tab${jogo === j.id ? ' active' : ''}`}
              onClick={() => setJogo(j.id)}
            >
              <i className={`bi ${j.icon} me-1`} aria-hidden="true" />
              {j.label}
            </button>
          ))}
        </div>

        <div className="ranking-filters">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ranking-filter${periodo === p.id ? ' active' : ''}`}
              onClick={() => setPeriodo(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rank-empty" role="alert">
            {error}
          </p>
        )}

        <table className="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Pontos</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="rank-empty">
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="rank-empty">
                  Nenhuma pontuação encontrada.
                </td>
              </tr>
            ) : (
              rows.map((p, i) => (
                <tr key={p.id ?? `${p.jogador_nome}-${i}`}>
                  <td>
                    <span className={`rank-position${i < 3 ? ` rank-${i + 1}` : ''}`}>{medal(i)}</span>
                  </td>
                  <td>{p.jogador_nome}</td>
                  <td>
                    <span className="rank-points">{p.pontos}</span>
                  </td>
                  <td>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
