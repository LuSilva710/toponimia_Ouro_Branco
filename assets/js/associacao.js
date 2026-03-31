// ============================================
// JOGO DE ASSOCIAÇÃO - associacao.js
// ============================================
import { supabase } from './supabase-client.js'

let pares = []
let acertos = 0
let segundos = 0
let timerInterval = null
let selecionado = null // { tipo: 'rua'|'bairro', idx, element }
let jogadorNome = ''

async function carregarDados() {
  const { data, error } = await supabase
    .from('ruas')
    .select('nome_oficial, bairros(nome)')
    .not('bairro_id', 'is', null)

  if (error || !data) return []

  // Pegar 8 pares aleatórios únicos por bairro
  const shuffled = data.filter(r => r.bairros?.nome).sort(() => Math.random() - 0.5)
  const usedBairros = new Set()
  const result = []

  for (const r of shuffled) {
    if (result.length >= 8) break
    result.push({ rua: r.nome_oficial, bairro: r.bairros.nome })
  }

  return result
}

function renderJogo() {
  const colunaRuas = document.getElementById('coluna-ruas')
  const colunaBairros = document.getElementById('coluna-bairros')

  // Clear
  colunaRuas.innerHTML = '<h3><i class="bi bi-signpost-2 me-1"></i>Ruas</h3>'
  colunaBairros.innerHTML = '<h3><i class="bi bi-geo-alt me-1"></i>Bairros</h3>'

  // Shuffle ruas and bairros separately
  const ruasShuffled = [...pares].sort(() => Math.random() - 0.5)
  const bairrosShuffled = [...pares].sort(() => Math.random() - 0.5)

  ruasShuffled.forEach((p, i) => {
    const el = document.createElement('div')
    el.className = 'assoc-item'
    el.textContent = p.rua
    el.dataset.bairro = p.bairro
    el.dataset.idx = i
    el.addEventListener('click', () => selecionar('rua', p, el))
    colunaRuas.appendChild(el)
  })

  bairrosShuffled.forEach((p, i) => {
    const el = document.createElement('div')
    el.className = 'assoc-item'
    el.textContent = p.bairro
    el.dataset.bairro = p.bairro
    el.dataset.idx = i
    el.addEventListener('click', () => selecionar('bairro', p, el))
    colunaBairros.appendChild(el)
  })
}

function selecionar(tipo, par, element) {
  if (element.classList.contains('matched')) return

  if (!selecionado) {
    selecionado = { tipo, par, element }
    element.classList.add('selected')
    return
  }

  // If same type, switch selection
  if (selecionado.tipo === tipo) {
    selecionado.element.classList.remove('selected')
    selecionado = { tipo, par, element }
    element.classList.add('selected')
    return
  }

  // Different types - check match
  const ruaPar = tipo === 'rua' ? par : selecionado.par
  const bairroPar = tipo === 'bairro' ? par : selecionado.par

  const match = ruaPar.bairro === bairroPar.bairro

  if (match) {
    element.classList.add('correct', 'matched')
    selecionado.element.classList.add('correct', 'matched')
    selecionado.element.classList.remove('selected')
    acertos++
    document.getElementById('acertos-count').textContent = acertos
  } else {
    element.classList.add('wrong')
    selecionado.element.classList.add('wrong')
    selecionado.element.classList.remove('selected')
    setTimeout(() => {
      element.classList.remove('wrong')
      selecionado?.element?.classList.remove('wrong')
    }, 800)
  }

  selecionado = null

  if (acertos >= pares.length) finalizarJogo()
}

function finalizarJogo() {
  clearInterval(timerInterval)

  const maxPontos = pares.length * 100
  const penalidade = segundos * 2
  const pontos = Math.max(maxPontos - penalidade, 50)

  document.getElementById('game-area').classList.add('d-none')
  document.getElementById('result-area').classList.remove('d-none')
  document.getElementById('result-score').textContent = pontos
  document.getElementById('result-detail').textContent =
    `${acertos} de ${pares.length} acertos em ${segundos}s`

  // Save score
  supabase.from('pontuacoes').insert({
    jogador_nome: jogadorNome || 'Anônimo',
    jogo: 'associacao',
    pontos,
  }).then(() => {}).catch(e => console.warn(e))
}

// ============================================
// INIT
// ============================================
document.getElementById('btn-iniciar')?.addEventListener('click', async () => {
  jogadorNome = document.getElementById('jogador-nome')?.value || 'Anônimo'
  document.querySelector('.assoc-header').classList.add('d-none')
  document.getElementById('game-area').classList.remove('d-none')

  pares = await carregarDados()
  acertos = 0
  segundos = 0
  renderJogo()

  timerInterval = setInterval(() => {
    segundos++
    document.getElementById('tempo').textContent = segundos
  }, 1000)
})

document.getElementById('btn-novamente')?.addEventListener('click', async () => {
  document.getElementById('result-area').classList.add('d-none')
  document.getElementById('game-area').classList.remove('d-none')
  pares = await carregarDados()
  acertos = 0
  segundos = 0
  document.getElementById('acertos-count').textContent = 0
  renderJogo()
  timerInterval = setInterval(() => {
    segundos++
    document.getElementById('tempo').textContent = segundos
  }, 1000)
})
