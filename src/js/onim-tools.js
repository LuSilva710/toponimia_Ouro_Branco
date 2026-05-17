import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { supabase } from './supabase-client.js';

/** Mesmo modelo das ruas indexadas em scripts/generate-embeddings.mjs (1536 dims) */
const GEMINI_EMBEDDING_MODEL = 'models/gemini-embedding-2';

async function embeddingConsultaTopo(termo) {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key || !termo?.trim()) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GEMINI_EMBEDDING_MODEL,
        taskType: 'RETRIEVAL_QUERY',
        output_dimensionality: 1536,
        content: { parts: [{ text: termo.trim() }] },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('⚠️ Embedding (Gemini):', response.status, data?.error?.message ?? '');
      return null;
    }
    const values = data?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch (e) {
    console.warn('⚠️ Sem embedding vetorial:', e?.message ?? e);
    return null;
  }
}
const onimLog = (type, msg) => {
  console.log(`%c[ONIM ${type}] %c${msg}`, "color: #ff9d00; font-weight: bold", "color: #fff");
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('onim-debug', { detail: { type, msg } }));
  }
};

/**
 * Ferramenta de Busca Histórica (ONIM v3.0)
 * Schema estrito (all fields required) para evitar avisos de API.
 */
export const historicalSearchTool = new DynamicStructuredTool({
  name: "historical_search",
  description: "Busca informações detalhadas sobre ruas, praças ou biografias de Ouro Branco.",
  schema: z.object({
    termo: z.string().describe("O nome da rua ou termo de busca (obrigatório)")
  }),
  func: async ({ termo }) => {
    if (typeof window !== 'undefined') onimLog('FERRAMENTA', `Busca Histórica: "${termo}"`);

    let queryEmbedding = null;
    try {
      queryEmbedding = await embeddingConsultaTopo(termo);
      if (!queryEmbedding && typeof window !== 'undefined' && !(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim()) {
        onimLog('FERRAMENTA', 'Busca só textual — VITE_GEMINI_API_KEY ausente (embeddings alinhadas ao script generate-embeddings).');
      }
    } catch (e) {
      console.warn("⚠️ Sem embedding vetorial:", e?.message ?? e);
    }

    let resultadosVetoriais = [];
    if (queryEmbedding) {
      const { data: vetoriais } = await supabase.rpc('match_ruas', {
        query_embedding: queryEmbedding,
        match_threshold: 0.60,
        match_count: 5
      });
      resultadosVetoriais = vetoriais || [];
    }

    const stopwords = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'rua', 'avenida', 'quem', 'foi'];
    const keywords = termo.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !stopwords.includes(w));
    
    let resultadosTextuais = [];
    if (keywords.length > 0) {
      const orFilter = keywords.map(k => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%`).join(',');
      const { data } = await supabase.from('ruas').select('id, nome_oficial, categoria_toponimica, significado, bairros(nome)').or(orFilter).limit(5);
      resultadosTextuais = data || [];
    }

    const mapa = new Map();
    [...resultadosTextuais, ...resultadosVetoriais].forEach(r => {
      if (!mapa.has(r.nome_oficial)) mapa.set(r.nome_oficial, r);
    });

    const finais = Array.from(mapa.values());
    if (finais.length === 0) return "Nenhum registro oficial encontrado.";

    return finais.map(r => (
      `--- LOGRADOURO ENCONTRADO ---\n` +
      `CONTEÚDO DO ACERVO OFICIAL: ${r.significado || 'Pesquisa em andamento.'}\n` +
      `Nome: ${r.nome_oficial}\n` +
      `Bairro: ${r.bairros?.nome || 'Desconhecido'}\n` +
      `Categoria: ${r.categoria_toponimica || 'Não classificada'}\n`
    )).join('\n');
  }
});

/**
 * Ferramenta de Estatísticas (ONIM v3.0)
 */
export const statsTool = new DynamicStructuredTool({
  name: "get_statistics",
  description: "Retorna o total de ruas, bairros e a distribuição por categoria.",
  schema: z.object({
    confirmar: z.boolean().describe("Confirmar execução (sempre true)")
  }),
  func: async () => {
    if (typeof window !== 'undefined') onimLog('FERRAMENTA', `Gerando Estatísticas...`);
    const [resRuas, resBairros, resTopCat] = await Promise.all([
      supabase.from('ruas').select('*', { count: 'exact', head: true }),
      supabase.from('bairros').select('*', { count: 'exact', head: true }),
      supabase.from('ruas').select('categoria_toponimica')
    ]);

    const totalRuas = resRuas.count || 0;
    const totalBairros = resBairros.count || 0;
    
    const contagem = {};
    resTopCat.data?.forEach(r => {
      const cat = r.categoria_toponimica || 'Não classificada';
      contagem[cat] = (contagem[cat] || 0) + 1;
    });

    const categoriasMarkdown = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, qtd]) => `- ${cat}: ${qtd} ruas (${((qtd/totalRuas)*100).toFixed(1)}%)`)
      .join('\n');

    return `
      Estatísticas Reais do Acervo:
      - Total de ruas: ${totalRuas}
      - Total de bairros: ${totalBairros}
      - Distribuição por Categoria:
${categoriasMarkdown}
    `;
  }
});

/**
 * Ferramenta de Contexto de Bairro (ONIM v3.0)
 */
export const neighborhoodContextTool = new DynamicStructuredTool({
  name: "neighborhood_info",
  description: "Busca a história de um bairro específico.",
  schema: z.object({
    bairro: z.string().describe("O nome do bairro (obrigatório)")
  }),
  func: async ({ bairro }) => {
    if (typeof window !== 'undefined') onimLog('FERRAMENTA', `Bairro: "${bairro}"`);
    const { data: bairros } = await supabase
      .from('bairros')
      .select('nome, titulo, descricao')
      .ilike('nome', `%${bairro}%`)
      .limit(1);

    if (!bairros || bairros.length === 0) return "Bairro não encontrado.";

    const b = bairros[0];
    return `Bairro: ${b.nome}\nTítulo: ${b.titulo || 'N/A'}\nHistória: ${b.descricao || 'Sem descrição disponível.'}`;
  }
});
