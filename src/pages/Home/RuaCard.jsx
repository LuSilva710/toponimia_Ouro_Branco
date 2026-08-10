import { assetUrl, idDetalhesRua } from './homeUtils.js'
import { MiniMap } from './MiniMap.jsx'

function RuaFicha({ rua }) {
  const hasMedia = Boolean(rua.imagemHomenageado || rua.imagem)

  return (
    <div className="ficha-toponimica">
      <div className="ficha-metadados">
        <div className="meta-item meta-nome">
          <span className="meta-label">Nome Oficial</span>
          <span className="meta-value">{rua.nome_oficial || '---'}</span>
        </div>
        <div className="meta-item meta-localizacao">
          <span className="meta-label">Localização</span>
          <span className="meta-value">{rua.localizacao || '---'}</span>
        </div>
        <div className="meta-item meta-legislacao">
          <span className="meta-label">Legislação</span>
          <span className="meta-value">{rua.legislacao || '---'}</span>
        </div>
        <div className="meta-item meta-codigo">
          <span className="meta-label">Código</span>
          <span className="meta-value">{rua.codigo || '---'}</span>
        </div>
        <div className="meta-item meta-regional">
          <span className="meta-label">Regional</span>
          <span className="meta-value">{rua.regional || '---'}</span>
        </div>
      </div>
      <div className="ficha-conteudo">
        <div className="ficha-col-principal">
          <div className="ficha-secao">
            <h4 className="secao-titulo">
              <i className="bi bi-info-circle" aria-hidden="true" /> Significado / Histórico
            </h4>
            <p className="secao-texto">{rua.significado || 'Significado não disponível.'}</p>
          </div>
          <div className="ficha-secao">
            <h4 className="secao-titulo">
              <i className="bi bi-map" aria-hidden="true" /> Localização Geográfica
            </h4>
            <div className="ficha-mapa-container">
              {rua.lat && rua.lng ? (
                <MiniMap
                  ruaId={rua.id}
                  lat={rua.lat}
                  lng={rua.lng}
                  nome={rua.nome_oficial}
                  localizacao={rua.localizacao}
                  mapaFallback={rua.mapa}
                />
              ) : rua.mapa ? (
                <iframe
                  src={rua.mapa}
                  width="100%"
                  height="320"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Mapa de ${rua.nome_oficial || 'rua'}`}
                />
              ) : (
                <div className="no-map">Mapa não disponível.</div>
              )}
            </div>
          </div>
        </div>
        {hasMedia && (
          <div className="ficha-col-midia">
            {rua.imagemHomenageado && (
              <div className="midia-card">
                <h5 className="midia-titulo">Homenageado(a)</h5>
                <div className="midia-img-wrapper">
                  <img src={assetUrl(rua.imagemHomenageado)} alt="Imagem do Homenageado" />
                </div>
              </div>
            )}
            {rua.imagem && (
              <div className="midia-card">
                <h5 className="midia-titulo">Imagem da Rua</h5>
                <div className="midia-img-wrapper">
                  <img src={assetUrl(rua.imagem)} alt="Imagem da rua" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function RuaCard({ nome, detalhes, expanded, onToggle }) {
  const panelId = idDetalhesRua(nome)
  const significado = detalhes.significado || 'Significado não disponível'
  const preview = significado.length > 120 ? `${significado.substring(0, 120)}...` : significado

  return (
    <>
      <button
        type="button"
        className="rua-card"
        data-rua-nome={nome}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`Ver detalhes de ${nome}`}
        onClick={onToggle}
      >
        <div className="rua-card-content">
          <div className="rua-card-title">
            <i className="bi bi-signpost-2" aria-hidden="true" /> {nome}
          </div>
          <div className="rua-card-info">{preview}</div>
        </div>
        <div className="rua-card-badge" aria-hidden="true">
          <i className="bi bi-info-circle" /> Ver detalhes
        </div>
      </button>
      {expanded && (
        <div
          className="detalhes-rua"
          id={panelId}
          role="region"
          aria-label={`Detalhes de ${detalhes.nome_oficial || nome}`}
        >
          <RuaFicha rua={detalhes} />
        </div>
      )}
    </>
  )
}
