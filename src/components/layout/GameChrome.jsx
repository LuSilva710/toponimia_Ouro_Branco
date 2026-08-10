/** Barra simples das páginas de jogo (em /games/). */
export function GameChrome() {
  return (
    <header>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top" aria-label="Navegação do jogo">
        <div className="container-fluid">
          <a className="navbar-brand" href="../index.html">
            Toponímia Urbana de Ouro Branco
          </a>
          <div className="ms-auto">
            <a href="../portaleducativo.html" className="btn btn-outline-light btn-sm">
              <i className="bi bi-arrow-left me-1" aria-hidden="true" />
              Voltar
            </a>
          </div>
        </div>
      </nav>
    </header>
  )
}
