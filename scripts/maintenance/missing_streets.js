import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  // 1. Busca todas as ruas cadastradas no Supabase
  const { data: ruas } = await supabase.from('ruas').select('nome_oficial');
  if (!ruas) {
    console.error('Erro ao buscar ruas no Supabase');
    return;
  }
  const nomesBanco = ruas.map(r => r.nome_oficial.trim().toLowerCase());

  // 2. Lê o GeoJSON existente
  const geojsonPath = 'data/ouro_branco_streets.json';
  const geojsonRaw = fs.readFileSync(geojsonPath, 'utf8');
  const geojson = JSON.parse(geojsonRaw);
  const nomesGeo = geojson.features.map(f => (f.properties?.nome || '').trim().toLowerCase());

  // 3. Identifica ruas que estão no banco mas não têm geometria no GeoJSON
  const faltantes = nomesBanco.filter(nome => !nomesGeo.includes(nome));

  // 4. Salva a lista em JSON para uso posterior
  fs.writeFileSync('scripts/missing_streets.json', JSON.stringify(faltantes, null, 2), 'utf8');
  console.log(`Encontradas ${faltantes.length} ruas sem geometria. Lista salva em scripts/missing_streets.json`);
}

run();
