// ============================================
// CHATBOT PREMIUM - chatbot.js
// ============================================
import { supabase } from './supabase-client.js'

// ============================================
// CONFIG
// ============================================
const SUGESTOES = [
  { text: 'Quem foi Amaro Lanari?', icon: 'bi-person-badge' },
  { text: 'História do Centro', icon: 'bi-bank' },
  { text: 'O que é toponímia?', icon: 'bi-info-circle', response: '<strong>Toponímia</strong> é o estudo dos nomes próprios de lugares (nomes geográficos) e suas origens. No nosso dicionário, focamos nos nomes das ruas de Ouro Branco para preservar a história local.' },
  { text: 'Quantas ruas tem?', icon: 'bi-hash', response: 'Atualmente, o nosso sistema conta com mais de <strong>1.500 ruas</strong> registradas em diversos bairros de Ouro Branco!' },
]

// ============================================
// STATE
// ============================================
let historico = JSON.parse(sessionStorage.getItem('chatbot_historico') || '[]')
let isOpen = false

// ============================================
// DOM ELEMENTS (WILL BE INJECTED)
// ============================================
let chatbotContainer, chatbotWindow, chatbotMessages, userInput, sendBtn, chatbotButton

// ============================================
// INIT
// ============================================
export function initChatbot() {
  injectHTML()
  bindElements()
  setupEventListeners()
  
  if (historico.length > 0) {
    restaurarHistorico()
  }
}

// ============================================
// HTML INJECTION
// ============================================
function injectHTML() {
  const html = `
    <div id="newChatbotContainer">
      <button id="newChatbotButton" aria-label="Abrir assistente">
        <i class="bi bi-chat-dots-fill"></i>
      </button>
      
      <div id="newChatbotWindow" class="chatbot-hidden">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar-status">
              <i class="bi bi-robot"></i>
              <span class="status-indicator"></span>
            </div>
            <div>
              <h3>Assistente Virtual</h3>
              <span>Online • Ouro Branco</span>
            </div>
          </div>
          <div class="chat-header-actions">
            <button id="backToHome" title="Voltar ao início"><i class="bi bi-house-door"></i></button>
            <button id="closeChat" title="Fechar"><i class="bi bi-x-lg"></i></button>
          </div>
        </div>

        <div id="newChatbotMessages">
          <!-- Messages or Welcome Screen -->
        </div>

        <div class="chat-input-area">
          <div class="input-wrapper">
            <input type="text" id="newUserInput" placeholder="Pergunte sobre uma rua ou bairro..." autocomplete="off">
            <button id="newSendMessageButton" aria-label="Enviar">
              <i class="bi bi-send-fill"></i>
            </button>
          </div>
          <p class="chat-footer">Poderia haver erros na IA. Verifique dados oficiais.</p>
        </div>
      </div>
    </div>
  `
  document.body.insertAdjacentHTML('beforeend', html)
}

function bindElements() {
  chatbotContainer = document.getElementById('newChatbotContainer')
  chatbotWindow = document.getElementById('newChatbotWindow')
  chatbotMessages = document.getElementById('newChatbotMessages')
  userInput = document.getElementById('newUserInput')
  sendBtn = document.getElementById('newSendMessageButton')
  chatbotButton = document.getElementById('newChatbotButton')
}

function setupEventListeners() {
  chatbotButton.addEventListener('click', toggleChat)
  document.getElementById('closeChat').addEventListener('click', toggleChat)
  document.getElementById('backToHome').addEventListener('click', irParaInicio)
  
  sendBtn.addEventListener('click', () => enviarMensagem())
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarMensagem()
  })

  // Close on Escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) toggleChat()
  })
}

// ============================================
// ACTIONS
// ============================================
function toggleChat() {
  isOpen = !isOpen
  chatbotWindow.classList.toggle('chatbot-hidden')
  chatbotWindow.classList.toggle('chatbot-visible')
  
  if (isOpen) {
    chatbotButton.classList.add('active')
    if (historico.length === 0) {
      mostrarBoasVindas()
    }
    setTimeout(() => userInput.focus(), 300)
  } else {
    chatbotButton.classList.remove('active')
  }
}

function mostrarBoasVindas() {
  chatbotMessages.innerHTML = `
    <div class="welcome-screen">
      <h2>Como posso ajudar?</h2>
      <p>Sou o assistente do Dicionário de Ruas. Explore a história de Ouro Branco comigo!</p>
      
      <div class="quick-actions">
        ${SUGESTOES.map(sug => `
          <button class="quick-action-btn" data-sug="${sug.text}">
            <i class="bi ${sug.icon}"></i>
            <span>${sug.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `
  
  chatbotMessages.querySelectorAll('.quick-action-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const sug = SUGESTOES[index]
      enviarMensagem(sug.text, sug.response)
    })
  })
}

function irParaInicio() {
  mostrarBoasVindas()
}

// ============================================
// MESSAGES CORE
// ============================================
function adicionarMensagem(role, texto) {
  // Remove welcome screen if present
  if (chatbotMessages.querySelector('.welcome-screen')) {
    chatbotMessages.innerHTML = ''
  }

  const msgDiv = document.createElement('div')
  msgDiv.className = `chat-msg ${role}`
  
  const bubble = document.createElement('div')
  bubble.className = 'chat-bubble'
  bubble.innerHTML = `
    <div class="chat-text">${texto}</div>
    <div class="chat-time">${horaAtual()}</div>
  `

  if (role === 'bot') {
    const avatar = document.createElement('div')
    avatar.className = 'chat-avatar'
    avatar.innerHTML = '<i class="bi bi-robot"></i>'
    msgDiv.appendChild(avatar)
  }

  msgDiv.appendChild(bubble)
  chatbotMessages.appendChild(msgDiv)
  scrollToBottom()

  if (role !== 'typing') {
    historico.push({ role, text: texto, time: horaAtual() })
    salvarHistorico()
  }
}

async function enviarMensagem(textoManual = null, respostaPronta = null) {
  const texto = textoManual || userInput.value.trim()
  if (!texto) return

  userInput.value = ''
  adicionarMensagem('user', texto)
  
  mostrarTyping()

  try {
    let resposta
    if (respostaPronta) {
      // Pequeno delay para simular pensamento
      await new Promise(res => setTimeout(res, 600))
      resposta = respostaPronta
    } else {
      resposta = await consultarIA(texto)
    }

    removerTyping()
    adicionarMensagem('bot', resposta)
    
    // Check for contribution context
    if (!respostaPronta && (texto.toLowerCase().includes('rua') || texto.toLowerCase().includes('quem foi'))) {
      mostrarOpcaoContribuir(texto)
    }
  } catch (err) {
    removerTyping()
    adicionarMensagem('bot', 'Ops! Tive um problema técnico. Tente novamente em instantes.')
    console.error(err)
  }
}

function mostrarTyping() {
  const typing = document.createElement('div')
  typing.className = 'chat-msg bot typing-msg'
  typing.id = 'typing-indicator'
  typing.innerHTML = `
    <div class="chat-avatar"><i class="bi bi-robot"></i></div>
    <div class="chat-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>
  `
  chatbotMessages.appendChild(typing)
  scrollToBottom()
}

function removerTyping() {
  document.getElementById('typing-indicator')?.remove()
}

function mostrarOpcaoContribuir(contexto) {
  const btn = document.createElement('button')
  btn.className = 'contrib-btn'
  btn.innerHTML = '<i class="bi bi-plus-circle-fill"></i> Sabe algo mais? Contribua aqui'
  btn.onclick = () => {
    btn.remove()
    mostrarFormContrib(contexto)
  }
  chatbotMessages.appendChild(btn)
  scrollToBottom()
}

function mostrarFormContrib(rua) {
  const form = document.createElement('div')
  form.className = 'contrib-form'
  form.innerHTML = `
    <h3>Sua contribuição (${rua})</h3>
    <textarea id="contribText" placeholder="Conte-nos o que você sabe..."></textarea>
    <div class="contrib-actions">
      <button class="btn-send"><i class="bi bi-check-lg"></i> Enviar</button>
      <button class="btn-cancel">Cancelar</button>
    </div>
  `
  chatbotMessages.appendChild(form)
  scrollToBottom()

  form.querySelector('.btn-cancel').onclick = () => form.remove()
  form.querySelector('.btn-send').onclick = async () => {
    const text = form.querySelector('#contribText').value.trim()
    if (!text) return
    
    try {
      await supabase.from('contribuicoes_chatbot').insert({ nome_rua: rua, contribuicao: text })
      form.innerHTML = '<div class="contrib-success"><i class="bi bi-heart-fill"></i> Obrigado por ajudar!</div>'
      setTimeout(() => form.remove(), 2000)
    } catch {
      alert('Erro ao enviar.')
    }
  }
}

// ============================================
// DATA ENGINE (IA)
// ============================================
async function consultarIA(pergunta) {
  const stopwords = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre', 'rua', 'ruas', 'bairro', 'quem', 'foi', 'nome']
  const keywords = pergunta.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !stopwords.includes(w))

  if (keywords.length === 0) return 'Como posso ajudar você hoje?'

  const orFilter = keywords.map(k => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%`).join(',')
  const { data: ruas, error } = await supabase.from('ruas').select('*, bairros(nome)').or(orFilter).limit(3)

  if (error) throw error
  if (!ruas || ruas.length === 0) return `Não encontrei dados exatos sobre "${pergunta}". Pode tentar o nome de uma rua específica?`

  let resp = `Encontrei informações relevantes:\n\n`
  ruas.forEach(r => {
    resp += `📍 **${r.nome_oficial}** ${r.bairros ? `(${r.bairros.nome})` : ''}\n`
    if (r.significado) resp += `📖 ${r.significado.substring(0, 150)}${r.significado.length > 150 ? '...' : ''}\n\n`
  })

  return resp.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

// ============================================
// UTILS
// ============================================
function scrollToBottom() {
  chatbotMessages.scrollTo({ top: chatbotMessages.scrollHeight, behavior: 'smooth' })
}

function horaAtual() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function salvarHistorico() {
  sessionStorage.setItem('chatbot_historico', JSON.stringify(historico))
}

function restaurarHistorico() {
  chatbotMessages.innerHTML = ''
  historico.forEach(msg => {
    adicionarMensagem(msg.role, msg.text)
  })
}

// ============================================
// AUTO-INIT
// ============================================
document.addEventListener('DOMContentLoaded', initChatbot)
