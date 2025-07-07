const mapa = L.map('map').setView([-20.5185, -43.6920], 15);

// Base do mapa (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(mapa);

let camadaRuas;
let dadosGeoJSONOriginal;

// Detecta o gênero com base no name da rua
function detectarGenero(name) {
  const n = name.trim().toLowerCase();
  if (n.endsWith('a')) return 'Feminino';
  if (n.endsWith('o')) return 'Masculino';
  return 'Neutro';
}

// Define a cor com base no gênero
function corPorGenero(genero) {
  return genero === 'Feminino' ? '#e60000'   // vermelho forte
       : genero === 'Masculino' ? '#0055ff'  // azul forte
       : '#999999';                          // cinza neutro
}

// Cria camada filtrada e estilizada
function criarCamadaFiltrada(dados) {
  return L.geoJSON(dados, {
    style: feature => ({
      color: corPorGenero(feature.properties.genero),
      weight: 4,
      opacity: 0.9,
      dashArray: '4,2', // efeito de linha tracejada como no ruasdogenero.pt
      lineJoin: 'round'
    }),
    onEachFeature: (feature, layer) => {
      const nome = feature.properties.name || feature.properties.nome || 'Rua sem nome';
      layer.bindPopup(`<strong>${nome}</strong><br>Gênero: ${feature.properties.genero}`);
    }
  });
}


// Carrega e trata o GeoJSON
async function carregarMapa() {
  const resposta = await fetch('ruas.geojson');
  const geojson = await resposta.json();

  // Adiciona o campo "genero" se não existir
  geojson.features.forEach(f => {
    const name = f.properties.name || '';
    if (!f.properties.genero) {
      f.properties.genero = detectarGenero(name);
    }
  });

  dadosGeoJSONOriginal = geojson;
  camadaRuas = criarCamadaFiltrada(geojson);
  camadaRuas.addTo(mapa);
}

// Filtra por gênero
function filtrar(genero) {
  if (!dadosGeoJSONOriginal) {
    alert("Mapa ainda está carregando. Por favor, aguarde...");
    return;
  }

  if (camadaRuas) mapa.removeLayer(camadaRuas);

  const dadosFiltrados = {
    ...dadosGeoJSONOriginal,
    features: dadosGeoJSONOriginal.features.filter(f =>
      genero === 'Todos' || f.properties.genero === genero
    )
  };

  camadaRuas = criarCamadaFiltrada(dadosFiltrados);
  camadaRuas.addTo(mapa);
}

// Inicialização
carregarMapa();
