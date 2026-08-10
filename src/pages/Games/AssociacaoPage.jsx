import { useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { GameChrome } from '@components/layout/GameChrome.jsx'

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

async function carregarPares() {
  const { data, error } = await supabase
    .from('ruas')
    .select('nome_oficial, bairros(nome)')
    .not('bairro_id', 'is', null)

  if (error || !data) return []
  const shuffled = data.filter((r) => r.bairros?.nome).sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 8).map((r) => ({
    id: `${r.nome_oficial}::${r.bairros.nome}`,
    rua: r.nome_oficial,
    bairro: r.bairros.nome,
  }))
}

export default function AssociacaoPage() {
  const [fase, setFase] = useState('setup')
  const [nome, setNome] = useState('')
  const [pares, setPares] = useState([])
  const [ruasCol, setRuasCol] = useState([])
  const [bairrosCol, setBairrosCol] = useState([])
  const [matched, setMatched] = useState(() => new Set())
  const [selected, setSelected] = useState(null)
  const [flashWrong, setFlashWrong] = useState(() => new Set())
  const [acertos, setAcertos] = useState(0)
  const [segundos, setSegundos] = useState(0)
  const [pontos, setPontos] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  async function iniciar() {
    setLoading(true)
    setError('')
    try {
      const lista = await carregarPares()
      if (lista.length < 2) {
        setError('Não há pares suficientes para o jogo.')
        return
      }
      setPares(lista)
      setRuasCol(shuffle(lista))
      setBairrosCol(shuffle(lista))
      setMatched(new Set())
      setSelected(null)
      setFlashWrong(new Set())
      setAcertos(0)
      setSegundos(0)
      setFase('game')
      clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    } catch (err) {
      console.error(err)
      setError('Não foi possível iniciar o jogo.')
    } finally {
      setLoading(false)
    }
  }

  function finalizar(acertosFinais, tempo) {
    clearInterval(timerRef.current)
    const score = Math.max(acertosFinais * 100 - tempo * 2, 50)
    setPontos(score)
    setFase('result')
    supabase
      .from('pontuacoes')
      .insert({
        jogador_nome: nome.trim() || 'Anônimo',
        jogo: 'associacao',
        pontos: score,
      })
      .then(() => {})
      .catch((e) => console.warn(e))
  }

  function escolher(tipo, par) {
    if (matched.has(par.id) || fase !== 'game') return

    if (!selected) {
      setSelected({ tipo, par })
      return
    }

    if (selected.tipo === tipo) {
      setSelected({ tipo, par })
      return
    }

    const ruaPar = tipo === 'rua' ? par : selected.par
    const bairroPar = tipo === 'bairro' ? par : selected.par
    const ok = ruaPar.bairro === bairroPar.bairro

    if (ok) {
      const nextMatched = new Set(matched)
      nextMatched.add(ruaPar.id)
      nextMatched.add(bairroPar.id)
      // same id for both since id is rua::bairro
      nextMatched.add(par.id)
      nextMatched.add(selected.par.id)
      setMatched(nextMatched)
      const nextAcertos = acertos + 1
      setAcertos(nextAcertos)
      setSelected(null)
      if (nextAcertos >= pares.length) finalizar(nextAcertos, segundos)
    } else {
      const wrong = new Set([par.id, selected.par.id])
      setFlashWrong(wrong)
      setSelected(null)
      setTimeout(() => setFlashWrong(new Set()), 800)
    }
  }

  function itemClass(par, tipo) {
    let cls = 'assoc-item'
    if (matched.has(par.id)) cls += ' correct matched'
    else if (flashWrong.has(par.id)) cls += ' wrong'
    else if (selected?.tipo === tipo && selected.par.id === par.id) cls += ' selected'
    return cls
  }

  return (
    <>
      <GameChrome />
      <div className="assoc-container">
        {fase === 'setup' && (
          <div className="assoc-header">
            <h1>
              <i className="bi bi-link-45deg me-2" aria-hidden="true" />
              Jogo de Associação
            </h1>
            <p>Conecte cada rua ao seu bairro correto</p>
            <input
              className="form-control form-control-sm mb-2"
              style={{ maxWidth: 250, margin: '0 auto' }}
              placeholder="Seu nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            {error && <p className="text-danger">{error}</p>}
            <button type="button" className="btn btn-primary" disabled={loading} onClick={iniciar}>
              {loading ? 'Carregando…' : 'Iniciar Jogo'}
            </button>
          </div>
        )}

        {fase === 'game' && (
          <>
            <div className="assoc-stats">
              <span>
                <i className="bi bi-check-circle me-1" aria-hidden="true" />
                Acertos: <strong>{acertos}</strong>/{pares.length}
              </span>
              <span>
                <i className="bi bi-clock me-1" aria-hidden="true" />
                Tempo: <strong>{segundos}</strong>s
              </span>
            </div>
            <div className="assoc-board">
              <div className="assoc-column">
                <h3>
                  <i className="bi bi-signpost-2 me-1" aria-hidden="true" />
                  Ruas
                </h3>
                {ruasCol.map((p) => (
                  <button
                    key={`rua-${p.id}`}
                    type="button"
                    className={itemClass(p, 'rua')}
                    disabled={matched.has(p.id)}
                    onClick={() => escolher('rua', p)}
                  >
                    {p.rua}
                  </button>
                ))}
              </div>
              <div className="assoc-column">
                <h3>
                  <i className="bi bi-geo-alt me-1" aria-hidden="true" />
                  Bairros
                </h3>
                {bairrosCol.map((p) => (
                  <button
                    key={`bairro-${p.id}`}
                    type="button"
                    className={itemClass(p, 'bairro')}
                    disabled={matched.has(p.id)}
                    onClick={() => escolher('bairro', p)}
                  >
                    {p.bairro}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {fase === 'result' && (
          <div className="assoc-result">
            <h2>Jogo Finalizado!</h2>
            <div className="assoc-score">{pontos}</div>
            <p style={{ color: 'var(--medium-gray)' }}>
              {acertos} de {pares.length} acertos em {segundos}s
            </p>
            <div className="mt-3">
              <button type="button" className="btn btn-primary me-2" onClick={iniciar}>
                Jogar Novamente
              </button>
              <a href="./ranking.html" className="btn btn-outline-secondary">
                Ranking
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
