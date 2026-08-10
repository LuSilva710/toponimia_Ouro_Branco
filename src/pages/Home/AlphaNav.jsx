import { LETTERS } from './homeUtils.js'
import { RuaCard } from './RuaCard.jsx'

export function AlphaNav({ lettersWithRuas, activeLetter, onSelectLetter }) {
  return (
    <nav id="navside" aria-label="Índice alfabético">
      <ul className="list-unstyled">
        {LETTERS.map((letra) => {
          const disabled = !lettersWithRuas.has(letra)
          return (
            <li
              key={letra}
              className={[
                'nav-item',
                disabled ? 'disabled' : '',
                activeLetter === letra ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-disabled={disabled || undefined}
            >
              <a
                className="nav-link"
                href={`#${letra}`}
                aria-disabled={disabled || undefined}
                title={disabled ? 'Nenhuma rua neste bairro começa com esta letra' : undefined}
                onClick={(e) => {
                  if (disabled) {
                    e.preventDefault()
                    return
                  }
                  onSelectLetter?.(letra)
                }}
              >
                {letra}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function StreetsByLetter({ ruasPorLetra, openRuaNome, onToggleRua, loading }) {
  return (
    <>
      {LETTERS.map((letra) => {
        const lista = ruasPorLetra[letra] || []
        return (
          <section key={letra} id={letra} className="main-section">
            <header>{letra}</header>
            <article>
              <div className="section-ruas">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="skeleton-card" aria-hidden="true">
                        <div className="skeleton-content">
                          <div className="skeleton-line skeleton-title" />
                          <div className="skeleton-line skeleton-text" />
                        </div>
                        <div className="skeleton-line skeleton-badge" />
                      </div>
                    ))
                  : lista.map(({ nome, detalhes }) => (
                      <RuaCard
                        key={nome}
                        nome={nome}
                        detalhes={detalhes}
                        expanded={openRuaNome === nome}
                        onToggle={() => onToggleRua(nome)}
                      />
                    ))}
              </div>
            </article>
          </section>
        )
      })}
    </>
  )
}
