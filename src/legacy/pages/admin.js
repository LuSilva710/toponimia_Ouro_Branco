import { supabase } from '../../lib/supabase.js'

// ============================================
// STATE
// ============================================
let currentUser = null
let bairrosCache = []
let ruasCache = []

// ============================================
// HELPERS
// ============================================
function gerarSlug(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function debounce(func, wait = 250) {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

function bindAutoSlug(nomeInputId, slugInputId) {
  const nomeEl = document.getElementById(nomeInputId)
  const slugEl = document.getElementById(slugInputId)
  if (!nomeEl || !slugEl) return

  slugEl.addEventListener('input', () => {
    slugEl.dataset.autoSlug = 'false'
  })

  nomeEl.addEventListener('input', () => {
    if (slugEl.dataset.autoSlug === 'false' && slugEl.value.trim()) return
    slugEl.dataset.autoSlug = 'true'
    slugEl.value = gerarSlug(nomeEl.value)
  })
}

function resetAutoSlug(slugInputId, valor = '') {
  const slugEl = document.getElementById(slugInputId)
  if (!slugEl) return
  slugEl.value = valor
  slugEl.dataset.autoSlug = valor ? 'false' : 'true'
}

function toast(mensagem, tipo = 'success') {
  let el = document.getElementById('admin-toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'admin-toast'
    el.className = 'admin-toast'
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')
    document.body.appendChild(el)
  }
  el.textContent = mensagem
  el.className = `admin-toast show ${tipo}`
  clearTimeout(el._timer)
  el._timer = setTimeout(() => el.classList.remove('show'), 3200)
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ============================================
// DOM REFERENCES
// ============================================
const loginScreen = document.getElementById('login-screen')
const dashboard = document.getElementById('admin-dashboard')
const formLogin = document.getElementById('form-login')
const loginError = document.getElementById('login-error')
const userEmailEl = document.getElementById('user-email')

bindAutoSlug('b_nome', 'b_slug')
bindAutoSlug('r_nome', 'r_slug')

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

    document.querySelectorAll('.sidebar-link[data-tab]').forEach(l => l.classList.remove('active'))
    link.classList.add('active')

    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    document.getElementById(`tab-${tab}`).classList.add('active')

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

    try {
      const contribRes = await supabase.from('contribuicoes_chatbot')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente')
      document.getElementById('stat-contribuicoes').textContent = contribRes.count ?? '0'
    } catch { document.getElementById('stat-contribuicoes').textContent = '0' }

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
      <td>${escapeHtml(b.nome)}</td>
      <td><code>${escapeHtml(b.slug)}</code></td>
      <td>${escapeHtml((b.descricao || '').substring(0, 60))}${(b.descricao || '').length > 60 ? '...' : ''}</td>
      <td>
        <button class="btn-action edit" onclick="editarBairro('${b.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-action delete" onclick="deletarBairro('${b.id}', '${String(b.nome || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('')

  const select = document.getElementById('r_bairro_id')
  const filtroBairro = document.getElementById('filtro-ruas-bairro')
  const optionsHtml = data.map(b => `<option value="${b.id}">${escapeHtml(b.nome)}</option>`).join('')
  select.innerHTML = '<option value="">Selecione...</option>' + optionsHtml
  if (filtroBairro) {
    const current = filtroBairro.value
    filtroBairro.innerHTML = '<option value="">Todos os bairros</option>' + optionsHtml
    filtroBairro.value = current
  }
}

document.getElementById('btn-novo-bairro').addEventListener('click', () => {
  document.getElementById('modal-bairro-titulo').textContent = 'Novo Bairro'
  document.getElementById('form-bairro').reset()
  document.getElementById('b_id').value = ''
  resetAutoSlug('b_slug')
  new bootstrap.Modal(document.getElementById('modal-bairro')).show()
})

document.getElementById('form-bairro').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('b_id').value
  const nome = document.getElementById('b_nome').value
  let slug = document.getElementById('b_slug').value.trim() || gerarSlug(nome)
  document.getElementById('b_slug').value = slug

  const payload = {
    slug,
    nome,
    titulo: document.getElementById('b_titulo').value,
    imagem_capa: document.getElementById('b_capa').value,
    descricao: document.getElementById('b_desc').value,
  }

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
  toast(id ? 'Bairro atualizado.' : 'Bairro cadastrado.')
  await loadBairros()
  await loadDashboardStats()
})

window.editarBairro = async (id) => {
  const b = bairrosCache.find(b => b.id === id)
  if (!b) return

  document.getElementById('modal-bairro-titulo').textContent = 'Editar Bairro'
  document.getElementById('b_id').value = b.id
  document.getElementById('b_nome').value = b.nome || ''
  document.getElementById('b_titulo').value = b.titulo || ''
  document.getElementById('b_capa').value = b.imagem_capa || ''
  document.getElementById('b_desc').value = b.descricao || ''
  resetAutoSlug('b_slug', b.slug || '')

  new bootstrap.Modal(document.getElementById('modal-bairro')).show()
}

window.deletarBairro = async (id, nome) => {
  if (!confirm(`Tem certeza que deseja excluir o bairro "${nome}"?`)) return

  const dadosAntes = bairrosCache.find(b => b.id === id)
  const { error } = await supabase.from('bairros').delete().eq('id', id)
  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria('DELETE', 'bairros', id, dadosAntes, null)
  toast('Bairro excluído.')
  await loadBairros()
  await loadDashboardStats()
}

// ============================================
// RUAS CRUD + FILTRO
// ============================================
async function loadRuas() {
  const { data, error } = await supabase
    .from('ruas')
    .select('*, bairros(nome)')
    .order('nome_oficial', { ascending: true })

  if (error) return console.error(error)
  ruasCache = data || []
  renderRuasFiltradas()
}

function renderRuasFiltradas() {
  const busca = (document.getElementById('filtro-ruas-busca')?.value || '').trim().toLowerCase()
  const bairroId = document.getElementById('filtro-ruas-bairro')?.value || ''
  const buscaNorm = busca.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filtradas = ruasCache.filter(r => {
    if (bairroId && String(r.bairro_id) !== String(bairroId)) return false
    if (!buscaNorm) return true

    const nome = (r.nome_oficial || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const loc = (r.localizacao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const sig = (r.significado || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const bairro = (r.bairros?.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const cat = (r.categoria_toponimica || '').toLowerCase()

    return nome.includes(buscaNorm) || loc.includes(buscaNorm) || sig.includes(buscaNorm) || bairro.includes(buscaNorm) || cat.includes(buscaNorm)
  })

  const contagem = document.getElementById('filtro-ruas-contagem')
  if (contagem) {
    contagem.textContent = busca || bairroId
      ? `${filtradas.length} de ${ruasCache.length} ruas`
      : `${ruasCache.length} ruas`
  }

  const tbody = document.querySelector('#tabela-ruas tbody')
  if (!filtradas.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Nenhuma rua encontrada com esses filtros.</td></tr>'
    return
  }

  tbody.innerHTML = filtradas.map(r => `
    <tr>
      <td>${escapeHtml(r.nome_oficial)}</td>
      <td>${escapeHtml(r.bairros?.nome || '--')}</td>
      <td>${escapeHtml(r.categoria_toponimica || '--')}</td>
      <td>${escapeHtml(r.genero_homenageado || '--')}</td>
      <td>
        <button class="btn-action edit" onclick="editarRua('${r.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-action delete" onclick="deletarRua('${r.id}', '${String(r.nome_oficial || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('')
}

document.getElementById('filtro-ruas-busca')?.addEventListener('input', debounce(renderRuasFiltradas, 200))
document.getElementById('filtro-ruas-bairro')?.addEventListener('change', renderRuasFiltradas)

document.getElementById('btn-nova-rua').addEventListener('click', () => {
  document.getElementById('modal-rua-titulo').textContent = 'Nova Rua'
  document.getElementById('form-rua').reset()
  document.getElementById('r_id').value = ''
  resetAutoSlug('r_slug')
  new bootstrap.Modal(document.getElementById('modal-rua')).show()
})

document.getElementById('form-rua').addEventListener('submit', async (e) => {
  e.preventDefault()
  const id = document.getElementById('r_id').value
  const nomeOficial = document.getElementById('r_nome').value
  let slug = document.getElementById('r_slug').value.trim() || gerarSlug(nomeOficial)
  document.getElementById('r_slug').value = slug

  const payload = {
    bairro_id: document.getElementById('r_bairro_id').value,
    slug,
    nome_oficial: nomeOficial,
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
  toast(id ? 'Rua atualizada.' : 'Rua cadastrada.')
  await loadRuas()
  await loadDashboardStats()
})

window.editarRua = async (id) => {
  const r = ruasCache.find(r => r.id === id)
  if (!r) return

  document.getElementById('modal-rua-titulo').textContent = 'Editar Rua'
  document.getElementById('r_id').value = r.id
  document.getElementById('r_bairro_id').value = r.bairro_id || ''
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
  resetAutoSlug('r_slug', r.slug || '')

  new bootstrap.Modal(document.getElementById('modal-rua')).show()
}

window.deletarRua = async (id, nome) => {
  if (!confirm(`Tem certeza que deseja excluir a rua "${nome}"?`)) return

  const dadosAntes = ruasCache.find(r => r.id === id)
  const { error } = await supabase.from('ruas').delete().eq('id', id)
  if (error) return alert('Erro: ' + error.message)

  await registrarAuditoria('DELETE', 'ruas', id, dadosAntes, null)
  toast('Rua excluída.')
  await loadRuas()
  await loadDashboardStats()
}

// ============================================
// CONTRIBUIÇÕES
// ============================================
function normalizarNomeRua(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

async function garantirRuasCache() {
  if (ruasCache.length) return
  const { data } = await supabase
    .from('ruas')
    .select('id, nome_oficial, significado, bairro_id, bairros(nome)')
    .order('nome_oficial', { ascending: true })
  ruasCache = data || []
}

function encontrarRuaPorNome(nomeRua) {
  const alvo = normalizarNomeRua(nomeRua)
  if (!alvo) return null

  const exact = ruasCache.find(r => normalizarNomeRua(r.nome_oficial) === alvo)
  if (exact) return exact

  return ruasCache.find(r => {
    const n = normalizarNomeRua(r.nome_oficial)
    return n.includes(alvo) || alvo.includes(n)
  }) || null
}

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

    await garantirRuasCache()

    container.innerHTML = data.map(c => {
      const ruaMatch = encontrarRuaPorNome(c.nome_rua)
      const matchHint = ruaMatch
        ? `<span class="contrib-match text-success"><i class="bi bi-link-45deg"></i> Vinculada a: ${escapeHtml(ruaMatch.nome_oficial)}</span>`
        : `<span class="contrib-match text-warning"><i class="bi bi-exclamation-triangle"></i> Rua não encontrada no cadastro</span>`

      return `
      <div class="contrib-card">
        <div class="contrib-header">
          <span class="contrib-rua"><i class="bi bi-signpost-2 me-1"></i>${escapeHtml(c.nome_rua)}</span>
          <span class="contrib-status ${c.status}">${c.status}</span>
        </div>
        <div class="contrib-text">${escapeHtml(c.contribuicao)}</div>
        <div class="contrib-meta">
          <i class="bi bi-person me-1"></i>${escapeHtml(c.autor_nome || 'Anônimo')} · ${new Date(c.created_at).toLocaleDateString('pt-BR')}
          ${matchHint}
        </div>
        ${c.status === 'pendente' ? `
          <div class="contrib-actions">
            <button class="btn btn-sm btn-success" onclick="moderarContribuicao('${c.id}', 'aprovado', true)" ${ruaMatch ? '' : 'disabled title="Cadastre a rua antes de aplicar"'}>
              <i class="bi bi-check2-all"></i> Aprovar e aplicar no significado
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="moderarContribuicao('${c.id}', 'aprovado', false)">
              <i class="bi bi-check-lg"></i> Só aprovar
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="moderarContribuicao('${c.id}', 'rejeitado', false)">
              <i class="bi bi-x-lg"></i> Rejeitar
            </button>
          </div>
        ` : ''}
      </div>
    `}).join('')
  } catch {
    document.getElementById('lista-contribuicoes').innerHTML =
      '<p class="text-muted">Tabela de contribuições ainda não criada.</p>'
  }
}

window.moderarContribuicao = async (id, novoStatus, aplicarNoSignificado = false) => {
  const { data: contribs, error: fetchErr } = await supabase
    .from('contribuicoes_chatbot')
    .select('*')
    .eq('id', id)
    .limit(1)

  if (fetchErr || !contribs?.length) return alert('Erro ao carregar contribuição.')
  const contrib = contribs[0]

  if (novoStatus === 'aprovado' && aplicarNoSignificado) {
    await garantirRuasCache()
    const rua = encontrarRuaPorNome(contrib.nome_rua)
    if (!rua) {
      alert('Não foi possível localizar a rua no cadastro. Use "Só aprovar" ou cadastre a rua primeiro.')
      return
    }

    const trecho = String(contrib.contribuicao || '').trim()
    const atual = String(rua.significado || '').trim()
    if (atual.includes(trecho)) {
      if (!confirm('Esse texto já parece estar no significado. Deseja só marcar a contribuição como aprovada?')) return
    } else {
      const preview = trecho.length > 180 ? trecho.slice(0, 180) + '…' : trecho
      if (!confirm(`Acrescentar esta contribuição ao significado de "${rua.nome_oficial}"?\n\n"${preview}"`)) return

      const novoSignificado = atual ? `${atual}\n\n[Contribuição da comunidade] ${trecho}` : trecho
      const { error: updateErr } = await supabase
        .from('ruas')
        .update({ significado: novoSignificado })
        .eq('id', rua.id)

      if (updateErr) return alert('Erro ao atualizar significado: ' + updateErr.message)

      await registrarAuditoria('UPDATE', 'ruas', rua.id, { significado: atual }, { significado: novoSignificado })
      const idx = ruasCache.findIndex(r => r.id === rua.id)
      if (idx >= 0) ruasCache[idx] = { ...ruasCache[idx], significado: novoSignificado }
    }
  }

  const { error } = await supabase
    .from('contribuicoes_chatbot')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) return alert('Erro: ' + error.message)

  if (novoStatus === 'aprovado' && aplicarNoSignificado) toast('Contribuição aprovada e aplicada no significado.')
  else if (novoStatus === 'aprovado') toast('Contribuição aprovada.')
  else toast('Contribuição rejeitada.')

  await loadContribuicoes('pendente')
  await loadDashboardStats()
}

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
        <td>${escapeHtml(a.user_email || '--')}</td>
        <td><span class="badge bg-${a.acao === 'INSERT' ? 'success' : a.acao === 'DELETE' ? 'danger' : 'primary'}">${a.acao}</span></td>
        <td>${escapeHtml(a.tabela)}</td>
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
        <td>${escapeHtml(u.email || u.id)}</td>
        <td>
          <select class="form-select form-select-sm" style="width:140px;display:inline-block;background:var(--admin-bg);color:var(--admin-text);border-color:var(--admin-border)" onchange="alterarRole('${u.id}', this.value)">
            <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Leitor</option>
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
  toast('Permissão atualizada.')
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
