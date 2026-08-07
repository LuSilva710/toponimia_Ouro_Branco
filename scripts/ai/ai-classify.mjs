/**
 * ai-classify.mjs — Classificação automática de ruas via ai-provider-kit
 *
 * Usa o ai-provider-kit para classificar ruas sem categoria usando IA.
 * O modelo analisa o nome e retorna a categoria toponímica mais adequada.
 *
 * Uso:
 *   node scripts/ai/ai-classify.mjs [--dry-run] [--limit=N] [--input=arquivo.json]
 *
 * Flags:
 *   --dry-run        Mostra o que seria feito sem chamar a IA/Supabase
 *   --limit=N        Processa apenas os primeiros N registros (padrão: 20)
 *   --input=FILE     Arquivo JSON de entrada (padrão: scripts/maintenance/missing_streets.json)
 *   --batch=N        Tamanho do lote enviado à IA por requisição (padrão: 10)
 *
 * Saída (gitignored):
 *   scripts/ai/ai-classify-results.json  → resultados completos
 *   scripts/ai/ai-classify.sql           → SQL para aplicar no Supabase
 *
 * Variáveis de ambiente (configurar em ai-provider-kit/.env ou .env raiz):
 *   AI_PROVIDER    = gemini | openai | codex
 *   GEMINI_API_KEY = ...
 *   OPENAI_API_KEY = ...
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Setup ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega .env manualmente (sem depender do dotenv no projeto raiz)
// Tenta em ordem: ai-provider-kit/.env → .env raiz
function _loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '..', 'ai-provider-kit', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = val;
      }
      console.log(`[ai-classify] .env carregado: ${envPath}`);
      return;
    }
  }
  console.warn('[ai-classify] Nenhum arquivo .env encontrado. Usando variáveis de ambiente do sistema.');
}

_loadEnv();

// Importa o ai-provider-kit (TypeScript via tsx, ou já compilado em dist/)
// Usa tsx para rodar diretamente o .ts sem precisar compilar antes
const kitPath = path.join(__dirname, '..', '..', 'ai-provider-kit', 'src', 'index.js');
const kitDistPath = path.join(__dirname, '..', '..', 'ai-provider-kit', 'dist', 'index.js');

let validateProviderConfig, generateJson, getProviderLabel;

// Tenta importar em ordem: src (via tsx) → dist (compilado)
const kitImportPath = fs.existsSync(kitDistPath) ? kitDistPath : kitPath;
({ validateProviderConfig, generateJson, getProviderLabel } = await import(`file:///${kitImportPath.replace(/\\/g, '/')}`));

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT   = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '20', 10);
const BATCH   = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '10', 10);
const INPUT   = args.find(a => a.startsWith('--input='))?.split('=')[1]
                ?? path.join(__dirname, '..', 'maintenance', 'missing_streets.json');

// ─── Categorias válidas ───────────────────────────────────────────────────────

/** Taxonomia toponímica usada pelo projeto (conforme banco Supabase) */
const CATEGORIAS_VALIDAS = [
  'antropotopônimo',    // Homenagem a pessoas (ex: Getúlio Vargas, Tiradentes)
  'hagiotopônimo',      // Referência a santos ou entidades religiosas (ex: São Francisco)
  'corotopônimo',       // Nome de lugar geográfico maior: cidade, estado, país (ex: Brasil, Minas)
  'sociotopônimo',      // Instituições, grupos sociais, profissões (ex: Metalúrgicos, Estudantes)
  'axiotopônimo',       // Títulos de honra, cargos ou dignidade (ex: General, Barão, Professor)
  'fitotopônimo',       // Vegetação, plantas, flores (ex: Ipês, Orquídeas)
  'zootopônimo',        // Animais (ex: Lobo Guará, Beija-flor)
  'outros',             // Não enquadrado nas anteriores
  'indefinido',         // Dados insuficientes ou ambiguidade total
];

// ─── System prompt para classificação ────────────────────────────────────────

const SYSTEM_PROMPT_CLASSIF = `
Você é um especialista em Toponímia brasileira. Sua tarefa é analisar o nome de um logradouro e classificá-lo em UMA das categorias permitidas.

REGRAS DE CLASSIFICAÇÃO:
1. ANTROPOTOPÔNIMO: Use se houver Nome e/ou Sobrenome de pessoa. Se houver título junto ao nome, ANTROPOTOPÔNIMO ainda é a prioridade.
2. HAGIOTOPÔNIMO: Use para nomes de santos ("São", "Santo", "Santa", "Nossa Senhora").
3. COROTOPÔNIMO: Use para nomes de Cidades, Estados, Países ou Regiões.
4. SOCIOTOPÔNIMO: Use para nomes de profissões, grupos ou classes (ex: Rua dos Metalúrgicos, dos Estudantes).
5. AXIOTOPÔNIMO: Use apenas quando houver UM TÍTULO sem nome de pessoa (ex: "Rua do Barão", "Avenida do Governador").
6. FITO/ZOOTOPÔNIMO: Nomes de plantas ou animais.
7. OUTROS / INDEFINIDO: Se o nome for uma data, cor, número ou conceito que não se encaixe acima, use "outros". Se não houver dados suficientes, use "indefinido".

LISTA DE CATEGORIAS PERMITIDAS:
${CATEGORIAS_VALIDAS.join(', ')}

RESPOSTA:
Responda APENAS com um objeto JSON válido no formato:
{
  "classificacoes": [
    {
      "nome": "string",
      "categoria": "string",
      "confianca": number,
      "justificativa": "frase curta"
    }
  ]
}
`.trim();

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   ai-classify — Classificação via IA  ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // 1. Valida configuração do provider
  if (!DRY_RUN) {
    validateProviderConfig();
  } else {
    console.log('[DRY-RUN] Modo simulação — nenhuma chamada de IA será feita.\n');
  }
  console.log(`Provider: ${DRY_RUN ? 'N/A (dry-run)' : getProviderLabel()}`);

  // 2. Carrega dados de entrada
  if (!fs.existsSync(INPUT)) {
    console.error(`❌ Arquivo de entrada não encontrado: ${INPUT}`);
    console.error('   Gere-o com: node scripts/maintenance/missing_streets.js');
    process.exit(1);
  }

  const ruas = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const aProcessar = ruas.slice(0, LIMIT);

  console.log(`📋 Total no arquivo:      ${ruas.length} ruas`);
  console.log(`🔢 Processando (--limit): ${aProcessar.length} ruas`);
  console.log(`📦 Tamanho do lote:       ${BATCH} ruas/requisição\n`);

  if (DRY_RUN) {
    console.log('Amostra de nomes que seriam classificados:');
    aProcessar.slice(0, 5).forEach(r => console.log(`  - ${r.nome_oficial ?? r.name ?? JSON.stringify(r)}`));
    console.log('  ...\n[DRY-RUN] Encerrando sem chamar a IA.\n');
    return;
  }

  // 3. Processa em lotes
  const resultados = [];
  const batches = _chunkArray(aProcessar, BATCH);
  let processed = 0;

  for (let i = 0; i < batches.length; i++) {
    const lote = batches[i];
    const nomes = lote.map((r, idx) => ({
      index: idx,
      id: r.id ?? null,
      nome: r.nome_oficial ?? r.name ?? r.nome ?? String(r),
    }));

    process.stdout.write(`  Lote ${i + 1}/${batches.length} (${nomes.length} ruas)... `);

    try {
      const prompt = `
Classifique os seguintes logradouros de Ouro Branco, MG:

${JSON.stringify(nomes, null, 2)}

Retorne um array JSON com o mesmo número de elementos, cada um contendo:
{
  "index": <mesmo índice do input>,
  "id": <mesmo id do input>,
  "nome": "<nome do logradouro>",
  "categoria": "<uma das categorias válidas>",
  "confianca": <0 a 1, donde 1 é certeza absoluta>,
  "justificativa": "<explicação breve em português>"
}
`.trim();

      /** @type {Array<{index:number, id:string|null, nome:string, categoria:string, confianca:number, justificativa:string}>} */
      const resposta = await _withRetry(() => generateJson(prompt));

      // Mescla com dados originais
      resposta.forEach(item => {
        const original = lote[item.index];
        resultados.push({
          ...item,
          original,
          categoria_valida: CATEGORIAS_VALIDAS.includes(item.categoria),
        });
      });

      processed += lote.length;
      console.log(`✅ (${processed}/${aProcessar.length} total)`);

      // Pausa entre lotes: 5s para respeitar o free tier (~15 req/min)
      if (i < batches.length - 1) await _sleep(5000);

    } catch (err) {
      console.log(`❌ Falha definitiva: ${err.message.slice(0, 120)}`);
      // Adiciona entradas com erro para não perder o rastreamento
      lote.forEach((r, idx) => {
        resultados.push({
          index: idx,
          id: r.id ?? null,
          nome: r.nome_oficial ?? r.name ?? String(r),
          categoria: 'indefinido',
          confianca: 0,
          justificativa: `Erro na classificação: ${err.message.slice(0, 80)}`,
          original: r,
          erro: true,
        });
      });
      processed += lote.length;
    }
  }

  // 4. Salva resultados
  _salvarResultados(resultados);
}

// ─── Output ───────────────────────────────────────────────────────────────────

function _salvarResultados(resultados) {
  const outDir = __dirname;

  // JSON completo
  const jsonPath = path.join(outDir, 'ai-classify-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(resultados, null, 2), 'utf8');

  // Estatísticas
  const stats = {};
  resultados.forEach(r => {
    stats[r.categoria] = (stats[r.categoria] ?? 0) + 1;
  });

  // SQL para Supabase (apenas resultados com ID e confiança >= 0.7)
  const seguros = resultados.filter(r => r.id && !r.erro && r.confianca >= 0.7);
  const sqlLines = seguros.map(r =>
    `UPDATE ruas SET categoria_toponimica = '${r.categoria}', classificado_por_ia = true WHERE id = '${r.id}'; -- ${r.confianca.toFixed(2)} | ${r.justificativa}`
  );

  const sql = `-- ai-classify.mjs — ${new Date().toISOString()}
-- Provider: ${getProviderLabel()}
-- Total classificados: ${resultados.length} | Aplicáveis (confiança >= 0.7): ${seguros.length}
--
-- ⚠️  REVISAR antes de executar no Supabase!

${sqlLines.join('\n')}
`;

  const sqlPath = path.join(outDir, 'ai-classify.sql');
  fs.writeFileSync(sqlPath, sql, 'utf8');

  // Resumo no console
  console.log('\n─────────────────────────────────────');
  console.log('📊 Resumo da classificação:');
  Object.entries(stats)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, count]) => console.log(`   ${cat.padEnd(22)} ${count}`));

  console.log(`\n📁 Arquivos gerados:`);
  console.log(`   ${jsonPath}`);
  console.log(`   ${sqlPath}`);
  console.log(`\n✅ ${resultados.length} ruas classificadas. ${seguros.length} com confiança >= 0.7 (prontas para SQL).`);
  console.log('');
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function _chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executa fn() com retry exponencial ao encontrar erros 429 (rate limit).
 * Lê o retryDelay sugerido pela API do Gemini na mensagem de erro.
 *
 * @param {() => Promise<any>} fn
 * @param {number} maxRetries Máximo de tentativas (padrão: 4)
 * @returns {Promise<any>}
 */
async function _withRetry(fn, maxRetries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err.message ?? '';

      // Detecta 429 e extrai o retryDelay sugerido pela API
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED');
      if (!is429 || attempt === maxRetries) throw err;

      // Tenta extrair "Please retry in Xs" da mensagem
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)/);
      const suggestedMs = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 0;

      // Backoff: max(sugestão da API, backoff exponencial) + jitter
      const backoffMs = Math.max(suggestedMs, 10_000 * Math.pow(2, attempt - 1));
      const jitter    = Math.floor(Math.random() * 3000);
      const waitMs    = backoffMs + jitter;

      console.log(`  ⏳ Rate limit (tentativa ${attempt}/${maxRetries}). Aguardando ${(waitMs / 1000).toFixed(1)}s...`);
      await _sleep(waitMs);
    }
  }
  throw lastErr;
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
