import { Navbar } from '@components/layout/Navbar.jsx'
import { Footer } from '@components/layout/Footer.jsx'

const TIMELINE = [
  {
    side: 'left',
    year: '2018 - 2020',
    title: 'Fase Inicial',
    icon: 'bi-compass',
    text: 'Análise de nomeação de ruas, avenidas e praças de Ouro Branco. Participação dos alunos Naiara e Dérlisson (Engenharia Metalúrgica).',
  },
  {
    side: 'right',
    year: '2019 - 2020',
    title: 'Expansão da Equipe',
    icon: 'bi-people',
    text: 'Continuação da análise da toponímia urbana com a participação dos alunos Marcos Paulo Leite (Engenharia Metalúrgica) e Giovana Lana (Técnico em Metalurgia).',
  },
  {
    side: 'left',
    year: '2021 - 2022',
    title: 'Foco nas Escolas',
    icon: 'bi-building',
    text: 'Investigação focada na microtoponímia urbana, com participação da aluna Maria Raquel Honorata (Pedagogia).',
  },
  {
    side: 'right',
    year: '2021',
    title: 'Foco nas Escolas',
    icon: 'bi-building',
    text: 'Investigação focada na microtoponímia urbana, com participação da aluna Maria Raquel Honorata (Pedagogia).',
  },
  {
    side: 'left',
    year: '2021 - 2022',
    title: 'Foco nas Escolas',
    icon: 'bi-building',
    text: 'Análise dos nomes das escolas públicas de Ouro Branco. Participação das alunas Bruna dos Santos e Shirley Pereira (Pedagogia).',
  },
  {
    side: 'right',
    year: '2023 - Presente',
    title: 'Portal Educativo',
    icon: 'bi-globe',
    text: 'Consolidação da pesquisa em microtoponímia e desenvolvimento do portal educativo para compartilhar nossas descobertas com a comunidade e escolas da região. Participação dos alunos Ludmila Silva e Marcos Túlio (Sistemas de Informação).',
  },
]

const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/**
 * Peças da colagem do topo: escolas (faixas largas) e placas de rua (menores).
 * `className` define a posição em style_about.css; `so-desktop` some em telas pequenas.
 */
const COLAGEM_TOPO = [
  { className: 'c-escola-1', src: 'images/sobre/escola-pio-xii.webp', alt: 'Colagem sobre a Escola Pio XII', giro: -3, fita: 'esquerda' },
  { className: 'c-placa-1', src: 'images/sobre/placa.webp', alt: 'Placas da Rua Amaro Lanari', giro: 6, fita: 'direita' },
  { className: 'c-escola-2', src: 'images/sobre/escola-maria-firmina.webp', alt: 'Colagem sobre a Escola Maria Firmina da Silva', giro: 2, fita: 'centro' },
  { className: 'c-placa-2', src: 'images/sobre/placa-getulio-vargas.webp', alt: 'Placa da Rua Getúlio Vargas', giro: -5, fita: 'centro' },
  { className: 'c-placa-3 so-desktop', src: 'images/sobre/placa-clodomiro-oliveira.webp', alt: 'Placa enferrujada da Rua Clodomiro de Oliveira', giro: 4, fita: 'esquerda' },
  { className: 'c-escola-3 so-desktop', src: 'images/sobre/escola-oswaldo-cruz.webp', alt: 'Colagem sobre a Escola Oswaldo Cruz', giro: -2, fita: 'direita' },
  { className: 'c-placa-4', src: 'images/sobre/placa-carlos-wigg.webp', alt: 'Placa da Rua Comendador Carlos Wigg', giro: -4, fita: 'direita' },
  { className: 'c-escola-4', src: 'images/sobre/escola-dom-luciano.webp', alt: 'Colagem sobre a Escola Dom Luciano Mendes', giro: 3, fita: 'esquerda' },
]

/** Traço à mão (como os rabiscos do PDF da cruzadinha). */
function Rabisco({ className = '' }) {
  return (
    <svg className={`rabisco ${className}`} viewBox="0 0 120 40" aria-hidden="true" focusable="false">
      <path d="M4 30 C 20 6, 34 6, 30 22 S 18 34, 36 26 S 64 6, 70 20 S 86 34, 116 12" />
    </svg>
  )
}

/** Foto "colada" na página: moldura de papel, leve rotação e fita adesiva. */
function Colagem({ src, alt, legenda, giro = 0, fita = 'centro', className = '' }) {
  return (
    <figure className={`colagem fita-${fita} ${className}`} style={{ '--giro': `${giro}deg` }}>
      <img src={asset(src)} alt={alt} loading="lazy" />
      {legenda && <figcaption>{legenda}</figcaption>}
    </figure>
  )
}

function BlocoSobre({ icone, titulo, children, imagem, invertido = false }) {
  return (
    <div className={`sobre-bloco${invertido ? ' sobre-bloco--invertido' : ''}`}>
      <div className="sobre-texto">
        <h3>
          <i className={`bi ${icone}`} aria-hidden="true" /> {titulo}
        </h3>
        {children}
      </div>
      <div className="sobre-imagem">{imagem}</div>
    </div>
  )
}

export default function AboutPage() {
  return (
    <>
      <Navbar active="about" />

      <main className="sobre" id="conteudo">
        {/* Topo: painel marrom com curvas (lateral do PDF) + colagem de fotos */}
        <section className="sobre-hero">
          <div className="sobre-hero-painel">
            <div className="sobre-hero-marcas">
              <span className="selo-fundo">
                <img src={asset('images/sobre/selo.webp')} alt="Selo Toponímia Ouro Branco MG" width="281" height="255" />
              </span>
            </div>
            <p className="sobre-eyebrow">Projeto de pesquisa e extensão · IFMG Campus Ouro Branco</p>
            <h1>Tradição e memória cultural na toponímia urbana do município</h1>
            <Rabisco />
            <p className="sobre-hero-texto">
              O projeto &quot;Tradição e Memória na Toponímia Urbana de Ouro Branco&quot; revela as histórias e memórias
              por trás dos nomes dos espaços públicos da cidade.
            </p>
            <div className="sobre-hero-acoes">
              <a href="#timeline" className="btn-sobre btn-sobre--claro">Conheça nossa jornada</a>
              <a href="./index.html" className="btn-sobre btn-sobre--contorno">Explorar o Dicionário</a>
            </div>
          </div>

          <div className="sobre-hero-colagem" aria-label="Colagem de escolas e placas de rua de Ouro Branco">
            {COLAGEM_TOPO.map((peca) => (
              <Colagem key={peca.src} {...peca} />
            ))}
            <Rabisco className="rabisco--colagem" />
          </div>
        </section>

        <section className="sobre-secao" aria-labelledby="titulo-sobre">
          <h2 id="titulo-sobre" className="sobre-titulo">Sobre o Projeto</h2>

          <BlocoSobre
            icone="bi-book"
            titulo="Nosso Propósito"
            imagem={
              <Colagem
                src="images/sobre/aerea-centro.webp"
                alt="Vista aérea do bairro Centro de Ouro Branco"
                legenda="Bairro Centro visto do alto"
                giro={2}
              />
            }
          >
            <p>
              Propõe-se, neste projeto de pesquisa, a continuidade do estudo da toponímia urbana ouro-branquense a
              partir da análise da motivação dos topônimos relativos aos espaços públicos de Ouro Branco - MG, com o
              intuito de resgatar e conhecer a história e a memória local.
            </p>
            <p>
              Entenda-se por topônimo o nome dado a determinado lugar, seja acidente físico (rio, córrego, serra,
              etc.) ou humano (povoado, rua, capela, escola, etc.).
            </p>
          </BlocoSobre>

          <BlocoSobre
            invertido
            icone="bi-bullseye"
            titulo="Nossa Missão"
            imagem={
              <Colagem
                src="images/sobre/dicionario.webp"
                alt="O que é o Dicionário de Ruas?"
                giro={-3}
                fita="direita"
              />
            }
          >
            <p>
              Em outros termos, pretende-se mostrar que os topônimos do município não foram e não são escolhidos
              aleatoriamente; pelo contrário, várias são as questões sociopolíticas e culturais que permeiam essas
              escolhas.
            </p>
            <p>
              Espera-se, dessa forma, a partir da investigação toponímica proposta, contribuir para os estudos
              linguísticos que se pautam na inter-relação língua, cultura e sociedade.
            </p>
          </BlocoSobre>

          <BlocoSobre
            icone="bi-people"
            titulo="Educação e Extensão"
            imagem={
              <Colagem
                src="images/sobre/escola-joao-xxiii.webp"
                alt="Colagem sobre a Escola João XXIII"
                giro={2}
                fita="esquerda"
              />
            }
          >
            <p>
              Como um projeto de extensão e pesquisa do IFMG, nossa missão é compartilhar o conhecimento com a
              comunidade. Levamos a história de Ouro Branco para as salas de aula e espaços públicos, fortalecendo a
              identidade local.
            </p>
            <p>
              Você pode baixar nossa{' '}
              <a href="./estatisticas.html#cartilha"><strong>Cartilha Toponímica</strong></a> completa, um material
              educativo preparado para auxiliar professores e pesquisadores na exploração do patrimônio histórico da
              nossa cidade.
            </p>
            <a className="btn-sobre btn-sobre--marrom" href="./estatisticas.html#cartilha">
              <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true" /> Baixar a Cartilha (PDF)
            </a>
            <img className="sobre-ifmg" src={asset('images/sobre/ifmg.webp')} alt="Instituto Federal de Minas Gerais — Campus Ouro Branco" />
          </BlocoSobre>
        </section>

        <section className="sobre-jornada" id="timeline" aria-labelledby="titulo-jornada">
          <div className="faixa-titulo sobre-jornada-faixa">
            <h2 id="titulo-jornada">Nossa Jornada</h2>
            <p>Da primeira análise das ruas ao portal educativo</p>
          </div>
          <ol className="timeline">
            {TIMELINE.map((item) => (
              <li className={`timeline-item ${item.side}`} key={`${item.year}-${item.title}-${item.side}`}>
                <div className="timeline-content">
                  <span className="timeline-year">{item.year}</span>
                  <h3><i className={`bi ${item.icon}`} aria-hidden="true" /> {item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <Footer />
    </>
  )
}
