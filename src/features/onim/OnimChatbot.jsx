import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SUGESTOES,
  bootOnimConfig,
  consultarAgente,
  detectarAmbiguidade,
  enviarContribuicao,
  horaAtual,
  loadHistorico,
  onimLog,
  saveHistorico,
} from './onimService.js'

function BotHtml({ html }) {
  return <div className="chat-text" dangerouslySetInnerHTML={{ __html: html }} />
}

export function OnimChatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => loadHistorico())
  const [typing, setTyping] = useState(false)
  const [showWelcome, setShowWelcome] = useState(() => loadHistorico().length === 0)
  const [pendingQuery, setPendingQuery] = useState(null)
  const [contribOffer, setContribOffer] = useState(null)
  const [contribOpen, setContribOpen] = useState(false)
  const [contribText, setContribText] = useState('')
  const [contribDone, setContribDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const messagesRef = useRef(null)
  const inputRef = useRef(null)
  const historyRef = useRef(messages)

  useEffect(() => {
    historyRef.current = messages
  }, [messages])

  useEffect(() => {
    bootOnimConfig()
    const onFallback = () => {
      const geminiModel = import.meta.env.VITE_GEMINI_MODEL ?? 'gemini'
      onimLog(
        'AVISO',
        `Limite do provedor principal atingido — o agente está usando Gemini (${geminiModel}).`,
      )
    }
    window.addEventListener('onim-langchain-gemini-fallback', onFallback)
    return () => window.removeEventListener('onim-langchain-gemini-fallback', onFallback)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('chatbot-open', open)
    return () => document.body.classList.remove('chatbot-open')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, contribOffer, contribOpen, contribDone, showWelcome])

  const pushMessage = useCallback((role, text) => {
    const entry = { role, text, time: horaAtual() }
    setMessages((prev) => {
      const next = [...prev, entry]
      historyRef.current = next
      saveHistorico(next)
      return next
    })
    setShowWelcome(false)
  }, [])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        setTimeout(() => inputRef.current?.focus(), 300)
        if (historyRef.current.length === 0) setShowWelcome(true)
      } else {
        setTimeout(() => document.getElementById('newChatbotButton')?.focus(), 0)
      }
      return next
    })
  }, [])

  const irParaInicio = useCallback(() => {
    setPendingQuery(null)
    setContribOffer(null)
    setContribOpen(false)
    setContribText('')
    setContribDone(false)
    setShowWelcome(true)
  }, [])

  const enviarMensagem = useCallback(
    async (textoManual = null, respostaPronta = null) => {
      const texto = (textoManual ?? input).trim()
      if (!texto || busy) return

      setInput('')
      setBusy(true)
      setContribOffer(null)
      setContribOpen(false)
      setContribDone(false)
      pushMessage('user', texto)
      setTyping(true)

      try {
        let resposta
        if (respostaPronta) {
          await new Promise((r) => setTimeout(r, 600))
          resposta = respostaPronta
        } else if (pendingQuery) {
          const queryOriginal = pendingQuery
          setPendingQuery(null)
          onimLog('DECISAO', 'Esclarecimento recebido. Consultando Agente LangChain...')
          resposta = await consultarAgente(
            `${queryOriginal} do bairro ${texto}`,
            historyRef.current,
          )
        } else {
          const ambigua = await detectarAmbiguidade(texto)
          if (ambigua) {
            setPendingQuery(ambigua.pendingName)
            resposta = ambigua.html
          } else {
            resposta = await consultarAgente(texto, historyRef.current)
          }
        }

        setTyping(false)
        pushMessage('bot', resposta)

        const textoMin = texto.toLowerCase()
        const isEstatistica =
          textoMin.includes('quant') ||
          textoMin.includes('mais') ||
          textoMin.includes('menos') ||
          textoMin.includes('qual bairro')
        if (
          !respostaPronta &&
          (textoMin.includes('rua') || textoMin.includes('quem foi')) &&
          !isEstatistica
        ) {
          setContribOffer(texto)
        }
      } catch (err) {
        setTyping(false)
        pushMessage('bot', 'Ops! Tive um problema técnico. Tente novamente em instantes.')
        console.error(err)
      } finally {
        setBusy(false)
      }
    },
    [input, busy, pendingQuery, pushMessage],
  )

  async function submitContrib() {
    const text = contribText.trim()
    if (!text || !contribOffer) return
    try {
      await enviarContribuicao(contribOffer, text)
      setContribDone(true)
      setContribOpen(false)
      setTimeout(() => {
        setContribOffer(null)
        setContribText('')
        setContribDone(false)
      }, 2000)
    } catch {
      alert('Erro ao enviar.')
    }
  }

  const showingChat = !showWelcome

  return (
    <div id="newChatbotContainer">
      <button
        id="newChatbotButton"
        type="button"
        className={open ? 'active' : ''}
        aria-label={open ? 'Fechar assistente virtual' : 'Abrir assistente virtual'}
        aria-expanded={open}
        aria-controls="newChatbotWindow"
        onClick={toggle}
      >
        <i className="bi bi-chat-dots-fill" aria-hidden="true" />
      </button>

      <div
        id="newChatbotWindow"
        className={open ? 'chatbot-visible' : 'chatbot-hidden'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-title"
        aria-hidden={!open}
      >
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-avatar-status">
              <i className="bi bi-robot" aria-hidden="true" />
              <span className="status-indicator" aria-hidden="true" />
            </div>
            <div>
              <h3 id="chatbot-title">Assistente Virtual</h3>
              <span>Online • Ouro Branco</span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              id="backToHome"
              aria-label="Voltar ao início da conversa"
              onClick={irParaInicio}
            >
              <i className="bi bi-house-door" aria-hidden="true" />
            </button>
            <button
              type="button"
              id="closeChat"
              aria-label="Fechar assistente virtual"
              onClick={toggle}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div id="newChatbotMessages" ref={messagesRef} aria-live="polite" aria-relevant="additions">
          {!showingChat ? (
            <div className="welcome-screen">
              <div className="onim-badge">
                <i className="bi bi-cpu-fill" aria-hidden="true" />
                <span>ONIM v2.0 · Agente Ativo</span>
              </div>
              <h2>Como posso ajudar?</h2>
              <p>
                Sou o <strong>ONIM</strong>, especialista em Toponímia Urbana de Ouro Branco&#8209;MG.
                <br />
                Pergunte sobre ruas, bairros, história ou estatísticas do acervo.
              </p>
              <div className="quick-actions">
                {SUGESTOES.map((sug) => (
                  <button
                    key={sug.text}
                    type="button"
                    className="quick-action-btn"
                    disabled={busy}
                    onClick={() => enviarMensagem(sug.text, sug.response)}
                  >
                    <i className={`bi ${sug.icon}`} aria-hidden="true" />
                    <span>{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}-${msg.time}`}
                  className={`chat-msg ${msg.role}`}
                  role={msg.role === 'bot' ? 'article' : undefined}
                >
                  {msg.role === 'bot' && (
                    <div className="chat-avatar">
                      <i className="bi bi-robot" aria-hidden="true" />
                    </div>
                  )}
                  <div className="chat-bubble">
                    {msg.role === 'bot' ? (
                      <BotHtml html={msg.text} />
                    ) : (
                      <div className="chat-text">{msg.text}</div>
                    )}
                    <div className="chat-time" aria-hidden="true">
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}

              {typing && (
                <div
                  className="chat-msg bot typing-msg"
                  role="status"
                  aria-live="polite"
                  aria-label="Assistente está digitando"
                >
                  <div className="chat-avatar">
                    <i className="bi bi-robot" aria-hidden="true" />
                  </div>
                  <div className="chat-bubble">
                    <div className="typing-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}

              {contribOffer && !contribOpen && !contribDone && (
                <button
                  type="button"
                  className="contrib-btn"
                  onClick={() => setContribOpen(true)}
                >
                  <i className="bi bi-plus-circle-fill" aria-hidden="true" /> Sabe algo mais?
                  Contribua aqui
                </button>
              )}

              {contribOffer && contribOpen && !contribDone && (
                <div className="contrib-form">
                  <h3>Sua contribuição ({contribOffer})</h3>
                  <textarea
                    id="contribText"
                    placeholder="Conte-nos o que você sabe..."
                    value={contribText}
                    onChange={(e) => setContribText(e.target.value)}
                  />
                  <div className="contrib-actions">
                    <button type="button" className="btn-send" onClick={submitContrib}>
                      <i className="bi bi-check-lg" aria-hidden="true" /> Enviar
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setContribOpen(false)
                        setContribText('')
                        setContribOffer(null)
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {contribDone && (
                <div className="contrib-success">
                  <i className="bi bi-heart-fill" aria-hidden="true" /> Obrigado por ajudar!
                </div>
              )}
            </>
          )}
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              id="newUserInput"
              placeholder="Pergunte sobre uma rua ou bairro..."
              autoComplete="off"
              aria-label="Pergunte sobre uma rua ou bairro"
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enviarMensagem()
              }}
            />
            <button
              type="button"
              id="newSendMessageButton"
              aria-label="Enviar mensagem"
              disabled={busy || !input.trim()}
              onClick={() => enviarMensagem()}
            >
              <i className="bi bi-send-fill" aria-hidden="true" />
            </button>
          </div>
          <p className="chat-footer">Poderia haver erros na IA. Verifique dados oficiais.</p>
        </div>
      </div>
    </div>
  )
}

export default OnimChatbot
