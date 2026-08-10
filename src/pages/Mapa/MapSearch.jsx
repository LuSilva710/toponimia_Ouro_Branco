import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { buscarRuasPorQuery } from './mapUtils.js'

/**
 * Combobox de busca por rua (autocomplete local).
 */
export function MapSearch({ ruas, bairrosById, disabled, onSelect }) {
  const listId = useId()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const results = useMemo(() => buscarRuasPorQuery(ruas, query, 8), [ruas, query])
  const showList = open && query.trim().length >= 2

  useEffect(() => {
    setActiveIndex(results.length ? 0 : -1)
  }, [results])

  function selectRua(rua) {
    setQuery(rua.nome_oficial || '')
    setOpen(false)
    setActiveIndex(-1)
    onSelect?.(rua)
  }

  function onKeyDown(e) {
    if (!showList || !results.length) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && results[activeIndex]) selectRua(results[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const statusText =
    query.trim().length < 2
      ? ''
      : results.length === 0
        ? `Nenhuma rua encontrada para "${query}"`
        : `${results.length} resultado${results.length === 1 ? '' : 's'}`

  return (
    <div className="filter-group map-search">
      <h3 className="filter-title">
        <i className="bi bi-search me-1" aria-hidden="true" />
        Buscar rua
      </h3>
      <div className="map-search-box">
        <input
          ref={inputRef}
          type="search"
          className="map-search-input"
          placeholder="Nome da rua…"
          autoComplete="off"
          disabled={disabled}
          value={query}
          aria-label="Buscar rua no mapa"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showList}
          aria-activedescendant={
            activeIndex >= 0 && results[activeIndex]
              ? `${listId}-opt-${activeIndex}`
              : undefined
          }
          role="combobox"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            // delay para permitir click na opção
            setTimeout(() => setOpen(false), 150)
          }}
        />
        {query && (
          <button
            type="button"
            className="map-search-clear"
            aria-label="Limpar busca"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('')
              setOpen(false)
              inputRef.current?.focus()
            }}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="visually-hidden" role="status" aria-live="polite">
        {statusText}
      </div>

      {showList && (
        <ul id={listId} className="map-search-results" role="listbox" aria-label="Sugestões de ruas">
          {results.length === 0 ? (
            <li className="map-search-empty" role="presentation">
              Nenhum resultado
            </li>
          ) : (
            results.map((rua, i) => {
              const bairro = bairrosById[rua.bairro_id]?.nome
              const semCoords = !(rua.lat && rua.lng)
              return (
                <li
                  key={rua.id ?? rua.nome_oficial}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={i === activeIndex ? 'is-active' : undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectRua(rua)}
                >
                  <span className="map-search-result-name">{rua.nome_oficial}</span>
                  <span className="map-search-result-meta">
                    {bairro || 'Sem bairro'}
                    {semCoords ? ' · sem coordenadas' : ''}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
