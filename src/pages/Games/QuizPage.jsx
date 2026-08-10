import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { GameChrome } from '@components/layout/GameChrome.jsx'

const TOTAL = 10
const TEMPO = 30

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function gerarOpcoes(correta, pool) {
  const outras = pool.filter((o) => o !== correta).sort(() => Math.random() - 0.5).slice(0, 3)
  return shuffle([correta, ...outras])
}

function gerarPerguntas(ruas, bairros) {
  const perguntas = []
  const shuffled = shuffle(ruas)
  const nomesBairros = bairros.map((b) => b.nome)
  const nomesRuas = ruas.map((r) => r.nome_oficial)

  for (let i = 0; i < Math.min(TOTAL, shuffled.length); i++) {
    const rua = shuffled[i]
    if (Math.random() > 0.5 && rua.bairros?.nome) {
      const correto = rua.bairros.nome
      perguntas.push({
        texto: `Em qual bairro fica a rua "${rua.nome_oficial}"?`,
        opcoes: gerarOpcoes(correto, nomesBairros),
        correta: correto,
        acertou: null,
      })
    } else {
      const sig = `${rua.significado.substring(0, 150)}...`
      perguntas.push({
        texto: `Qual rua tem o seguinte significado?\n"${sig}"`,
        opcoes: gerarOpcoes(rua.nome_oficial, nomesRuas),
        correta: rua.nome_oficial,
        acertou: null,
      })
    }
  }
  return perguntas
}

export default function QuizPage() {
  const [fase, setFase] = useState('setup')
  const [nome, setNome] = useState('')
  const [sala, setSala] = useState('')
  const [perguntas, setPerguntas] = useState([])
  const [idx, setIdx] = useState(0)
  const [pontos, setPontos] = useState(0)
  const [tempo, setTempo] = useState(TEMPO)
  const [locked, setLocked] = useState(false)
  const [escolha, setEscolha] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const dataRef = useRef({ ruas: [], bairros: [] })
  const lockedRef = useRef(false)
  const tempoRef = useRef(TEMPO)
  const idxRef = useRef(0)
  const perguntasRef = useRef([])
  const pontosRef = useRef(0)

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])
  useEffect(() => {
    tempoRef.current = tempo
  }, [tempo])
  useEffect(() => {
    idxRef.current = idx
  }, [idx])
  useEffect(() => {
    perguntasRef.current = perguntas
  }, [perguntas])
  useEffect(() => {
    pontosRef.current = pontos
  }, [pontos])

  const irParaResultado = useCallback(async (lista, score) => {
    setFase('result')
    setPerguntas(lista)
    setPontos(score)
    try {
      await supabase.from('pontuacoes').insert({
        jogador_nome: nome.trim() || 'Anônimo',
        jogo: 'quiz',
        pontos: score,
        sala_id: sala.trim() || null,
      })
    } catch (e) {
      console.warn(e)
    }
  }, [nome, sala])

  const responder = useCallback(
    (opcao) => {
      if (lockedRef.current) return
      lockedRef.current = true
      setLocked(true)

      const i = idxRef.current
      const lista = [...perguntasRef.current]
      const p = lista[i]
      if (!p) return

      const acertou = opcao === p.correta
      let score = pontosRef.current
      if (acertou) score += Math.max(100 - (TEMPO - tempoRef.current) * 2, 10)

      lista[i] = { ...p, acertou }
      setPerguntas(lista)
      setPontos(score)
      setEscolha(opcao)

      setTimeout(() => {
        if (i + 1 >= lista.length) {
          irParaResultado(lista, score)
        } else {
          setIdx(i + 1)
          setEscolha(null)
          lockedRef.current = false
          setLocked(false)
          setTempo(TEMPO)
        }
      }, 1200)
    },
    [irParaResultado],
  )

  useEffect(() => {
    if (fase !== 'game' || locked) return undefined
    setTempo(TEMPO)
    const t = setInterval(() => {
      setTempo((s) => {
        if (s <= 1) {
          clearInterval(t)
          responder(null)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [fase, idx, locked, responder])

  async function iniciar() {
    setLoading(true)
    setError('')
    try {
      if (!dataRef.current.ruas.length) {
        const [ruasRes, bairrosRes] = await Promise.all([
          supabase.from('ruas').select('nome_oficial, significado, bairro_id, bairros(nome)'),
          supabase.from('bairros').select('id, nome'),
        ])
        if (ruasRes.error) throw ruasRes.error
        if (bairrosRes.error) throw bairrosRes.error
        dataRef.current.ruas = (ruasRes.data || []).filter((r) => r.significado && r.significado.length > 10)
        dataRef.current.bairros = bairrosRes.data || []
      }
      if (dataRef.current.ruas.length < 4) {
        setError('Não há dados suficientes para gerar o quiz.')
        return
      }
      const lista = gerarPerguntas(dataRef.current.ruas, dataRef.current.bairros)
      setPerguntas(lista)
      setIdx(0)
      setPontos(0)
      setEscolha(null)
      lockedRef.current = false
      setLocked(false)
      setFase('game')
    } catch (err) {
      console.error(err)
      setError('Não foi possível carregar o quiz.')
    } finally {
      setLoading(false)
    }
  }

  function emitirCertificado() {
    const { jsPDF } = globalThis.jspdf || {}
    if (!jsPDF) {
      alert('Biblioteca de PDF não carregada.')
      return
    }
    const pdf = new jsPDF('l', 'mm', 'a4')
    pdf.setFillColor(15, 15, 35)
    pdf.rect(0, 0, 297, 210, 'F')
    pdf.setDrawColor(108, 99, 255)
    pdf.setLineWidth(2)
    pdf.rect(10, 10, 277, 190, 'S')
    pdf.setTextColor(108, 99, 255)
    pdf.setFontSize(28)
    pdf.text('Certificado de Participação', 148.5, 40, { align: 'center' })
    pdf.setTextColor(224, 224, 224)
    pdf.setFontSize(14)
    pdf.text('Toponímia Urbana de Ouro Branco — IFMG', 148.5, 55, { align: 'center' })
    pdf.setFontSize(16)
    pdf.text('Certificamos que', 148.5, 80, { align: 'center' })
    pdf.setFontSize(24)
    pdf.setTextColor(108, 99, 255)
    pdf.text(nome.trim() || 'Participante', 148.5, 95, { align: 'center' })
    pdf.setTextColor(224, 224, 224)
    pdf.setFontSize(14)
    pdf.text(`completou o Quiz Toponímia com ${pontos} pontos`, 148.5, 115, { align: 'center' })
    pdf.setFontSize(12)
    pdf.setTextColor(136, 136, 170)
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 140, { align: 'center' })
    pdf.save(`certificado-quiz-${nome.trim() || 'participante'}.pdf`)
  }

  const atual = perguntas[idx]
  const acertos = perguntas.filter((p) => p.acertou).length
  const pct = perguntas.length ? acertos / perguntas.length : 0

  return (
    <>
      <GameChrome />
      <div className="quiz-container">
        {fase === 'setup' && (
          <>
            <div className="quiz-sala">
              <p>Modo Turma (opcional)</p>
              <div className="d-flex gap-2 justify-content-center flex-wrap">
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 200 }}
                  placeholder="Código da sala"
                  value={sala}
                  onChange={(e) => setSala(e.target.value)}
                />
                <input
                  className="form-control form-control-sm"
                  style={{ maxWidth: 200 }}
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <p className="mt-2" style={{ fontSize: '.8rem' }}>
                Digite seu nome e clique em Iniciar Quiz
              </p>
            </div>
            <div className="quiz-header">
              <h1>
                <i className="bi bi-question-circle me-2" aria-hidden="true" />
                Quiz Toponímia
              </h1>
              <p>Teste seus conhecimentos sobre as ruas de Ouro Branco</p>
              {error && <p className="text-danger">{error}</p>}
              <button type="button" className="btn btn-primary" disabled={loading} onClick={iniciar}>
                {loading ? 'Carregando…' : 'Iniciar Quiz'}
              </button>
            </div>
          </>
        )}

        {fase === 'game' && atual && (
          <>
            <div className="quiz-progress" aria-hidden="true">
              {perguntas.map((p, i) => {
                let cls = ''
                if (i < idx) cls = p.acertou ? 'correct' : 'wrong'
                else if (i === idx) cls = 'current'
                return <div key={i} className={`quiz-dot ${cls}`} />
              })}
            </div>
            <div className="quiz-question">
              <span className="quiz-q-number">
                Pergunta {idx + 1} de {perguntas.length}
              </span>
              <h2 style={{ whiteSpace: 'pre-line' }}>{atual.texto}</h2>
              <div className={`quiz-timer${tempo <= 10 ? ' warning' : ''}`}>
                <i className="bi bi-clock" aria-hidden="true" /> {tempo}s
              </div>
            </div>
            <div className="quiz-options">
              {atual.opcoes.map((op) => {
                let cls = 'quiz-option'
                if (locked) {
                  if (op === atual.correta) cls += ' correct'
                  else if (op === escolha) cls += ' wrong'
                }
                return (
                  <button key={op} type="button" className={cls} disabled={locked} onClick={() => responder(op)}>
                    {op}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {fase === 'result' && (
          <div className="quiz-result">
            <h2>Quiz Finalizado!</h2>
            <div className="quiz-score">{pontos}</div>
            <p style={{ color: 'var(--medium-gray)' }}>
              {acertos} de {perguntas.length} corretas · {Math.round(pct * 100)}% de acerto
            </p>
            <div className="mt-3 d-flex gap-2 justify-content-center flex-wrap">
              <button type="button" className="btn btn-primary" onClick={iniciar}>
                Jogar Novamente
              </button>
              {pct >= 0.7 && (
                <button type="button" className="btn btn-outline-primary" onClick={emitirCertificado}>
                  Certificado
                </button>
              )}
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
