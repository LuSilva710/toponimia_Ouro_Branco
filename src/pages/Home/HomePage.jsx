import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import { Navbar } from '@components/layout/Navbar.jsx'
import { initChatbot } from '@features/onim/chatbot.js'
import { AlphaNav, StreetsByLetter } from './AlphaNav.jsx'
import { BairroCombobox } from './BairroCombobox.jsx'
import { SearchResults } from './SearchResults.jsx'
import {
  adaptRua,
  agruparRuasPorLetra,
  assetUrl,
  filtrarRuasPorQuery,
} from './homeUtils.js'

const INTRO_CARDS = [
  {
    icon: 'bi-book',
    title: 'Significados',
    text: 'Explicações detalhadas e justificativas dos nomes das ruas da cidade.',
  },
  {
    icon: 'bi-person-badge',
    title: 'Homenageados',
    text: 'Biografias das pessoas que emprestam seus nomes às ruas de Ouro Branco.',
  },
  {
    icon: 'bi-geo-alt',
    title: 'Localização',
    text: 'Informações sobre onde cada rua está localizada na cidade.',
  },
  {
    icon: 'bi-file-earmark-text',
    title: 'Legislação',
    text: 'Documentação oficial sobre a nomenclatura das ruas quando disponível.',
  },
]

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function HomePage() {
  const [bairros, setBairros] = useState([])
  const [todasRuas, setTodasRuas] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [loading, setLoading] = useState(true)
  const [bairroLoading, setBairroLoading] = useState(false)
  const [error, setError] = useState('')
  const [openRuaNome, setOpenRuaNome] = useState(null)
  const [activeLetter, setActiveLetter] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [pendingScrollRua, setPendingScrollRua] = useState(null)
  const searchRef = useRef(null)

  const debouncedQuery = useDebouncedValue(searchInput, 400)

  useEffect(() => {
    initChatbot()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [bairrosRes, ruasRes] = await Promise.all([
          supabase
            .from('bairros')
            .select('id, slug, nome, titulo, imagem_capa, descricao')
            .order('nome', { ascending: true }),
          supabase.from('ruas').select('*').order('nome_oficial', { ascending: true }),
        ])
        if (bairrosRes.error) throw bairrosRes.error
        if (ruasRes.error) throw ruasRes.error
        if (cancelled) return

        const listaBairros = bairrosRes.data || []
        setBairros(listaBairros)
        setTodasRuas((ruasRes.data || []).map(adaptRua))
        if (listaBairros.length) setSelectedSlug(listaBairros[0].slug)
        setLoading(false)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const bairrosById = useMemo(() => {
    const map = {}
    bairros.forEach((b) => {
      map[b.id] = b
    })
    return map
  }, [bairros])

  const bairroAtual = useMemo(
    () => bairros.find((b) => b.slug === selectedSlug) || null,
    [bairros, selectedSlug],
  )

  const ruasDoBairro = useMemo(() => {
    if (!bairroAtual) return {}
    const map = {}
    todasRuas.forEach(({ nome, detalhes }) => {
      if (detalhes.bairro_id === bairroAtual.id) map[nome] = detalhes
    })
    return map
  }, [todasRuas, bairroAtual])

  const ruasPorLetra = useMemo(() => agruparRuasPorLetra(ruasDoBairro), [ruasDoBairro])

  const lettersWithRuas = useMemo(() => new Set(Object.keys(ruasPorLetra)), [ruasPorLetra])

  const searchResultados = useMemo(
    () => filtrarRuasPorQuery(todasRuas, debouncedQuery),
    [todasRuas, debouncedQuery],
  )

  const searchStatusText = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) return ''
    if (!searchResultados) return ''
    const n = Object.keys(searchResultados).length
    if (n === 0) return `Nenhum resultado encontrado para "${debouncedQuery}"`
    return `${n} ${n === 1 ? 'resultado' : 'resultados'} para "${debouncedQuery}"`
  }, [debouncedQuery, searchResultados])

  const selectBairro = useCallback((slug) => {
    setBairroLoading(true)
    setSelectedSlug(slug)
    setOpenRuaNome(null)
    setSearchInput('')
    setActiveLetter(null)
    requestAnimationFrame(() => setBairroLoading(false))
  }, [])

  const clearSearch = useCallback((focus = true) => {
    setSearchInput('')
    if (focus) searchRef.current?.focus()
  }, [])

  const goToRua = useCallback(
    (slug, nome) => {
      if (!slug) return
      setSearchInput('')
      setSelectedSlug(slug)
      setPendingScrollRua(nome)
      setOpenRuaNome(nome)
    },
    [],
  )

  useEffect(() => {
    if (!pendingScrollRua || bairroLoading) return undefined
    const t = setTimeout(() => {
      const card = document.querySelector(`[data-rua-nome="${CSS.escape(pendingScrollRua)}"]`)
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setPendingScrollRua(null)
    }, 150)
    return () => clearTimeout(t)
  }, [pendingScrollRua, selectedSlug, bairroLoading])

  function toggleRua(nome) {
    setOpenRuaNome((prev) => (prev === nome ? null : nome))
  }

  function runSearchNow() {
    // força feedback imediato ao Enter / botão (debounce já cobre o digitado)
    setSearchInput((v) => v.trim())
  }

  return (
    <>
      <a href="#main-doc" className="skip-link">
        Pular para o conteúdo
      </a>
      <Navbar active="home" />
      <AlphaNav
        lettersWithRuas={lettersWithRuas}
        activeLetter={activeLetter}
        onSelectLetter={setActiveLetter}
      />

      <main id="main-doc" tabIndex={-1} aria-busy={loading || bairroLoading || undefined}>
        <div id="loading-announcer" className="visually-hidden" role="status" aria-live="polite">
          {loading || bairroLoading ? 'Carregando ruas, aguarde.' : ''}
        </div>

        <section className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">
              Dicionário de nomes de Ruas: memória e identidade de Ouro Branco
            </h1>
            <p className="hero-subtitle">
              Descubra a história e significado por trás dos nomes das ruas da cidade
            </p>
            <div className="hero-search">
              <div className="search-container">
                <input
                  ref={searchRef}
                  type="search"
                  id="searchInput"
                  className={`search-input${searchInput && debouncedQuery.length >= 2 && searchResultados === null ? ' search-loading' : ''}`}
                  placeholder="Buscar rua, bairro ou homenageado..."
                  aria-label="Buscar rua, bairro ou homenageado"
                  aria-describedby="search-hint"
                  autoComplete="off"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runSearchNow()
                  }}
                />
                <button
                  type="button"
                  id="searchSubmit"
                  className="search-submit"
                  aria-label="Buscar"
                  onClick={runSearchNow}
                >
                  <i className="bi bi-search" aria-hidden="true" />
                </button>
                <span id="search-hint" className="visually-hidden">
                  Digite pelo menos 2 caracteres para buscar
                </span>
              </div>
              <div id="search-status" className="visually-hidden" aria-live="polite" role="status">
                {searchStatusText}
              </div>
            </div>
          </div>
        </section>

        {searchResultados && (
          <SearchResults
            query={debouncedQuery}
            resultados={searchResultados}
            bairrosById={bairrosById}
            onClear={() => clearSearch(true)}
            onSelect={goToRua}
          />
        )}

        {error && (
          <p role="alert" aria-live="assertive" style={{ textAlign: 'center', color: 'red', padding: '2rem' }}>
            {error}
          </p>
        )}

        {!error && (
          <>
            <section id="Introdução" className="intro-section">
              <div className="intro-header">
                <h2 className="intro-title">Bem-vindo ao Dicionário de nomes de Ruas</h2>
                <p className="intro-lead">
                  O Dicionário de nomes de Ruas: memória e identidade de Ouro Branco é uma plataforma
                  que reúne informações sobre os nomes das ruas da cidade.
                </p>
              </div>
              <div className="intro-cards">
                {INTRO_CARDS.map((card) => (
                  <div className="intro-card" key={card.title}>
                    <div className="intro-card-icon">
                      <i className={`bi ${card.icon}`} aria-hidden="true" />
                    </div>
                    <h3 className="intro-card-title">{card.title}</h3>
                    <p className="intro-card-text">{card.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="introducao-bairro" className="bairro-section">
              <div className="bairro-header">
                <div
                  className="bairro-cover"
                  id="bairro-cover"
                  style={
                    !bairroAtual?.imagem_capa
                      ? { background: 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)' }
                      : undefined
                  }
                >
                  {bairroAtual?.imagem_capa && (
                    <img
                      src={assetUrl(bairroAtual.imagem_capa)}
                      alt={`Capa do bairro ${bairroAtual.nome}`}
                    />
                  )}
                </div>
                <div className="bairro-info">
                  <BairroCombobox
                    bairros={bairros}
                    selectedSlug={selectedSlug}
                    onSelect={selectBairro}
                    label={bairroAtual?.nome || (loading ? 'Carregando Bairro...' : 'Selecione')}
                  />
                  <h2 className="bairro-title" id="bairro-titulo">
                    {bairroAtual?.titulo || bairroAtual?.nome || ''}
                  </h2>
                  <p className="bairro-description" id="bairro-descricao">
                    {bairroAtual?.descricao || ''}
                  </p>
                </div>
              </div>
            </section>

            <StreetsByLetter
              ruasPorLetra={ruasPorLetra}
              openRuaNome={openRuaNome}
              onToggleRua={toggleRua}
              loading={loading || bairroLoading}
            />
          </>
        )}

        <div className="fixed-buttons">
          <button
            type="button"
            id="returnTopButton"
            aria-label="Voltar ao topo"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <i className="bi bi-arrow-up" aria-hidden="true" />
          </button>
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Toponímia Urbana</h3>
            <p className="footer-description">
              Preservando a história e memória de Ouro Branco através dos nomes de suas ruas.
            </p>
          </div>
          <div className="footer-section">
            <h4 className="footer-heading">Links Rápidos</h4>
            <ul className="footer-links">
              <li>
                <a href="./index.html">Dicionário de Ruas</a>
              </li>
              <li>
                <a href="./portaleducativo.html">Projeto Saberes</a>
              </li>
              <li>
                <a href="./about.html">Sobre Nós</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h4 className="footer-heading">Contato</h4>
            <ul className="footer-links">
              <li>
                <i className="bi bi-envelope" aria-hidden="true" /> contato@toponimia.com
              </li>
              <li>
                <i className="bi bi-geo-alt" aria-hidden="true" /> Ouro Branco, MG
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Toponímia Urbana de Ouro Branco. Todos os direitos reservados.</p>
        </div>
      </footer>
    </>
  )
}
