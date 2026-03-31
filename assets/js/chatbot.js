// ============================================
// CHATBOT COM IA - chatbot.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CONFIG
// ============================================
const SUGESTOES = [
  'Quem foi Amaro Lanari?',
  'Ruas com nomes femininos',
  'História do bairro Centro',
  'O que é toponímia?',
  'Quantas ruas tem Ouro Branco?',
]

// ============================================
// STATE
// ============================================
let historico = JSON.parse(sessionStorage.getItem('chatbot_historico') || '[]')

// ============================================
// DOM
// ============================================
const chatbot = document.getElementById('chatbot')
const chatbotMessages = document.getElementById('chatbotMessages')
const chatbotButton = document.getElementById('chatbotButton')
const closeChatbotButton = document.getElementById('closeChatbotButton')
const userInput = document.getElementById('userInput')
const sendBtn = document.getElementById('sendMessageButton')

// ============================================
// INIT
// ============================================
export function initChatbot() {
  if (!chatbot || !chatbotButton) return

  // Improve chatbot UI
  melhorarUI()

  chatbotButton.addEventListener('click', () => {
    chatbot.style.display = 'block'
    chatbot.classList.remove('chatbot-hidden')
    if (historico.length === 0) {
      adicionarMensagemBot('Olá! 👋 Sou o assistente do Dicionário de Ruas de Ouro Branco. Pergunte sobre qualquer rua, homenageado ou bairro!')
      mostrarSugestoes()
    } else {
      restaurarHistorico()
    }
    userInput?.focus()
  })

  closeChatbotButton?.addEventListener('click', () => {
    chatbot.style.display = 'none'
  })

  sendBtn?.addEventListener('click', enviarMensagem)
  userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarMensagem()
  })
}

// ============================================
// UI IMPROVEMENTS
// ============================================
function melhorarUI() {
  if (!chatbotMessages) return

  // Add aria-live for accessibility
  chatbotMessages.setAttribute('aria-live', 'polite')
  chatbotMessages.setAttribute('role', 'log')
  chatbotMessages.innerHTML = ''
}

// ============================================
// MESSAGES
// ============================================
function adicionarMensagemBot(texto) {
  const msg = document.createElement('div')
  msg.className = 'chat-msg bot'
  msg.innerHTML = `
    <div class="chat-avatar"><i class="bi bi-robot"></i></div>
    <div class="chat-bubble bot-bubble">
      <div class="chat-text">${texto}</div>
      <div class="chat-time">${horaAtual()}</div>
    </div>
  `
  chatbotMessages.appendChild(msg)
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight

  historico.push({ role: 'bot', text: texto, time: horaAtual() })
  salvarHistorico()
}

function adicionarMensagemUsuario(texto) {
  const msg = document.createElement('div')
  msg.className = 'chat-msg user'
  msg.innerHTML = `
    <div class="chat-bubble user-bubble">
      <div class="chat-text">${texto}</div>
      <div class="chat-time">${horaAtual()}</div>
    </div>
    <div class="chat-avatar"><i class="bi bi-person"></i></div>
  `
  chatbotMessages.appendChild(msg)
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight

  historico.push({ role: 'user', text: texto, time: horaAtual() })
  salvarHistorico()
}

function mostrarTyping() {
  const typing = document.createElement('div')
  typing.className = 'chat-msg bot typing-indicator'
  typing.id = 'typing'
  typing.innerHTML = `
    <div class="chat-avatar"><i class="bi bi-robot"></i></div>
    <div class="chat-bubble bot-bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `
  chatbotMessages.appendChild(typing)
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight
}

function removerTyping() {
  document.getElementById('typing')?.remove()
}

function mostrarSugestoes() {
  const chips = document.createElement('div')
  chips.className = 'chat-chips'
  SUGESTOES.forEach(sug => {
    const chip = document.createElement('button')
    chip.className = 'chat-chip'
    chip.textContent = sug
    chip.addEventListener('click', () => {
      chips.remove()
      userInput.value = sug
      enviarMensagem()
    })
    chips.appendChild(chip)
  })
  chatbotMessages.appendChild(chips)
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight
}

function mostrarContribuicao(nomeRua) {
  const form = document.createElement('div')
  form.className = 'chat-contrib-form'
  form.innerHTML = `
    <p><strong>Contribuir informação sobre "${nomeRua}":</strong></p>
    <textarea class="form-control form-control-sm" rows="3" placeholder="Digite sua contribuição..."></textarea>
    <input class="form-control form-control-sm mt-1" placeholder="Seu nome (opcional)">
    <div class="mt-2">
      <button class="btn btn-sm btn-primary btn-enviar-contrib">Enviar</button>
      <button class="btn btn-sm btn-outline-secondary btn-cancelar-contrib">Cancelar</button>
    </div>
  `
  chatbotMessages.appendChild(form)

  form.querySelector('.btn-enviar-contrib').addEventListener('click', async () => {
    const contribuicao = form.querySelector('textarea').value.trim()
    const autor = form.querySelector('input').value.trim()
    if (!contribuicao) return alert('Digite sua contribuição')

    try {
      await supabase.from('contribuicoes_chatbot').insert({
        nome_rua: nomeRua,
        contribuicao,
        autor_nome: autor || null,
      })
      form.remove()
      adicionarMensagemBot('✅ Obrigado! Sua contribuição foi enviada para moderação.')
    } catch (err) {
      adicionarMensagemBot('❌ Erro ao enviar contribuição. Tente novamente.')
    }
  })

  form.querySelector('.btn-cancelar-contrib').addEventListener('click', () => form.remove())
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight
}

// ============================================
// SEND MESSAGE
// ============================================
async function enviarMensagem() {
  const texto = userInput.value.trim()
  if (!texto) return

  userInput.value = ''
  adicionarMensagemUsuario(texto)
  mostrarTyping()

  // Remove suggestion chips
  document.querySelectorAll('.chat-chips').forEach(c => c.remove())

  try {
    const resposta = await consultarIA(texto)
    removerTyping()
    adicionarMensagemBot(resposta)

    // Show contribute button if asking about a specific street
    if (texto.toLowerCase().includes('rua') || texto.toLowerCase().includes('quem foi')) {
      const contrib = document.createElement('div')
      contrib.className = 'chat-contrib-btn-container'
      contrib.innerHTML = `<button class="chat-chip contrib-chip"><i class="bi bi-plus-circle me-1"></i>Contribuir informação</button>`
      contrib.querySelector('button').addEventListener('click', () => {
        contrib.remove()
        mostrarContribuicao(texto)
      })
      chatbotMessages.appendChild(contrib)
      chatbotMessages.scrollTop = chatbotMessages.scrollHeight
    }
  } catch (err) {
    removerTyping()
    adicionarMensagemBot('Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.')
    console.error('Chatbot error:', err)
  }
}

// ============================================
// AI QUERY (RAG with Supabase + Keyword matching)
// ============================================
async function consultarIA(pergunta) {
  // Extract keywords (>= 4 chars, remove stopwords)
  const stopwords = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre', 'rua', 'ruas', 'bairro', 'quem', 'foi', 'nome']
  const keywords = pergunta
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopwords.includes(w))

  if (keywords.length === 0) {
    return 'Poderia reformular sua pergunta com mais detalhes? Por exemplo: "Quem foi Amaro Lanari?" ou "Quais ruas homenageiam mulheres?"'
  }

  // Search relevant ruas via ILIKE
  const orFilter = keywords.map(k => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%`).join(',')

  const { data: ruas, error } = await supabase
    .from('ruas')
    .select('nome_oficial, significado, localizacao, legislacao, genero_homenageado, categoria_toponimica, bairros(nome)')
    .or(orFilter)
    .limit(10)

  if (error) throw error

  if (!ruas || ruas.length === 0) {
    return `Não encontrei informações sobre "${pergunta}" no nosso dicionário. Que tal perguntar sobre uma rua específica de Ouro Branco?`
  }

  // Format response from found data (without external AI for now)
  let resposta = `Encontrei **${ruas.length}** resultado(s):\n\n`

  ruas.forEach(r => {
    resposta += `🔹 **${r.nome_oficial}**`
    if (r.bairros?.nome) resposta += ` (${r.bairros.nome})`
    resposta += '\n'
    if (r.significado) {
      const sig = r.significado.length > 200 ? r.significado.substring(0, 200) + '...' : r.significado
      resposta += `${sig}\n`
    }
    resposta += '\n'
  })

  // Format markdown-like to HTML
  resposta = resposta
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')

  return resposta
}

// ============================================
// HISTORY
// ============================================
function salvarHistorico() {
  sessionStorage.setItem('chatbot_historico', JSON.stringify(historico))
}

function restaurarHistorico() {
  chatbotMessages.innerHTML = ''
  historico.forEach(msg => {
    if (msg.role === 'bot') {
      const el = document.createElement('div')
      el.className = 'chat-msg bot'
      el.innerHTML = `
        <div class="chat-avatar"><i class="bi bi-robot"></i></div>
        <div class="chat-bubble bot-bubble">
          <div class="chat-text">${msg.text}</div>
          <div class="chat-time">${msg.time}</div>
        </div>
      `
      chatbotMessages.appendChild(el)
    } else {
      const el = document.createElement('div')
      el.className = 'chat-msg user'
      el.innerHTML = `
        <div class="chat-bubble user-bubble">
          <div class="chat-text">${msg.text}</div>
          <div class="chat-time">${msg.time}</div>
        </div>
        <div class="chat-avatar"><i class="bi bi-person"></i></div>
      `
      chatbotMessages.appendChild(el)
    }
  })
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight
}

// ============================================
// HELPERS
// ============================================
function horaAtual() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Auto-init
document.addEventListener('DOMContentLoaded', initChatbot)
