// ============================================
// ESTATÍSTICAS - estatisticas.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CHART COLORS
// ============================================
const CORES = {
  antropotoponimo: '#ED4A7B', // Magenta Vibrante
  fitotoponimo: '#109655',    // Verde Limpo
  ergotoponimo: '#F6A810',    // Amarelo Ouro
  axiotoponimo: '#6B4B9A',    // Roxo App
  hagiotoponimo: '#29B6F6',   // Azul Celeste Suave (Agradável)
  corotoponimo: '#FF7043',    // Laranja Coral (Agradável)
  zootoponimo: '#26A69A',     // Verde-água Menta (Agradável)
  mitotoponimo: '#B23A48',    // Carmesim
  litotoponimo: '#607D8B',    // Azul Rochoso/Metálico (Agradável e semântico para litos=pedra)
  outro: '#DFDFDF',           // Cinza claro maciço
}

function normalizarCategoria(cat) {
  if (!cat) return 'outro';
  // Remove acentos, lowercase, e espaços finais
  let n = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Correção fonética: Se a pessoa digitou com "s" no final (plural), nós fatiamos a string e removemos o último caractere, forçando o singular absoluto.
  if (n.endsWith('toponimos')) return n.slice(0, -1);
  return n;
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
  const contagem = {}
  ruas.forEach(r => {
    const cat = normalizarCategoria(r.categoria_toponimica)
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
        legend: { display: false },
      },
    },
  })

  // Render HTML legend em duas colunas
  const legendBox = document.getElementById('legend-html-categorias')
  if (legendBox) {
    legendBox.innerHTML = labels.map((label, i) => `
      <div class="custom-legend-item">
        <span class="custom-legend-color" style="background-color: ${colors[i]}"></span>
        <span class="custom-legend-label">${label}</span>
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
// COMPONENTE: Panorama Geral Semântico (Linhas)
// ============================================
function renderPanorama(ruas) {
  // Contabilizar incidência global das categorias na cidade real
  const contagemCat = {}
  ruas.forEach(r => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    contagemCat[cat] = (contagemCat[cat] || 0) + 1
  })

  // Extrair chaves globais também pela ordem de densidade para montar a legenda alinha
  const legendCatsOrdenadas = Object.keys(contagemCat).sort((a,b) => contagemCat[b] - contagemCat[a])

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
    const explicitCatName = r.categoria_toponimica ? r.categoria_toponimica.charAt(0).toUpperCase() + r.categoria_toponimica.slice(1) : 'Sem Categoria de Origem'
    // Remover title do navegador e usar tag HTML Data nativa 
    return `<div class="waffle-line" style="background-color: ${color}; animation-delay: ${delay}ms" data-rua="${r.nome_oficial}" data-cat="${explicitCatName}"></div>`
  }).join('')

  // Gerar estrutura HTML da legenda (Círculo de cor, Categoria, e Contagem total)
  const legendHtml = legendCatsOrdenadas.map(cat => {
    const count = contagemCat[cat]
    const color = CORES[cat] || CORES.outro
    const label = cat.charAt(0).toUpperCase() + cat.slice(1) // Capitaliza
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
  const colors = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#ca8a04', '#0f172a', '#e11d48', '#0284c7', '#059669', '#d97706']

  // Misturar aleatoriamente para que as palavras grandes não fiquem apenas no começo
  const scrambled = [...sorted].sort(() => Math.random() - 0.5)

  container.innerHTML = scrambled.map(([word, count]) => {
    // Tamanho proporcional (0.9 a 3.5 rem)
    const size = 0.9 + ((count / maxFreq) * 2.6)
    const color = colors[Math.floor(Math.random() * colors.length)]
    const opacity = 0.6 + ((count / maxFreq) * 0.4) // palavras mais raras ficam levemente translúcidas
    
    return `<span class="word-badge" style="--base-size: ${size}rem; color: ${color}; opacity: ${opacity}" title="Citada ${count} vezes">${word}</span>`
  }).join('')
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
