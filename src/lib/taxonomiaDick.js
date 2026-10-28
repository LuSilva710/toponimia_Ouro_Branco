/**
 * Taxonomia toponímica de Dick (1990) — fonte única do projeto.
 *
 * 27 taxes em dois grupos (11 de natureza física, 16 antropoculturais), mais as duas
 * subdivisões de hierotopônimo (hagiotopônimo e mitotopônimo).
 * Referência: DICK, M. V. de P. do A. A motivação toponímica e a realidade brasileira.
 * São Paulo: Edições Arquivo do Estado, 1990, p. 31-34. Texto completo em docs/taxonomia-dick.md.
 *
 * Usado por: painel admin, estatísticas, mapa, PDF, scripts/ai/ai-classify.mjs e
 * (via npm run taxonomia:sync) o prompt do chatbot em supabase/functions/onim-chat/.
 * Sem imports: precisa rodar no navegador e no Node.
 *
 * `id` é o valor gravado em ruas.categoria_toponimica (minúsculo, sem acento).
 * `cor` é a cor padrão; cada tela pode ter paleta própria para as categorias que já usava.
 */
export const TAXES = [
  // ── A. Natureza física ──────────────────────────────────────────────────────
  { id: 'astrotoponimo', nome: 'Astrotopônimo', natureza: 'fisica', cor: '#1e3a8a',
    definicao: 'Relativo aos corpos celestes em geral.', exemplos: ['Estrela', 'Rio da Estrela', 'Saturno'] },
  { id: 'cardinotoponimo', nome: 'Cardinotopônimo', natureza: 'fisica', cor: '#0e7490',
    definicao: 'Relativo às posições geográficas em geral.', exemplos: ['Praia do Leste', 'Serra do Norte', 'Entre-Rios'] },
  { id: 'cromotoponimo', nome: 'Cromotopônimo', natureza: 'fisica', cor: '#be185d',
    definicao: 'Relativo à escala cromática.', exemplos: ['Rio Branco', 'Rio Negro', 'Serra Azul'] },
  { id: 'dimensiotoponimo', nome: 'Dimensiotopônimo', natureza: 'fisica', cor: '#a16207',
    definicao: 'Relativo às dimensões do acidente geográfico (extensão, largura, altura, profundidade).',
    exemplos: ['Ilha Comprida', 'Morro Alto', 'Córrego Fundo'] },
  { id: 'fitotoponimo', nome: 'Fitotopônimo', natureza: 'fisica', cor: '#109655',
    definicao: 'De índole vegetal, espontânea ou não, individual ou em conjunto.', exemplos: ['Arroio Pinheiro', 'Pinheiral', 'Cafezal'] },
  { id: 'geomorfotoponimo', nome: 'Geomorfotopônimo', natureza: 'fisica', cor: '#78716c',
    definicao: 'Relativo às formas topográficas: elevações, depressões e formações litorâneas.',
    exemplos: ['Monte Alto', 'Vale Fundo', 'Cabo Frio'] },
  { id: 'hidrotoponimo', nome: 'Hidrotopônimo', natureza: 'fisica', cor: '#0284c7',
    definicao: 'Resultante de acidentes hidrográficos em geral.', exemplos: ['Água Boa', 'Riozinho', 'Ribeirão Preto'] },
  { id: 'litotoponimo', nome: 'Litotopônimo', natureza: 'fisica', cor: '#607D8B',
    definicao: 'De índole mineral, relativo também à constituição do solo.', exemplos: ['Arroio do Ouro', 'Minas Gerais', 'Pedreiras'] },
  { id: 'meteorotoponimo', nome: 'Meteorotopônimo', natureza: 'fisica', cor: '#64748b',
    definicao: 'Relativo a fenômenos atmosféricos.', exemplos: ['Serra do Vento', 'Ventania', 'Trovão'] },
  { id: 'morfotoponimo', nome: 'Morfotopônimo', natureza: 'fisica', cor: '#7c3aed',
    definicao: 'Reflete o sentido de forma geométrica.', exemplos: ['Curva Grande', 'Lagoa Redonda', 'Triângulo'] },
  { id: 'zootoponimo', nome: 'Zootopônimo', natureza: 'fisica', cor: '#26A69A',
    definicao: 'De índole animal: indivíduos domésticos, não domésticos ou em grupos.', exemplos: ['Rio do Boi', 'Lagoa da Onça', 'Vacaria'] },

  // ── B. Natureza antropocultural ────────────────────────────────────────────
  { id: 'animotoponimo', nome: 'Animotopônimo (Nootopônimo)', natureza: 'antropocultural', cor: '#db2777',
    definicao: 'Relativo à vida psíquica e à cultura espiritual (sentimentos, estados de ânimo).',
    exemplos: ['Vitória', 'Triunfo', 'Cachoeira da Saudade'] },
  { id: 'antropotoponimo', nome: 'Antropotopônimo', natureza: 'antropocultural', cor: '#ED4A7B',
    definicao: 'Relativo aos nomes próprios individuais: prenome, apelido de família, alcunha.',
    exemplos: ['Abel', 'Antonio Amaral', 'Manoel Alves'] },
  { id: 'axiotoponimo', nome: 'Axiotopônimo', natureza: 'antropocultural', cor: '#6B4B9A',
    definicao: 'Relativo aos títulos e dignidades que acompanham nomes próprios individuais.',
    exemplos: ['Presidente Prudente', 'Doutor Pedrinho', 'Duque de Caxias'] },
  { id: 'corotoponimo', nome: 'Corotopônimo', natureza: 'antropocultural', cor: '#FF7043',
    definicao: 'Relativo a nomes de cidades, países, estados, regiões e continentes.', exemplos: ['Brasil', 'Europa', 'Amazonas'] },
  { id: 'cronotoponimo', nome: 'Cronotopônimo', natureza: 'antropocultural', cor: '#0f766e',
    definicao: 'Encerra indicadores cronológicos, representados pelos adjetivos novo/nova, velho/velha.',
    exemplos: ['Velha Boipeba', 'Nova Viçosa', 'Rio Novo Mundo'] },
  { id: 'ecotoponimo', nome: 'Ecotopônimo', natureza: 'antropocultural', cor: '#9a3412',
    definicao: 'Relativo às habitações de modo geral.', exemplos: ['Casa da Telha', 'Sobrado'] },
  { id: 'ergotoponimo', nome: 'Ergotopônimo', natureza: 'antropocultural', cor: '#b45309',
    definicao: 'Relativo aos elementos da cultura material.', exemplos: ['Córrego da Flecha', 'Jangada', 'Relógio'] },
  { id: 'etnotoponimo', nome: 'Etnotopônimo', natureza: 'antropocultural', cor: '#4d7c0f',
    definicao: 'Referente a elementos étnicos (povos, tribos, castas).', exemplos: ['Guarani', 'Ilha do Francês', 'Rio Xavante'] },
  { id: 'dirrematotoponimo', nome: 'Dirrematotopônimo', natureza: 'antropocultural', cor: '#c026d3',
    definicao: 'Constituído por frases ou enunciados linguísticos.', exemplos: ['Há Mais Tempo', 'Valha-me Deus', 'Deus me Livre'] },
  { id: 'hierotoponimo', nome: 'Hierotopônimo', natureza: 'antropocultural', cor: '#0369a1',
    definicao: 'Relativo a nomes sagrados de diferentes crenças, efemérides e associações religiosas e locais de culto.',
    exemplos: ['Cristo Rei', 'Natividade', 'Capela'] },
  { id: 'hagiotoponimo', nome: 'Hagiotopônimo', natureza: 'antropocultural', subdivisaoDe: 'hierotoponimo', cor: '#29B6F6',
    definicao: 'Subdivisão de hierotopônimo: relativo aos santos e santas do hagiológio romano.',
    exemplos: ['São Paulo', 'Santa Tereza', 'Santana da Boa Vista'] },
  { id: 'mitotoponimo', nome: 'Mitotopônimo', natureza: 'antropocultural', subdivisaoDe: 'hierotoponimo', cor: '#7e22ce',
    definicao: 'Subdivisão de hierotopônimo: relativo a entidades mitológicas.', exemplos: ['Ribeirão do Saci', 'Lago Curupira'] },
  { id: 'historiotoponimo', nome: 'Historiotopônimo', natureza: 'antropocultural', cor: '#b91c1c',
    definicao: 'Relativo a movimentos de cunho histórico-social, seus membros e as datas correspondentes.',
    exemplos: ['Independência', 'Inconfidentes', 'Rua Vinte e Um de Abril'] },
  { id: 'hodotoponimo', nome: 'Hodotopônimo (Odotopônimo)', natureza: 'antropocultural', cor: '#525252',
    definicao: 'Relativo às vias de comunicação rural ou urbana.', exemplos: ['Estradas', 'Córrego do Atalho', 'Ladeira'] },
  { id: 'numerotoponimo', nome: 'Numerotopônimo', natureza: 'antropocultural', cor: '#0891b2',
    definicao: 'Relativo aos adjetivos numerais.', exemplos: ['Duas Barras', 'Duas Pontes', 'Três Coroas'] },
  { id: 'poliotoponimo', nome: 'Poliotopônimo', natureza: 'antropocultural', cor: '#a8a29e',
    definicao: 'Constituído pelos vocábulos vila, aldeia, cidade, povoado, arraial.', exemplos: ['Rio da Cidade', 'Serra da Aldeia', 'Arraial'] },
  { id: 'sociotoponimo', nome: 'Sociotopônimo', natureza: 'antropocultural', cor: '#C5CB81',
    definicao: 'Relativo a atividades profissionais, locais de trabalho e pontos de encontro da comunidade (largo, pátio, praça).',
    exemplos: ['Pescador', 'Serra dos Tropeiros', 'Oficina'] },
  { id: 'somatotoponimo', nome: 'Somatotopônimo', natureza: 'antropocultural', cor: '#e11d48',
    definicao: 'Empregado em relação metafórica a partes do corpo humano ou animal.', exemplos: ['Cotovelo', 'Pé de Boi', 'Igarapé do Dedo'] },
]

/** Categoria para valores vazios ou fora da taxonomia. */
export const OUTRO = { id: 'outro', nome: 'Outro / sem classificação', cor: '#DFDFDF' }

export const NATUREZAS = {
  fisica: 'Natureza física',
  antropocultural: 'Natureza antropocultural',
}

const POR_ID = Object.fromEntries([...TAXES, OUTRO].map((t) => [t.id, t]))

/** Ids na ordem da taxonomia, com "outro" no fim. */
export const IDS_TAXES = [...TAXES.map((t) => t.id), OUTRO.id]

export function taxe(id) {
  return POR_ID[id] || null
}

/**
 * Converte o valor gravado no banco ("Corotopônimo", "corotoponimo\n", "antropotopônimos") no id da taxe.
 * @returns {string} id da taxe ou 'outro'
 */
export function normalizarTaxe(valor) {
  if (!valor) return OUTRO.id
  let n = String(valor)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[-_\s ]+/g, '')
  if (n.endsWith('toponimos')) n = n.slice(0, -1)
  if (n === 'nootoponimo') n = 'animotoponimo'
  if (n === 'odotoponimo') n = 'hodotoponimo'
  return POR_ID[n] ? n : OUTRO.id
}

/** Nome com acento para exibição. */
export function rotuloTaxe(id) {
  return POR_ID[id]?.nome || (id ? id.charAt(0).toUpperCase() + id.slice(1) : OUTRO.nome)
}

/** Cor da taxe; `paleta` (opcional) sobrepõe as cores próprias de cada tela. */
export function corTaxe(id, paleta = {}) {
  return paleta[id] || POR_ID[id]?.cor || OUTRO.cor
}

/** Grupos para <optgroup> em formulários. */
export function taxesPorNatureza() {
  return Object.entries(NATUREZAS).map(([natureza, rotulo]) => ({
    natureza,
    rotulo,
    taxes: TAXES.filter((t) => t.natureza === natureza),
  }))
}
