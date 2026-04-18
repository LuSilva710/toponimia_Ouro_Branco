// ============================================
// CHATBOT PREMIUM - chatbot.js
// ============================================
import { supabase } from './supabase-client.js'
import { SYSTEM_PROMPT } from './systemPrompt.js'
import { generateText, validateConfig, getProviderLabel } from './ai-client.js'

// Valida configuração do provider ao carregar o módulo (loga no console, não quebra a UI)
try {
  validateConfig()
  console.log(`[Chatbot] Provider de IA: ${getProviderLabel()}`)
} catch (e) {
  console.warn('[Chatbot] Aviso de configuração de IA:', e.message)
}

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
      await new Promise(res => setTimeout(res, 600))
      resposta = respostaPronta
    } else {
      resposta = await consultarIA(texto)
    }

    removerTyping()
    adicionarMensagem('bot', resposta)
    

 // Check for contribution context
    const textoMin = texto.toLowerCase();
    // Bloqueia o botão se for pergunta de estatística/contagem
    const isEstatistica = textoMin.includes('quant') || textoMin.includes('mais') || textoMin.includes('menos') || textoMin.includes('qual bairro');
    
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
// DATA ENGINE (IA) - SPRINT 5 (Agente Roteador)
// ============================================

// 1. O CLASSIFICADOR (Função Auxiliar)
function classificarIntencao(pergunta) {
  const p = pergunta.toLowerCase();
  const palavrasEstatistica = [
    'quantas', 'quantos', 'qual bairro tem mais', 'qual bairro possui', 
    'maioria', 'total', 'estatística', 'porcentagem', 'femininos', 'masculinos'
  ];
  
  // Se a pergunta contiver qualquer palavra matemática/contagem, é Estatística
  for (let palavra of palavrasEstatistica) {
    if (p.includes(palavra)) return 'ESTATISTICA';
  }
  
  // Caso contrário, é uma busca histórica normal
  return 'HISTORIA';
}

// 2. A FUNÇÃO PRINCIPAL DA IA
async function consultarIA(pergunta) {
  // Passa pelo roteador primeiro
  const intencao = classificarIntencao(pergunta);
  let contextoParaIA = '';
  let instrucaoEspecial = '';

  console.log(`🧠 Intenção detectada pelo Roteador: ${intencao}`);

  // ==========================================
  // ROTA A: PERGUNTAS MATEMÁTICAS / ESTATÍSTICAS
  // ==========================================
  if (intencao === 'ESTATISTICA') {
    // Busca dados vivos diretamente do banco via Supabase!
    const resRuas = await supabase.from('ruas').select('*', { count: 'exact', head: true });
    const resBairros = await supabase.from('bairros').select('*', { count: 'exact', head: true });
    
    const totalRuas = resRuas.count || 'mais de 1500';
    const totalBairros = resBairros.count || 'dezenas';

    // Injeta os dados dinâmicos + curiosidades fixas no contexto
    contextoParaIA = `
      DADOS ESTATÍSTICOS OFICIAIS DO BANCO DE DADOS EM TEMPO REAL:
      - O sistema possui exatamente ${totalRuas} ruas catalogadas na cidade.
      - A cidade de Ouro Branco possui ${totalBairros} bairros registrados no nosso banco.
      - A maior categoria de origem dos nomes é 'Antropotopônimo' (homenagens a pessoas, correspondendo à maioria das ruas).
      - O bairro que possui MAIS nomes femininos registrados é o Luzia Augusta, seguido pelo Pioneiros.
      - A cidade teve uma forte explosão de novos logradouros registrados na década de 1970 com a chegada da usina Açominas.
    `;
    
    // Instrução dinâmica adaptada
    instrucaoEspecial = "O usuário está fazendo uma pergunta quantitativa ou estatística. Use EXCLUSIVAMENTE os 'DADOS ESTATÍSTICOS OFICIAIS' abaixo para responder. Não invente números. Após responder gentilmente, convide-o a visitar a nossa aba 'Estatísticas' (no menu principal) para ver gráficos completos.";
  } 
  
  // ==========================================
  // ROTA B: PERGUNTAS HISTÓRICAS (O RAG Clássico)
  // ==========================================
  else {
    const stopwords = ['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre', 'rua', 'ruas', 'bairro', 'quem', 'foi', 'nome'];
    const keywords = pergunta.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !stopwords.includes(w));

    if (keywords.length > 0) {
      const orFilter = keywords.map(k => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%`).join(',');
      const { data: ruas, error } = await supabase.from('ruas').select('*, bairros(nome)').or(orFilter).limit(3);

      if (!error && ruas && ruas.length > 0) {
        ruas.forEach(r => {
          contextoParaIA += `Nome: ${r.nome_oficial} (Bairro: ${r.bairros ? r.bairros.nome : 'Desconhecido'})\nSignificado: ${r.significado || 'Sem dados.'}\n\n`;
        });
      }
    }
    
    instrucaoEspecial = "O usuário está buscando a história de uma rua específica. Baseie-se APENAS no contexto histórico abaixo. Se o contexto estiver vazio, diga que ainda não temos esse registro no acervo.";
  }

  // ==========================================
  // 3. CHAMADA FINAL PARA O MODELO (ai-client — provider-agnostic)
  // ==========================================
  try {
    // System prompt completo: prompt base + instrução dinâmica do roteador
    const systemPromptFinal = `${SYSTEM_PROMPT}\n\nINSTRUÇÃO DINÂMICA DO ROTEADOR: ${instrucaoEspecial}`;

    // User prompt: contexto do banco (RAG) + pergunta do usuário
    const userPrompt = `CONTEXTO INJETADO PELO SISTEMA:\n${contextoParaIA || 'Nenhum registro encontrado.'}\n\nPERGUNTA DO USUÁRIO: ${pergunta}`;

    // Chama o provider configurado via VITE_AI_PROVIDER (Gemini, OpenAI, etc.)
    return await generateText(systemPromptFinal, userPrompt, 0.2);

  } catch (err) {
    console.error('[Chatbot] Erro ao consultar IA:', err);
    return 'Tivemos um problema de conexão com nossos servidores históricos. Tente novamente em instantes.';
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