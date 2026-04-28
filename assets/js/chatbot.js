// ============================================
// ONIM v2.0 — Arquiteto de Memória Toponímica
// chatbot.js — Sprint 5 (Agente Autônomo)
// Implementa: Chain-of-Thought · Toolset · Ambiguity Detection
// Taxonomia: Dick (1990)
// ============================================
import { supabase } from './supabase-client.js'
import { SYSTEM_PROMPT } from './systemPrompt.js'
import { generateText, validateConfig, getProviderLabel, truncateContext } from './ai-client.js'

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
      // ── MODO ESCLARECIMENTO: extrai apenas o bairro da resposta do usuário ──
      if (pendingQuery) {
        const queryOriginal = pendingQuery
        pendingQuery = null

        const bairroExtraido = texto
          .replace(new RegExp(queryOriginal, 'i'), '')
          .replace(/\b(rua|avenida|travessa|alameda|bairro)\b/gi, '')
          .replace(/\b(do|da|de|no|na|em|o|a)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim()

        const bairroFinal = bairroExtraido || texto

        // ✅ CONCATENA O BAIRRO NA QUERY PARA A IA ENTENDER O CONTEXTO COMPLETO
        const queryComBairro = `${queryOriginal} do bairro ${bairroFinal}`

        onimLog('DECISAO', `Esclarecimento recebido. Query reformulada: "${queryComBairro}"`)
        resposta = await consultarIA(queryComBairro, true, bairroFinal)
      } else {
        resposta = await consultarIA(texto)
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

// ============================================================
// ONIM v2.0 — DATA ENGINE & AGENT MIDDLEWARE
// Sprint 5 — Agente Autônomo com Chain-of-Thought
// ============================================================

// -----------------------------------------------
// FERRAMENTA 1: ROTEAMENTO DE INTENÇÃO
// Determina qual "ferramenta" o agente deve usar.
// -----------------------------------------------
function classificarIntencao(pergunta) {
  const p = pergunta.toLowerCase();

  // ── ROTA CONCEITO: perguntas sobre o que é / definição de termos toponymicos ──
  // O SYSTEM_PROMPT já contém toda a taxonomia — não precisa de RAG.
  const verbosConceito = ['o que é', 'o que são', 'o que significa', 'defina', 'define',
    'explique', 'explica', 'me explica', 'me fale sobre o conceito',
    'qual é a definição', 'qual a definição', 'como funciona', 'como se classifica'];
  const termosConceito = [
    'toponi', 'litotop', 'antropotop', 'hagiotop', 'fitotop', 'zootop',
    'hidrotop', 'ergotop', 'sociotop', 'geomorfotop', 'historiotop',
    'numerotop', 'corotop', 'cronotop', 'taxonomia', 'dick', 'onim',
    'classificação', 'categoria', 'logradouro'
  ];
  const temVerboConceito = verbosConceito.some(v => p.includes(v));
  const temTermoConceito = termosConceito.some(t => p.includes(t));
  if (temVerboConceito && temTermoConceito) return 'CONCEITO';
  // "o que é toponymia" ou "o que é um ergotoponimo" sem precisar de verbo explícito
  if (temVerboConceito && p.length < 60) return 'CONCEITO';

  const palavrasEstatistica = [
    'quantas', 'quantos', 'qual bairro tem mais', 'qual bairro possui',
    'maioria', 'total', 'estatística', 'porcentagem', 'femininos', 'masculinos',
    'antigo', 'velho', 'primeiro', 'fundação', 'história da cidade',
    'recente', 'novo', 'último', 'criado', 'surgido', 'predomina', 'categoria'
  ];

  for (const palavra of palavrasEstatistica) {
    if (p.includes(palavra)) return 'ESTATISTICA';
  }

  // ── GUARDA: se a pergunta já menciona um tipo de logradouro (rua, av...),
  // é consulta HISTÓRICA mesmo que também cite um bairro como filtro.
  // Exemplos: "Rua Minas Gerais do bairro Luzia Augusta" → HISTORIA
  const temLogradouro = /\b(rua|avenida|av\.|travessa|alameda|praça)\b/.test(p);
  if (temLogradouro) return 'HISTORIA';

  // Detecta perguntas sobre a história/origem de um BAIRRO como entidade
  // (ex: "história do Centro", "fale sobre o bairro Santa Luzia")
  const palavrasBairro = [
    'história do bairro', 'historia do bairro',
    'história do centro', 'historia do centro',
    'fale sobre o bairro', 'fale do bairro',
    'origem do bairro', 'bairro ', 'no bairro'
  ];
  for (const kw of palavrasBairro) {
    if (p.includes(kw)) return 'BAIRRO';
  }

  // Padrão: "história do <nome>" sem rua explícita → provavelmente é bairro
  if (/hist[oó]ria\s+d[oa]s?\s+\w+/.test(p) && !p.includes('rua') && !p.includes('avenida')) {
    return 'BAIRRO';
  }

  return 'HISTORIA';
}

// -----------------------------------------------
// FERRAMENTA 2: DETECÇÃO DE AMBIGUIDADE
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

  // Agrupa por nome de rua para ver se há repetição em bairros diferentes
  const grupos = {};
  for (const r of resultados) {
    const nomePadrao = r.nome_oficial?.toLowerCase() || '';
    if (!grupos[nomePadrao]) grupos[nomePadrao] = [];
    const bairro = r.bairros?.nome || 'Bairro desconhecido';
    if (!grupos[nomePadrao].includes(bairro)) grupos[nomePadrao].push(bairro);
  }

  // Encontra o primeiro nome com ocorrência em múltiplos bairros
  for (const [nome, bairros] of Object.entries(grupos)) {
    if (bairros.length > 1) {
      const nomeFormatado = resultados.find(r => r.nome_oficial?.toLowerCase() === nome)?.nome_oficial || nome;
      onimLog('DECISAO', `Ambiguidade detectada: "${nomeFormatado}" em ${bairros.length} bairros. Solicitando esclarecimento.`);
      // Salva a query original para ser combinada com a resposta do usuário
      pendingQuery = nomeFormatado;
      const bairrosList = bairros.map(b => `<strong>${b}</strong>`).join(' ou ');
      return `Encontrei <strong>"${nomeFormatado}"</strong> em mais de um local: ${bairrosList}.<br>Sobre qual desses bairros você gostaria de conhecer a história?`;
    }
  }

  return null; // Sem ambiguidade
}

// -----------------------------------------------
// FERRAMENTA 3: BUSCA DE HISTÓRICO DE BAIRRO
// Busca diretamente na tabela `bairros` e agrega
// as ruas mais representativas daquele setor.
// -----------------------------------------------
async function buscarContextoBairro(pergunta) {
  onimLog('FERRAMENTA', '[BUSCA BAIRRO] Procurando bairro no acervo...');

  // Extrai o nome do bairro da pergunta removendo conectivos comuns
  const nomeBairro = pergunta
    .replace(/hist[oó]ria\s+d[oa]s?/i, '')
    .replace(/fale\s+(sobre|do|da|de)\s+(o\s+)?bairro/i, '')
    .replace(/bairro/i, '')
    .replace(/\b(do|da|de|no|na|sobre|um|uma|o|a)\b/gi, '')
    .trim();

  if (!nomeBairro) {
    onimLog('AVISO', 'Não foi possível extrair o nome do bairro da pergunta.');
    return '';
  }

  onimLog('CONTEXTO', `Nome do bairro extraído: "${nomeBairro}"`);

  // Busca o bairro pelo nome (tolerante a case e acentos)
  const { data: bairros, error: errBairro } = await supabase
    .from('bairros')
    .select('id, nome, titulo, descricao')
    .ilike('nome', `%${nomeBairro}%`)
    .limit(1);

  if (errBairro || !bairros || bairros.length === 0) {
    onimLog('AVISO', `Bairro "${nomeBairro}" não encontrado na tabela bairros.`);
    // Fallback: tenta a busca clássica por ruas
    return await buscarContextoHistorico(pergunta);
  }

  const bairro = bairros[0];
  onimLog('CONTEXTO', `Bairro encontrado: ${bairro.nome} (id: ${bairro.id})`);

  // Busca uma amostra de ruas desse bairro para enriquecer o contexto
  const { data: ruas } = await supabase
    .from('ruas')
    .select('nome_oficial, categoria, significado, homenageado')
    .eq('bairro_id', bairro.id)
    .not('significado', 'is', null)
    .limit(5);

  let contexto = `--- BAIRRO ---\n`;
  contexto += `Nome: ${bairro.nome}\n`;
  if (bairro.titulo && bairro.titulo !== bairro.nome) contexto += `Título: ${bairro.titulo}\n`;
  if (bairro.descricao) contexto += `Descrição/História: ${bairro.descricao}\n`;
  contexto += `\n`;

  if (ruas && ruas.length > 0) {
    contexto += `--- LOGRADOUROS DO BAIRRO (amostra) ---\n`;
    ruas.forEach(r => {
      contexto += `• ${r.nome_oficial}`;
      if (r.categoria) contexto += ` [${r.categoria}]`;
      if (r.homenageado) contexto += ` — Homenageado: ${r.homenageado}`;
      if (r.significado) contexto += ` — ${r.significado.substring(0, 120)}...`;
      contexto += `\n`;
    });
  }

  onimLog('CONTEXTO', `Contexto de bairro montado: ${contexto.length} chars.`);
  return contexto;
}

// -----------------------------------------------
// FERRAMENTA 4: ROTEAMENTO ESTATÍSTICO
// Consulta dinâmica ao Supabase (live data)
// -----------------------------------------------
async function buscarDadosEstatisticos() {
  onimLog('FERRAMENTA', '[ROTEAMENTO ESTATÍSTICO] Acessando módulo de dados vivos do Supabase...');

  const [resRuas, resBairros, resTopCat, resRecente] = await Promise.all([
    supabase.from('ruas').select('*', { count: 'exact', head: true }),
    supabase.from('bairros').select('*', { count: 'exact', head: true }),
    supabase.from('ruas').select('categoria'),
    supabase.from('ruas').select('bairro, ano_lei').order('ano_lei', { ascending: false }).limit(1)
  ]);

  const totalRuas = resRuas.count || 0;
  const totalBairros = resBairros.count || 0;
  const bairroMaisNovo = resRecente.data?.[0]?.bairro || 'em expansão';
  const anoMaisNovo = resRecente.data?.[0]?.ano_lei || 'recente';

  const contagemCategorias = {};
  resTopCat.data?.forEach(r => {
    if (r.categoria) contagemCategorias[r.categoria] = (contagemCategorias[r.categoria] || 0) + 1;
  });
  const topCategoria = Object.entries(contagemCategorias)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'não identificada';
  const totalTopCategoria = contagemCategorias[topCategoria] || 0;
  const pctTopCategoria = totalRuas > 0 ? ((totalTopCategoria / totalRuas) * 100).toFixed(1) : '?';

  onimLog('CONTEXTO', `Dados carregados: ${totalRuas} ruas · ${totalBairros} bairros · Top: ${topCategoria} (${pctTopCategoria}%)`);

  return `
ESTATÍSTICAS VIVAS DO SISTEMA (geradas em ${new Date().toLocaleString('pt-BR')}):
- Total de Logradouros catalogados: ${totalRuas}
- Total de Setores/Bairros registrados: ${totalBairros}
- Categoria Toponímica Predominante (Taxonomia Dick 1990): ${topCategoria} — ${totalTopCategoria} ruas (${pctTopCategoria}% do acervo)
- Expansão Urbana Mais Recente: Bairro ${bairroMaisNovo} (legislação de ${anoMaisNovo})
- Núcleo Histórico Original: Bairro Centro (Matriz fundada em 1717)
`;
}

// -----------------------------------------------
// FERRAMENTA 4: BUSCA HISTÓRICA (RAG)
// Recupera logradouros e enriquece com taxonomia.
// -----------------------------------------------
async function buscarContextoHistorico(pergunta, filtroBairro = null) {
  onimLog('FERRAMENTA', '[LEITURA SQL] Buscando logradouros no Supabase (RAG Clássico)...');

  const stopwords = new Set(['de', 'da', 'do', 'em', 'que', 'e', 'a', 'o', 'os', 'as', 'um', 'uma',
    'com', 'por', 'para', 'se', 'não', 'mais', 'como', 'qual', 'quais', 'sobre',
    'rua', 'ruas', 'avenida', 'bairro', 'quem', 'foi', 'nome']);

  // Quando filtroBairro está ativo, remove o nome do bairro e o conector "do/no bairro"
  // da pergunta ANTES de extrair keywords — evita que tokens do bairro (ex: "luzia", "augusta")
  // poluam o OR filter da rua e empurrem o resultado alvo para fora do limit.
  const perguntaParaKeywords = filtroBairro
    ? pergunta
        .replace(new RegExp(`\\b${filtroBairro.replace(/\s+/g, '\\s+')}\\b`, 'gi'), '')
        .replace(/\b(no|do|da|de|em)\s+bairro\b/gi, '')
        .trim()
    : pergunta;

  const keywords = perguntaParaKeywords.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopwords.has(w));

  if (!keywords.length) {
    onimLog('AVISO', 'Nenhuma keyword extraída. Contexto vazio.');
    return '';
  }

  onimLog('CONTEXTO', `Keywords para busca: [${keywords.join(', ')}]${filtroBairro ? ` | Bairro: "${filtroBairro}"` : ''}`);

  const orFilter = keywords
    .map(k => `nome_oficial.ilike.%${k}%,significado.ilike.%${k}%,homenageado.ilike.%${k}%`)
    .join(',');

  let query = supabase
    .from('ruas')
    .select('nome_oficial, categoria, significado, homenageado, ano_lei, lei_municipal, bairros(nome)')
    .or(orFilter);

  // Quando há filtro de bairro: busca mais linhas e filtra em JS usando o join bairros(nome).
  // Não usamos .eq('bairro_id') pois o PostgREST falha silenciosamente ao combinar .or() com .eq().
  const limite = filtroBairro ? 20 : 4;

  const { data: todasRuas, error } = await query.limit(limite);

  if (error || !todasRuas || todasRuas.length === 0) {
    onimLog('AVISO', 'Busca RAG retornou vazia. Contexto: nenhum registro.');
    return '';
  }

  const ruas = filtroBairro
    ? todasRuas.filter(r => r.bairros?.nome?.toLowerCase().includes(filtroBairro.toLowerCase()))
    : todasRuas;

  if (ruas.length === 0) {
    onimLog('AVISO', `Nenhum resultado após filtro JS por bairro "${filtroBairro}".`);
    return '';
  }

  onimLog('CONTEXTO', `RAG: ${todasRuas.length} total → ${ruas.length} no bairro "${filtroBairro || 'todos'}".`);

  let contexto = '';
  ruas.forEach(r => {
    contexto += `--- LOGRADOURO ---\n`;
    contexto += `Nome Oficial: ${r.nome_oficial}\n`;
    contexto += `Bairro: ${r.bairros?.nome || 'Desconhecido'}\n`;
    contexto += `Categoria Taxonômica (Dick 1990): ${r.categoria || 'Não classificado'}\n`;
    if (r.homenageado) contexto += `Homenageado: ${r.homenageado}\n`;
    if (r.significado) contexto += `Significado/História: ${r.significado}\n`;
    if (r.ano_lei) contexto += `Ano da Lei: ${r.ano_lei}\n`;
    if (r.lei_municipal) contexto += `Lei Municipal: ${r.lei_municipal}\n`;
    contexto += '\n';
  });

  return contexto;
}

// -----------------------------------------------
// MOTOR PRINCIPAL DO AGENTE (ONIM v2.0)
// Orquestra o Chain-of-Thought e as ferramentas.
// skipAmbiguidade: true quando a query já vem do fluxo de esclarecimento
// -----------------------------------------------
async function consultarIA(pergunta, skipAmbiguidade = false, filtroBairro = null) {
  // ── ETAPA 1: CLASSIFICAR INTENÇÃO ──────────────────────────
  onimLog('INTENCAO', `Pergunta recebida: "${pergunta}"`);
  const intencao = classificarIntencao(pergunta);
  onimLog('INTENCAO', `Intenção classificada → ${intencao}`);

  let contextoParaIA = '';
  let instrucaoEspecial = '';

  // ── ETAPA 1.5: EXTRAI BAIRRO INLINE (antes da ambiguidade) ─────────────
  // Detecta "no Bairro X" / "do bairro X" na própria pergunta do usuário.
  // Se encontrado, o bairro já está especificado — não há ambiguidade a resolver.
  const matchBairroInline = pergunta.match(/\b(?:no|do|da|de|em)\s+(?:bairro\s+)?([A-ZÀ-Ü][\w\s]+?)(?:\s*$|[,.])/i);
  const filtroBairroLocal = filtroBairro
    || (matchBairroInline ? matchBairroInline[1].trim() : null);
  if (filtroBairroLocal && !filtroBairro) {
    onimLog('DECISAO', `Bairro detectado inline na pergunta: "${filtroBairroLocal}". Pulando ambiguidade.`);
  }

  // ── ETAPA 2: DETECÇÃO DE AMBIGUIDADE ─────────────────────────────────
  // Apenas quando: rota HISTORIA + não vem de esclarecimento + bairro não especificado
  if (intencao === 'HISTORIA' && !skipAmbiguidade) {
    onimLog('DECISAO', 'Verificando ambiguidade antes de buscar contexto...');
    const respostaAmbigua = await detectarAmbiguidade(pergunta);
    if (respostaAmbigua) {
      onimLog('DECISAO', '⚠️ Ambiguidade detectada. Aguardando esclarecimento do usuário.');
      return respostaAmbigua;
    }
    onimLog('DECISAO', '✅ Sem ambiguidade. Prosseguindo para busca RAG.');
  } else if (skipAmbiguidade) {
    onimLog('DECISAO', '🔓 Modo esclarecimento ativo. Pulando verificação de ambiguidade.');
  }

  // ── ETAPA 3: EXECUTAR A FERRAMENTA ADEQUADA ────────────────
  if (intencao === 'CONCEITO') {
    onimLog('DECISAO', 'Rota CONCEITO. Respondendo com base no SYSTEM_PROMPT — sem consulta ao banco.');
    // Nenhuma query ao Supabase. O modelo usa o conhecimento embutido no system prompt.
    contextoParaIA = '';
    instrucaoEspecial = (
      'O usuário fez uma pergunta CONCEITUAL sobre toponímia ou sobre a taxonomia de Dick (1990). '
      + 'Responda de forma clara, didática e objetiva usando APENAS o conhecimento da sua persona (SYSTEM_PROMPT). '
      + 'NÃO use a frase de desconhecimento do sistema. '
      + 'NÃO diga que não temos o registro. '
      + 'Inclua exemplos práticos de ruas de Ouro Branco se fizer sentido. '
      + 'Mantenha o tom acadêmico e acolhedor do ONIM.'
    );
  } else if (intencao === 'ESTATISTICA') {
    onimLog('DECISAO', 'Confiança > 0.9 para rota ESTATÍSTICA. Acionando módulo de dados.');
    contextoParaIA = await buscarDadosEstatisticos();
    instrucaoEspecial = (
      'Você é um analista de dados do acervo toponymico. '
      + 'Use os números EXATOS fornecidos no contexto. '
      + 'Mencione que os dados são gerados em tempo real do banco de dados do IFMG. '
      + 'Sugira ao final que o usuário explore a aba Estatísticas para ver gráficos detalhados.'
    );
  } else if (intencao === 'BAIRRO') {
    onimLog('DECISAO', 'Rota BAIRRO detectada. Acionando busca histórica de setor urbano.');
    contextoParaIA = await buscarContextoBairro(pergunta);
    instrucaoEspecial = (
      'O usuário quer conhecer a história e características de um BAIRRO de Ouro Branco. '
      + 'Apresente o bairro de forma acolhedora e narrativa. '
      + 'Se a descrição do bairro estiver disponível no contexto, use-a como base principal. '
      + 'Comente sobre as ruas listadas na amostra, mencionando suas categorias taxonômicas (Dick 1990). '
      + 'Se o contexto estiver vazio, admita o desconhecimento com a frase padrão do sistema. '
      + 'NUNCA invente datas ou eventos históricos. '
      + 'Sugira ao final que o usuário explore o Mapa Interativo para ver as ruas do bairro.'
    );
  } else {
    onimLog('DECISAO', 'Confiança > 0.8 para rota HISTÓRICA. Acionando busca RAG.');

    // ✅ PRIORIZA O FILTRO PASSADO POR PARÂMETRO (vindo do esclarecimento)
    let filtroBairroBusca = filtroBairroLocal;

    if (filtroBairroBusca) {
      onimLog('CONTEXTO', `Filtro de bairro ativo: "${filtroBairroBusca}"`);
    }

    contextoParaIA = await buscarContextoHistorico(pergunta, filtroBairroBusca);
    instrucaoEspecial = (
      'O usuário busca a história de um logradouro específico. '
      + 'Baseie-se EXCLUSIVAMENTE no contexto abaixo (taxonomia Dick 1990 já inclusa). '
      + 'ATENÇÃO: A ambiguidade de nome já foi resolvida pelo sistema. '
      + 'NÃO faça nenhuma pergunta de esclarecimento sobre bairro ou localização. '
      + 'FORMATAÇÃO OBRIGATÓRIA: use APENAS HTML (<strong>, <em>, <br>, <ul><li>). '
      + 'É PROIBIDO usar Markdown (asteriscos ** ou * para negrito/itálico). '
      + 'REGRA CRÍTICA: SE o contexto contiver "Nome Oficial" e "Bairro", o logradouro EXISTE no acervo. '
      + 'Nesse caso, apresente-o usando o formato padrão: '
      + '<strong>[Nome Oficial]</strong><br><em>Bairro: [Bairro] | Categoria: [Categoria]</em><br> '
      + 'Se "Significado/História" estiver ausente no contexto, acrescente apenas: '
      + '"Nossa equipe do IFMG continua pesquisando o histórico completo deste logradouro." '
      + 'NUNCA use a frase "Ainda não temos o registro" se o contexto tiver nome e bairro. '
      + 'Use "Ainda não temos o registro" SOMENTE se o contexto estiver 100% vazio. '
      + 'NUNCA invente motivações, datas ou narrativas históricas. '
      + 'Sugira ao final que o usuário explore o Mapa Interativo.'
    );
  }

  // ── ETAPA 4: VERIFICAR SUFICIÊNCIA DO CONTEXTO ─────────────
  const confianca = contextoParaIA.trim().length > 50 ? '>0.7 (suficiente)' : '<0.7 (insuficiente)';
  onimLog('DECISAO', `Confiança do contexto: ${confianca}. Enviando para o modelo...`);

  // ── ETAPA 5: CHAMAR O MODELO DE LINGUAGEM ──────────────────
  try {
    const systemPromptFinal = `${SYSTEM_PROMPT}\n\nINSTRUÇÃO DINÂMICA DO ROTEADOR ONIM: ${instrucaoEspecial}`;
    // Trunca o contexto para não exceder o limite de tokens do provider (ex: Groq 64k)
    const contextoSeguro = truncateContext(contextoParaIA);
    // Para a rota CONCEITO não há contexto do banco — não injetar texto enganoso de "sem registro"
    const userPrompt = intencao === 'CONCEITO'
      ? `PERGUNTA DO USUÁRIO: ${pergunta}`
      : `CONTEXTO INJETADO PELO SISTEMA:\n${contextoSeguro || 'Nenhum registro encontrado no acervo.'}\n\nPERGUNTA DO USUÁRIO: ${pergunta}`;

    onimLog('FERRAMENTA', `[IA] Chamando provider: ${getProviderLabel()}...`);
    const resposta = await generateText(systemPromptFinal, userPrompt, 0.2);
    onimLog('RESPOSTA', 'Resposta gerada com sucesso.');
    return resposta;

  } catch (err) {
    console.error('[ONIM] Erro ao consultar IA:', err);
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