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

export default function AboutPage() {
  const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

  return (
    <>
      <Navbar active="about" />

      <section className="hero-section">
        <div className="container">
          <h1>Descubra a História por Trás dos Nomes</h1>
          <p>
            O projeto &quot;Tradição e Memória na Toponímia Urbana de Ouro Branco&quot; revela as histórias e memórias
            por trás dos nomes dos espaços públicos da cidade
          </p>
          <a href="#timeline" className="btn hero-btn">Conheça nossa jornada</a>
        </div>
      </section>

      <section className="about-section">
        <div className="container">
          <h2 className="section-title">Sobre o Projeto</h2>

          <div className="row g-5 mb-5">
            <div className="col-lg-6">
              <div className="about-card">
                <h3><i className="bi bi-book" aria-hidden="true" /> Nosso Propósito</h3>
                <p>
                  Propõe-se, neste projeto de pesquisa, a continuidade do estudo da toponímia urbana ouro-branquense a
                  partir da análise da motivação dos topônimos relativos aos espaços públicos de Ouro Branco - MG, com o
                  intuito de resgatar e conhecer a história e a memória local.
                </p>
                <p>
                  Entenda-se por topônimo o nome dado a determinado lugar, seja acidente físico (rio, córrego, serra,
                  etc.) ou humano (povoado, rua, capela, escola, etc.).
                </p>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="about-img">
                <img src={asset('images/header/toponimia.png')} alt="Logo do Projeto" />
              </div>
            </div>
          </div>

          <div className="row g-5 mb-5">
            <div className="col-lg-6 order-lg-2">
              <div className="about-card">
                <h3><i className="bi bi-bullseye" aria-hidden="true" /> Nossa Missão</h3>
                <p>
                  Em outros termos, pretende-se mostrar que os topônimos do município não foram e não são escolhidos
                  aleatoriamente; pelo contrário, várias são as questões sociopolíticas e culturais que permeiam essas
                  escolhas.
                </p>
                <p>
                  Espera-se, dessa forma, a partir da investigação toponímica proposta, contribuir para os estudos
                  linguísticos que se pautam na inter-relação língua, cultura e sociedade.
                </p>
              </div>
            </div>
            <div className="col-lg-6 order-lg-1">
              <div className="about-img">
                <img src={asset('images/header/dicionario.png')} alt="Objetivos do projeto" />
              </div>
            </div>
          </div>

          <div className="row g-5">
            <div className="col-lg-6">
              <div className="about-card">
                <h3><i className="bi bi-people" aria-hidden="true" /> Educação e Extensão</h3>
                <p>
                  Como um projeto de extensão e pesquisa do IFMG, nossa missão é compartilhar o conhecimento com a
                  comunidade. Levamos a história de Ouro Branco para as salas de aula e espaços públicos, fortalecendo a
                  identidade local.
                </p>
                <p>
                  Você pode baixar nossa <strong>Cartilha Toponímica</strong> completa, um material educativo preparado
                  para auxiliar professores e pesquisadores na exploração do patrimônio histórico da nossa cidade.
                </p>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="about-img" style={{ padding: 40, background: 'white' }}>
                <img
                  src={asset('images/header/ob3-removebg-preview.png')}
                  alt="Educação e Extensão"
                  style={{ maxHeight: 180 }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="timeline-section" id="timeline">
        <div className="container">
          <h2 className="section-title text-black">Nossa Jornada</h2>
          <div className="timeline">
            {TIMELINE.map((item) => (
              <div className={`timeline-item ${item.side}`} key={`${item.year}-${item.title}-${item.side}`}>
                <div className="timeline-content">
                  <span className="timeline-year">{item.year}</span>
                  <h4><i className={`bi ${item.icon}`} aria-hidden="true" /> {item.title}</h4>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
