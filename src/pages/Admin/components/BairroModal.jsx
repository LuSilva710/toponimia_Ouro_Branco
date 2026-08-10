import { useEffect, useState } from 'react'
import { gerarSlug } from '../adminApi.js'

const empty = { id: '', nome: '', slug: '', titulo: '', imagem_capa: '', descricao: '' }

export function BairroModal({ open, initial, onClose, onSubmit }) {
  const [form, setForm] = useState(empty)
  const [autoSlug, setAutoSlug] = useState(true)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        id: initial.id || '',
        nome: initial.nome || '',
        slug: initial.slug || '',
        titulo: initial.titulo || '',
        imagem_capa: initial.imagem_capa || '',
        descricao: initial.descricao || '',
      })
      setAutoSlug(false)
    } else {
      setForm(empty)
      setAutoSlug(true)
    }
    setFile(null)
  }, [open, initial])

  if (!open) return null

  function setNome(nome) {
    setForm((f) => ({
      ...f,
      nome,
      slug: autoSlug ? gerarSlug(nome) : f.slug,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({ ...form, slug: form.slug.trim() || gerarSlug(form.nome), file })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{form.id ? 'Editar Bairro' : 'Novo Bairro'}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label" htmlFor="b_nome">Nome</label>
                  <input id="b_nome" className="form-control" required value={form.nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="b_slug">
                    Identificador (slug) <span className="text-muted fw-normal">— gerado automaticamente</span>
                  </label>
                  <input
                    id="b_slug"
                    className="form-control"
                    required
                    value={form.slug}
                    onChange={(e) => {
                      setAutoSlug(false)
                      setForm((f) => ({ ...f, slug: e.target.value }))
                    }}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="b_titulo">Título</label>
                  <input id="b_titulo" className="form-control" value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="b_capa">Imagem de Capa (URL ou upload)</label>
                  <input id="b_capa" className="form-control" value={form.imagem_capa} onChange={(e) => setForm((f) => ({ ...f, imagem_capa: e.target.value }))} />
                  <input type="file" className="form-control mt-1" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="b_desc">Descrição</label>
                  <textarea id="b_desc" className="form-control" rows={3} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  )
}
