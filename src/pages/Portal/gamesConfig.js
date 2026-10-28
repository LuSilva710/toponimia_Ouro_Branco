/**
 * Jogos do portal, em tons terrosos do PDF da cruzadinha. `cor` decora o topo do card;
 * `corTexto` é a versão escura (contraste AA com texto creme) usada no botão.
 */
export const GAMES = [
  {
    id: 'quiz',
    href: './games/quiz.html',
    icon: 'bi-question-circle',
    title: 'Quiz Toponímia',
    description: 'Adivinhe a rua pela sua história ou o bairro onde ela fica. Quanto mais rápido, mais pontos!',
    aprende: 'A história por trás dos nomes das ruas',
    meta: ['10 perguntas', '~5 min', 'Certificado'],
    cor: '#7c5220',
    corTexto: '#7c5220',
  },
  {
    id: 'associacao',
    href: './games/associacao.html',
    icon: 'bi-link-45deg',
    title: 'Jogo de Associação',
    description: 'Ligue cada rua ao bairro onde ela fica, contra o relógio.',
    aprende: 'A geografia da cidade, bairro a bairro',
    meta: ['8 pares', '~2 min'],
    cor: '#6b7d3a',
    corTexto: '#4b5a24',
  },
  {
    id: 'cruzadinha',
    href: './games/cruzadinha.html',
    icon: 'bi-grid-3x3',
    title: 'Palavras Cruzadas',
    description: 'Descubra os nomes das escolas de Ouro Branco a partir das pistas.',
    aprende: 'A história das escolas da cidade',
    meta: ['Escolas', '~10 min', 'Versão para imprimir'],
    cor: '#a1452a',
    corTexto: '#8a3a22',
  },
]

export const ROTULO_JOGO = Object.fromEntries(GAMES.map((g) => [g.id, g.title]))
