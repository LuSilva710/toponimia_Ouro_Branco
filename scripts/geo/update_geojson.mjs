import fs from 'fs';

const geojsonPath = 'data/ouro_branco_streets.json';
const geometriesPath = 'scripts/osm_geometries.json';

if (!fs.existsSync(geojsonPath)) {
  console.error('GeoJSON file not found:', geojsonPath);
  process.exit(1);
}
if (!fs.existsSync(geometriesPath)) {
  console.error('Geometries file not found:', geometriesPath);
  process.exit(1);
}

const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
const geometries = JSON.parse(fs.readFileSync(geometriesPath, 'utf8'));

let added = 0;
for (const [streetName, geom] of Object.entries(geometries)) {
  // Check if already exists (by name)
  const exists = geojson.features.some(f => (f.properties?.nome || '').toLowerCase() === streetName.toLowerCase());
  if (exists) continue;
  const feature = {
    type: 'Feature',
    properties: {
      nome: streetName,
      // opcional: pode incluir bairro vazio; será preenchido depois se necessário
    },
    geometry: geom
  };
  geojson.features.push(feature);
  added++;
}

fs.writeFileSync(geojsonPath, JSON.stringify(geojson, null, 2), 'utf8');
console.log(`GeoJSON atualizado. ${added} novas features adicionadas.`);
