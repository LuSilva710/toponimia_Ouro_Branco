// ============================================
// ONIM v2.0 — Arquiteto de Memória Toponímica
// chatbot.js — Sprint 5 (Agente Autônomo)
// Implementa: Chain-of-Thought · Toolset · Ambiguity Detection
// Taxonomia: Dick (1990)
// ============================================
import { supabase } from '../../lib/supabase.js'
import { validateConfig, getProviderLabel } from '../../lib/ai-client.js'
import { executarAgenteONIM } from './onim-chain.js'
import { HumanMessage, AIMessage } from "@langchain/core/messages"

// ============================================
// ONIM — CHAIN-OF-THOUGHT LOGGER
// Imprime os passos de raciocínio do agente no console.
// Útil para demonstração na banca do TCC.
// ============================================
function onimLog(etapa, detalhe) {
  const estilos = {
    INTENCAO: 'color:#4ade80; font-weight:bold',
    FERRAMENTA: 'color:#60a5fa; font-weight:bold',
    CONTEXTO: 'color:#facc15; font-weight:bold',
    DECISAO: 'color:#f472b6; font-weight:bold',
    RESPOSTA: 'color:#a78bfa; font-weight:bold',
    AVISO: 'color:#fb923c; font-weight:bold',
  }
  const estilo = estilos[etapa] || 'color:#e2e8f0'
  console.log(`%c[ONIM · ${etapa}] ${detalhe}`, estilo)
}

// Valida configuração do provider ao carregar o módulo (loga no console, não quebra a UI)
try {
  validateConfig()
  onimLog('RESPOSTA', `Provider de IA ativo: ${getProviderLabel()}`)
} catch (e) {
  console.warn('[ONIM] Aviso de configuração de IA:', e.message)
}

window.addEventListener('onim-langchain-gemini-fallback', () => {
  const geminiModel = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini'
  onimLog('AVISO', `Limite do provedor principal atingido — o agente está usando Gemini (${geminiModel}).`)
})

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
// Guarda a pergunta original quando o ONIM pede esclarecimento de ambiguidade
let pendingQuery = null

// ============================================
// DOM ELEMENTS (WILL BE INJECTED)
// ============================================
let chatbotContainer, chatbotWindow, chatbotMessages, userInput, sendBtn, chatbotButton

// ============================================
// INIT
// ============================================
export function initChatbot() {
  if (document.getElementById('newChatbotContainer')) return

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
      <button id="newChatbotButton" type="button" aria-label="Abrir assistente virtual" aria-expanded="false" aria-controls="newChatbotWindow">
        <i class="bi bi-chat-dots-fill" aria-hidden="true"></i>
      </button>
      
      <div id="newChatbotWindow" class="chatbot-hidden" role="dialog" aria-modal="true" aria-labelledby="chatbot-title" aria-hidden="true">
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar-status">
              <i class="bi bi-robot" aria-hidden="true"></i>
              <span class="status-indicator" aria-hidden="true"></span>
            </div>
            <div>
              <h3 id="chatbot-title">Assistente Virtual</h3>
              <span>Online • Ouro Branco</span>
            </div>
          </div>
          <div class="chat-header-actions">
            <button type="button" id="backToHome" aria-label="Voltar ao início da conversa"><i class="bi bi-house-door" aria-hidden="true"></i></button>
            <button type="button" id="closeChat" aria-label="Fechar assistente virtual"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
          </div>
        </div>

        <div id="newChatbotMessages" aria-live="polite" aria-relevant="additions">
          </div>

        <div class="chat-input-area">
          <div class="input-wrapper">
            <input type="text" id="newUserInput" placeholder="Pergunte sobre uma rua ou bairro..." autocomplete="off" aria-label="Pergunte sobre uma rua ou bairro">
            <button type="button" id="newSendMessageButton" aria-label="Enviar mensagem">
              <i class="bi bi-send-fill" aria-hidden="true"></i>
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

  chatbotButton.setAttribute('aria-expanded', String(isOpen))
  chatbotWindow.setAttribute('aria-hidden', String(!isOpen))
  chatbotButton.setAttribute(
    'aria-label',
    isOpen ? 'Fechar assistente virtual' : 'Abrir assistente virtual'
  )
  document.body.classList.toggle('chatbot-open', isOpen)

  if (isOpen) {
    chatbotButton.classList.add('active')
    if (historico.length === 0) {
      mostrarBoasVindas()
    }
    setTimeout(() => userInput.focus(), 300)
  } else {
    chatbotButton.classList.remove('active')
    chatbotButton.focus()
  }
}

function mostrarBoasVindas() {
  chatbotMessages.innerHTML = `
    <div class="welcome-screen">
      <div class="onim-badge">
        <i class="bi bi-cpu-fill"></i>
        <span>ONIM v2.0 · Agente Ativo</span>
      </div>
      <h2>Como posso ajudar?</h2>
      <p>Sou o <strong>ONIM</strong>, especialista em Toponímia Urbana de Ouro Branco&#8209;MG.<br>Pergunte sobre ruas, bairros, história ou estatísticas do acervo.</p>
      
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
  pendingQuery = null // Descarta qualquer esclarecimento pendente
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
  if (role === 'bot') msgDiv.setAttribute('role', 'article')

  const bubble = document.createElement('div')
  bubble.className = 'chat-bubble'
  bubble.innerHTML = `
    <div class="chat-text">${texto}</div>
    <div class="chat-time" aria-hidden="true">${horaAtual()}</div>
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
      await new Promise(res => setTimeout(res, 600))
      resposta = respostaPronta
    } else {
      // ── MODO ESCLARECIMENTO: extrai apenas o bairro da resposta do usuário ──
      if (pendingQuery) {
        const queryOriginal = pendingQuery
        pendingQuery = null
        const queryComBairro = `${queryOriginal} do bairro ${texto}`
        onimLog('DECISAO', `Esclarecimento recebido. Consultando Agente LangChain...`)
        resposta = await consultarAgente(queryComBairro)
      } else {
        // Verifica ambiguidade antes (UX específica)
        const respostaAmbigua = await detectarAmbiguidade(texto)
        if (respostaAmbigua) {
          resposta = respostaAmbigua
        } else {
          resposta = await consultarAgente(texto)
        }
      }
    }

    removerTyping()
    adicionarMensagem('bot', resposta)

    // Botão de contribuição (apenas para buscas históricas não-estatísticas)
    const textoMin = texto.toLowerCase()
    const isEstatistica = textoMin.includes('quant') || textoMin.includes('mais') || textoMin.includes('menos') || textoMin.includes('qual bairro')
    if (!respostaPronta && (textoMin.includes('rua') || textoMin.includes('quem foi')) && !isEstatistica) {
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
  typing.setAttribute('role', 'status')
  typing.setAttribute('aria-live', 'polite')
  typing.setAttribute('aria-label', 'Assistente está digitando')
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

// -----------------------------------------------
// FERRAMENTA: DETECÇÃO DE AMBIGUIDADE (UX)
// Se o mesmo nome de rua existir em >1 bairro,
// o ONIM pergunta antes de responder.
// -----------------------------------------------
async function detectarAmbiguidade(pergunta) {
  onimLog('FERRAMENTA', '[BUSCA SEMÂNTICA] Verificando ambiguidade de logradouro...');

  const stopwords = new Set(['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma',
    'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre',
    'rua', 'ruas', 'avenida', 'bairro', 'quem', 'foi', 'nome', 'historia', 'história']);

  const keywords = pergunta.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (!keywords.length) return null;

  const orFilter = keywords.map(k => `nome_oficial.ilike.%${k}%`).join(',');
  const { data: resultados, error } = await supabase
    .from('ruas')
    .select('nome_oficial, bairros(nome)')
    .or(orFilter)
    .limit(10);

  if (error || !resultados || resultados.length === 0) return null;

  const grupos = {};
  for (const r of resultados) {
    const nomePadrao = r.nome_oficial?.toLowerCase() || '';
    if (!grupos[nomePadrao]) grupos[nomePadrao] = [];
    const bairro = r.bairros?.nome || 'Bairro desconhecido';
    if (!grupos[nomePadrao].includes(bairro)) grupos[nomePadrao].push(bairro);
  }

  for (const [nome, bairros] of Object.entries(grupos)) {
    if (bairros.length > 1) {
      const nomeFormatado = resultados.find(r => r.nome_oficial?.toLowerCase() === nome)?.nome_oficial || nome;
      onimLog('DECISAO', `Ambiguidade detectada: "${nomeFormatado}"`);
      pendingQuery = nomeFormatado;
      const bairrosList = bairros.map(b => `<strong>${b}</strong>`).join(' ou ');
      return `Encontrei <strong>"${nomeFormatado}"</strong> em mais de um local: ${bairrosList}.<br>Sobre qual desses bairros você gostaria de conhecer a história?`;
    }
  }
  return null;
}

// -----------------------------------------------
// MOTOR PRINCIPAL DO AGENTE (ONIM v3.0 — LangChain)
// -----------------------------------------------
async function consultarAgente(pergunta) {
  onimLog('INTENCAO', `Nova pergunta para o Agente: "${pergunta}"`)
  
  // Converte histórico para o formato LangChain
  const chatHistory = historico.map(m => {
    if (m.role === 'user') return new HumanMessage(m.text)
    if (m.role === 'bot') return new AIMessage(m.text)
    return null
  }).filter(m => m !== null)

  try {
    const resposta = await executarAgenteONIM(pergunta, chatHistory)
    onimLog('RESPOSTA', 'Agente LangChain respondeu com sucesso.')
    return resposta
  } catch (err) {
    console.error('[ONIM] Erro no Agente LangChain:', err)
    const msg = String(err?.message ?? '')
    const nome = err?.name ?? ''
    const rateLimited =
      nome === 'RateLimitError' ||
      msg.includes('429') ||
      /rate limit/i.test(msg)
    if (rateLimited) {
      const retryMatch = msg.match(/try again in ([^.]+)/i)
      const tempoEspera = retryMatch ? retryMatch[1].trim() : 'alguns minutos'
      return (
        '<p>O serviço de IA (Groq) recusou a requisição por <strong>limite de uso</strong> ' +
        '(cotas diárias de tokens ou muitas chamadas seguidas).</p>' +
        `<p>Se a mensagem da API indicar tempo de espera, tente de novo em <strong>${tempoEspera}</strong>. ` +
        'No plano gratuito, o limite renova conforme a política da Groq; mais capacidade em ' +
        '<a href="https://console.groq.com/settings/billing" target="_blank" rel="noopener">console Groq → billing</a>.</p>'
      )
    }
    return 'Tive um problema ao processar sua pergunta com meu novo motor de inteligência. Tente novamente.'
  }
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
