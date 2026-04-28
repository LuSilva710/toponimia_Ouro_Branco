// ============================================
// ESTATÍSTICAS - estatisticas.js
// ============================================
import { supabase } from './supabase-client.js'

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

// ============================================
// PDF EXPORT — Relatório por Bairros (jsPDF nativo)
// ============================================

/** Converte hex (#RRGGBB) para [r, g, b] */
function hexRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
}

/** Desenha a capa do relatório */
function pdfCapa(pdf, W, H, totalRuas, totalBairros, imgHeroB64) {
  // ── Imagem de fundo (ouro_branco_historico.png) — largura total
  if (imgHeroB64) {
    try { pdf.addImage(imgHeroB64, 'PNG', 0, 0, W, H, undefined, 'FAST') }
    catch { pdf.setFillColor(26, 26, 26); pdf.rect(0, 0, W, H, 'F') }
  } else {
    pdf.setFillColor(26, 26, 26); pdf.rect(0, 0, W, H, 'F')
  }

  // Overlay escuro em camadas — espelha o gradiente do CSS do hero:
  // linear-gradient(135deg, rgba(26,26,26,0.92) 0%, rgba(45,45,45,0.88) 50%, rgba(10,10,10,0.95) 100%)
  pdf.setFillColor(0, 0, 0)
  pdf.setGState(pdf.GState({ opacity: 0.91 }))
  pdf.rect(0, 0, W, H, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // Faixa de acento superior (navbar-like)
  pdf.setFillColor(15, 15, 15); pdf.rect(0, 0, W, 10, 'F')
  pdf.setFillColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.1 }))
  pdf.rect(0, 9, W, 0.5, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // Badge IFMG · TCC (topo)
  pdf.setFillColor(255, 255, 255)
  pdf.setGState(pdf.GState({ opacity: 0.15 }))
  pdf.roundedRect(W/2 - 22, 22, 44, 9, 4, 4, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
  pdf.text('IFMG · Instituto Federal de Minas Gerais', W/2, 28, {align:'center'})

  // Título principal — espelha .hero-title
  pdf.setFont('helvetica','bold'); pdf.setFontSize(34); pdf.setTextColor(255,255,255)
  pdf.text('Dicionário de Ruas', W/2, H/2 - 24, {align:'center'})
  pdf.text('de Ouro Branco', W/2, H/2 - 6, {align:'center'})

  // Subtítulo — espelha .hero-subtitle
  pdf.setFont('helvetica','normal'); pdf.setFontSize(12); pdf.setTextColor(220, 220, 220)
  pdf.text('Descubra a história e significado por trás dos nomes das ruas da cidade', W/2, H/2 + 10, {align:'center'})

  // Linha divisória
  pdf.setDrawColor(255,255,255); pdf.setLineWidth(0.3)
  pdf.setGState(pdf.GState({ opacity: 0.3 }))
  pdf.line(W/2 - 55, H/2 + 18, W/2 + 55, H/2 + 18)
  pdf.setGState(pdf.GState({ opacity: 1 }))

  // Stats cards (glassmorphism — retângulos semi-transparentes)
  const cardW = 55, cardH2 = 22, cardY = H/2 + 24, gap = 10
  const totalX = W/2 - cardW - gap/2
  const bairrX = W/2 + gap/2

  ;[totalX, bairrX].forEach(cx => {
    pdf.setFillColor(255,255,255)
    pdf.setGState(pdf.GState({ opacity: 0.12 }))
    pdf.roundedRect(cx, cardY, cardW, cardH2, 4, 4, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))
  })

  pdf.setFont('helvetica','bold'); pdf.setFontSize(22); pdf.setTextColor(255,255,255)
  pdf.text(String(totalRuas), totalX + cardW/2, cardY + 13, {align:'center'})
  pdf.text(String(totalBairros), bairrX + cardW/2, cardY + 13, {align:'center'})

  pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(200,200,200)
  pdf.text('Logradouros catalogados', totalX + cardW/2, cardY + 19.5, {align:'center'})
  pdf.text('Bairros registrados', bairrX + cardW/2, cardY + 19.5, {align:'center'})

  // Taxonomia Dick (nota acadêmica)
  pdf.setFont('helvetica','italic'); pdf.setFontSize(8); pdf.setTextColor(160,160,160)
  pdf.text('Classificação Taxonômica segundo Dick (1990)', W/2, cardY + cardH2 + 12, {align:'center'})

  // Rodapé
  pdf.setFillColor(0,0,0)
  pdf.setGState(pdf.GState({ opacity: 0.5 }))
  pdf.rect(0, H - 14, W, 14, 'F')
  pdf.setGState(pdf.GState({ opacity: 1 }))
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); pdf.setTextColor(180,180,180)
  pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 10, H - 5)
  pdf.text('Ouro Branco, Minas Gerais', W/2, H - 5, {align:'center'})
  pdf.text('Projeto TCC · IFMG', W - 10, H - 5, {align:'right'})
}

/** Desenha a página 2 com contexto do projeto */
function pdfPaginaContexto(pdf, W, H, logoHeaderB64) {
  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, 0, W, H, 'F')

  // Cabeçalho preto inspirado na referência visual
  const headerH = 22
  pdf.setFillColor(0, 0, 0)
  pdf.rect(0, 0, W, headerH, 'F')

  // Logo centralizada com largura de 3 cm (30 mm)
  if (logoHeaderB64) {
    try {
      const logoW = 30
      const logoH = 8.4
      pdf.addImage(logoHeaderB64, 'PNG', (W - logoW) / 2, (headerH - logoH) / 2, logoW, logoH, undefined, 'FAST')
    } catch {
      // Se a imagem falhar, mantém apenas o cabeçalho preto.
    }
  }

  const margemX = 22
  const gapColunas = 18
  const colW = (W - (margemX * 2) - gapColunas) / 2
  const colEsqX = margemX
  const colDirX = margemX + colW + gapColunas

  let yAtual = headerH + 18

  const blocos = [
    {
      titulo: 'Sobre o Projeto',
      texto: 'Propõe-se a continuidade do estudo da toponímia urbana ouro-branquense a partir da análise da motivação dos topônimos relativos aos espaços públicos de Ouro Branco - MG, resgatando a história local.',
      lado: 'esquerda',
      cor: [130, 90, 70] // Marrom Histórico
    },
    {
      titulo: 'Nossa Missão',
      texto: 'Mostrar que os topônimos não são escolhidos aleatoriamente; permeiam questões sociopolíticas e culturais. Contribui para estudos linguísticos na inter-relação língua, cultura e sociedade.',
      lado: 'direita',
      cor: [130, 90, 70] // Marrom Histórico
    },
    {
      titulo: 'Nossa Jornada',
      texto: 'Revela as histórias por trás dos nomes dos espaços públicos. Consolida-se com o portal educativo para compartilhar descobertas com a comunidade e escolas da região.',
      lado: 'esquerda',
      cor: [130, 90, 70] // Marrom Histórico
    },
  ]

  blocos.forEach((bloco) => {
    const x = bloco.lado === 'direita' ? colDirX : colEsqX
    const tituloLinhas = pdf.splitTextToSize(bloco.titulo, colW - 10)
    const textoLinhas = pdf.splitTextToSize(bloco.texto, colW - 10)
    const alturaTitulo = tituloLinhas.length * 6
    const alturaTexto = textoLinhas.length * 4.8
    const blocoH = alturaTitulo + alturaTexto + 4

    // Fundo do "Card" (Sombra/Background sutil)
    pdf.setFillColor(250, 250, 252)
    pdf.roundedRect(x - 4, yAtual - 5, colW + 4, blocoH + 3, 1.5, 1.5, 'F')
    
    // Indicador lateral (Barra Marrom)
    pdf.setFillColor(bloco.cor[0], bloco.cor[1], bloco.cor[2])
    pdf.rect(x - 4, yAtual - 5, 1.8, blocoH + 3, 'F')

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13)
    pdf.setTextColor(30, 30, 30)
    pdf.text(tituloLinhas, x + 2, yAtual)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(70, 70, 70)
    pdf.text(textoLinhas, x + 2, yAtual + alturaTitulo - 1)

    yAtual += blocoH + 8
  })

  // ── Seção: Linha do Tempo (Segunda Metade da Página)
  const yTimelineBase = 238 // Mais respiro entre o texto e a cronologia
  const margemTimeline = 20
  const widthTimeline = W - (margemTimeline * 2)
  
  // Título da Linha do Tempo com elemento visual
  pdf.setFillColor(240, 235, 230) // Bege sutil
  pdf.roundedRect(W/2 - 40, yTimelineBase - 32, 80, 10, 5, 5, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(130, 90, 70) // Título em Marrom
  pdf.text('LINHA DO TEMPO DO PROJETO', W / 2, yTimelineBase - 25, { align: 'center' })

  // Linha horizontal principal
  pdf.setDrawColor(130, 90, 70)
  pdf.setLineWidth(0.8)
  pdf.line(margemTimeline, yTimelineBase, W - margemTimeline, yTimelineBase)

  const marcos = [
    { 
      ano: '2018-2020', 
      titulo: 'Fase Inicial', 
      desc: 'Análise de nomeação de ruas, avenidas e praças de Ouro Branco.',
      alunos: 'Naiara e Dérlisson (Engenharia Metalúrgica)'
    },
    { 
      ano: '2019-2020', 
      titulo: 'Expansão da Equipe', 
      desc: 'Continuação da análise da toponímia urbana de Ouro Branco.',
      alunos: 'Marcos Paulo Leite e Giovana Lana'
    },
    { 
      ano: '2021-2022', 
      titulo: 'Foco nas Escolas', 
      desc: 'Investigação focada na microtoponímia e escolas públicas.',
      alunos: 'Maria Raquel, Bruna Santos e Shirley Pereira'
    },
    { 
      ano: '2023-Pres.', 
      titulo: 'Portal Educativo', 
      desc: 'Consolidação da pesquisa e desenvolvimento do portal educativo.',
      alunos: 'Ludmila Silva e Marcos Túlio (Sistemas de Informação)'
    }
  ]

  const step = widthTimeline / (marcos.length - 1)
  
  marcos.forEach((marco, i) => {
    const x = margemTimeline + (i * step)
    const intercalado = i % 2 === 0 ? 1 : -1 // 1 para baixo, -1 para cima
    
    // Círculo decorativo no marco
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(130, 90, 70)
    pdf.setLineWidth(1)
    pdf.circle(x, yTimelineBase, 2.8, 'FD')
    pdf.setFillColor(130, 90, 70)
    pdf.circle(x, yTimelineBase, 1.2, 'F')

    // Ano (sempre oposto à descrição)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(130, 90, 70)
    pdf.text(marco.ano, x, yTimelineBase - (intercalado * 10), { align: 'center' })

    // Bloco de Texto (Título, Descrição e Alunos)
    const yTextoBase = yTimelineBase + (intercalado * 8)
    const alignY = intercalado === 1 ? 'top' : 'bottom' // Ajuste manual de offset
    
    // Título
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(30, 30, 30)
    pdf.text(marco.titulo, x, yTextoBase + (intercalado * 2), { align: 'center' })

    // Descrição
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(80, 80, 80)
    const descLinhas = pdf.splitTextToSize(marco.desc, (widthTimeline / marcos.length) - 6)
    pdf.text(descLinhas, x, yTextoBase + (intercalado * 7), { align: 'center' })

    // Ícone de "Alunos" (Simulado com dois círculos pequenos)
    const yAlunos = yTextoBase + (intercalado * (7 + (descLinhas.length * 4)))
    pdf.setFillColor(130, 90, 70)
    pdf.circle(x - 2, yAlunos + (intercalado * 2), 0.6, 'F')
    pdf.circle(x + 2, yAlunos + (intercalado * 2), 0.6, 'F')

    // Nomes dos Alunos
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 100, 100)
    pdf.text(marco.alunos, x, yAlunos + (intercalado * 5), { align: 'center' })
  })

  // Rodapé da página de apresentação
  pdf.setDrawColor(220, 220, 220)
  pdf.setLineWidth(0.3)
  pdf.line(margemX, H - 16, W - margemX, H - 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(110, 110, 110)
  pdf.text('Dicionário Toponímico de Ouro Branco-MG', margemX, H - 10.5)
  pdf.text('Pág. 2', W - margemX, H - 10.5, { align: 'right' })
}


/** Carrega uma URL de imagem e retorna base64 (ou null se falhar) */
async function urlParaBase64(url) {
  if (!url) return null
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const blob = await resp.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

/**
 * Desenha o card de um bairro numa faixa horizontal da página.
 * startY: Y de início do card, cardH: altura disponível, W: largura total.
 * TODAS as ruas são listadas (sem truncamento).
 */
function pdfCardBairro(pdf, W, startY, cardH, bairroNome, ruasDoBairro, imgB64, idx, total) {
  const PAD     = 5
  const IMG_H   = imgB64 ? 22 : 0
  const HDR_H   = 14
  const CAT_H   = 9
  const DIV_H   = 6
  const NUM_COLS = 4

  // Categorias
  const contagem = {}
  Object.keys(CORES).forEach(k => { contagem[k] = 0 })
  ruasDoBairro.forEach(r => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    contagem[cat] = (contagem[cat] || 0) + 1
  })
  let catPredom = 'outro', maxCt = 0
  Object.entries(contagem).forEach(([k,v]) => { if (v > maxCt) { maxCt = v; catPredom = k } })
  const [rC,gC,bC] = hexRgb(CORES[catPredom] || CORES.outro)
  const catsOrdenadas = ORDEM_CATEGORIAS.filter(k => contagem[k] > 0).sort((a,b) => contagem[b]-contagem[a])

  // Imagem de capa
  let innerY = startY
  if (imgB64) {
    try { pdf.addImage(imgB64, 'JPEG', 0, startY, W, IMG_H, undefined, 'FAST') }
    catch { pdf.setFillColor(170,170,185); pdf.rect(0, startY, W, IMG_H, 'F') }
    pdf.setFillColor(0,0,0)
    pdf.setGState(pdf.GState({ opacity: 0.4 }))
    pdf.rect(0, startY, W, IMG_H, 'F')
    pdf.setGState(pdf.GState({ opacity: 1 }))
    innerY = startY + IMG_H
  }

  // Header colorido reduzido
  pdf.setFillColor(rC,gC,bC)
  pdf.rect(0, innerY, W, HDR_H, 'F')
  pdf.setFont('helvetica','bold'); pdf.setFontSize(6); pdf.setTextColor(255,255,255)
  pdf.text(`${String(idx+1).padStart(2,'0')}/${String(total).padStart(2,'0')}`, W-PAD, innerY+5, {align:'right'})
  pdf.setFont('helvetica','bold'); pdf.setFontSize(13); pdf.setTextColor(255,255,255)
  pdf.text(bairroNome, PAD, innerY+8)
  pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(255,255,255)
  pdf.text(`${ruasDoBairro.length} logradouros  \u00b7  ${rotuloCategoriaToponimica(catPredom)}`, PAD, innerY+HDR_H-2)

  let y = innerY + HDR_H + 3

  // ── Seção de categorias: barras em 2 colunas, altura responsiva
  const BAR_ROW_H  = 5.5   // altura de cada linha de barra (compacta)
  const BAR_TITLE  = 5.5   // "DISTRIBUIÇÃO..." + margem
  const halfCats   = Math.ceil(catsOrdenadas.length / 2)
  const CAT_SECTION_H = catsOrdenadas.length > 0 ? BAR_TITLE + halfCats * BAR_ROW_H + 2 : 0

  if (catsOrdenadas.length > 0) {

    pdf.setFont('helvetica','bold'); pdf.setFontSize(7); pdf.setTextColor(55,55,75)
    pdf.text('DISTRIBUIÇÃO POR CATEGORIA TOPONÍMICA', PAD, y + 4); y += BAR_TITLE

    const barColW   = (W - PAD*2) / 2 - 3
    const barLabelW = 38
    const barMax    = barColW - barLabelW - 16

    catsOrdenadas.forEach((k, i) => {
      const col  = i < halfCats ? 0 : 1
      const row  = i < halfCats ? i : i - halfCats
      const xOff = PAD + col * (barColW + 6)
      const rowY = y + row * BAR_ROW_H

      const v   = contagem[k]
      const pct = ruasDoBairro.length > 0 ? v / ruasDoBairro.length : 0
      const barW = Math.max(1, pct * barMax)
      const [rk,gk,bk] = hexRgb(CORES[k] || CORES.outro)

      pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(55,55,72)
      const label = rotuloCategoriaToponimica(k)
      pdf.text(label.length > 14 ? label.slice(0,13)+'.' : label, xOff, rowY + 3.5)

      pdf.setFillColor(215,215,228); pdf.roundedRect(xOff+barLabelW, rowY+0.5, barMax, 3.5, 1, 1, 'F')
      pdf.setFillColor(rk,gk,bk);   pdf.roundedRect(xOff+barLabelW, rowY+0.5, barW,  3.5, 1, 1, 'F')

      pdf.setFont('helvetica','bold'); pdf.setFontSize(5.5); pdf.setTextColor(35,35,60)
      pdf.text(`${v} (${(pct*100).toFixed(0)}%)`, xOff+barLabelW+barMax+2, rowY+3.5)
    })

    y += halfCats * BAR_ROW_H + 2
  }

  // Divisória + título LOGRADOUROS
  pdf.setDrawColor(195,195,212); pdf.setLineWidth(0.2)
  pdf.line(PAD, y, W-PAD, y); y += 2.5
  pdf.setFont('helvetica','bold'); pdf.setFontSize(6.5); pdf.setTextColor(55,55,75)
  pdf.text('LOGRADOUROS \u2014 LISTAGEM COMPLETA ALFAB\u00c9TICA', PAD, y+2.5)
  y += 5.5

  // rowH e fontSize adaptativos: cabe TODAS as ruas no espaço restante
  const espacoRuas = startY + cardH - y - 1
  const totalN     = ruasDoBairro.length
  const rowsNeeded = Math.ceil(totalN / NUM_COLS)
  const rowH       = Math.max(2.8, Math.min(5.0, espacoRuas / Math.max(rowsNeeded, 1)))
  const fontSize   = Math.max(4.5, Math.min(6.5, rowH * 1.3))
  const dotR       = Math.max(0.6, rowH * 0.22)
  const maxPorCol  = Math.ceil(totalN / NUM_COLS)
  const ruaColW    = (W - PAD*2) / NUM_COLS

  const todasRuas = [...ruasDoBairro]
    .sort((a,b) => (a.nome_oficial||'').localeCompare(b.nome_oficial||''))

  // Pré-calcular se algum nome vai precisar de 2 linhas (para ajustar espaçamento)
  const colTextW = ruaColW - dotR*2 - 3.5

  todasRuas.forEach((r, i) => {
    const col  = Math.floor(i / maxPorCol)
    const row  = i % maxPorCol
    if (col >= NUM_COLS) return
    const xR   = PAD + col * ruaColW
    const rowY = y + row * rowH
    const catR = normalizarCategoria(r.categoria_toponimica)
    const [ri,gi,bi] = hexRgb(CORES[catR] || CORES.outro)
    pdf.setFillColor(ri,gi,bi); pdf.circle(xR+dotR+0.3, rowY+rowH*0.45, dotR, 'F')
    pdf.setFont('helvetica','normal'); pdf.setFontSize(fontSize); pdf.setTextColor(20,20,45)
    const nome = r.nome_oficial || '\u2014'
    const linhas = pdf.splitTextToSize(nome, colTextW)
    pdf.text(linhas, xR+dotR*2+1.5, rowY+rowH*0.65)
  })

}


document.getElementById('btn-exportar-pdf')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-exportar-pdf')
  btn.disabled = true
  btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Gerando PDF...'

  try {
    // Buscar ruas + bairros (com imagem_capa)
    const [{ data: ruas, error: errR }, { data: bairrosData, error: errB }] = await Promise.all([
      supabase.from('ruas').select('nome_oficial, categoria_toponimica, bairros(nome)').order('nome_oficial'),
      supabase.from('bairros').select('nome, imagem_capa').order('nome')
    ])
    if (errR) throw errR
    if (errB) throw errB

    // Mapa nome→imagem_capa
    const capaMap = {}
    bairrosData.forEach(b => { if(b.nome) capaMap[b.nome] = b.imagem_capa || null })

    // Agrupar ruas por bairro
    const bairrosMap = {}
    ruas.forEach(r => {
      const nome = r.bairros?.nome || 'Sem Bairro'
      if (!bairrosMap[nome]) bairrosMap[nome] = []
      bairrosMap[nome].push(r)
    })
    const bairrosList = Object.entries(bairrosMap).sort((a,b) => a[0].localeCompare(b[0]))

    // Pré-carregar imagem do hero (ouro_branco_historico.png) + capas dos bairros em paralelo
    btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Carregando imagens...'
    const [imgHeroB64, imgLogoHeaderB64, ...imagensB64] = await Promise.all([
      urlParaBase64('./assets/images/ouro_branco_historico.png'),
      urlParaBase64('./assets/images/header/toponimia-black.png'),
      ...bairrosList.map(([nome]) => urlParaBase64(capaMap[nome]))
    ])

    // Gerar PDF
    btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Montando PDF...'
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF('p', 'mm', 'a4')
    const W = 210, H = 297
    const FOOTER_H = 9
    const HALF = (H - FOOTER_H) / 2

    // Capa com imagem do hero
    pdfCapa(pdf, W, H, ruas.length, bairrosList.length, imgHeroB64)

    // Página 2: contexto do projeto
    pdf.addPage()
    pdfPaginaContexto(pdf, W, H, imgLogoHeaderB64)

    // 2 bairros por página (empilhados verticalmente)
    const totalPares = Math.ceil(bairrosList.length / 2)
    for (let i = 0; i < bairrosList.length; i += 2) {
      pdf.addPage()
      const paginaIdx = Math.floor(i / 2)

      // Fundo claro
      pdf.setFillColor(245, 245, 250); pdf.rect(0, 0, W, H, 'F')

      // Rodapé escuro
      pdf.setFillColor(25, 25, 55); pdf.rect(0, H - FOOTER_H, W, FOOTER_H, 'F')
      pdf.setFont('helvetica','normal'); pdf.setFontSize(6.5); pdf.setTextColor(200,200,220)
      pdf.text('Dicionário Toponímico de Ouro Branco-MG · IFMG', 8, H-3.5)
      pdf.text(`Pág. ${paginaIdx + 3} / ${totalPares + 2}`, W-8, H-3.5, {align:'right'})

      // Card superior (bairro A)
      const [nomeA, ruasA] = bairrosList[i]
      pdfCardBairro(pdf, W, 0, HALF, nomeA, ruasA, imagensB64[i], i, bairrosList.length)

      // Linha divisória entre os dois cards
      pdf.setDrawColor(180, 180, 200); pdf.setLineWidth(0.5)
      pdf.line(0, HALF, W, HALF)

      // Card inferior (bairro B — se existir)
      if (i + 1 < bairrosList.length) {
        const [nomeB, ruasB] = bairrosList[i + 1]
        pdfCardBairro(pdf, W, HALF, HALF, nomeB, ruasB, imagensB64[i + 1], i + 1, bairrosList.length)
      }
    }

    pdf.save('dicionario-toponomico-ouro-branco.pdf')
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
