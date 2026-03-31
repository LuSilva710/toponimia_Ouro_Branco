// ============================================
// MAPA INTERATIVO - mapa.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CONFIG
// ============================================
const OURO_BRANCO_CENTER = [-20.5185, -43.6920]
const DEFAULT_ZOOM = 15

const CORES_CATEGORIA = {
  antropotoponimo: '#2563eb',
  fitotoponimo: '#16a34a',
  axiotoponimo: '#9333ea',
  hagiotoponimo: '#ca8a04',
  litotoponimo: '#0d9488',
  outro: '#6b7280',
}

// ============================================
// HELPERS
// ============================================
function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  const normalizada = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
  const validas = ['antropotoponimo', 'fitotoponimo', 'ergotoponimo', 'axiotoponimo', 'hagiotoponimo', 'litotoponimo']
  return validas.includes(normalizada) ? normalizada : 'outro'
}

// ============================================
// STATE
// ============================================
let todasRuas = []
let bairrosMap = {}
let map = null
let markersLayer = null
let heatLayerFeminino = null
let heatLayerMasculino = null
let showHeatmap = false

// ============================================
// INIT MAP
// ============================================
function initMap() {
  map = L.map('map', {
    center: OURO_BRANCO_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  markersLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  })
  map.addLayer(markersLayer)
}

// ============================================
// CREATE MARKER
// ============================================
function criarMarcador(rua) {
  if (!rua.lat || !rua.lng) return null

  const categoria = normalizarCategoria(rua.categoria_toponimica)
  const cor = CORES_CATEGORIA[categoria] || CORES_CATEGORIA.outro

  // Custom icon with color
  const icon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${cor};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })

  const marker = L.marker([rua.lat, rua.lng], { icon })

  // Popup
  const significado = rua.significado || ''
  const sigPreview = significado.length > 150 ? significado.substring(0, 150) + '...' : significado
  const bairroNome = bairrosMap[rua.bairro_id]?.nome || ''

  marker.bindPopup(`
    <div class="mapa-popup">
      <h4>${rua.nome_oficial}</h4>
      ${bairroNome ? `<p class="popup-bairro"><i class="bi bi-geo-alt"></i> ${bairroNome}</p>` : ''}
      ${sigPreview ? `<p class="popup-sig">${sigPreview}</p>` : ''}
      ${rua.genero_homenageado ? `<p class="popup-genero">Gênero: ${rua.genero_homenageado}</p>` : ''}
      <a href="./index.html" class="popup-link">Ver detalhes →</a>
    </div>
  `)

  return marker
}

// ============================================
// APPLY FILTERS
// ============================================
function aplicarFiltros() {
  // Get selected categories
  const categSelecionadas = Array.from(
    document.querySelectorAll('#filtro-categorias input:checked')
  ).map(cb => cb.value)

  // Get selected genders
  const generosSelecionados = Array.from(
    document.querySelectorAll('#filtro-genero input:checked')
  ).map(cb => cb.value)

  // Get selected bairros
  const bairrosSelecionados = Array.from(
    document.querySelectorAll('#filtro-bairros input:checked')
  ).map(cb => cb.value)

  // Filter ruas
  const ruasFiltradas = todasRuas.filter(rua => {
    const categ = normalizarCategoria(rua.categoria_toponimica)
    const genero = rua.genero_homenageado || 'neutro'
    const bairroId = rua.bairro_id

    const isCategEmpty = categSelecionadas.length === 0
    const isGeneroEmpty = generosSelecionados.length === 0
    const isBairroEmpty = bairrosSelecionados.length === 0

    // Se todos os filtros do mapa estiverem completamente desmarcados, limpa o mapa (retorna false)
    if (isCategEmpty && isGeneroEmpty && isBairroEmpty) {
      return false
    }

    // Se uma categoria de filtro estiver vazia, mas outras não, ela não restringe a busca (funciona como 'permitir todos')
    const categOk = isCategEmpty || categSelecionadas.includes(categ)
    const generoOk = isGeneroEmpty || generosSelecionados.includes(genero)
    const bairroOk = isBairroEmpty || bairrosSelecionados.includes(String(bairroId))

    return categOk && generoOk && bairroOk
  })

  // Update markers
  markersLayer.clearLayers()
  const contagem = {}

  ruasFiltradas.forEach(rua => {
    const marker = criarMarcador(rua)
    if (marker) {
      markersLayer.addLayer(marker)
      const cat = normalizarCategoria(rua.categoria_toponimica)
      contagem[cat] = (contagem[cat] || 0) + 1
    }
  })

  // Update legend counts
  Object.keys(CORES_CATEGORIA).forEach(cat => {
    const el = document.getElementById(`cnt-${cat}`)
    if (el) el.textContent = contagem[cat] || 0
  })

  // Update total
  const totalEl = document.getElementById('total-marcadores')
  if (totalEl) totalEl.textContent = ruasFiltradas.filter(r => r.lat && r.lng).length

  // Update heatmap
  if (showHeatmap) {
    updateHeatmap(ruasFiltradas)
  }
}

// ============================================
// HEATMAP
// ============================================
function updateHeatmap(ruas) {
  if (heatLayerFeminino) {
    map.removeLayer(heatLayerFeminino)
    heatLayerFeminino = null
  }
  if (heatLayerMasculino) {
    map.removeLayer(heatLayerMasculino)
    heatLayerMasculino = null
  }

  if (!showHeatmap) return

  const pontosFeminino = ruas
    .filter(r => r.lat && r.lng && r.genero_homenageado === 'feminino')
    .map(r => [r.lat, r.lng, 1]) // peso 1

  const pontosMasculino = ruas
    .filter(r => r.lat && r.lng && r.genero_homenageado === 'masculino')
    .map(r => [r.lat, r.lng, 1]) // peso 1 também, pois vamos usar gradientes separados

  if (pontosFeminino.length > 0) {
    heatLayerFeminino = L.heatLayer(pontosFeminino, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      // Tons quentes (Rosa/Vermelho) para homenageadas mulheres
      gradient: { 0.4: '#fbcfe8', 0.65: '#f43f5e', 1: '#be123c' },
    })
    heatLayerFeminino.addTo(map)
  }

  if (pontosMasculino.length > 0) {
    heatLayerMasculino = L.heatLayer(pontosMasculino, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      // Tons frios (Azuis) para homenageados homens
      gradient: { 0.4: '#bfdbfe', 0.65: '#3b82f6', 1: '#1d4ed8' },
    })
    heatLayerMasculino.addTo(map)
  }
}

// ============================================
// POPULATE BAIRRO FILTER
// ============================================
function populateBairroFilter(bairros) {
  const container = document.getElementById('filtro-bairros')
  container.innerHTML = bairros.map(b => `
    <label class="filter-checkbox">
      <input type="checkbox" value="${b.id}" checked> ${b.nome}
    </label>
  `).join('')

  // Add event listeners
  container.querySelectorAll('input').forEach(cb => {
    cb.addEventListener('change', aplicarFiltros)
  })
}

// ============================================
// LOAD DATA
// ============================================
async function carregarDados() {
  try {
    // Load bairros
    const { data: bairros, error: bErr } = await supabase
      .from('bairros')
      .select('id, nome, slug')
      .order('nome')

    if (bErr) throw bErr

    bairros.forEach(b => { bairrosMap[b.id] = b })
    populateBairroFilter(bairros)

    // Load ruas with coords
    const { data: ruas, error: rErr } = await supabase
      .from('ruas')
      .select('*')
      .order('nome_oficial')

    if (rErr) throw rErr

    todasRuas = ruas || []
    aplicarFiltros()
  } catch (err) {
    console.error('Erro ao carregar dados do mapa:', err)
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
  // Clear filter buttons
  document.querySelectorAll('.btn-clear-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const targetSelector = e.currentTarget.getAttribute('data-target')
      if (targetSelector) {
        const checkboxes = document.querySelectorAll(`${targetSelector} input[type="checkbox"]`)
        const someChecked = Array.from(checkboxes).some(cb => cb.checked)
        
        checkboxes.forEach(cb => {
          cb.checked = !someChecked
        })
        
        e.currentTarget.textContent = someChecked ? "Marcar todos" : "Desmarcar todos"
        aplicarFiltros()
      }
    })
  })

  // Category filters
  document.querySelectorAll('#filtro-categorias input').forEach(cb => {
    cb.addEventListener('change', aplicarFiltros)
  })

  // Gender filters
  document.querySelectorAll('#filtro-genero input').forEach(cb => {
    cb.addEventListener('change', aplicarFiltros)
  })

  // Heatmap toggle
  document.getElementById('toggle-heatmap').addEventListener('change', (e) => {
    showHeatmap = e.target.checked
    aplicarFiltros()
  })

  // Mobile sidebar toggle
  const openBtn = document.getElementById('btn-open-sidebar')
  const closeBtn = document.getElementById('btn-close-sidebar')
  const sidebar = document.getElementById('sidebar')

  if (openBtn) {
    openBtn.addEventListener('click', () => sidebar.classList.add('open'))
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => sidebar.classList.remove('open'))
  }
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initMap()
  setupEventListeners()
  carregarDados()
})
