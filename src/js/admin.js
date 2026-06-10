// ============================================
// ADMIN DASHBOARD - admin.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// STATE
// ============================================
let currentUser = null
let bairrosCache = []

// ============================================
// DOM REFERENCES
// ============================================
const loginScreen = document.getElementById('login-screen')
const dashboard = document.getElementById('admin-dashboard')
const formLogin = document.getElementById('form-login')
const loginError = document.getElementById('login-error')
const userEmailEl = document.getElementById('user-email')

// ============================================
// AUTH
// ============================================

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const btnLogin = document.getElementById('btn-login')

  btnLogin.querySelector('.btn-text').textContent = 'Entrando...'
  btnLogin.querySelector('.spinner-border').classList.remove('d-none')
  btnLogin.disabled = true
  loginError.classList.add('d-none')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  btnLogin.querySelector('.btn-text').textContent = 'Entrar'
  btnLogin.querySelector('.spinner-border').classList.add('d-none')
  btnLogin.disabled = false

  if (error) {
    loginError.textContent = 'Erro: ' + error.message
    loginError.classList.remove('d-none')
    return
  }

  currentUser = data.user
  showDashboard()
})

document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut()
  currentUser = null
  dashboard.classList.add('d-none')
  loginScreen.style.display = 'flex'
})

// Check existing session
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user
    showDashboard()
  }
})

async function showDashboard() {
  loginScreen.style.display = 'none'
  dashboard.classList.remove('d-none')
  userEmailEl.textContent = currentUser.email
  await loadDashboardStats()
  await loadBairros()
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================
document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    const tab = link.dataset.tab

    // Update active state
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(l => l.classList.remove('active'))
    link.classList.add('active')

    // Show corresponding tab
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    document.getElementById(`tab-${tab}`).classList.add('active')

    // Load data for tab
    if (tab === 'bairros') loadBairros()
    if (tab === 'ruas') loadRuas()
    if (tab === 'contribuicoes') loadContribuicoes('pendente')
    if (tab === 'auditoria') loadAuditoria()
    if (tab === 'usuarios') loadUsuarios()
  })
})

// ============================================
// DASHBOARD STATS
// ============================================
async function loadDashboardStats() {
  try {
    const [ruasRes, bairrosRes] = await Promise.all([
      supabase.from('ruas').select('id', { count: 'exact', head: true }),
      supabase.from('bairros').select('id', { count: 'exact', head: true })
    ])

    document.getElementById('stat-ruas').textContent = ruasRes.count ?? '--'
    document.getElementById('stat-bairros').textContent = bairrosRes.count ?? '--'

    // Contribuições - may not exist yet
    try {
      const contribRes = await supabase.from('contribuicoes_chatbot')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      document.getElementById('stat-contribuicoes').textContent = contribRes.count ?? '0'
    } catch { document.getElementById('stat-contribuicoes').textContent = '0' }

    // Usuarios - may not exist yet
    try {
      const usersRes = await supabase.from('perfis').select('id', { count: 'exact', head: true })
      document.getElementById('stat-usuarios').textContent = usersRes.count ?? '0'
    } catch { document.getElementById('stat-usuarios').textContent = '0' }
  } catch (err) {
    console.error('Erro ao carregar stats:', err)
  }
}

// ============================================
// BAIRROS CRUD
// ============================================
async function loadBairros() {
  const { data, error } = await supabase
    .from('bairros')
    .select('*')
    .order('nome', { ascending: true })

  if (error) return console.error(error)
  bairrosCache = data || []

  const tbody = document.querySelector('#tabela-bairros tbody')
  tbody.innerHTML = data.map(b => `
    <tr>
      <td>${b.nome}</td>
      <td><code>${b.slug}</code></td>
      <td>${(b.descricao || '').substring(0, 60)}${(b.descricao || '').length > 60 ? '...' : ''}</td>
      <td>
        <button class="btn-action edit" onclick="editarBairro('${b.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-action delete" onclick="deletarBairro('${b.id}', '${b.nome}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('')

  // Populate rua form bairro select
  const select = document.getElementById('r_bairro_id')
  select.innerHTML = '<option value="">Selecione...</option>' + data.map(b =>
    `<option value="${b.id}">${b.nome}</option>`
  ).join('')
}

document.getElementById('btn-novo-bairro').addEventListener('click', () => {
  document.getElementById('modal-bairro-titulo').textContent = 'Novo Bairro'
  document.getElementById('form-bairro').reset()
  document.getElementById('b_id').value = ''
  new bootstrap.Modal(document.getElementById('modal-bairro')).show()
})

document.getElementById('form-bairro').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('b_id').value
  const payload = {
    slug: document.getElementById('b_slug').value,
    nome: document.getElementById('b_nome').value,
    titulo: document.getElementById('b_titulo').value,
    imagem_capa: document.getElementById('b_capa').value,
    descricao: document.getElementById('b_desc').value,
  }

  // Handle image upload
  const file = document.getElementById('b_capa_file').files[0]
  if (file) {
    const url = await uploadImage(file, 'bairros')
    if (url) payload.imagem_capa = url
  }

  const dadosAntes = id ? bairrosCache.find(b => b.id === id) : null

  let error
  if (id) {
    ({ error } = await supabase.from('bairros').update(payload).eq('id', id))
  } else {
    ({ error } = await supabase.from('bairros').insert(payload))
  }

  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria(id ? 'UPDATE' : 'INSERT', 'bairros', id, dadosAntes, payload)

  bootstrap.Modal.getInstance(document.getElementById('modal-bairro')).hide()
  await loadBairros()
  await loadDashboardStats()
})

window.editarBairro = async (id) => {
  const b = bairrosCache.find(b => b.id === id)
  if (!b) return

  document.getElementById('modal-bairro-titulo').textContent = 'Editar Bairro'
  document.getElementById('b_id').value = b.id
  document.getElementById('b_slug').value = b.slug || ''
  document.getElementById('b_nome').value = b.nome || ''
  document.getElementById('b_titulo').value = b.titulo || ''
  document.getElementById('b_capa').value = b.imagem_capa || ''
  document.getElementById('b_desc').value = b.descricao || ''

  new bootstrap.Modal(document.getElementById('modal-bairro')).show()
}

window.deletarBairro = async (id, nome) => {
  if (!confirm(`Tem certeza que deseja excluir o bairro "${nome}"?`)) return

  const dadosAntes = bairrosCache.find(b => b.id === id)
  const { error } = await supabase.from('bairros').delete().eq('id', id)
  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria('DELETE', 'bairros', id, dadosAntes, null)
  await loadBairros()
  await loadDashboardStats()
}

// ============================================
// RUAS CRUD
// ============================================
let ruasCache = []

async function loadRuas() {
  const { data, error } = await supabase
    .from('ruas')
    .select('*, bairros(nome)')
    .order('nome_oficial', { ascending: true })

  if (error) return console.error(error)
  ruasCache = data || []

  const tbody = document.querySelector('#tabela-ruas tbody')
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.nome_oficial}</td>
      <td>${r.bairros?.nome || '--'}</td>
      <td>${r.categoria_toponimica || '--'}</td>
      <td>${r.genero_homenageado || '--'}</td>
      <td>
        <button class="btn-action edit" onclick="editarRua('${r.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-action delete" onclick="deletarRua('${r.id}', '${r.nome_oficial}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('')
}

document.getElementById('btn-nova-rua').addEventListener('click', () => {
  document.getElementById('modal-rua-titulo').textContent = 'Nova Rua'
  document.getElementById('form-rua').reset()
  document.getElementById('r_id').value = ''
  new bootstrap.Modal(document.getElementById('modal-rua')).show()
})

document.getElementById('form-rua').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('r_id').value
  const payload = {
    bairro_id: document.getElementById('r_bairro_id').value,
    slug: document.getElementById('r_slug').value,
    nome_oficial: document.getElementById('r_nome').value,
    significado: document.getElementById('r_sig').value,
    localizacao: document.getElementById('r_loc').value,
    legislacao: document.getElementById('r_leg').value,
    codigo: document.getElementById('r_cod').value,
    regional: document.getElementById('r_reg').value,
    mapa: document.getElementById('r_mapa').value,
    categoria_toponimica: document.getElementById('r_categoria').value || null,
    genero_homenageado: document.getElementById('r_genero').value || null,
    decada_nomeacao: document.getElementById('r_decada').value ? parseInt(document.getElementById('r_decada').value) : null,
    lat: document.getElementById('r_lat').value ? parseFloat(document.getElementById('r_lat').value) : null,
    lng: document.getElementById('r_lng').value ? parseFloat(document.getElementById('r_lng').value) : null,
  }

  // Handle image uploads
  const imgHom = document.getElementById('r_img_hom_file').files[0]
  if (imgHom) {
    const url = await uploadImage(imgHom, 'homenageados')
    if (url) payload.imagemhomenageado = url
  } else {
    payload.imagemhomenageado = document.getElementById('r_img_hom').value || null
  }

  const imgRua = document.getElementById('r_img_file').files[0]
  if (imgRua) {
    const url = await uploadImage(imgRua, 'ruas')
    if (url) payload.imagem = url
  } else {
    payload.imagem = document.getElementById('r_img').value || null
  }

  const dadosAntes = id ? ruasCache.find(r => r.id === id) : null

  let error
  if (id) {
    ({ error } = await supabase.from('ruas').update(payload).eq('id', id))
  } else {
    ({ error } = await supabase.from('ruas').insert(payload))
  }

  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria(id ? 'UPDATE' : 'INSERT', 'ruas', id, dadosAntes, payload)

  bootstrap.Modal.getInstance(document.getElementById('modal-rua')).hide()
  await loadRuas()
  await loadDashboardStats()
})

window.editarRua = async (id) => {
  const r = ruasCache.find(r => r.id === id)
  if (!r) return

  document.getElementById('modal-rua-titulo').textContent = 'Editar Rua'
  document.getElementById('r_id').value = r.id
  document.getElementById('r_bairro_id').value = r.bairro_id || ''
  document.getElementById('r_slug').value = r.slug || ''
  document.getElementById('r_nome').value = r.nome_oficial || ''
  document.getElementById('r_sig').value = r.significado || ''
  document.getElementById('r_loc').value = r.localizacao || ''
  document.getElementById('r_leg').value = r.legislacao || ''
  document.getElementById('r_cod').value = r.codigo || ''
  document.getElementById('r_reg').value = r.regional || ''
  document.getElementById('r_mapa').value = r.mapa || ''
  document.getElementById('r_img_hom').value = r.imagemhomenageado || ''
  document.getElementById('r_img').value = r.imagem || ''
  document.getElementById('r_categoria').value = r.categoria_toponimica || ''
  document.getElementById('r_genero').value = r.genero_homenageado || ''
  document.getElementById('r_decada').value = r.decada_nomeacao || ''
  document.getElementById('r_lat').value = r.lat || ''
  document.getElementById('r_lng').value = r.lng || ''

  new bootstrap.Modal(document.getElementById('modal-rua')).show()
}

window.deletarRua = async (id, nome) => {
  if (!confirm(`Tem certeza que deseja excluir a rua "${nome}"?`)) return

  const dadosAntes = ruasCache.find(r => r.id === id)
  const { error } = await supabase.from('ruas').delete().eq('id', id)
  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria('DELETE', 'ruas', id, dadosAntes, null)
  await loadRuas()
  await loadDashboardStats()
}

// ============================================
// CONTRIBUIÇÕES
// ============================================
async function loadContribuicoes(status) {
  try {
    const { data, error } = await supabase
      .from('contribuicoes_chatbot')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      document.getElementById('lista-contribuicoes').innerHTML =
        '<p class="text-muted">Tabela de contribuições ainda não criada. Execute as migrações SQL.</p>'
      return
    }

    const container = document.getElementById('lista-contribuicoes')
    if (!data || data.length === 0) {
      container.innerHTML = `<p class="text-muted">Nenhuma contribuição ${status}.</p>`
      return
    }

    container.innerHTML = data.map(c => `
      <div class="contrib-card">
        <div class="contrib-header">
          <span class="contrib-rua"><i class="bi bi-signpost-2 me-1"></i>${c.nome_rua}</span>
          <span class="contrib-status ${c.status}">${c.status}</span>
        </div>
        <div class="contrib-text">${c.contribuicao}</div>
        <div class="contrib-meta">
          <i class="bi bi-person me-1"></i>${c.autor_nome || 'Anônimo'} · ${new Date(c.created_at).toLocaleDateString('pt-BR')}
        </div>
        ${c.status === 'pendente' ? `
          <div class="contrib-actions">
            <button class="btn btn-sm btn-outline-success" onclick="moderarContribuicao('${c.id}', 'aprovado')">
              <i class="bi bi-check-lg"></i> Aprovar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="moderarContribuicao('${c.id}', 'rejeitado')">
              <i class="bi bi-x-lg"></i> Rejeitar
            </button>
          </div>
        ` : ''}
      </div>
    `).join('')
  } catch {
    document.getElementById('lista-contribuicoes').innerHTML =
      '<p class="text-muted">Tabela de contribuições ainda não criada.</p>'
  }
}

window.moderarContribuicao = async (id, novoStatus) => {
  const { error } = await supabase
    .from('contribuicoes_chatbot')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) return alert('Erro: ' + error.message)
  await loadContribuicoes('pendente')
  await loadDashboardStats()
}

// Contribution filter buttons
document.querySelectorAll('[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    loadContribuicoes(btn.dataset.filter)
  })
})

// ============================================
// AUDITORIA
// ============================================
async function loadAuditoria() {
  try {
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    const filtroAcao = document.getElementById('filtro-acao').value
    const filtroTabela = document.getElementById('filtro-tabela').value

    if (filtroAcao) query = query.eq('acao', filtroAcao)
    if (filtroTabela) query = query.eq('tabela', filtroTabela)

    const { data, error } = await query

    if (error) {
      document.querySelector('#tabela-auditoria tbody').innerHTML =
        '<tr><td colspan="5" class="text-muted">Tabela de auditoria ainda não criada.</td></tr>'
      return
    }

    const tbody = document.querySelector('#tabela-auditoria tbody')
    tbody.innerHTML = (data || []).map(a => `
      <tr>
        <td>${new Date(a.created_at).toLocaleString('pt-BR')}</td>
        <td>${a.user_email || '--'}</td>
        <td><span class="badge bg-${a.acao === 'INSERT' ? 'success' : a.acao === 'DELETE' ? 'danger' : 'primary'}">${a.acao}</span></td>
        <td>${a.tabela}</td>
        <td><button class="btn btn-sm btn-outline-secondary" onclick="alert(JSON.stringify(${JSON.stringify(a.dados_depois || a.dados_antes || {})}, null, 2))">Ver</button></td>
      </tr>
    `).join('')
  } catch {
    document.querySelector('#tabela-auditoria tbody').innerHTML =
      '<tr><td colspan="5" class="text-muted">Tabela de auditoria ainda não criada.</td></tr>'
  }
}

document.getElementById('filtro-acao').addEventListener('change', loadAuditoria)
document.getElementById('filtro-tabela').addEventListener('change', loadAuditoria)

// ============================================
// USUARIOS
// ============================================
async function loadUsuarios() {
  try {
    const { data, error } = await supabase
      .from('perfis')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      document.querySelector('#tabela-usuarios tbody').innerHTML =
        '<tr><td colspan="4" class="text-muted">Tabela de perfis ainda não criada.</td></tr>'
      return
    }

    const tbody = document.querySelector('#tabela-usuarios tbody')
    tbody.innerHTML = (data || []).map(u => `
      <tr>
        <td>${u.id}</td>
        <td>
          <select class="form-select form-select-sm" style="width:120px;display:inline-block;background:var(--admin-bg);color:var(--admin-text);border-color:var(--admin-border)" onchange="alterarRole('${u.id}', this.value)">
            <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </td>
        <td>${new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
        <td>–</td>
      </tr>
    `).join('')
  } catch {
    document.querySelector('#tabela-usuarios tbody').innerHTML =
      '<tr><td colspan="4" class="text-muted">Tabela de perfis ainda não criada.</td></tr>'
  }
}

window.alterarRole = async (id, role) => {
  const { error } = await supabase.from('perfis').update({ role }).eq('id', id)
  if (error) return alert('Erro: ' + error.message)
  alert('Role atualizado!')
}

// ============================================
// IMAGE UPLOAD
// ============================================
async function uploadImage(file, folder) {
  const fileName = `${folder}/${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage
    .from('imagens')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (error) {
    console.error('Upload error:', error)
    alert('Erro no upload: ' + error.message)
    return null
  }

  const { data: urlData } = supabase.storage.from('imagens').getPublicUrl(data.path)
  return urlData.publicUrl
}

// ============================================
// AUDITORIA HELPER
// ============================================
async function registrarAuditoria(acao, tabela, registroId, dadosAntes, dadosDepois) {
  try {
    await supabase.from('audit_log').insert({
      user_id: currentUser?.id,
      user_email: currentUser?.email,
      acao,
      tabela,
      registro_id: registroId,
      dados_antes: dadosAntes || null,
      dados_depois: dadosDepois || null,
    })
  } catch (err) {
    console.warn('Auditoria não registrada (tabela pode não existir):', err)
  }
}
