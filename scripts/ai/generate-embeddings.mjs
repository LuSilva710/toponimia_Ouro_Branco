/**
 * scripts/generate-embeddings.mjs
 * Versão Resiliente (Fetch Direto) para evitar erros de versão do SDK
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Prioriza a Service Role Key para ter permissão de escrita (Bypass RLS)
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Erro: VITE_GEMINI_API_KEY não encontrada no .env");
  process.exit(1);
}

if (SUPABASE_KEY === process.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("⚠️ Aviso: Usando chave ANON. A atualização pode falhar se o RLS estiver ativo.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getEmbedding(text) {
  const modelPath = "v1beta/models/gemini-embedding-2";
  try {
    const url = `https://generativelanguage.googleapis.com/${modelPath}:embedContent?key=${GEMINI_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "models/gemini-embedding-2",
        taskType: "RETRIEVAL_DOCUMENT",
        output_dimensionality: 1536,
        content: { parts: [{ text }] } 
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.embedding.values;
    } else {
      const errorData = await response.json();
      throw new Error(`[${response.status}] ${errorData.error?.message || 'Erro desconhecido'}`);
    }
  } catch (e) {
    throw e;
  }
}

async function start() {
  console.log("🔍 Iniciando processo de geração de embeddings (Modo Direto)...");
  
  while (true) {
    const { data: ruas, error } = await supabase
      .from('ruas')
      .select('id, nome_oficial, significado')
      .is('embedding', null)
      .not('significado', 'is', null)
      .limit(50);

    if (error) {
      console.error("❌ Erro no Supabase:", error);
      break;
    }

    if (!ruas || ruas.length === 0) {
      console.log("✅ Concluído! Todas as ruas elegíveis possuem embeddings.");
      break;
    }

    console.log(`🚀 Processando lote de ${ruas.length} ruas...`);

    for (const rua of ruas) {
      try {
        const textToEmbed = `Logradouro: ${rua.nome_oficial}. História e Significado: ${rua.significado}`;
        const embedding = await getEmbedding(textToEmbed);

        const { error: updErr } = await supabase
          .from('ruas')
          .update({ embedding })
          .eq('id', rua.id);

        if (updErr) throw updErr;
        
        console.log(`  - ✅ ${rua.nome_oficial}`);
        await wait(200);
      } catch (e) {
        console.error(`  - ❌ Erro em ${rua.nome_oficial}:`, e.message);
        if (e.message.includes('429')) {
          console.log("⏳ Limite de quota atingido. Aguardando 1 minuto...");
          await wait(60000);
        }
      }
    }
  }
}

start();
