// fetch_osm_geometry.mjs
// Fetch geometries from Overpass API for streets missing in the GeoJSON.
// Uses global fetch (Node >=18). Handles 504/429 by retrying up to 3 times per street.

import fs from 'fs';

const BOUNDING_BOX = '-20.6,-43.8,-20.4,-43.6'; // south,west,north,east
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RETRIES = 3;
const BATCH_SIZE = 5; // small to respect rate limits
const DELAY_MS = 8000; // 8 seconds between batches

async function fetchGeometry(streetName) {
  const query = `[out:json][timeout:30];
    (
      way["name"~"${streetName}", i](${BOUNDING_BOX});
      node["name"~"${streetName}", i](${BOUNDING_BOX});
    );
    out center;`;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      if (!response.ok) {
        console.warn(`[WARN] Overpass status ${response.status} on attempt ${attempt} for "${streetName}"`);
        // 429 or 504 – wait and retry
        await new Promise(r => setTimeout(r, DELAY_MS * attempt));
        continue;
      }
      const data = await response.json();
      if (!data.elements || data.elements.length === 0) return null;
      // Prefer ways (polylines)
      const way = data.elements.find(el => el.type === 'way' && el.geometry);
      const target = way || data.elements[0];
      if (target.type === 'way' && target.geometry) {
        const coords = target.geometry.map(p => [p.lon, p.lat]);
        return { type: 'LineString', coordinates: coords };
      }
      // fallback to point (center or node)
      const lat = target.center ? target.center.lat : target.lat;
      const lon = target.center ? target.center.lon : target.lon;
      if (lat !== undefined && lon !== undefined) {
        return { type: 'Point', coordinates: [lon, lat] };
      }
      return null;
    } catch (err) {
      console.error(`[ERROR] Fetch failed for "${streetName}" attempt ${attempt}: ${err.message}`);
      await new Promise(r => setTimeout(r, DELAY_MS * attempt));
    }
  }
  return null; // all attempts failed
}

async function run() {
  const missingPath = 'scripts/maintenance/missing_streets.json';
  if (!fs.existsSync(missingPath)) {
    console.error('missing_streets.json not found. Run: node scripts/maintenance/missing_streets.js');
    return;
  }
  const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));
  const results = {};
  const totalBatches = Math.ceil(missing.length / BATCH_SIZE);
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batch = missing.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
    console.log(`Processing batch ${batchIdx + 1}/${totalBatches} (${batch.length} streets)`);
    for (const name of batch) {
      const geom = await fetchGeometry(name);
      if (geom) {
        results[name] = geom;
        console.log(`[OK] ${name}`);
      } else {
        console.warn(`[WARN] Geometry not found for ${name}`);
      }
    }
    // pause between batches
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  fs.writeFileSync('scripts/geo/osm_geometries.json', JSON.stringify(results, null, 2), 'utf8');
  console.log(`Finished. ${Object.keys(results).length} geometries saved to scripts/geo/osm_geometries.json`);
}

run();
