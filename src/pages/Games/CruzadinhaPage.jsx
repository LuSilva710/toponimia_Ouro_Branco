import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { GameChrome } from '@components/layout/GameChrome.jsx'
import {
  CRUZADINHA_WORDS,
  GRID_SIZE,
  buildGrid,
  countCompleted,
  emptyBoolGrid,
  emptyGrid,
  formatTime,
  isWordComplete,
} from './cruzadinhaData.js'

function cloneGrid(grid) {
  return grid.map((row) => [...row])
}

function fireConfetti() {
  const ConfettiGenerator = globalThis.ConfettiGenerator
  if (!ConfettiGenerator) return

  let canvas = document.getElementById('confetti-canvas')
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.id = 'confetti-canvas'
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9999',
    })
    document.body.appendChild(canvas)
  }

  const confetti = new ConfettiGenerator({ target: 'confetti-canvas', max: 150 })
  confetti.render()
  setTimeout(() => {
    confetti.clear()
    canvas.remove()
  }, 5000)
}

export default function CruzadinhaPage() {
  const gridModel = useMemo(() => buildGrid(CRUZADINHA_WORDS), [])
  const {
    correctLetters,
    cellIsPartOfWord,
    cellToWordIndices,
    wordEntries,
    totalCells,
    positionMarkers,
  } = gridModel

  const [userAnswers, setUserAnswers] = useState(() => emptyGrid(''))
  const [revealed, setRevealed] = useState(() => emptyBoolGrid())
  const [cellMarks, setCellMarks] = useState(() => emptyGrid('')) // '' | 'correct' | 'incorrect'
  const [activeWordIndex, setActiveWordIndex] = useState(-1)
  const [seconds, setSeconds] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [status, setStatus] = useState({ text: 'Complete a cruzadinha!', color: 'inherit' })
  const [won, setWon] = useState(false)
  const [jogadorNome, setJogadorNome] = useState('')
  const [score, setScore] = useState(null)

  const wrapperRef = useRef(null)
  const inputRefs = useRef(new Map())
  const activeWordRef = useRef(-1)
  const wonRef = useRef(false)
  const answersRef = useRef(userAnswers)
  const revealedRef = useRef(revealed)
  const secondsRef = useRef(0)
  const hintsRef = useRef(0)

  useEffect(() => {
    activeWordRef.current = activeWordIndex
  }, [activeWordIndex])
  useEffect(() => {
    answersRef.current = userAnswers
  }, [userAnswers])
  useEffect(() => {
    revealedRef.current = revealed
  }, [revealed])
  useEffect(() => {
    secondsRef.current = seconds
  }, [seconds])
  useEffect(() => {
    hintsRef.current = hintsUsed
  }, [hintsUsed])
  useEffect(() => {
    wonRef.current = won
  }, [won])

  const completedCells = useMemo(
    () => countCompleted(userAnswers, correctLetters, cellIsPartOfWord),
    [userAnswers, correctLetters, cellIsPartOfWord],
  )
  const progressPct = totalCells > 0 ? (completedCells / totalCells) * 100 : 0

  const completedWords = useMemo(
    () => wordEntries.map((entry) => isWordComplete(entry, userAnswers, correctLetters)),
    [wordEntries, userAnswers, correctLetters],
  )

  useEffect(() => {
    if (won) return undefined
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [won])

  const focusCell = useCallback((row, col) => {
    const key = `${row},${col}`
    const el = inputRefs.current.get(key)
    if (el && !el.disabled) {
      el.focus()
      el.select()
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [])

  const highlightWord = useCallback((wordIdx) => {
    if (wordIdx < 0 || wordIdx >= wordEntries.length) return
    setActiveWordIndex(wordIdx)
  }, [wordEntries.length])

  const winGame = useCallback(async () => {
    if (wonRef.current) return
    wonRef.current = true
    setWon(true)

    const finalScore = Math.max(
      100,
      1000 - secondsRef.current * 2 - hintsRef.current * 50,
    )
    setScore(finalScore)
    setStatus({
      text: 'Parabéns! Você completou o jogo com sucesso!',
      color: '#2c6e49',
    })

    try {
      await supabase.from('pontuacoes').insert({
        jogador_nome: jogadorNome.trim() || 'Anônimo',
        jogo: 'cruzadinha',
        pontos: finalScore,
      })
    } catch (error) {
      console.error('Erro ao salvar pontuação:', error)
    }

    setTimeout(fireConfetti, 400)
  }, [jogadorNome])

  const maybeWin = useCallback(
    (answers) => {
      const done = countCompleted(answers, correctLetters, cellIsPartOfWord)
      if (done === totalCells) winGame()
    },
    [correctLetters, cellIsPartOfWord, totalCells, winGame],
  )

  const advanceToNextCell = useCallback(
    (row, col) => {
      const wordIdx = activeWordRef.current
      if (wordIdx < 0 || wordIdx >= wordEntries.length) return
      const entry = wordEntries[wordIdx]
      const currentIdx = entry.positions.findIndex((p) => p.row === row && p.col === col)
      if (currentIdx < 0) return

      for (let i = currentIdx + 1; i < entry.positions.length; i++) {
        const next = entry.positions[i]
        if (!revealedRef.current[next.row][next.col]) {
          focusCell(next.row, next.col)
          return
        }
      }
    },
    [wordEntries, focusCell],
  )

  const retreatToPreviousCell = useCallback(
    (row, col) => {
      const wordIdx = activeWordRef.current
      if (wordIdx < 0 || wordIdx >= wordEntries.length) return
      const entry = wordEntries[wordIdx]
      const currentIdx = entry.positions.findIndex((p) => p.row === row && p.col === col)
      if (currentIdx <= 0) return

      for (let i = currentIdx - 1; i >= 0; i--) {
        const prev = entry.positions[i]
        if (!revealedRef.current[prev.row][prev.col]) {
          focusCell(prev.row, prev.col)
          return
        }
      }
    },
    [wordEntries, focusCell],
  )

  const setAnswerAt = useCallback(
    (row, col, value) => {
      setUserAnswers((prev) => {
        const next = cloneGrid(prev)
        next[row][col] = value
        answersRef.current = next
        maybeWin(next)
        return next
      })
      setCellMarks((prev) => {
        if (!prev[row][col]) return prev
        const next = cloneGrid(prev)
        next[row][col] = ''
        return next
      })
    },
    [maybeWin],
  )

  const handleInput = useCallback(
    (row, col, raw) => {
      if (wonRef.current) return
      const value = raw.toUpperCase().slice(0, 1)
      setAnswerAt(row, col, value)
      if (value !== '') advanceToNextCell(row, col)
    },
    [setAnswerAt, advanceToNextCell],
  )

  const handleFocus = useCallback(
    (row, col) => {
      const indices = cellToWordIndices[row][col]
      if (!indices.length) return
      if (indices.includes(activeWordRef.current)) {
        highlightWord(activeWordRef.current)
        return
      }
      highlightWord(indices[0])
    },
    [cellToWordIndices, highlightWord],
  )

  const handleClick = useCallback(
    (row, col) => {
      const indices = cellToWordIndices[row][col]
      if (!indices.length) return
      if (indices.length > 1 && indices.includes(activeWordRef.current)) {
        const pos = indices.indexOf(activeWordRef.current)
        highlightWord(indices[(pos + 1) % indices.length])
      } else {
        highlightWord(indices[0])
      }
    },
    [cellToWordIndices, highlightWord],
  )

  const handleKeyDown = useCallback(
    (event, row, col) => {
      if (event.key === 'Backspace') {
        if ((answersRef.current[row][col] || '') === '') {
          event.preventDefault()
          retreatToPreviousCell(row, col)
        } else {
          setAnswerAt(row, col, '')
        }
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const direction = event.shiftKey ? -1 : 1
        let nextWordIdx = activeWordRef.current + direction
        if (nextWordIdx >= wordEntries.length) nextWordIdx = 0
        if (nextWordIdx < 0) nextWordIdx = wordEntries.length - 1
        highlightWord(nextWordIdx)

        const entry = wordEntries[nextWordIdx]
        const emptyPos =
          entry.positions.find(
            (p) =>
              !revealedRef.current[p.row][p.col] &&
              (answersRef.current[p.row][p.col] || '') === '',
          ) ||
          entry.positions.find((p) => !revealedRef.current[p.row][p.col]) ||
          entry.positions[0]
        focusCell(emptyPos.row, emptyPos.col)
        return
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      let nextRow = row
      let nextCol = col
      if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1)
      if (event.key === 'ArrowDown') nextRow = Math.min(GRID_SIZE - 1, row + 1)
      if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1)
      if (event.key === 'ArrowRight') nextCol = Math.min(GRID_SIZE - 1, col + 1)
      if (cellIsPartOfWord[nextRow][nextCol]) focusCell(nextRow, nextCol)
    },
    [
      retreatToPreviousCell,
      setAnswerAt,
      wordEntries,
      highlightWord,
      focusCell,
      cellIsPartOfWord,
    ],
  )

  const focusWord = useCallback(
    (wordIdx) => {
      highlightWord(wordIdx)
      const entry = wordEntries[wordIdx]
      if (!entry) return
      const target =
        entry.positions.find(
          (p) =>
            !revealedRef.current[p.row][p.col] &&
            (answersRef.current[p.row][p.col] || '') === '',
        ) ||
        entry.positions.find((p) => !revealedRef.current[p.row][p.col]) ||
        entry.positions[0]
      focusCell(target.row, target.col)
    },
    [highlightWord, wordEntries, focusCell],
  )

  function giveHint() {
    if (won) return
    const eligible = wordEntries.filter((entry) =>
      entry.positions.some((pos) => !revealedRef.current[pos.row][pos.col]),
    )
    if (!eligible.length) {
      setStatus({ text: 'Todas as dicas já foram reveladas!', color: '#666' })
      return
    }

    const entry = eligible[Math.floor(Math.random() * eligible.length)]
    const unrevealed = entry.positions.filter((pos) => !revealedRef.current[pos.row][pos.col])
    const pos = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    const letter = correctLetters[pos.row][pos.col]

    setRevealed((prev) => {
      const next = cloneGrid(prev)
      next[pos.row][pos.col] = true
      revealedRef.current = next
      return next
    })
    setAnswerAt(pos.row, pos.col, letter)
    const nextHints = hintsRef.current + 1
    hintsRef.current = nextHints
    setHintsUsed(nextHints)
    setStatus({
      text: `Dica revelada! (${nextHints} dica${nextHints > 1 ? 's' : ''} usada${nextHints > 1 ? 's' : ''})`,
      color: '#666',
    })
    setTimeout(() => {
      if (!wonRef.current) {
        setStatus({ text: 'Continue preenchendo o jogo!', color: 'inherit' })
      }
    }, 3000)
  }

  function checkAnswers() {
    if (won) return
    let allCorrect = true
    let errorsFound = 0
    let emptyCells = 0
    const marks = emptyGrid('')

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!cellIsPartOfWord[r][c] || revealed[r][c]) continue
        const userInput = (userAnswers[r][c] || '').toUpperCase()
        const correct = correctLetters[r][c]
        if (userInput === '') {
          emptyCells++
          allCorrect = false
        } else if (userInput !== correct) {
          allCorrect = false
          errorsFound++
          marks[r][c] = 'incorrect'
        } else {
          marks[r][c] = 'correct'
        }
      }
    }

    setCellMarks(marks)

    if (emptyCells > 0 && errorsFound === 0) {
      setStatus({
        text: `Ainda faltam ${emptyCells} célula${emptyCells > 1 ? 's' : ''} vazias. Continue preenchendo!`,
        color: '#888',
      })
    } else if (allCorrect && emptyCells === 0) {
      winGame()
    } else if (errorsFound > 0) {
      setStatus({
        text: `Encontrado${errorsFound > 1 ? 's' : ''} ${errorsFound} erro${errorsFound > 1 ? 's' : ''}. Continue tentando!`,
        color: '#d1495b',
      })
    } else {
      setStatus({
        text: 'Todas as respostas estão corretas até agora! Continue!',
        color: '#2c6e49',
      })
    }
  }

  function resetGame() {
    setUserAnswers(emptyGrid(''))
    setRevealed(emptyBoolGrid())
    setCellMarks(emptyGrid(''))
    setActiveWordIndex(-1)
    setSeconds(0)
    setHintsUsed(0)
    setWon(false)
    wonRef.current = false
    setScore(null)
    setStatus({ text: 'Jogo reiniciado! Boa sorte!', color: 'inherit' })
    setTimeout(() => {
      setStatus({
        text: 'Preencha o jogo de palavras cruzadas com os nomes das escolas!',
        color: 'inherit',
      })
    }, 2000)
  }

  // Tamanho dinâmico das células
  useEffect(() => {
    function calculateCellSize() {
      const wrapper = wrapperRef.current
      if (!wrapper || wrapper.clientWidth === 0) return
      const availableWidth = wrapper.clientWidth - 2
      const availableHeight = wrapper.clientHeight - 2
      const sizeBasedOnWidth = availableWidth / GRID_SIZE
      const sizeBasedOnHeight =
        availableHeight > 100 ? availableHeight / GRID_SIZE : sizeBasedOnWidth
      let cellSize = Math.min(sizeBasedOnWidth, sizeBasedOnHeight)
      if (cellSize < 5) cellSize = 15

      wrapper.querySelectorAll('.grid-cell').forEach((cell) => {
        cell.style.width = `${cellSize}px`
        cell.style.height = `${cellSize}px`
        const input = cell.querySelector('input')
        if (input) input.style.fontSize = `${cellSize * 0.6}px`
        const marker = cell.querySelector('.word-number')
        if (marker) marker.style.fontSize = `${cellSize * 0.5}px`
      })
    }

    calculateCellSize()
    const t = setTimeout(calculateCellSize, 100)
    window.addEventListener('resize', calculateCellSize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', calculateCellSize)
    }
  }, [])

  const cells = []
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = `${row},${col}`
      if (!cellIsPartOfWord[row][col]) {
        cells.push(<div key={key} className="grid-cell empty" />)
        continue
      }

      const isRevealed = revealed[row][col]
      const value = isRevealed ? correctLetters[row][col] : userAnswers[row][col] || ''
      const mark = cellMarks[row][col]
      const wordIndices = cellToWordIndices[row][col]
      const isHighlighted = wordIndices.includes(activeWordIndex)
      const isWordDone = wordIndices.some((i) => completedWords[i])
      const marker = positionMarkers[key]
      const ariaWords = wordIndices.map((i) => `Palavra ${i + 1}`).join(', ')

      cells.push(
        <div
          key={key}
          className={[
            'grid-cell',
            isHighlighted ? 'highlighted' : '',
            isWordDone ? 'word-complete' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="gridcell"
        >
          {marker != null && <span className="word-number">{marker}</span>}
          <input
            ref={(el) => {
              if (el) inputRefs.current.set(key, el)
              else inputRefs.current.delete(key)
            }}
            maxLength={1}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isRevealed || won}
            value={value}
            aria-label={`Linha ${row + 1}, Coluna ${col + 1} — ${ariaWords}`}
            className={[isRevealed ? 'revealed' : '', mark].filter(Boolean).join(' ')}
            onChange={(e) => handleInput(row, col, e.target.value)}
            onFocus={() => handleFocus(row, col)}
            onClick={() => handleClick(row, col)}
            onKeyDown={(e) => handleKeyDown(e, row, col)}
          />
        </div>,
      )
    }
  }

  return (
    <>
      <GameChrome />

      <div className="game-container">
        <h1 className="game-title">Palavras Cruzadas</h1>

        <div className="game-header">
          <div className="controls">
            <button type="button" className="game-button check" onClick={checkAnswers}>
              <i className="bi bi-check-circle" aria-hidden="true" /> Verificar
            </button>
            <button type="button" className="game-button hint" onClick={giveHint}>
              <i className="bi bi-lightbulb" aria-hidden="true" /> Dica
            </button>
            <button type="button" className="game-button restart" onClick={resetGame}>
              <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Reiniciar
            </button>
          </div>
          <div id="timer">
            <i className="bi bi-clock" aria-hidden="true" /> {formatTime(seconds)}
          </div>
        </div>

        <div className="mb-3" style={{ maxWidth: 320 }}>
          <label htmlFor="jogador-nome" className="form-label small mb-1">
            Seu nome (ranking)
          </label>
          <input
            id="jogador-nome"
            className="form-control form-control-sm"
            value={jogadorNome}
            onChange={(e) => setJogadorNome(e.target.value)}
            placeholder="Anônimo"
            disabled={won}
          />
        </div>

        <div className="game-content">
          <div className="crossword-section">
            <div className="crossword-scroll-wrapper">
              <div className="scroll-hint">
                <i className="bi bi-arrows-expand" aria-hidden="true" />
                Role para ver tudo
              </div>
              <div
                id="crossword-container"
                ref={wrapperRef}
                role="grid"
                aria-label="Grade de palavras cruzadas"
              >
                <div
                  id="crossword"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                    gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                  }}
                >
                  {cells}
                </div>
              </div>
            </div>
          </div>

          <div className="clues-section">
            <h2>Dicas - Escolas</h2>
            <ul id="clues-list">
              {CRUZADINHA_WORDS.map((item, index) => {
                const done = completedWords[index]
                const active = activeWordIndex === index
                const dirIcon = item.direction === 'horizontal' ? '→' : '↓'
                const dirLabel = item.direction === 'horizontal' ? 'Horizontal' : 'Vertical'
                return (
                  <li
                    key={item.word}
                    className={active ? 'clue-active' : ''}
                    aria-current={active ? 'true' : undefined}
                    data-word-index={index}
                    onClick={() => focusWord(index)}
                    style={{
                      opacity: done ? 0.6 : 1,
                      textDecoration: done ? 'line-through' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{index + 1}</strong>
                    <span className="clue-direction" title={dirLabel}>
                      {dirIcon}
                    </span>{' '}
                    {item.clue}
                  </li>
                )
              })}
            </ul>

            <div className="game-status">
              <div id="status-message" aria-live="polite" role="status" style={{ color: status.color }}>
                {status.text}
                {won && score != null ? ` Pontuação: ${score}` : ''}
              </div>
              <div className="progress-container">
                <div id="progress-bar" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
