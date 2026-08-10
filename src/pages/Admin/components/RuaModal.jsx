import { useEffect, useState } from 'react'
import { CATEGORIAS, gerarSlug } from '../adminApi.js'

const empty = {
  id: '',
  bairro_id: '',
  slug: '',
  nome_oficial: '',
  significado: '',
  localizacao: '',
  legislacao: '',
  codigo: '',
  regional: '',
  mapa: '',
  categoria_toponimica: '',
  genero_homenageado: '',
  decada_nomeacao: '',
  lat: '',
  lng: '',
  imagemhomenageado: '',
  imagem: '',
}

export function RuaModal({ open, initial, bairros, onClose, onSubmit }) {
  const [form, setForm] = useState(empty)
  const [autoSlug, setAutoSlug] = useState(true)
  const [fileHom, setFileHom] = useState(null)
  const [fileRua, setFileRua] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        id: initial.id || '',
        bairro_id: initial.bairro_id || '',
        slug: initial.slug || '',
        nome_oficial: initial.nome_oficial || '',
        significado: initial.significado || '',
        localizacao: initial.localizacao || '',
        legislacao: initial.legislacao || '',
        codigo: initial.codigo || '',
        regional: initial.regional || '',
        mapa: initial.mapa || '',
        categoria_toponimica: initial.categoria_toponimica || '',
        genero_homenageado: initial.genero_homenageado || '',
        decada_nomeacao: initial.decada_nomeacao ?? '',
        lat: initial.lat ?? '',
        lng: initial.lng ?? '',
        imagemhomenageado: initial.imagemhomenageado || '',
        imagem: initial.imagem || '',
      })
      setAutoSlug(false)
    } else {
      setForm(empty)
      setAutoSlug(true)
    }
    setFileHom(null)
    setFileRua(null)
  }, [open, initial])

  if (!open) return null

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function setNome(nome_oficial) {
    setForm((f) => ({
      ...f,
      nome_oficial,
      slug: autoSlug ? gerarSlug(nome_oficial) : f.slug,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        slug: form.slug.trim() || gerarSlug(form.nome_oficial),
        fileHom,
        fileRua,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{form.id ? 'Editar Rua' : 'Nova Rua'}</h5>
              <button type="button" className="btn-close" aria-label="Fechar" onClick={onClose} />
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Bairro</label>
                    <select className="form-select" required value={form.bairro_id} onChange={(e) => set('bairro_id', e.target.value)}>
                      <option value="">Selecione...</option>
                      {bairros.map((b) => (
                        <option key={b.id} value={b.id}>{b.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Nome Oficial</label>
                    <input className="form-control" required value={form.nome_oficial} onChange={(e) => setNome(e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Localização</label>
                    <input className="form-control" value={form.localizacao} onChange={(e) => set('localizacao', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Identificador (slug) <span className="text-muted fw-normal">— automático</span></label>
                    <input
                      className="form-control"
                      required
                      value={form.slug}
                      onChange={(e) => {
                        setAutoSlug(false)
                        set('slug', e.target.value)
                      }}
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Significado</label>
                  <textarea className="form-control" rows={3} value={form.significado} onChange={(e) => set('significado', e.target.value)} />
                </div>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Categoria Toponímica</label>
                    <select className="form-select" value={form.categoria_toponimica} onChange={(e) => set('categoria_toponimica', e.target.value)}>
                      <option value="">Selecione...</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Gênero do Homenageado</label>
                    <select className="form-select" value={form.genero_homenageado} onChange={(e) => set('genero_homenageado', e.target.value)}>
                      <option value="">Selecione...</option>
                      <option value="masculino">Masculino</option>
                      <option value="feminino">Feminino</option>
                      <option value="neutro">Neutro</option>
                    </select>
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Década de Nomeação</label>
                    <input type="number" className="form-control" value={form.decada_nomeacao} onChange={(e) => set('decada_nomeacao', e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Latitude</label>
                    <input type="number" step="any" className="form-control" value={form.lat} onChange={(e) => set('lat', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Longitude</label>
                    <input type="number" step="any" className="form-control" value={form.lng} onChange={(e) => set('lng', e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Legislação</label>
                    <input className="form-control" value={form.legislacao} onChange={(e) => set('legislacao', e.target.value)} />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Código</label>
                    <input className="form-control" value={form.codigo} onChange={(e) => set('codigo', e.target.value)} />
                  </div>
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Regional</label>
                    <input className="form-control" value={form.regional} onChange={(e) => set('regional', e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Imagem do Homenageado</label>
                    <input className="form-control" value={form.imagemhomenageado} onChange={(e) => set('imagemhomenageado', e.target.value)} />
                    <input type="file" className="form-control mt-1" accept="image/*" onChange={(e) => setFileHom(e.target.files?.[0] || null)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Imagem da Rua</label>
                    <input className="form-control" value={form.imagem} onChange={(e) => set('imagem', e.target.value)} />
                    <input type="file" className="form-control mt-1" accept="image/*" onChange={(e) => setFileRua(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">URL do Mapa (embed)</label>
                  <input className="form-control" value={form.mapa} onChange={(e) => set('mapa', e.target.value)} />
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
