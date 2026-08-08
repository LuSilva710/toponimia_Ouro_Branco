import { NAV_LINKS } from './navLinks.js'

/**
 * Navbar compartilhada (HTML legado + páginas React).
 * Usa âncoras <a> enquanto a migração for multi-page.
 */
export function Navbar({ active = 'about' }) {
  return (
    <header>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top" aria-label="Navegação principal">
        <div className="container-fluid">
          <a className="navbar-brand" href="./index.html">
            <strong>Toponímia Urbana de Ouro Branco</strong>
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarScroll"
            aria-controls="navbarScroll"
            aria-expanded="false"
            aria-label="Abrir menu de navegação"
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className="collapse navbar-collapse" id="navbarScroll">
            <ul className="navbar-nav me-auto my-2 my-lg-0 navbar-nav-scroll" style={{ ['--bs-scroll-height']: '180px' }}>
              {NAV_LINKS.map((link) => (
                <li className="nav-item" key={link.id}>
                  <a
                    className={`nav-link${active === link.id ? ' active' : ''}`}
                    href={link.href}
                    aria-current={active === link.id ? 'page' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </nav>
    </header>
  )
}
