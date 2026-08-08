export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <h4>Toponímia Urbana de Ouro Branco</h4>
            <p>
              Projeto de pesquisa dedicado ao estudo dos nomes de lugares e sua relação com a história e cultura local.
            </p>
            <div className="social-icons">
              <a href="#" aria-label="Facebook"><i className="bi bi-facebook" aria-hidden="true" /></a>
              <a href="#" aria-label="Instagram"><i className="bi bi-instagram" aria-hidden="true" /></a>
              <a href="#" aria-label="Twitter"><i className="bi bi-twitter" aria-hidden="true" /></a>
              <a href="#" aria-label="YouTube"><i className="bi bi-youtube" aria-hidden="true" /></a>
            </div>
          </div>

          <div className="col-lg-4">
            <h4>Contato</h4>
            <div className="contact-info">
              <p><i className="bi bi-geo-alt" aria-hidden="true" /> Instituto Federal de Ouro Branco, MG</p>
              <p><i className="bi bi-envelope" aria-hidden="true" /> toponimiaob@gmail.com</p>
              <p><i className="bi bi-telephone" aria-hidden="true" /> (31) 99999-9999</p>
            </div>
          </div>

          <div className="col-lg-4">
            <h4>Links Rápidos</h4>
            <ul className="list-unstyled">
              <li><a href="./index.html" className="text-white">Dicionário de Ruas</a></li>
              <li><a href="./portaleducativo.html" className="text-white">Projeto Saberes</a></li>
              <li><a href="./about.html" className="text-white">Sobre Nós</a></li>
            </ul>
          </div>
        </div>

        <div className="copyright">
          <p>&copy; {new Date().getFullYear()} Toponímia Urbana de Ouro Branco. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
