// ============================================
// ESTATÍSTICAS - estatisticas.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CHART COLORS
// ============================================
const CORES = {
  antropotoponimo: '#2563eb',
  fitotoponimo: '#16a34a',
  ergotoponimo: '#ea580c',
  axiotoponimo: '#9333ea',
  hagiotoponimo: '#ca8a04',
  outro: '#6b7280',
}

const CORES_GENERO = {
  masculino: '#3b82f6',
  feminino: '#ec4899',
  neutro: '#8b5cf6',
}

const STOPWORDS = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'na', 'no', 'ao', 'das', 'dos', 'foi', 'ser', 'seu', 'sua', 'ele', 'ela', 'são', 'era', 'isso', 'esse', 'essa', 'este', 'esta', 'muito', 'tem', 'entre', 'já', 'também', 'após', 'até', 'onde', 'quando', 'qual', 'quais', 'sobre', 'grande', 'cidade', 'ouro', 'branco']

// ============================================
// LOAD DATA
// ============================================
async function carregarDados() {
  try {
    const [ruasRes, bairrosRes] = await Promise.all([
      supabase.from('ruas').select('*, bairros(nome)'),
      supabase.from('bairros').select('id, nome').order('nome'),
    ])

    if (ruasRes.error) throw ruasRes.error
    if (bairrosRes.error) throw bairrosRes.error

    const ruas = ruasRes.data || []
    const bairros = bairrosRes.data || []

    // Summary cards
    document.getElementById('total-ruas').textContent = ruas.length
    document.getElementById('total-bairros').textContent = bairros.length

    const comCategoria = ruas.filter(r => r.categoria_toponimica)
    const comGenero = ruas.filter(r => r.genero_homenageado)
    const homenageados = ruas.filter(r => r.significado && r.significado.length > 10)
    const incompletas = ruas.filter(r => !r.categoria_toponimica || !r.genero_homenageado)

    document.getElementById('total-homenageados').textContent = homenageados.length
    document.getElementById('total-incompletas').textContent = incompletas.length

    // Coverage warning
    if (comCategoria.length < ruas.length * 0.5) {
      const alerta = document.getElementById('alerta-cobertura')
      alerta.classList.remove('d-none')
      document.getElementById('texto-cobertura').textContent =
        `Dados ainda sendo preenchidos pelo admin. ${comCategoria.length} de ${ruas.length} ruas classificadas.`
    }

    // Render charts
    renderCategorias(ruas)
    renderGenero(ruas)
    renderBairros(ruas, bairros)
    renderTimeline(ruas)
    renderWordCloud(ruas)
  } catch (err) {
    console.error('Erro ao carregar estatísticas:', err)
  }
}

// ============================================
// CHART: Categorias (Doughnut)
// ============================================
function renderCategorias(ruas) {
  const contagem = {}
  ruas.forEach(r => {
    const cat = r.categoria_toponimica || 'outro'
    contagem[cat] = (contagem[cat] || 0) + 1
  })

  const labels = Object.keys(contagem).map(k => k.charAt(0).toUpperCase() + k.slice(1))
  const data = Object.values(contagem)
  const colors = Object.keys(contagem).map(k => CORES[k] || CORES.outro)

  new Chart(document.getElementById('chart-categorias'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#444', padding: 15 } },
      },
    },
  })
}

// ============================================
// CHART: Gênero (Horizontal Bars)
// ============================================
function renderGenero(ruas) {
  const contagem = { masculino: 0, feminino: 0, neutro: 0 }
  ruas.forEach(r => {
    const g = r.genero_homenageado || 'neutro'
    contagem[g] = (contagem[g] || 0) + 1
  })

  new Chart(document.getElementById('chart-genero'), {
    type: 'bar',
    data: {
      labels: ['Masculino', 'Feminino', 'Neutro'],
      datasets: [{
        data: [contagem.masculino, contagem.feminino, contagem.neutro],
        backgroundColor: [CORES_GENERO.masculino, CORES_GENERO.feminino, CORES_GENERO.neutro],
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#444' }, grid: { display: false } },
      },
    },
  })
}

// ============================================
// CHART: Bairros (Top 10)
// ============================================
function renderBairros(ruas, bairros) {
  const contagem = {}
  ruas.forEach(r => {
    const nome = r.bairros?.nome || 'Desconhecido'
    contagem[nome] = (contagem[nome] || 0) + 1
  })

  const sorted = Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, 10)

  new Chart(document.getElementById('chart-bairros'), {
    type: 'bar',
    data: {
      labels: sorted.map(s => s[0]),
      datasets: [{
        data: sorted.map(s => s[1]),
        backgroundColor: '#222',
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#444', maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
      },
    },
  })
}

// ============================================
// CHART: Timeline (Décadas)
// ============================================
function renderTimeline(ruas) {
  const contagem = {}

  ruas.forEach(r => {
    let decada = r.decada_nomeacao
    if (!decada && r.legislacao) {
      const match = r.legislacao.match(/\b(19|20)\d{2}\b/)
      if (match) decada = Math.floor(parseInt(match[0]) / 10) * 10
    }
    if (decada) {
      contagem[decada] = (contagem[decada] || 0) + 1
    }
  })

  const decadas = Object.keys(contagem).sort()
  if (decadas.length === 0) {
    document.getElementById('chart-timeline').parentElement.innerHTML +=
      '<p class="text-muted text-center">Dados de década ainda não preenchidos.</p>'
    return
  }

  new Chart(document.getElementById('chart-timeline'), {
    type: 'line',
    data: {
      labels: decadas.map(d => `${d}s`),
      datasets: [{
        data: decadas.map(d => contagem[d]),
        borderColor: '#222',
        backgroundColor: 'rgba(34,34,34,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: '#222',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
      },
    },
  })
}

// ============================================
// WORD CLOUD (Canvas API)
// ============================================
function renderWordCloud(ruas) {
  const freq = {}

  ruas.forEach(r => {
    if (!r.significado) return
    const words = r.significado
      .toLowerCase()
      .replace(/[^\w\sáàâãéèêíïóôõúüç]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.includes(w))

    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  })

  // Sort and take top 60
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60)
  if (sorted.length === 0) return

  const canvas = document.getElementById('chart-wordcloud')
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height

  ctx.clearRect(0, 0, W, H)

  const maxFreq = sorted[0][1]
  const minSize = 12
  const maxSize = 48
  const colors = ['#222', '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#ca8a04', '#444', '#3b82f6']

  sorted.forEach(([word, count], i) => {
    const size = minSize + ((count / maxFreq) * (maxSize - minSize))
    ctx.font = `${Math.round(size)}px "Segoe UI", sans-serif`
    ctx.fillStyle = colors[i % colors.length]

    // Simple placement (grid-based)
    const cols = 5
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = (col / cols) * W + 20 + Math.random() * 30
    const y = row * 55 + 35 + Math.random() * 15

    if (y < H - 10) {
      ctx.fillText(word, x, y)
    }
  })
}

// ============================================
// PDF EXPORT
// ============================================
document.getElementById('btn-exportar-pdf')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-exportar-pdf')
  btn.disabled = true
  btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Gerando PDF...'

  try {
    const container = document.getElementById('charts-container')
    const canvas = await html2canvas(container, {
      backgroundColor: '#fafafa',
      scale: 2,
    })

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('l', 'mm', 'a4')

    pdf.setFontSize(18)
    pdf.setTextColor(34, 34, 34)
    pdf.text('Análise da Toponímia Urbana de Ouro Branco', 15, 15)

    pdf.setFontSize(10)
    pdf.setTextColor(150)
    pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 15, 22)

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 267
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 15, 28, imgWidth, Math.min(imgHeight, 170))

    pdf.save('estatisticas-toponimia-ouro-branco.pdf')
  } catch (err) {
    console.error('Erro ao exportar PDF:', err)
    alert('Erro ao gerar PDF. Tente novamente.')
  }

  btn.disabled = false
  btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>Exportar PDF'
})

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', carregarDados)
