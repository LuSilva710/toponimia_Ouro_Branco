/**
 * scripts/list-models.mjs
 * Descobrir quais modelos estão disponíveis para a sua API Key
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY;

async function list() {
  console.log("🔍 Consultando modelos disponíveis para sua chave...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("❌ Erro da API:", data.error.message);
      return;
    }

    const embeddingModels = data.models.filter(m => 
      m.supportedGenerationMethods.includes('embedContent')
    );

    if (embeddingModels.length === 0) {
      console.log("⚠️ Nenhum modelo de EMBEDDING encontrado para esta chave.");
      console.log("Modelos totais disponíveis:", data.models.map(m => m.name).join(', '));
    } else {
      console.log("✅ Modelos de Embedding disponíveis:");
      embeddingModels.forEach(m => console.log(`  - ${m.name}`));
    }
  } catch (e) {
    console.error("❌ Erro na consulta:", e.message);
  }
}

list();
