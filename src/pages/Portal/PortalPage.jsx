import { useEffect, useState } from 'react'
import { Navbar } from '@components/layout/Navbar.jsx'
import { corTaxe, normalizarTaxe, rotuloTaxe } from '@lib/taxonomiaDick.js'
import { GAMES, ROTULO_JOGO } from './gamesConfig.js'
import { fetchNumerosPortal, fetchRuaDoDia, fetchTopJogadores } from './portalApi.js'

const BASE = import.meta.env.BASE_URL
const MEDALHAS = ['🥇', '🥈', '🥉']

/** Executa `carregar` uma vez; erros viram estado `erro` (cada bloco falha sozinho). */
function useDados(carregar) {
  const [estado, setEstado] = useState({ dados: null, carregando: true, erro: false })
  useEffect(() => {
    let ativo = true
    carregar()
      .then((dados) => ativo && setEstado({ dados, carregando: false, erro: false }))
      .catch((err) => {
        console.error(err)
        if (ativo) setEstado({ dados: null, carregando: false, erro: true })
      })
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return estado
}

const formatar = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR') : '–')

// ─── Topo ────────────────────────────────────────────────────────────────────

function Hero() {
  const { dados: numeros } = useDados(fetchNumerosPortal)
  const itens = [
    { valor: numeros?.ruas, rotulo: 'ruas no acervo', icone: 'bi-signpost-2' },
    { valor: numeros?.bairros, rotulo: 'bairros', icone: 'bi-geo-alt' },
    { valor: numeros?.partidas, rotulo: numeros?.partidas === 1 ? 'partida jogada' : 'partidas jogadas', icone: 'bi-controller' },
  ].filter((i) => i.icone !== 'bi-controller' || i.valor > 0) // "0 partidas" desanima mais do que convida

  return (
    <section className="portal-hero" style={{ '--hero-img': `url("${BASE}images/portal-hero.webp")` }}>
      <div className="portal-hero-conteudo">
        <span className="portal-eyebrow">Portal Educativo</span>
        <h1>Cada rua de Ouro Branco conta uma história.</h1>
        <p>Descubra quem foram as pessoas, os lugares e os acontecimentos por trás dos nomes da cidade — jogando.</p>
        <div className="portal-hero-acoes">
          <a className="btn-portal btn-portal--claro" href="./games/quiz.html">
            <i className="bi bi-play-fill" aria-hidden="true" /> Jogar o Quiz
          </a>
          <a className="btn-portal btn-portal--contorno" href="#professores">
            Sou professor(a)
          </a>
        </div>
        <ul className="portal-numeros" aria-label="Números do acervo">
          {itens.map((i) => (
            <li key={i.rotulo}>
              <i className={`bi ${i.icone}`} aria-hidden="true" />
              <strong>{formatar(i.valor)}</strong> {i.rotulo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── Jogos ───────────────────────────────────────────────────────────────────

function CardJogo({ jogo }) {
  return (
    <a href={jogo.href} className="jogo-card" style={{ '--cor': jogo.cor, '--cor-texto': jogo.corTexto }}>
      <div className="jogo-card-topo" aria-hidden="true">
        <i className={`bi ${jogo.icon}`} />
      </div>
      <div className="jogo-card-corpo">
        <h3>{jogo.title}</h3>
        <p>{jogo.description}</p>
        <p className="jogo-aprende">
          <i className="bi bi-lightbulb" aria-hidden="true" /> {jogo.aprende}
        </p>
        <ul className="jogo-meta">
          {jogo.meta.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <span className="jogo-cta">
          Jogar <i className="bi bi-arrow-right" aria-hidden="true" />
        </span>
      </div>
    </a>
  )
}

// ─── Ranking e rua do dia ────────────────────────────────────────────────────

function TopJogadores() {
  const { dados: top, carregando, erro } = useDados(() => fetchTopJogadores(5))

  return (
    <section className="portal-painel" aria-labelledby="titulo-ranking">
      <div className="portal-painel-cabecalho">
        <h2 id="titulo-ranking">
          <i className="bi bi-trophy" aria-hidden="true" /> Melhores pontuações
        </h2>
        <a href="./games/ranking.html">Ranking completo</a>
      </div>
      {carregando ? (
        <p className="portal-vazio">Carregando…</p>
      ) : erro ? (
        <p className="portal-vazio">Não foi possível carregar o ranking agora.</p>
      ) : !top.length ? (
        <div className="portal-vazio portal-vazio--convite">
          <span aria-hidden="true">🏁</span>
          <p>
            Ninguém pontuou ainda.
            <br />
            <strong>Jogue agora e seja o primeiro do ranking!</strong>
          </p>
        </div>
      ) : (
        <ol className="top-lista">
          {top.map((p, i) => (
            <li key={p.id}>
              <span className="top-posicao">{MEDALHAS[i] || i + 1}</span>
              <span className="top-nome">{p.jogador_nome}</span>
              <span className="top-jogo">{ROTULO_JOGO[p.jogo] || p.jogo}</span>
              <span className="top-pontos">{formatar(p.pontos)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function RuaDoDia() {
  const { dados: rua, carregando, erro } = useDados(() => fetchRuaDoDia())
  if (erro || (!carregando && !rua)) return null

  const categoria = rua ? normalizarTaxe(rua.categoria) : null
  const link = rua?.bairroSlug
    ? `./index.html?bairro=${encodeURIComponent(rua.bairroSlug)}&rua=${encodeURIComponent(rua.nome)}`
    : './index.html'

  return (
    <section className="portal-painel rua-dia" aria-labelledby="titulo-rua-dia">
      <div className="portal-painel-cabecalho">
        <h2 id="titulo-rua-dia">
          <i className="bi bi-signpost-split" aria-hidden="true" /> Você sabia? · Rua do dia
        </h2>
      </div>
      {carregando ? (
        <p className="portal-vazio">Carregando…</p>
      ) : (
        <>
          <h3 className="rua-dia-nome">{rua.nome}</h3>
          <div className="rua-dia-tags">
            {rua.bairro && (
              <span className="tag">
                <i className="bi bi-geo-alt" aria-hidden="true" /> {rua.bairro}
              </span>
            )}
            {categoria !== 'outro' && (
              <span className="tag tag--categoria" style={{ '--tag-cor': corTaxe(categoria) }}>
                {rotuloTaxe(categoria)}
              </span>
            )}
          </div>
          <p className="rua-dia-texto">{rua.trecho}</p>
          <a className="rua-dia-link" href={link}>
            Ler a história completa no Dicionário <i className="bi bi-arrow-right" aria-hidden="true" />
          </a>
        </>
      )}
    </section>
  )
}

// ─── Professores ─────────────────────────────────────────────────────────────

function LinkCopiavel({ rotulo, url }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copie o link:', url)
    }
  }
  return (
    <div className="link-copiavel">
      <span className="link-copiavel-rotulo">{rotulo}</span>
      <code>{url}</code>
      <button type="button" onClick={copiar}>
        <i className={`bi ${copiado ? 'bi-check-lg' : 'bi-clipboard'}`} aria-hidden="true" />
        {copiado ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}

function Professores() {
  const [codigo, setCodigo] = useState('')
  const sala = codigo.trim().replace(/\s+/g, '-').slice(0, 20)
  const url = (caminho) => new URL(`${caminho}?sala=${encodeURIComponent(sala)}`, window.location.href).href

  return (
    <section id="professores" className="portal-professores" aria-labelledby="titulo-professores">
      <h2 id="titulo-professores">
        <i className="bi bi-mortarboard" aria-hidden="true" /> Para professores
      </h2>
      <p className="portal-secao-sub">Use os jogos em sala de aula e acompanhe a turma.</p>

      <div className="prof-grid">
        <div className="prof-card prof-card--turma">
          <h3>
            <i className="bi bi-people" aria-hidden="true" /> Quiz com a sua turma
          </h3>
          <p>Escolha um código para a turma. Os alunos jogam pelo link e você acompanha o ranking só deles.</p>
          <label htmlFor="codigo-turma" className="form-label">Código da turma</label>
          <input
            id="codigo-turma"
            className="form-control"
            placeholder="Ex.: 7A-2026"
            maxLength={20}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          {sala ? (
            <div className="prof-links" aria-live="polite">
              <LinkCopiavel rotulo="Para os alunos" url={url('games/quiz.html')} />
              <LinkCopiavel rotulo="Ranking da turma" url={`${url('games/ranking.html')}&jogo=quiz`} />
            </div>
          ) : (
            <p className="prof-dica">Digite um código para gerar os links.</p>
          )}
        </div>

        <div className="prof-card">
          <h3>
            <i className="bi bi-printer" aria-hidden="true" /> Cruzadinha para imprimir
          </h3>
          <p>Versão em folha A4 da cruzadinha das escolas, para atividades sem computador.</p>
          <a className="btn-portal btn-portal--escuro" href={encodeURI(`${BASE}docs/Cruzadinha (A4).pdf`)} download>
            <i className="bi bi-download" aria-hidden="true" /> Baixar PDF
          </a>
        </div>

        <div className="prof-card">
          <h3>
            <i className="bi bi-award" aria-hidden="true" /> Certificado de participação
          </h3>
          <p>Ao terminar o Quiz, cada aluno pode gerar um certificado em PDF com o nome e a pontuação.</p>
          <a className="btn-portal btn-portal--escuro" href="./games/quiz.html">
            Abrir o Quiz
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function PortalPage() {
  return (
    <>
      <a href="#hub-main" className="skip-link">
        Pular para o conteúdo
      </a>
      <Navbar active="jogos" />

      <main id="hub-main" className="portal-main" tabIndex={-1}>
        <Hero />

        <section className="portal-secao" aria-labelledby="titulo-jogos">
          <h2 id="titulo-jogos">Escolha seu desafio</h2>
          <p className="portal-secao-sub">Três jogos rápidos para conhecer a cidade de um jeito novo.</p>
          <div className="jogos-grid">
            {GAMES.map((g) => (
              <CardJogo key={g.id} jogo={g} />
            ))}
          </div>
        </section>

        <div className="portal-secao portal-duo">
          <TopJogadores />
          <RuaDoDia />
        </div>

        <div className="portal-secao">
          <Professores />
        </div>
      </main>

      <footer className="hub-footer">
        <p>
          © {new Date().getFullYear()} Toponímia Urbana de Ouro Branco · IFMG Campus Ouro Branco
        </p>
      </footer>
    </>
  )
}
