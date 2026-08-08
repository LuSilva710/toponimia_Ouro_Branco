import { supabase } from '../../lib/supabase.js'
import { PdfGeneratorService } from '../services/PdfGeneratorService.js'

// Chart.js v4: o plugin "colors" aplica paleta padrão e pode ignorar backgroundColor customizado
if (globalThis.Chart?.defaults?.plugins) {
  globalThis.Chart.defaults.plugins.colors = { enabled: false }
}

// ============================================
// CHART COLORS
// ============================================
const CORES = {
  antropotoponimo: '#ED4A7B', // Magenta Vibrante
  fitotoponimo: '#109655',    // Verde Limpo
  axiotoponimo: '#6B4B9A',    // Roxo App
  hagiotoponimo: '#29B6F6',   // Azul Celeste Suave (Agradável)
  corotoponimo: '#FF7043',    // Laranja Coral (Agradável)
  zootoponimo: '#26A69A',     // Verde-água Menta (Agradável)
  litotoponimo: '#607D8B',    // Azul Rochoso/Metálico (Agradável e semântico para litos=pedra)
  sociotoponimo: '#C5CB81',   // Verde musgo rgb(197, 203, 129)
  outro: '#DFDFDF',           // Cinza claro maciço
}

/** Rótulos acentuados para gráfico e legendas */
const ROTULO_CATEGORIA = {
  antropotoponimo: 'Antropotopônimo',
  fitotoponimo: 'Fitotopônimo',
  axiotoponimo: 'Axiotopônimo',
  hagiotoponimo: 'Hagiotopônimo',
  corotoponimo: 'Corotopônimo',
  zootoponimo: 'Zootopônimo',
  litotoponimo: 'Litotopônimo',
  sociotoponimo: 'Sociotopônimo',
  outro: 'Outro / sem classificação',
}

function rotuloCategoriaToponimica(chaveNormalizada) {
  return ROTULO_CATEGORIA[chaveNormalizada] || (chaveNormalizada.charAt(0).toUpperCase() + chaveNormalizada.slice(1))
}

/** Ordem fixa na legenda (todas as categorias aparecem, mesmo com contagem 0). */
const ORDEM_CATEGORIAS = [
  'antropotoponimo', 'fitotoponimo', 'axiotoponimo', 'hagiotoponimo',
  'corotoponimo', 'zootoponimo', 'litotoponimo', 'sociotoponimo', 'outro',
]

function contarPorCategoria(ruas) {
  const contagem = {}
  Object.keys(CORES).forEach((k) => {
    contagem[k] = 0
  })
  ruas.forEach((r) => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (contagem[cat] !== undefined) contagem[cat]++
    else contagem.outro++
  })
  return contagem
}

let chartInstanciaCategorias = null
let chartInstanciaGenero = null
let chartInstanciaTimeline = null

function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  // Minúsculas, sem acento (ô = o), sem espaços/hífens internos — alinha com chaves em CORES
  let n = String(cat)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  n = n.replace(/[-_\s\u00a0]+/g, '')
  while (n.endsWith('toponimos')) n = n.slice(0, -1)
  if (CORES[n] !== undefined) return n
  return 'outro'
}

const CORES_GENERO = {
  masculino: '#3b82f6',
  feminino: '#ec4899',
  neutro: '#8b5cf6',
}

const STOPWORDS = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'na', 'no', 'ao', 'das', 'dos', 'foi', 'ser', 'seu', 'sua', 'ele', 'ela', 'são', 'era', 'isso', 'esse', 'essa', 'este', 'esta', 'muito', 'tem', 'entre', 'já', 'também', 'após', 'até', 'onde', 'quando', 'qual', 'quais', 'sobre', 'grande', 'cidade', 'ouro', 'branco', 'rua', 'nome', 'homenagem', 'filho', 'filha', 'nasceu', 'faleceu', 'ano', 'anos', 'dia', 'mês', 'idade', 'recebeu', 'homenageado', 'homenageada', 'local', 'histórico', 'história', 'pessoa', 'vida', 'suas', 'seus', 'pela', 'pelo', 'aos', 'teve', 'sendo', 'quem', 'foi', 'está']

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
    
    // Filtra apenas bairros que possuem pelo menos uma rua vinculada
    const idsBairrosComRua = new Set(ruas.filter(r => r.bairro_id).map(r => r.bairro_id))
    const totalBairrosComRua = idsBairrosComRua.size

    // Summary cards
    document.getElementById('total-ruas').textContent = ruas.length
    document.getElementById('total-bairros').textContent = totalBairrosComRua

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
    renderPanorama(ruas)
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
  const contagem = contarPorCategoria(ruas)
  const keysChart = ORDEM_CATEGORIAS.filter((k) => contagem[k] > 0)
  const labels = keysChart.map((k) => rotuloCategoriaToponimica(k))
  const data = keysChart.map((k) => contagem[k])
  const colors = keysChart.map((k) => CORES[k])
  const borders = keysChart.map(() => '#ffffff')

  const canvas = document.getElementById('chart-categorias')
  if (chartInstanciaCategorias) {
    chartInstanciaCategorias.destroy()
    chartInstanciaCategorias = null
  }

  if (keysChart.length > 0) {
    chartInstanciaCategorias = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: borders,
          borderWidth: 2,
          hoverBorderColor: '#ffffff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          colors: { enabled: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.raw
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0)
                const pct = total ? ((v / total) * 100).toFixed(1) : '0'
                return ` ${ctx.label}: ${v} (${pct}%)`
              },
            },
          },
        },
      },
    })
  }

  // Legenda completa: todas as categorias + contagem (inclui Sociotopônimo com 0)
  const legendBox = document.getElementById('legend-html-categorias')
  if (legendBox) {
    legendBox.innerHTML = ORDEM_CATEGORIAS.map((k) => `
      <div class="custom-legend-item">
        <span class="custom-legend-color" style="background-color: ${CORES[k]}"></span>
        <span class="custom-legend-label">${rotuloCategoriaToponimica(k)}</span>
        <span class="custom-legend-count">${contagem[k]}</span>
      </div>
    `).join('')
  }
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

  const canvasGen = document.getElementById('chart-genero')
  if (chartInstanciaGenero) {
    chartInstanciaGenero.destroy()
    chartInstanciaGenero = null
  }

  const coresGen = [CORES_GENERO.masculino, CORES_GENERO.feminino, CORES_GENERO.neutro]
  chartInstanciaGenero = new Chart(canvasGen, {
    type: 'bar',
    data: {
      labels: ['Masculino', 'Feminino', 'Neutro'],
      datasets: [{
        data: [contagem.masculino, contagem.feminino, contagem.neutro],
        backgroundColor: coresGen,
        borderColor: coresGen.map(() => '#ffffff'),
        borderWidth: 2,
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        colors: { enabled: false },
        legend: { display: false },
      },
      scales: {
        x: { ticks: { color: '#444' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        y: { ticks: { color: '#444' }, grid: { display: false } },
      },
    },
  })
}

// ============================================
// COMPONENTE: Panorama Geral Semântico (Linhas)
// ============================================
function renderPanorama(ruas) {
  const contagemCat = contarPorCategoria(ruas)

  // Ordenadão: 
  // 1. Pelo peso numérico da Categoria Toponímica (para o tufo maior ficar em 1º)
  // 2. Empate métrico vai pra ordem alfabética da Categoria
  // 3. Ordem alfabética do logradouro
  const ruasOrdenadas = [...ruas].sort((a, b) => {
    const catA = normalizarCategoria(a.categoria_toponimica)
    const catB = normalizarCategoria(b.categoria_toponimica)
    
    if (contagemCat[catB] !== contagemCat[catA]) {
      return contagemCat[catB] - contagemCat[catA]
    }
    
    if (catA !== catB) {
      return catA.localeCompare(catB)
    }

    return (a.nome_oficial || '').localeCompare(b.nome_oficial || '')
  })

  const container = document.getElementById('waffle-container')
  if (!container) return

  let hoverTooltip = document.getElementById('custom-waffle-tooltip')
  if (!hoverTooltip) {
    hoverTooltip = document.createElement('div')
    hoverTooltip.id = 'custom-waffle-tooltip'
    hoverTooltip.className = 'custom-waffle-tooltip'
    document.body.appendChild(hoverTooltip)
  }

  // Gerar linhas
  const blocksHtml = ruasOrdenadas.map((r, index) => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    const color = CORES[cat] || CORES.outro
    const delay = (index % 60) * 8 // Delay suave para fazer as barras escorregarem fluídas
    const explicitCatName = r.categoria_toponimica
      ? rotuloCategoriaToponimica(normalizarCategoria(r.categoria_toponimica))
      : 'Sem Categoria de Origem'
    // Remover title do navegador e usar tag HTML Data nativa 
    return `<div class="waffle-line" style="background-color: ${color}; animation-delay: ${delay}ms" data-rua="${r.nome_oficial}" data-cat="${explicitCatName}"></div>`
  }).join('')

  // Legenda com todas as categorias (inclui contagem 0), mesma ordem do gráfico de rosca
  const legendHtml = ORDEM_CATEGORIAS.map((cat) => {
    const count = contagemCat[cat]
    const color = CORES[cat] || CORES.outro
    const label = rotuloCategoriaToponimica(cat)
    return `
      <div class="waffle-legend-item">
        <span class="waffle-legend-color" style="background-color: ${color}"></span>
        <span>${label}:</span>
        <span class="waffle-legend-count">${count}</span>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="waffle-cidade-header">
      <div class="waffle-cidade-title">Percepção Semântica da Malha Urbana Ouro-branquense</div>
      <div class="waffle-cidade-count">${ruasOrdenadas.length} logradouros processados</div>
    </div>
    <div class="waffle-grid">${blocksHtml}</div>
    <div class="waffle-legend">${legendHtml}</div>
  `

  // Gatilho de aparecimento magico quando damos Scroll pelo observer
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const lines = entry.target.querySelectorAll('.waffle-line')
        lines.forEach(l => l.classList.add('animate-in'))
        observer.unobserve(entry.target)
      }
    })
  }, { rootMargin: '0px 0px -40px 0px' })

  observer.observe(container)

  // Magia de UI: Tooltip Seguindo o Mouse instantaneamente
  const linesNodes = container.querySelectorAll('.waffle-line')
  linesNodes.forEach(node => {
    node.addEventListener('mouseenter', (e) => {
      hoverTooltip.innerHTML = `<strong>${e.target.dataset.rua}</strong><br><span style="font-size:0.8rem; color:#d1d5db">${e.target.dataset.cat}</span>`
      hoverTooltip.style.visibility = 'visible'
      hoverTooltip.style.opacity = '1'
    })
    node.addEventListener('mousemove', (e) => {
      hoverTooltip.style.left = (e.pageX + 15) + 'px'
      hoverTooltip.style.top = (e.pageY + 15) + 'px'
    })
    node.addEventListener('mouseleave', () => {
      hoverTooltip.style.opacity = '0'
      hoverTooltip.style.visibility = 'hidden'
    })
  })
}

// ============================================
// CHART: Timeline (Décadas × categoria — barras empilhadas)
// ============================================
function resolverDecada(rua) {
  const raw = rua.decada_nomeacao
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (!Number.isNaN(n)) {
      // Limitar a data para evitar erros de digitação (ex: 2050) e respeitar o limite de 2020
      if (n > 2020) return null;
      if (n >= 1800) return Math.floor(n / 10) * 10
      return n
    }
  }
  if (rua.legislacao) {
    const match = String(rua.legislacao).match(/\b(19|20)\d{2}\b/)
    if (match) {
      const ano = parseInt(match[0], 10);
      if (ano > 2020) return null;
      return Math.floor(ano / 10) * 10;
    }
  }
  return null
}

function renderTimeline(ruas) {
  const porDecadaCat = {}

  ruas.forEach((r) => {
    const decada = resolverDecada(r)
    if (decada == null) return
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (!porDecadaCat[decada]) porDecadaCat[decada] = {}
    porDecadaCat[decada][cat] = (porDecadaCat[decada][cat] || 0) + 1
  })

  // Decadas ordenadas
  const decadas = Object.keys(porDecadaCat)
    .map(Number)
    .sort((a, b) => a - b)

  const canvasTl = document.getElementById('chart-timeline')
  const emptyEl = document.getElementById('timeline-empty')
  const insightEl = document.getElementById('timeline-insight')

  const mostrarVazio = () => {
    if (chartInstanciaTimeline) {
      chartInstanciaTimeline.destroy()
      chartInstanciaTimeline = null
    }
    if (canvasTl) canvasTl.hidden = true
    if (emptyEl) emptyEl.hidden = false
    if (insightEl) insightEl.hidden = true
  }

  const mostrarGrafico = () => {
    if (canvasTl) canvasTl.hidden = false
    if (emptyEl) emptyEl.hidden = true
  }

  if (decadas.length === 0) {
    mostrarVazio()
    return
  }

  mostrarGrafico()

  // Calcular totais e acumulado
  const catsVisiveis = ORDEM_CATEGORIAS.filter((k) =>
    decadas.some((d) => (porDecadaCat[d][k] || 0) > 0),
  )

  const totaisPorDecada = decadas.map((d) =>
    catsVisiveis.reduce((s, k) => s + (porDecadaCat[d][k] || 0), 0),
  )

  let acumulado = 0
  const dadosAcumulados = totaisPorDecada.map(v => {
    acumulado += v
    return acumulado
  })

  const totalComDecada = acumulado

  // Insight analítico
  let idxPico = 0
  totaisPorDecada.forEach((n, i) => {
    if (n > totaisPorDecada[idxPico]) idxPico = i
  })
  const decPico = decadas[idxPico]
  const nPico = totaisPorDecada[idxPico]
  const pctPico = totalComDecada ? ((nPico / totalComDecada) * 100).toFixed(0) : '0'

  let catDominantePico = catsVisiveis[0]
  let maxCat = 0
  catsVisiveis.forEach((k) => {
    const v = porDecadaCat[decPico][k] || 0
    if (v > maxCat) {
      maxCat = v
      catDominantePico = k
    }
  })

  if (insightEl) {
    insightEl.hidden = false
    insightEl.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-lightbulb text-warning" style="font-size: 1.2rem;"></i>
        <span>
          Ouro Branco expandiu significativamente a partir da década de <strong>${decPico}</strong>, 
          quando <strong>${nPico}</strong> novas ruas (${pctPico}%) foram registradas. 
          O predomínio de <strong>${rotuloCategoriaToponimica(catDominantePico)}</strong> sugere uma influência 
          ${catDominantePico === 'antropotoponimo' ? 'biográfica forte' : 'histórica setorial'} nesse período.
        </span>
      </div>
    `
  }

  if (chartInstanciaTimeline) {
    chartInstanciaTimeline.destroy()
    chartInstanciaTimeline = null
  }

  // Datasets de Barras
  const datasets = catsVisiveis.map((k) => ({
    type: 'bar',
    label: rotuloCategoriaToponimica(k),
    data: decadas.map((d) => porDecadaCat[d][k] || 0),
    backgroundColor: CORES[k] || CORES.outro,
    borderColor: '#ffffff',
    borderWidth: 1,
    stack: 'decadas',
    order: 2,
    yAxisID: 'y',
  }))

  // Dataset de Linha (Acumulado)
  datasets.push({
    type: 'line',
    label: 'Expansão Urbana (Acumulado)',
    data: dadosAcumulados,
    borderColor: '#222222',
    borderWidth: 3,
    pointBackgroundColor: '#ffffff',
    pointBorderColor: '#222222',
    pointHoverRadius: 6,
    fill: false,
    tension: 0.4,
    order: 1,
    yAxisID: 'yTotal',
  })

  chartInstanciaTimeline = new Chart(canvasTl, {
    data: {
      labels: decadas.map((d) => `${d}s`),
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 15,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.85)',
          padding: 12,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw
              if (ctx.dataset.type === 'line') return ` Cúmulo: ${val} ruas`
              return ` ${ctx.dataset.label}: ${val}`
            },
            footer: (items) => {
              const t = items
                .filter(it => it.dataset.type === 'bar')
                .reduce((s, it) => s + (it.parsed.y || 0), 0)
              return `Total na década: ${t} ruas`
            },
          },
        },
        annotation: {
          annotations: {
            line1953: {
              type: 'line',
              xMin: decadas.indexOf(1950) !== -1 ? decadas.indexOf(1950) + 0.3 : null,
              xMax: decadas.indexOf(1950) !== -1 ? decadas.indexOf(1950) + 0.3 : null,
              borderColor: 'rgba(0,0,0,0.4)',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                display: true,
                content: 'Emancipação (1953)',
                position: 'start',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: '#222',
                font: { size: 10, weight: 'bold' },
                padding: 4
              }
            },
            line1976: {
              type: 'line',
              xMin: decadas.indexOf(1970) !== -1 ? decadas.indexOf(1970) + 0.6 : null,
              xMax: decadas.indexOf(1970) !== -1 ? decadas.indexOf(1970) + 0.6 : null,
              borderColor: 'rgba(0,0,0,0.4)',
              borderWidth: 2,
              borderDash: [6, 6],
              label: {
                display: true,
                content: 'Início Açominas (1976)',
                position: 'end',
                backgroundColor: 'rgba(255,255,255,0.8)',
                color: '#222',
                font: { size: 10, weight: 'bold' },
                padding: 4
              }
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
          title: { display: true, text: 'Novas Ruas / Década', font: { size: 10, weight: 'bold' } },
          ticks: { precision: 0 },
        },
        yTotal: {
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'Total Acumulado', font: { size: 10, weight: 'bold' } },
          grid: { display: false }, // Ocultar grids do segundo eixo para não poluir
          ticks: { precision: 0 },
        }
      },
    },
  })
}

// ============================================
// WORD CLOUD (Modern Flexbox UI)
// ============================================
function renderWordCloud(ruas) {
  const freq = {}

  ruas.forEach(r => {
    if (!r.significado) return
    const words = r.significado
      .toLowerCase()
      .replace(/[^\w\sáàâãéèêíïóôõúüç]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.includes(w))

    words.forEach(w => { freq[w] = (freq[w] || 0) + 1 })
  })

  // Sort and take top 65
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 65)
  if (sorted.length === 0) return

  const container = document.getElementById('html-wordcloud')
  if (!container) return

  const maxFreq = sorted[0][1]
  const paletaToponimia = Object.values(CORES).filter((c) => c !== CORES.outro)

  // Misturar aleatoriamente para que as palavras grandes não fiquem apenas no começo
  const scrambled = [...sorted].sort(() => Math.random() - 0.5)

  container.innerHTML = scrambled.map(([word, count], idx) => {
    // Tamanho proporcional (0.9 a 3.5 rem)
    const size = 0.9 + ((count / maxFreq) * 2.6)
    const color = paletaToponimia[idx % paletaToponimia.length]
    const opacity = 0.6 + ((count / maxFreq) * 0.4) // palavras mais raras ficam levemente translúcidas
    
    return `<span class="word-badge" style="--base-size: ${size}rem; color: ${color}; opacity: ${opacity}" title="Citada ${count} vezes">${word}</span>`
  }).join('')
}

document.getElementById('btn-exportar-pdf')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-exportar-pdf')
  await PdfGeneratorService.exportFullReport(btn)
})

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', carregarDados)
