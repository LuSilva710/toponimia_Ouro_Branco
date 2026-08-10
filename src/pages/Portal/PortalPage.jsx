import { Navbar } from '@components/layout/Navbar.jsx'
import { GAMES } from './gamesConfig.js'

export default function PortalPage() {
  return (
    <>
      <a href="#hub-main" className="skip-link">
        Pular para o conteúdo
      </a>
      <Navbar active="jogos" />

      <main id="hub-main" className="hub-main" tabIndex={-1}>
        <div className="hub-hero">
          <h1>Portal Educativo</h1>
          <p>Aprenda sobre a história das ruas de Ouro Branco de forma divertida e interativa!</p>
        </div>

        <div className="games-grid">
          {GAMES.map((game) => (
            <a key={game.href} href={game.href} className="game-card">
              <div className="game-icon">
                <i className={`bi ${game.icon}`} aria-hidden="true" />
              </div>
              <h3>{game.title}</h3>
              <p>{game.description}</p>
              <span className="game-badge">{game.badge}</span>
            </a>
          ))}
        </div>
      </main>

      <div className="hub-footer">
        <p>
          © {new Date().getFullYear()} Toponímia Urbana de Ouro Branco · IFMG Campus Ouro Branco
        </p>
      </div>
    </>
  )
}
