// ============================================
// QUIZ INTERATIVO - quiz.js
// ============================================
import { supabase } from './supabase-client.js'

const TOTAL_PERGUNTAS = 10
const TEMPO_POR_PERGUNTA = 30

let ruas = []
let bairros = []
let perguntas = []
let perguntaAtual = 0
let pontuacao = 0
let timerInterval = null
let tempoRestante = 0
let salaId = null
let jogadorNome = ''

// ============================================
// LOAD DATA
// ============================================
async function carregarDados() {
  const [ruasRes, bairrosRes] = await Promise.all([
    supabase.from('ruas').select('nome_oficial, significado, bairro_id, bairros(nome)'),
    supabase.from('bairros').select('id, nome'),
  ])
  ruas = (ruasRes.data || []).filter(r => r.significado && r.significado.length > 10)
  bairros = bairrosRes.data || []
}

// ============================================
// GENERATE QUESTIONS
// ============================================
function gerarPerguntas() {
  perguntas = []
  const shuffled = [...ruas].sort(() => Math.random() - 0.5)

  for (let i = 0; i < Math.min(TOTAL_PERGUNTAS, shuffled.length); i++) {
    const rua = shuffled[i]
    const tipo = Math.random() > 0.5 ? 'homenageado' : 'bairro'

    if (tipo === 'bairro' && rua.bairros?.nome) {
      const correto = rua.bairros.nome
      const opcoes = gerarOpcoes(correto, bairros.map(b => b.nome))
      perguntas.push({
        texto: `Em qual bairro fica a rua "${rua.nome_oficial}"?`,
        opcoes,
        correta: correto,
      })
    } else {
      const sig = rua.significado.substring(0, 150) + '...'
      const correto = rua.nome_oficial
      const opcoes = gerarOpcoes(correto, ruas.map(r => r.nome_oficial))
      perguntas.push({
        texto: `Qual rua tem o seguinte significado?\n"${sig}"`,
        opcoes,
        correta: correto,
      })
    }
  }
}

function gerarOpcoes(correta, pool) {
  const outras = pool.filter(o => o !== correta).sort(() => Math.random() - 0.5).slice(0, 3)
  const opcoes = [correta, ...outras].sort(() => Math.random() - 0.5)
  return opcoes
}

// ============================================
// RENDER
// ============================================
function renderProgress() {
  const container = document.getElementById('quiz-progress')
  container.innerHTML = perguntas.map((_, i) => {
    let cls = ''
    if (i < perguntaAtual) cls = perguntas[i].acertou ? 'correct' : 'wrong'
    else if (i === perguntaAtual) cls = 'current'
    return `<div class="quiz-dot ${cls}"></div>`
  }).join('')
}

function renderPergunta() {
  if (perguntaAtual >= perguntas.length) return mostrarResultado()

  const p = perguntas[perguntaAtual]
  document.getElementById('q-number').textContent = `Pergunta ${perguntaAtual + 1} de ${perguntas.length}`
  document.getElementById('q-text').textContent = p.texto

  const container = document.getElementById('quiz-options')
  container.innerHTML = p.opcoes.map((op, i) =>
    `<button class="quiz-option" data-idx="${i}">${op}</button>`
  ).join('')

  container.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => responder(btn.dataset.idx))
  })

  renderProgress()
  iniciarTimer()
}

// ============================================
// TIMER
// ============================================
function iniciarTimer() {
  tempoRestante = TEMPO_POR_PERGUNTA
  const timerEl = document.getElementById('q-timer-text')
  const timerContainer = document.getElementById('q-timer')

  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    tempoRestante--
    timerEl.textContent = `${tempoRestante}s`
    timerContainer.classList.toggle('warning', tempoRestante <= 10)

    if (tempoRestante <= 0) {
      clearInterval(timerInterval)
      responder(-1) // Timeout
    }
  }, 1000)
}

// ============================================
// ANSWER
// ============================================
function responder(idx) {
  clearInterval(timerInterval)

  const p = perguntas[perguntaAtual]
  const opcoes = document.querySelectorAll('.quiz-option')
  opcoes.forEach(btn => btn.disabled = true)

  const respostaSelecionada = idx >= 0 ? p.opcoes[idx] : null
  const acertou = respostaSelecionada === p.correta

  if (acertou) {
    const pontosBase = 100 - ((TEMPO_POR_PERGUNTA - tempoRestante) * 2)
    pontuacao += Math.max(pontosBase, 10)
  }

  p.acertou = acertou

  // Highlight correct/wrong
  opcoes.forEach(btn => {
    const op = p.opcoes[btn.dataset.idx]
    if (op === p.correta) btn.classList.add('correct')
    else if (btn.dataset.idx == idx) btn.classList.add('wrong')
  })

  renderProgress()

  setTimeout(() => {
    perguntaAtual++
    renderPergunta()
  }, 1500)
}

// ============================================
// RESULT
// ============================================
async function mostrarResultado() {
  document.getElementById('quiz-game').classList.add('d-none')
  document.getElementById('quiz-result').classList.remove('d-none')

  const acertos = perguntas.filter(p => p.acertou).length
  document.getElementById('result-score').textContent = pontuacao
  document.getElementById('result-detail').textContent =
    `${acertos} de ${perguntas.length} corretas • ${Math.round((acertos / perguntas.length) * 100)}% de acerto`

  // Show/hide certificate button
  const pct = acertos / perguntas.length
  document.getElementById('btn-certificado').classList.toggle('d-none', pct < 0.7)

  // Save score
  try {
    await supabase.from('pontuacoes').insert({
      jogador_nome: jogadorNome || 'Anônimo',
      jogo: 'quiz',
      pontos: pontuacao,
      sala_id: salaId || null,
    })
  } catch (e) { console.warn('Não foi possível salvar pontuação:', e) }
}

// ============================================
// CERTIFICATE
// ============================================
document.getElementById('btn-certificado')?.addEventListener('click', () => {
  const { jsPDF } = window.jspdf
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
  pdf.text(`Certificamos que`, 148.5, 80, { align: 'center' })

  pdf.setFontSize(24)
  pdf.setTextColor(108, 99, 255)
  pdf.text(jogadorNome || 'Participante', 148.5, 95, { align: 'center' })

  pdf.setTextColor(224, 224, 224)
  pdf.setFontSize(14)
  pdf.text(`completou o Quiz Toponímia com ${pontuacao} pontos`, 148.5, 115, { align: 'center' })

  pdf.setFontSize(12)
  pdf.setTextColor(136, 136, 170)
  pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 148.5, 140, { align: 'center' })

  pdf.save(`certificado-quiz-${jogadorNome || 'participante'}.pdf`)
})

// ============================================
// INIT
// ============================================
document.getElementById('btn-iniciar')?.addEventListener('click', async () => {
  jogadorNome = document.getElementById('jogador-nome')?.value || 'Anônimo'
  salaId = document.getElementById('sala-codigo')?.value || null

  document.querySelector('.quiz-header').classList.add('d-none')
  document.getElementById('sala-section').classList.add('d-none')
  document.getElementById('quiz-game').classList.remove('d-none')

  await carregarDados()
  gerarPerguntas()
  renderPergunta()
})

document.getElementById('btn-jogar-novamente')?.addEventListener('click', () => {
  perguntaAtual = 0
  pontuacao = 0
  document.getElementById('quiz-result').classList.add('d-none')
  document.getElementById('quiz-game').classList.remove('d-none')
  gerarPerguntas()
  renderPergunta()
})
