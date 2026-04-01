import fs from 'fs'
import path from 'path'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const QUERY = `
  [out:json][timeout:60];
  area[name="Ouro Branco"][admin_level=8]->.a;
  (
    way(area.a)[highway][name];
  );
  out geom;
`

async function getStreets() {
  console.log('Fetching streets geometry from Overpass API...')
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: `data=${encodeURIComponent(QUERY)}`
  })

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.statusText}`)
  }

  const data = await response.ok ? await response.json() : null
  if (!data || !data.elements) {
    console.error('No data elements found.')
    return
  }

  console.log(`Found ${data.elements.length} street elements. Converting to GeoJSON...`)

  const geojson = {
    type: 'FeatureCollection',
    features: data.elements.map(el => ({
      type: 'Feature',
      properties: {
        name: el.tags.name,
        highway: el.tags.highway
      },
      geometry: {
        type: 'LineString',
        coordinates: el.geometry ? el.geometry.map(g => [g.lon, g.lat]) : []
      }
    }))
  }

  const outputPath = path.join(process.cwd(), 'assets', 'data', 'ouro_branco_streets.json')
  
  // Ensure directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2))
  console.log(`Successfully saved GeoJSON to ${outputPath}`)
}

getStreets().catch(console.error)
