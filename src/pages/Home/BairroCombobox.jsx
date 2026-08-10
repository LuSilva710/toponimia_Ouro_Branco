import { useEffect, useRef, useState } from 'react'

export function BairroCombobox({ bairros, selectedSlug, onSelect, label }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const options = bairros.map((b) => ({ slug: b.slug, nome: b.nome }))

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  function focusOption(index) {
    if (!options.length) return
    const next = ((index % options.length) + options.length) % options.length
    setActiveIndex(next)
  }

  function selectSlug(slug) {
    setOpen(false)
    setActiveIndex(-1)
    onSelect(slug)
    triggerRef.current?.focus()
  }

  function onTriggerKeyDown(e) {
    if (!options.length) return
    if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End', 'Escape'].includes(e.key)) {
      e.preventDefault()
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      setOpen(true)
      const selectedIdx = options.findIndex((o) => o.slug === selectedSlug)
      focusOption(selectedIdx >= 0 ? selectedIdx : 0)
      return
    }
    if (!open) return
    if (e.key === 'ArrowDown') focusOption(activeIndex + 1)
    else if (e.key === 'ArrowUp') focusOption(activeIndex - 1)
    else if (e.key === 'Home') focusOption(0)
    else if (e.key === 'End') focusOption(options.length - 1)
    else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
      selectSlug(options[activeIndex].slug)
    }
  }

  function onMenuKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusOption(activeIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusOption(activeIndex - 1)
    } else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
      e.preventDefault()
      selectSlug(options[activeIndex].slug)
    }
  }

  return (
    <div className={`custom-dropdown${open ? ' open' : ''}`} id="bairro-dropdown">
      <button
        type="button"
        ref={triggerRef}
        id="bairro-dropdown-trigger"
        className="dropdown-trigger bairro-badge"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="bairro-list"
        aria-label="Selecionar bairro"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
      >
        <i className="bi bi-geo-alt-fill" aria-hidden="true" />
        <span id="selected-bairro">{label}</span>
        <i className="bi bi-chevron-down ms-1" aria-hidden="true" style={{ fontSize: '0.8rem' }} />
      </button>
      <ul
        ref={menuRef}
        className={`dropdown-menu-custom${open ? ' active' : ''}`}
        id="bairro-list"
        role="listbox"
        aria-label="Lista de bairros"
        tabIndex={-1}
        onKeyDown={onMenuKeyDown}
      >
        {options.map((opt, i) => (
          <li
            key={opt.slug}
            role="option"
            aria-selected={opt.slug === selectedSlug}
            data-slug={opt.slug}
            className={i === activeIndex ? 'is-focused' : undefined}
            onClick={() => selectSlug(opt.slug)}
          >
            {opt.nome}
          </li>
        ))}
      </ul>
    </div>
  )
}
