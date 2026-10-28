/**
 * Gera supabase/functions/onim-chat/taxonomia.ts a partir de src/lib/taxonomiaDick.js.
 *
 * A Edge Function roda no Deno e é publicada só com os arquivos da pasta dela,
 * então não importa src/ diretamente: este script copia a taxonomia para o prompt.
 *
 * Uso: npm run taxonomia:sync   (depois: npx supabase functions deploy onim-chat --use-api)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATUREZAS, TAXES, taxe } from '../src/lib/taxonomiaDick.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const destino = path.join(__dirname, '..', 'supabase', 'functions', 'onim-chat', 'taxonomia.ts')

const blocos = Object.entries(NATUREZAS).map(([natureza, rotulo]) => {
  const linhas = TAXES.filter((t) => t.natureza === natureza).map((t) => {
    const pai = t.subdivisaoDe ? ` (subdivisão de ${taxe(t.subdivisaoDe).nome})` : ''
    return `- **${t.nome}**${pai}: ${t.definicao} Ex.: ${t.exemplos.join(', ')}.`
  })
  return `#### ${rotulo}\n${linhas.join('\n')}`
})

const texto = `### TAXONOMIA DE DICK (1990) — CLASSIFICAÇÃO OBRIGATÓRIA
Os nomes são classificados pela motivação semântica, em 27 taxes de dois grupos.
No acervo, a categoria aparece sem acento (ex.: "antropotoponimo"); ao responder, use o nome com acento.

${blocos.join('\n\n')}`

const conteudo = `// GERADO por scripts/taxonomia-sync.mjs a partir de src/lib/taxonomiaDick.js — não edite à mão.
// Para alterar: edite src/lib/taxonomiaDick.js, rode \`npm run taxonomia:sync\` e publique a função.

export const TAXONOMIA_PROMPT = ${JSON.stringify(texto)}
`

fs.writeFileSync(destino, conteudo, 'utf8')
console.log(`Taxonomia (${TAXES.length} taxes) gravada em ${path.relative(process.cwd(), destino)}`)
