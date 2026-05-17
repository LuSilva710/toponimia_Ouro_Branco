// ============================================
// MAPA INTERATIVO - mapa.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CONFIG
// ============================================
const OURO_BRANCO_CENTER = [-20.5185, -43.6920]
const DEFAULT_ZOOM = 15
const STREETS_GEOJSON_URL = `${import.meta.env.BASE_URL}data/ouro_branco_streets.json`;

const CORES_CATEGORIA = {
  antropotoponimo: '#2563eb',
  fitotoponimo: '#16a34a',
  axiotoponimo: '#9333ea',
  hagiotoponimo: '#ca8a04',
  litotoponimo: '#94530d',
  zootoponimo: '#facc15',
  corotoponimo: '#fb7185', // Rosa coral
  sociotoponimo: '#C5CB81', // Verde musgo (alinhado às estatísticas)
  outro: '#6b7280',
}

const ROTULO_CATEGORIA = {
  antropotoponimo: 'Antropotopônimo',
  fitotoponimo: 'Fitotopônimo',
  axiotoponimo: 'Axiotopônimo',
  hagiotoponimo: 'Hagiotopônimo',
  corotoponimo: 'Corotopônimo',
  zootoponimo: 'Zootopônimo',
  litotoponimo: 'Litotopônimo',
  sociotoponimo: 'Sociotopônimo',
  outro: 'Outro',
}

const CORES_GENERO = {
  masculino: '#06b6d4', 
  feminino: '#a855f7',  
  neutro: '#94a3b8',
}

// ============================================
// HELPERS
// ============================================
function normalizarCategoria(cat) {
  if (!cat) return 'outro'
  let n = String(cat)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim()
  n = n.replace(/[-_\s\u00a0]+/g, '')
  while (n.endsWith('toponimos')) n = n.slice(0, -1)
  const chaves = Object.keys(CORES_CATEGORIA).filter((k) => k !== 'outro')
  return chaves.includes(n) ? n : 'outro'
}

function normalizarNomeRua(nome) {
  if (!nome) return ''
  return nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(rua|avenida|travessa|alameda|pca|praca|r\.|av\.)\b/gi, '')
    .trim()
}

// ============================================
// STATE
// ============================================
let todasRuas = []
let bairrosMap = {}
let streetsGeoJSON = null
let map = null
let markersLayer = null
let geojsonLayer = null
let heatLayerFeminino = null
let heatLayerMasculino = null
let showHeatmap = false
let visualMode = 'genero' // 'genero' ou 'categoria'

// Objeto para acesso rápido às camadas do GeoJSON por nome da rua (normalizado)
const layersPorRua = {}

// ============================================
// INIT MAP
// ============================================
function initMap() {
  map = L.map('map', {
    center: OURO_BRANCO_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
  })

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // Usando um mapa base mais minimalista estilo data-journalism
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map)

  markersLayer = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    // Custom cluster icon without number
    iconCreateFunction: function (cluster) {
      // Create a simple circle without numeric label
      return L.divIcon({
        html: `<div class="custom-cluster-circle"></div>`,
        className: 'custom-cluster-icon',
        iconSize: L.point(40, 40)
      });
    }
  });
  map.addLayer(markersLayer)

  geojsonLayer = L.geoJSON(null, {
    style: feature => ({
      color: '#333',
      weight: 3,
      opacity: 0.6
    }),
    onEachFeature: (feature, layer) => {
      // Logic for polyline popups will be handled during filter application
    }
  }).addTo(map)
}

/** Leaflet precisa recalcular o tamanho quando o layout ao lado muda (ex.: legenda/panorama). */
function invalidateMapSizeSoon() {
  if (!map) return
  requestAnimationFrame(() => {
    map.invalidateSize({ animate: false })
    setTimeout(() => map.invalidateSize({ animate: false }), 150)
  })
}

/** Altura real da navbar → --map-navbar-offset (evita desvio entre 100vh e o bloco fixo do mapa). */
function syncMapNavbarOffset() {
  const nav = document.querySelector('header .navbar.fixed-top')
  if (!nav) return
  document.documentElement.style.setProperty('--map-navbar-offset', `${nav.offsetHeight}px`)
}

function setupMapResizeObserver() {
  const el = document.querySelector('.map-container')
  if (!el || !map || !window.ResizeObserver) return
  const ro = new ResizeObserver(() => {
    map.invalidateSize({ animate: false })
  })
  ro.observe(el)
}

// ============================================
// CREATE MARKER
// ============================================
function criarMarcador(rua) {
  if (!rua.lat || !rua.lng) return null

  const categoria = normalizarCategoria(rua.categoria_toponimica)
  const genero = rua.genero_homenageado || 'neutro'
  
  const corCat = CORES_CATEGORIA[categoria] || CORES_CATEGORIA.outro
  const corGen = CORES_GENERO[genero] || CORES_GENERO.neutro

  // Definir cor base dependendo do modo visual
  const corFinal = (visualMode === 'genero') ? corGen : corCat

  // Custom SVG icon
  const icon = L.divIcon({
    className: 'premium-marker',
    html: `
      <div class="marker-container" data-nome-rua="${normalizarNomeRua(rua.nome_oficial)}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8" fill="white" fill-opacity="0.2" stroke="${corFinal}" stroke-width="2"/>
          <circle cx="12" cy="12" r="3" fill="${corFinal}"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

  const marker = L.marker([rua.lat, rua.lng], { icon })

  // Interação: Destaque da rua no GeoJSON ao passar o mouse
  marker.on('mouseover', function () {
    const nomeNorm = normalizarNomeRua(rua.nome_oficial)
    destacarRua(nomeNorm)
  })

  marker.on('mouseout', function () {
    const nomeNorm = normalizarNomeRua(rua.nome_oficial)
    removerDestaqueRua(nomeNorm)
  })

  // Popup
  const significado = rua.significado || ''
  const sigPreview = significado.length > 150 ? significado.substring(0, 150) + '...' : significado
  const bairroNome = bairrosMap[rua.bairro_id]?.nome || ''

  marker.bindPopup(`
    <div class="mapa-popup">
      <div class="popup-header" style="border-left: 4px solid ${corGen}">
        <h4>${rua.nome_oficial}</h4>
        <span class="badge" style="background: ${corCat}">${ROTULO_CATEGORIA[categoria] || categoria}</span>
      </div>
      <div class="popup-body">
        ${bairroNome ? `<p class="popup-bairro"><i class="bi bi-geo-alt"></i> ${bairroNome}</p>` : ''}
        ${sigPreview ? `<p class="popup-sig">${sigPreview}</p>` : ''}
        <div class="popup-meta">
          <span class="genero-tag ${genero}"><i class="bi bi-person"></i> ${genero}</span>
        </div>
        <a href="./index.html" class="popup-link">Ver bio completa →</a>
      </div>
    </div>
  `)

  return marker
}

// Funções de Destaque
function destacarRua(nomeNorm) {
  const layer = layersPorRua[nomeNorm]
  if (layer) {
    layer.setStyle({
      weight: 10,
      opacity: 1,
      dashArray: ''
    })
    layer.bringToFront()
  }
}

function removerDestaqueRua(nomeNorm) {
  const layer = layersPorRua[nomeNorm]
  if (layer) {
    // Restaurar estilo original
    const ruaData = layer.ruaData
    if (ruaData) {
      const cat = normalizarCategoria(ruaData.categoria_toponimica)
      const gen = ruaData.genero_homenageado || 'neutro'
      const cor = (visualMode === 'genero') ? CORES_GENERO[gen] : CORES_CATEGORIA[cat]
      
      layer.setStyle({
        color: cor || '#6b7280',
        weight: 8,
        opacity: 0.8
      })
    }
  }
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

    // Se todos os filtros do mapa estiverem completamente desmarcados, mostra todas as ruas (nenhum filtro)
    if (isCategEmpty && isGeneroEmpty && isBairroEmpty) {
      return true;
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

  // Update GeoJSON Streets
  renderizarRuasGeoJSON(ruasFiltradas)

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

  // Update Gender Statistics
  atualizarEstatisticasGenero(ruasFiltradas)
  // Update Category Statistics
  atualizarEstatisticasCategoria(ruasFiltradas)
}

function atualizarEstatisticasCategoria(ruas) {
  const total = ruas.length
  if (total === 0) return

  const contagem = {}
  Object.keys(CORES_CATEGORIA).forEach(c => contagem[c] = 0)

  ruas.forEach(r => {
    const cat = normalizarCategoria(r.categoria_toponimica)
    if (contagem[cat] !== undefined) contagem[cat]++
    else contagem.outro++
  })

  // Atualizar UI
  const listContainer = document.getElementById('stats-list-categorias')
  if (!listContainer) return

  listContainer.innerHTML = Object.keys(CORES_CATEGORIA).map(cat => {
    const count = contagem[cat]
    const percent = total > 0 ? ((count / total) * 100).toFixed(1) : 0
    const cor = CORES_CATEGORIA[cat]
    
    return `
      <div class="stat-item">
        <div class="stat-info">
          <span class="stat-label">${ROTULO_CATEGORIA[cat] || cat}</span>
          <span class="stat-values">${count} (${percent}%)</span>
        </div>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width: ${percent}%; background: ${cor}"></div>
        </div>
      </div>
    `
  }).join('')
}

function atualizarEstatisticasGenero(ruas) {
  const total = ruas.length
  if (total === 0) return

  const contagem = { masculino: 0, feminino: 0, neutro: 0 }
  ruas.forEach(r => {
    const gen = r.genero_homenageado || 'neutro'
    if (contagem[gen] !== undefined) contagem[gen]++
    else contagem.neutro++
  })

  // Atualizar UI
  const generos = ['masculino', 'feminino', 'neutro']
  generos.forEach(gen => {
    const countEl = document.getElementById(`stats-count-${gen}`)
    const percentEl = document.getElementById(`stats-percent-${gen}`)
    const barEl = document.getElementById(`stats-bar-${gen}`)
    
    if (countEl && percentEl && barEl) {
      const count = contagem[gen]
      const percent = ((count / total) * 100).toFixed(1)
      
      countEl.textContent = count
      percentEl.textContent = `${percent}%`
      barEl.style.width = `${percent}%`
    }
  })
}

// ============================================
// RENDER GEOJSON STREETS
// ============================================
function renderizarRuasGeoJSON(ruasFiltradas) {
  if (!geojsonLayer || !streetsGeoJSON) return

  geojsonLayer.clearLayers()
  // Limpar cache de camadas
  for (let key in layersPorRua) delete layersPorRua[key]

  // Map of normalized names for fast lookup
  const mapaRuasFiltradas = new Map()
  ruasFiltradas.forEach(r => {
    mapaRuasFiltradas.set(normalizarNomeRua(r.nome_oficial), r)
  })

  // Add features from GeoJSON that match filtered streets
  const featuresParaExibir = streetsGeoJSON.features.filter(f => {
    const nomeNorm = normalizarNomeRua(f.properties.name)
    return mapaRuasFiltradas.has(nomeNorm)
  })

  geojsonLayer.addData(featuresParaExibir)

  geojsonLayer.eachLayer(layer => {
    const f = layer.feature
    const nomeNorm = normalizarNomeRua(f.properties.name)
    const ruaData = mapaRuasFiltradas.get(nomeNorm)

    if (ruaData) {
      const cat = normalizarCategoria(ruaData.categoria_toponimica)
      const gen = ruaData.genero_homenageado || 'neutro'
      const cor = (visualMode === 'genero') ? CORES_GENERO[gen] : CORES_CATEGORIA[cat]

      layer.ruaData = ruaData // Guardar dados para fácil acesso
      layersPorRua[nomeNorm] = layer // Guardar camada para destaque

      layer.setStyle({
        color: cor || '#6b7280',
        weight: 8,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      })

      // Interação reversa: Highlight do marcador ao passar o mouse na rua
      layer.on('mouseover', function () {
        layer.setStyle({ weight: 10, opacity: 1 })
        
        // Tentar encontrar o elemento do marcador no DOM para aplicar efeito CSS
        const markerEl = document.querySelector(`.marker-container[data-nome-rua="${nomeNorm}"]`)
        if (markerEl) markerEl.classList.add('highlight-pulse')
      })

      layer.on('mouseout', function () {
        layer.setStyle({ weight: 6, opacity: 0.7 })
        const markerEl = document.querySelector(`.marker-container[data-nome-rua="${nomeNorm}"]`)
        if (markerEl) markerEl.classList.remove('highlight-pulse')
      })

      // Popup for polyline
      // Popup for polyline - more comprehensive like marker popup
      const significado = ruaData.significado || ''
      const sigPreview = significado.length > 200 ? significado.substring(0, 200) + '...' : significado
      const bairroNome = bairrosMap[ruaData.bairro_id]?.nome || ''
      const corGen = CORES_GENERO[gen] || CORES_GENERO.neutro
      
      layer.bindPopup(`
        <div class="mapa-popup">
          <div class="popup-header" style="border-left: 4px solid ${corGen}">
            <h4>${ruaData.nome_oficial}</h4>
            <span class="badge" style="background: ${cor}">${visualMode === 'genero' ? (gen.charAt(0).toUpperCase() + gen.slice(1)) : ROTULO_CATEGORIA[cat]}</span>
          </div>
          <div class="popup-body">
            ${bairroNome ? `<p class="popup-bairro"><i class="bi bi-geo-alt"></i> ${bairroNome}</p>` : ''}
            ${sigPreview ? `<p class="popup-sig">${sigPreview}</p>` : ''}
            <div class="popup-meta">
              <span class="genero-tag ${gen}"><i class="bi bi-person"></i> ${gen}</span>
            </div>
            <a href="./index.html" class="popup-link">Ver detalhes →</a>
          </div>
        </div>
      `, {
        maxWidth: 300,
        className: 'premium-popup'
      })
    }
  })
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

    // Load GeoJSON geometry
    console.log('Carregando geometria das ruas...')
    console.log('Fetching GeoJSON from', STREETS_GEOJSON_URL);
    const geoResponse = await fetch(STREETS_GEOJSON_URL);
    console.log('GeoJSON fetch status:', geoResponse.status);
    if (geoResponse.ok) {
      streetsGeoJSON = await geoResponse.json();
      console.log('GeoJSON loaded, features:', streetsGeoJSON.features?.length);
    } else {
      console.error('Failed to load GeoJSON:', geoResponse.statusText);
    }

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
    openBtn.addEventListener('click', () => {
      sidebar.classList.add('open')
      invalidateMapSizeSoon()
    })
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.remove('open')
      invalidateMapSizeSoon()
    })
  }

  // Visual Mode Toggles
  const modeToggles = document.querySelectorAll('input[name="visual-mode"]')
  modeToggles.forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      visualMode = e.target.value
      aplicarFiltros()
      
      // Update legend title/visibility
      document.getElementById('legend-title').textContent = (visualMode === 'genero') ? 'Gêneros' : 'Categorias'
      document.getElementById('legenda-categorias').style.display = (visualMode === 'genero') ? 'none' : 'block'
      document.getElementById('legenda-genero').style.display = (visualMode === 'genero') ? 'block' : 'none'

      // Update panorama title/visibility
      document.getElementById('panorama-title').textContent = (visualMode === 'genero') ? 'Panorama de Gênero' : 'Panorama de Categorias'
      document.getElementById('panorama-categorias').style.display = (visualMode === 'genero') ? 'none' : 'block'
      document.getElementById('panorama-genero').style.display = (visualMode === 'genero') ? 'block' : 'none'

      invalidateMapSizeSoon()
    })
  })
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  syncMapNavbarOffset()
  initMap()
  setupMapResizeObserver()
  invalidateMapSizeSoon()
  window.addEventListener('resize', syncMapNavbarOffset)

  const navCollapse = document.getElementById('navbarScroll')
  if (navCollapse) {
    navCollapse.addEventListener('shown.bs.collapse', syncMapNavbarOffset)
    navCollapse.addEventListener('hidden.bs.collapse', syncMapNavbarOffset)
  }

  setupEventListeners()
  carregarDados()
})
