/**
 * Classifica ruas sem categoria: candidatos a antropotopônimo vs outras classes.
 * Executar: node scripts/classify_antropotoponimos.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jsonPath = path.join(__dirname, 'ruas_sem_categoria.json')

const ruas = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

/** Nome oficial completo — NÃO é antropotopônimo (já classificado como outra categoria ou indefinido). */
const EXCLUIR_ANTROPO = new Set([
  // —— Corotopônimo: estados, DF, capitais, países, cidades, acidentes ——
  'Avenida Macapá',
  'Avenida Roraima',
  'Estrada de Carreiras',
  'Estrada Pé da Serra',
  'Rua Acre',
  'Rua Alagoas',
  'Rua Amazonas',
  'Rua Amapá',
  'Rua Aracaju',
  'Rua Bahia',
  'Rua Belém',
  'Rua Belo Horizonte',
  'Rua Belo Vale',
  'Rua Brasília',
  'Rua Campo Grande',
  'Rua Carandaí',
  'Rua Ceará',
  'Rua Cuiabá',
  'Rua Curitiba',
  'Rua Distrito Federal',
  'Rua Florianópolis',
  'Rua Fortaleza',
  'Rua Goiânia',
  'Rua Goiás',
  'Rua Maceió',
  'Rua Manaus',
  'Rua Maranhão',
  'Rua Mariana',
  'Rua Mato Grosso do Sul',
  'Rua Minas Gerais',
  'Rua Natal',
  'Rua Ouro Preto',
  'Rua Palmas',
  'Rua Pará',
  'Rua Paraíba',
  'Rua Paraná',
  'Rua Pernambuco',
  'Rua Piauí',
  'Rua Porto Alegre',
  'Rua Porto Velho',
  'Rua Rio de Janeiro',
  'Rua Rio Grande do Norte',
  'Rua Rio Grandense',
  'Rua Rondônia',
  'Rua Salvador',
  'Rua Sergipe',
  'Rua Teresina',
  'Rua Tocantins',
  'Rua Vitória',
  'Rua Boa Vista',
  'Rua Terezina',
  'Rua João Pessoa',
  'Rua Argentina',
  'Rua França',
  'Rua Itália',
  'Rua Portugal',
  'Rua Itabirito',
  'Rua Piedade das Gerais',
  'Rua Alto do Cruzeiro',
  'Rua Morro do Campestre',
  'Rua Cachoeira do Campo',
  'Rua Casa Grande',
  'Rua Nações Unidas',
  'Rua Itabirito',
  'Rua Lobo Leite',
  // —— Sociotopônimo: indústria, empresa, instituição laboral ——
  'Cosigua',
  'Da Siderbras',
  'Rua Acesita',
  'Rua Aço Norte',
  'Rua Aliperte',
  'Rua Anhanguera',
  'Rua Barra Mansa',
  'Rua Belgo Mineira',
  'Rua Cimetal',
  'Rua Coferraz',
  'Rua Consider',
  'Rua Cosigua',
  'Rua Cosim',
  'Rua Dedine',
  'Rua Fiel',
  'Rua Ferro Brasileiro',
  'Rua Gerdau AçoMinas',
  'Rua Guaira',
  'Rua Itaunense',
  'Rua Lafersa',
  'Rua da Lafersa',
  'Rua Mannesmam',
  'Rua Pains',
  'Rua Patriótica',
  'Rua Queiros Junior',
  'Rua Siderbrás',
  'Rua Villares',
  'Da Lavoura',
  // —— Hagiotopônimo / religioso ——
  'Nossa Senhora Mãe dos Homens',
  'João XXIII',
  'Sagrados Corações',
  'Rua Nossa Senhora Aparecida',
  // —— Litotopônimo / / mineral (não antropo) ——
  'Rua Ametista',
  'Rua Cristais',
  // —— Outros topônimos compostos / vagos ——
  'Das Flores',
  'Das Mercês',
  'Das Missões',
  'Das Rotas',
  'Ouro Park',
  'Praça do Céu',
  'Praça Maçonaria',
  'Salanacia',
  'Rua Hum',
  'Rua Dois',
  'Rua S1-VL3-118',
  'Rua S2-VL4-6',
  'Rua S7-VL5-48.1',
  'Rua S7-VL5-48.2',
  'Rua S7-VL5-53',
  'Rua S7-VL5-54',
  'Rua S7-VL5-58',
  'Rua S7-VL5-60',
  'Rua S7-VL5-64',
])

function ehCodigoInterno(nome) {
  return /^Rua S\d+-VL\d+-\d/.test(nome) || /^Rua S\d+-VL/.test(nome)
}

const antropo = []
const revisar = []

for (const r of ruas) {
  const nome = r.nome_oficial
  if (EXCLUIR_ANTROPO.has(nome) || ehCodigoInterno(nome)) {
    revisar.push({ ...r, motivo: EXCLUIR_ANTROPO.has(nome) ? 'lista exclusão' : 'código interno' })
    continue
  }
  antropo.push(r)
}

antropo.sort((a, b) => a.nome_oficial.localeCompare(b.nome_oficial, 'pt-BR'))

const outDir = __dirname
fs.writeFileSync(
  path.join(outDir, 'update_antropotoponimo_ids.json'),
  JSON.stringify(antropo.map((r) => ({ id: r.id, nome_oficial: r.nome_oficial })), null, 2),
  'utf8'
)

const nomesLista = antropo.map((r) => r.nome_oficial).join('\n')
fs.writeFileSync(path.join(outDir, 'lista_antropotoponimos.txt'), nomesLista + '\n', 'utf8')

// SQL para Supabase (executar no SQL Editor com cuidado — conferir lista antes)
const ids = antropo.map((r) => `'${r.id}'`).join(', ')
const sql = `-- ${antropo.length} ruas → antropotoponimo (conferir lista antes de executar)
UPDATE ruas
SET categoria_toponimica = 'antropotoponimo'
WHERE id IN (${ids});
`
fs.writeFileSync(path.join(outDir, 'update_antropotoponimo.sql'), sql, 'utf8')

console.log('Total sem categoria:', ruas.length)
console.log('Candidatos antropotopônimo:', antropo.length)
console.log('Excluídos (outras classes / códigos):', ruas.length - antropo.length)
console.log('\nFicheiros gerados:')
console.log(' - scripts/lista_antropotoponimos.txt')
console.log(' - scripts/update_antropotoponimo_ids.json')
console.log(' - scripts/update_antropotoponimo.sql')
