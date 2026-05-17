import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Iniciando Sincronização OSM -> Supabase ---');
    
    // 1. Buscar todas as ruas que estão fora de Ouro Branco
    let { data: ruas } = await supabase.from('ruas').select('id, nome_oficial, lat, lng');
    const fora = ruas.filter(r => r.lat && (r.lat > -20.4 || r.lat < -20.6 || r.lng > -43.6 || r.lng < -43.8));
    
    console.log(`Encontradas ${fora.length} ruas com problemas geográficos.`);

    const boundingBox = '-20.6,-43.8,-20.4,-43.6';
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    let sqlUpdates = "-- SCRIPT DE ATUALIZAÇÃO MASSIVA VIA OSM\n-- =======================================\n\n";
    sqlUpdates += "-- 1. Limpeza preventiva de ruas fora de MG\n";
    sqlUpdates += "UPDATE ruas SET lat = NULL, lng = NULL WHERE (lat > -20.4 OR lat < -20.6 OR lng > -43.6 OR lng < -43.8) AND lat IS NOT NULL;\n\n";

    // Processar de 1 em 1 para ser o mais conservador possível com a API
    const batchSize = 1;
    for (let i = 0; i < fora.length; i += batchSize) {
        const batch = fora.slice(i, i + batchSize);
        const namesRegex = batch.map(r => r.nome_oficial.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        
        console.log(`Processando lote ${Math.floor(i/batchSize) + 1}...`);

        const query = `[out:json][timeout:25];
        (
          way["name"~"${namesRegex}", i](${boundingBox});
          node["name"~"${namesRegex}", i](${boundingBox});
        );
        out center;`;

        try {
            const response = await fetch(overpassUrl, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(query)
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`[ERRO] Resposta da API (${response.status}): ${text.substring(0, 100)}...`);
                continue;
            }

            const data = await response.json();
            
            if (data.elements) {
                batch.forEach(ruaDB => {
                    const match = data.elements.find(el => {
                        const nameOSM = el.tags && el.tags.name;
                        return nameOSM && nameOSM.toLowerCase().includes(ruaDB.nome_oficial.toLowerCase());
                    });

                    if (match) {
                        const lat = match.center ? match.center.lat : match.lat;
                        const lon = match.center ? match.center.lon : match.lon;
                        sqlUpdates += `UPDATE ruas SET lat = ${lat}, lng = ${lon} WHERE id = '${ruaDB.id}'; -- ${ruaDB.nome_oficial}\n`;
                        console.log(`[OK] Encontrada: ${ruaDB.nome_oficial} -> ${lat}, ${lon}`);
                    } else {
                        console.log(`[AVISO] Não encontrada no OSM: ${ruaDB.nome_oficial}`);
                    }
                });
                
                // Salvar progresso incrementalmente
                fs.writeFileSync('sql/19_update_mass_coordinates_osm.sql', sqlUpdates);
            }
        } catch (err) {
            console.error('Erro no lote:', err.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 7000)); // Delay longo entre lotes (1 em 1)
    }

    console.log('\nFinalizado! Script SQL final gerado em: sql/19_update_mass_coordinates_osm.sql');
}

run();
