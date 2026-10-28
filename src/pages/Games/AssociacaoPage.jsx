import { useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { GameChrome } from '@components/layout/GameChrome.jsx'
import { salvarPontuacao } from './scoreApi.js'

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
  // Sem pares repetidos (mesma rua no mesmo bairro): o id identifica o botão na tela
  const unicos = [...new Map(shuffled.map((r) => [`${r.nome_oficial}::${r.bairros.nome}`, r])).values()]
  return unicos.slice(0, 8).map((r) => ({
    id: `${r.nome_oficial}::${r.bairros.nome}`,
    rua: r.nome_oficial,
    bairro: r.bairros.nome,
  }))
}

/** Cada par aparece duas vezes (uma por coluna): o estado é por botão, não por par. */
const chave = (tipo, par) => `${tipo}:${par.id}`

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
  const [rankingFalhou, setRankingFalhou] = useState(false)
  const timerRef = useRef(null)
  const flashRef = useRef(null)

  useEffect(() => () => {
    clearInterval(timerRef.current)
    clearTimeout(flashRef.current)
  }, [])

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
      clearTimeout(flashRef.current)
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
    setRankingFalhou(false)
    salvarPontuacao({ jogo: 'associacao', nome, pontos: score }).then((ok) => setRankingFalhou(!ok))
  }

  function escolher(tipo, par) {
    if (matched.has(chave(tipo, par)) || fase !== 'game') return

    // Primeiro clique, troca dentro da mesma coluna, ou clique de novo para desmarcar
    if (!selected || selected.tipo === tipo) {
      const mesmo = selected && chave(selected.tipo, selected.par) === chave(tipo, par)
      setSelected(mesmo ? null : { tipo, par })
      return
    }

    const ruaPar = tipo === 'rua' ? par : selected.par
    const bairroPar = tipo === 'bairro' ? par : selected.par
    // Compara pelo nome do bairro: há bairros repetidos na coluna (várias ruas no mesmo bairro)
    const ok = ruaPar.bairro === bairroPar.bairro

    if (ok) {
      const nextMatched = new Set(matched)
      nextMatched.add(chave('rua', ruaPar))
      nextMatched.add(chave('bairro', bairroPar))
      setMatched(nextMatched)
      const nextAcertos = acertos + 1
      setAcertos(nextAcertos)
      setSelected(null)
      if (nextAcertos >= pares.length) finalizar(nextAcertos, segundos)
    } else {
      setFlashWrong(new Set([chave('rua', ruaPar), chave('bairro', bairroPar)]))
      setSelected(null)
      clearTimeout(flashRef.current)
      flashRef.current = setTimeout(() => setFlashWrong(new Set()), 800)
    }
  }

  function itemClass(par, tipo) {
    const k = chave(tipo, par)
    let cls = 'assoc-item'
    if (matched.has(k)) cls += ' correct matched'
    else if (flashWrong.has(k)) cls += ' wrong'
    else if (selected && chave(selected.tipo, selected.par) === k) cls += ' selected'
    return cls
  }

  return (
    <>
      <GameChrome />
      <div className="assoc-container">
        {fase === 'setup' && (
          <>
            <div className="assoc-header faixa-titulo">
              <h1>
                <i className="bi bi-link-45deg me-2" aria-hidden="true" />
                Jogo de Associação
              </h1>
              <p>Conecte cada rua ao seu bairro correto</p>
            </div>
            <div className="assoc-inicio">
              <input
                className="form-control mb-3"
                style={{ maxWidth: 260, margin: '0 auto' }}
                placeholder="Seu nome"
                aria-label="Seu nome"
                maxLength={40}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
              {error && <p className="text-danger">{error}</p>}
              <button type="button" className="btn btn-primary btn-lg" disabled={loading} onClick={iniciar}>
                <i className="bi bi-play-fill me-1" aria-hidden="true" />
                {loading ? 'Carregando…' : 'Iniciar Jogo'}
              </button>
            </div>
          </>
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
                    disabled={matched.has(chave('rua', p))}
                    aria-pressed={selected ? chave(selected.tipo, selected.par) === chave('rua', p) : false}
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
                    disabled={matched.has(chave('bairro', p))}
                    aria-pressed={selected ? chave(selected.tipo, selected.par) === chave('bairro', p) : false}
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
            {rankingFalhou && (
              <p className="text-warning" style={{ fontSize: '.85rem' }}>
                Não foi possível salvar sua pontuação no ranking.
              </p>
            )}
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
