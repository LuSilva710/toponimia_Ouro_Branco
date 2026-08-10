import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@lib/supabase.js'
import {
  SIDEBAR_TABS,
  encontrarRuaPorNome,
  fetchDashboardStats,
  registrarAuditoria,
  uploadImage,
} from './adminApi.js'
import { LoginForm } from './components/LoginForm.jsx'
import { Toast } from './components/Toast.jsx'
import { BairroModal } from './components/BairroModal.jsx'
import { RuaModal } from './components/RuaModal.jsx'
import { DashboardTab } from './tabs/DashboardTab.jsx'
import { BairrosTab } from './tabs/BairrosTab.jsx'
import { RuasTab } from './tabs/RuasTab.jsx'
import { ContribuicoesTab } from './tabs/ContribuicoesTab.jsx'
import { AuditoriaTab } from './tabs/AuditoriaTab.jsx'
import { UsuariosTab } from './tabs/UsuariosTab.jsx'

export default function AdminPage() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const showToast = useCallback((message, type = 'success') => setToast({ message, type }), [])

  const [stats, setStats] = useState({ ruas: '--', bairros: '--', contribuicoes: '--', usuarios: '--' })
  const [bairros, setBairros] = useState([])
  const [ruas, setRuas] = useState([])

  const [bairroModal, setBairroModal] = useState({ open: false, initial: null })
  const [ruaModal, setRuaModal] = useState({ open: false, initial: null })

  const [contribStatus, setContribStatus] = useState('pendente')
  const [contribuicoes, setContribuicoes] = useState([])
  const [contribError, setContribError] = useState('')

  const [auditRows, setAuditRows] = useState([])
  const [auditError, setAuditError] = useState('')
  const [filtroAcao, setFiltroAcao] = useState('')
  const [filtroTabela, setFiltroTabela] = useState('')

  const [usuarios, setUsuarios] = useState([])
  const [usuariosError, setUsuariosError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUser(session.user)
      setBooting(false)
    })
  }, [])

  const refreshStats = useCallback(async () => {
    try {
      setStats(await fetchDashboardStats())
    } catch (err) {
      console.error(err)
    }
  }, [])

  const loadBairros = useCallback(async () => {
    const { data, error } = await supabase.from('bairros').select('*').order('nome', { ascending: true })
    if (error) return console.error(error)
    setBairros(data || [])
  }, [])

  const loadRuas = useCallback(async () => {
    const { data, error } = await supabase
      .from('ruas')
      .select('*, bairros(nome)')
      .order('nome_oficial', { ascending: true })
    if (error) return console.error(error)
    setRuas(data || [])
  }, [])

  const loadContribuicoes = useCallback(async (status) => {
    try {
      const { data, error } = await supabase
        .from('contribuicoes_chatbot')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
      if (error) {
        setContribError('Tabela de contribuições ainda não criada. Execute as migrações SQL.')
        setContribuicoes([])
        return
      }
      setContribError('')
      setContribuicoes(data || [])
      if (!ruas.length) await loadRuas()
    } catch {
      setContribError('Tabela de contribuições ainda não criada.')
      setContribuicoes([])
    }
  }, [loadRuas, ruas.length])

  const loadAuditoria = useCallback(async () => {
    try {
      let query = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50)
      if (filtroAcao) query = query.eq('acao', filtroAcao)
      if (filtroTabela) query = query.eq('tabela', filtroTabela)
      const { data, error } = await query
      if (error) {
        setAuditError('Tabela de auditoria ainda não criada.')
        setAuditRows([])
        return
      }
      setAuditError('')
      setAuditRows(data || [])
    } catch {
      setAuditError('Tabela de auditoria ainda não criada.')
      setAuditRows([])
    }
  }, [filtroAcao, filtroTabela])

  const loadUsuarios = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('perfis').select('*').order('created_at', { ascending: false })
      if (error) {
        setUsuariosError('Tabela de perfis ainda não criada.')
        setUsuarios([])
        return
      }
      setUsuariosError('')
      setUsuarios(data || [])
    } catch {
      setUsuariosError('Tabela de perfis ainda não criada.')
      setUsuarios([])
    }
  }, [])

  useEffect(() => {
    if (!user) return
    refreshStats()
    loadBairros()
  }, [user, refreshStats, loadBairros])

  useEffect(() => {
    if (!user) return
    if (tab === 'bairros') loadBairros()
    if (tab === 'ruas') loadRuas()
    if (tab === 'contribuicoes') loadContribuicoes(contribStatus)
    if (tab === 'auditoria') loadAuditoria()
    if (tab === 'usuarios') loadUsuarios()
  }, [tab, user, contribStatus, loadBairros, loadRuas, loadContribuicoes, loadAuditoria, loadUsuarios])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  async function saveBairro(form) {
    const payload = {
      slug: form.slug,
      nome: form.nome,
      titulo: form.titulo,
      imagem_capa: form.imagem_capa,
      descricao: form.descricao,
    }
    if (form.file) {
      try {
        payload.imagem_capa = await uploadImage(form.file, 'bairros')
      } catch (err) {
        alert(`Erro no upload: ${err.message}`)
        throw err
      }
    }
    const antes = form.id ? bairros.find((b) => b.id === form.id) : null
    const { error } = form.id
      ? await supabase.from('bairros').update(payload).eq('id', form.id)
      : await supabase.from('bairros').insert(payload)
    if (error) {
      alert(`Erro: ${error.message}`)
      throw error
    }
    await registrarAuditoria(user, form.id ? 'UPDATE' : 'INSERT', 'bairros', form.id, antes, payload)
    showToast(form.id ? 'Bairro atualizado.' : 'Bairro cadastrado.')
    await loadBairros()
    await refreshStats()
  }

  async function deleteBairro(b) {
    if (!confirm(`Tem certeza que deseja excluir o bairro "${b.nome}"?`)) return
    const { error } = await supabase.from('bairros').delete().eq('id', b.id)
    if (error) return alert(`Erro: ${error.message}`)
    await registrarAuditoria(user, 'DELETE', 'bairros', b.id, b, null)
    showToast('Bairro excluído.')
    await loadBairros()
    await refreshStats()
  }

  async function saveRua(form) {
    const payload = {
      bairro_id: form.bairro_id,
      slug: form.slug,
      nome_oficial: form.nome_oficial,
      significado: form.significado,
      localizacao: form.localizacao,
      legislacao: form.legislacao,
      codigo: form.codigo,
      regional: form.regional,
      mapa: form.mapa,
      categoria_toponimica: form.categoria_toponimica || null,
      genero_homenageado: form.genero_homenageado || null,
      decada_nomeacao: form.decada_nomeacao ? parseInt(form.decada_nomeacao, 10) : null,
      lat: form.lat !== '' ? parseFloat(form.lat) : null,
      lng: form.lng !== '' ? parseFloat(form.lng) : null,
    }
    try {
      if (form.fileHom) payload.imagemhomenageado = await uploadImage(form.fileHom, 'homenageados')
      else payload.imagemhomenageado = form.imagemhomenageado || null
      if (form.fileRua) payload.imagem = await uploadImage(form.fileRua, 'ruas')
      else payload.imagem = form.imagem || null
    } catch (err) {
      alert(`Erro no upload: ${err.message}`)
      throw err
    }
    const antes = form.id ? ruas.find((r) => r.id === form.id) : null
    const { error } = form.id
      ? await supabase.from('ruas').update(payload).eq('id', form.id)
      : await supabase.from('ruas').insert(payload)
    if (error) {
      alert(`Erro: ${error.message}`)
      throw error
    }
    await registrarAuditoria(user, form.id ? 'UPDATE' : 'INSERT', 'ruas', form.id, antes, payload)
    showToast(form.id ? 'Rua atualizada.' : 'Rua cadastrada.')
    await loadRuas()
    await refreshStats()
  }

  async function deleteRua(r) {
    if (!confirm(`Tem certeza que deseja excluir a rua "${r.nome_oficial}"?`)) return
    const { error } = await supabase.from('ruas').delete().eq('id', r.id)
    if (error) return alert(`Erro: ${error.message}`)
    await registrarAuditoria(user, 'DELETE', 'ruas', r.id, r, null)
    showToast('Rua excluída.')
    await loadRuas()
    await refreshStats()
  }

  async function moderarContribuicao(contrib, novoStatus, aplicar) {
    if (novoStatus === 'aprovado' && aplicar) {
      const rua = encontrarRuaPorNome(ruas, contrib.nome_rua)
      if (!rua) {
        alert('Não foi possível localizar a rua no cadastro. Use "Só aprovar" ou cadastre a rua primeiro.')
        return
      }
      const trecho = String(contrib.contribuicao || '').trim()
      const atual = String(rua.significado || '').trim()
      if (atual.includes(trecho)) {
        if (!confirm('Esse texto já parece estar no significado. Deseja só marcar a contribuição como aprovada?')) return
      } else {
        const preview = trecho.length > 180 ? `${trecho.slice(0, 180)}…` : trecho
        if (!confirm(`Acrescentar esta contribuição ao significado de "${rua.nome_oficial}"?\n\n"${preview}"`)) return
        const novoSignificado = atual ? `${atual}\n\n[Contribuição da comunidade] ${trecho}` : trecho
        const { error: updateErr } = await supabase.from('ruas').update({ significado: novoSignificado }).eq('id', rua.id)
        if (updateErr) return alert(`Erro ao atualizar significado: ${updateErr.message}`)
        await registrarAuditoria(user, 'UPDATE', 'ruas', rua.id, { significado: atual }, { significado: novoSignificado })
        setRuas((list) => list.map((r) => (r.id === rua.id ? { ...r, significado: novoSignificado } : r)))
      }
    }

    const { error } = await supabase.from('contribuicoes_chatbot').update({ status: novoStatus }).eq('id', contrib.id)
    if (error) return alert(`Erro: ${error.message}`)

    if (novoStatus === 'aprovado' && aplicar) showToast('Contribuição aprovada e aplicada no significado.')
    else if (novoStatus === 'aprovado') showToast('Contribuição aprovada.')
    else showToast('Contribuição rejeitada.')

    await loadContribuicoes('pendente')
    setContribStatus('pendente')
    await refreshStats()
  }

  async function alterarRole(id, role) {
    const { error } = await supabase.from('perfis').update({ role }).eq('id', id)
    if (error) return alert(`Erro: ${error.message}`)
    showToast('Permissão atualizada.')
    await loadUsuarios()
  }

  if (booting) {
    return <div className="login-container" style={{ display: 'flex' }}><p className="text-muted">Carregando…</p></div>
  }

  if (!user) {
    return <LoginForm onSuccess={setUser} />
  }

  return (
    <>
      <div id="admin-dashboard">
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
          <div className="container-fluid">
            <a className="navbar-brand"><i className="bi bi-gear-fill me-2" aria-hidden="true" /><strong>Admin</strong> — Toponímia</a>
            <div className="ms-auto d-flex align-items-center">
              <span className="text-light me-3 d-none d-md-inline">{user.email}</span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sair
              </button>
            </div>
          </div>
        </nav>

        <div className="admin-layout">
          <aside className="admin-sidebar">
            <nav className="sidebar-nav">
              {SIDEBAR_TABS.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`sidebar-link${tab === t.id ? ' active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    setTab(t.id)
                  }}
                >
                  <i className={`bi ${t.icon}`} aria-hidden="true" /><span>{t.label}</span>
                </a>
              ))}
            </nav>
            <div className="sidebar-footer">
              <a href="./index.html" className="sidebar-link">
                <i className="bi bi-house" aria-hidden="true" /><span>Voltar ao Site</span>
              </a>
            </div>
          </aside>

          <main className="admin-main">
            {tab === 'dashboard' && <DashboardTab stats={stats} />}
            {tab === 'bairros' && (
              <BairrosTab
                bairros={bairros}
                onNovo={() => setBairroModal({ open: true, initial: null })}
                onEdit={(b) => setBairroModal({ open: true, initial: b })}
                onDelete={deleteBairro}
              />
            )}
            {tab === 'ruas' && (
              <RuasTab
                ruas={ruas}
                bairros={bairros}
                onNovo={() => setRuaModal({ open: true, initial: null })}
                onEdit={(r) => setRuaModal({ open: true, initial: r })}
                onDelete={deleteRua}
              />
            )}
            {tab === 'contribuicoes' && (
              <ContribuicoesTab
                status={contribStatus}
                items={contribuicoes}
                error={contribError}
                ruas={ruas}
                onFilter={(s) => {
                  setContribStatus(s)
                  loadContribuicoes(s)
                }}
                onModerar={moderarContribuicao}
              />
            )}
            {tab === 'auditoria' && (
              <AuditoriaTab
                rows={auditRows}
                error={auditError}
                filtroAcao={filtroAcao}
                filtroTabela={filtroTabela}
                onFiltroAcao={(v) => setFiltroAcao(v)}
                onFiltroTabela={(v) => setFiltroTabela(v)}
                onVer={(a) => alert(JSON.stringify(a.dados_depois || a.dados_antes || {}, null, 2))}
              />
            )}
            {tab === 'usuarios' && (
              <UsuariosTab users={usuarios} error={usuariosError} onRoleChange={alterarRole} />
            )}
          </main>
        </div>
      </div>

      <BairroModal
        open={bairroModal.open}
        initial={bairroModal.initial}
        onClose={() => setBairroModal({ open: false, initial: null })}
        onSubmit={saveBairro}
      />
      <RuaModal
        open={ruaModal.open}
        initial={ruaModal.initial}
        bairros={bairros}
        onClose={() => setRuaModal({ open: false, initial: null })}
        onSubmit={saveRua}
      />
      <Toast message={toast.message} type={toast.type} onClear={() => setToast({ message: '', type: 'success' })} />
    </>
  )
}
