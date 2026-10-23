import { useCallback, useEffect, useState } from 'react'
import { fetchConfigIa, salvarConfigIa, testarConfigIa } from '../adminApi.js'

const cardStyle = {
  background: 'var(--admin-surface)',
  border: '1px solid var(--admin-border)',
  borderRadius: 8,
  padding: '1.25rem',
  marginBottom: '1rem',
}

const vazio = {
  provider: 'gemini',
  geminiKey: '',
  removerGemini: false,
  geminiModel: '',
  openaiKey: '',
  removerOpenai: false,
  openaiBaseUrl: '',
  openaiModel: '',
  origens: '',
}

/** Chave digitada substitui; "remover" apaga; campo vazio mantém a atual (null para o RPC). */
function valorChave(digitada, remover) {
  if (remover) return ''
  return digitada.trim() ? digitada.trim() : null
}

function StatusChave({ final }) {
  return final ? (
    <span className="badge bg-success ms-2">configurada · termina em {final}</span>
  ) : (
    <span className="badge bg-secondary ms-2">não configurada</span>
  )
}

export function IaTab({ showToast }) {
  const [form, setForm] = useState(vazio)
  const [atual, setAtual] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [teste, setTeste] = useState(null)

  const set = (campo) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [campo]: value }))
  }

  const carregar = useCallback(async () => {
    setErro('')
    try {
      const cfg = await fetchConfigIa()
      setAtual(cfg)
      setForm({
        ...vazio,
        provider: cfg?.provider || 'gemini',
        geminiModel: cfg?.gemini_model || '',
        openaiBaseUrl: cfg?.openai_base_url || '',
        openaiModel: cfg?.openai_model || '',
        origens: cfg?.origens_permitidas || '',
      })
    } catch (err) {
      setErro(
        err?.code === '42501'
          ? 'Apenas administradores podem ver e alterar a configuração de IA.'
          : `Não foi possível carregar a configuração (a migration 10 foi aplicada?): ${err.message}`,
      )
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await salvarConfigIa({
        provider: form.provider,
        geminiKey: valorChave(form.geminiKey, form.removerGemini),
        geminiModel: form.geminiModel,
        openaiKey: valorChave(form.openaiKey, form.removerOpenai),
        openaiBaseUrl: form.openaiBaseUrl,
        openaiModel: form.openaiModel,
        origens: form.origens,
      })
      showToast('Configuração de IA salva. Pode levar até 1 minuto para valer no chatbot.')
      setTeste(null)
      await carregar()
    } catch (err) {
      showToast(`Erro ao salvar: ${err.message}`, 'danger')
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    setTestando(true)
    setTeste(null)
    try {
      setTeste(await testarConfigIa())
    } catch (err) {
      setTeste({ ok: false, detalhe: err.message, resultados: [] })
    } finally {
      setTestando(false)
    }
  }

  if (erro) {
    return (
      <div className="tab-content active">
        <h2 className="page-title">Inteligência Artificial</h2>
        <p className="text-muted">{erro}</p>
      </div>
    )
  }

  return (
    <div className="tab-content active">
      <h2 className="page-title">Inteligência Artificial</h2>
      <p className="text-muted" style={{ maxWidth: 760 }}>
        Chaves usadas pelo chatbot ONIM. Ficam guardadas no banco, fora do site: nenhum visitante tem acesso,
        e este painel mostra só os 4 últimos caracteres. Deixe o campo de chave em branco para manter a atual.
        {atual?.updated_at && (
          <> Última alteração: {new Date(atual.updated_at).toLocaleString('pt-BR')}.</>
        )}
      </p>

      <form onSubmit={salvar} style={{ maxWidth: 760 }}>
        <div style={cardStyle}>
          <label className="form-label fw-semibold" htmlFor="ia_provider">Provedor principal</label>
          <select id="ia_provider" className="form-select" value={form.provider} onChange={set('provider')}>
            <option value="gemini">Google Gemini</option>
            <option value="openai">OpenAI-compatível (Groq, OpenRouter, OpenAI…)</option>
          </select>
          <div className="form-text">O outro provedor, se tiver chave, é usado automaticamente quando a cota do principal acaba.</div>
        </div>

        <div style={cardStyle}>
          <h3 className="h6 mb-3">
            Google Gemini <StatusChave final={atual?.gemini_key_final} />
          </h3>
          <div className="mb-3">
            <label className="form-label" htmlFor="ia_gemini_key">Nova chave</label>
            <input
              id="ia_gemini_key"
              type="password"
              className="form-control"
              autoComplete="off"
              placeholder={atual?.gemini_key_final ? '•••• (em branco = manter a atual)' : 'Cole a chave aqui'}
              value={form.geminiKey}
              disabled={form.removerGemini}
              onChange={set('geminiKey')}
            />
            <div className="form-text">
              Crie em{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/app/apikey</a>.
              Não aplique restrição de &quot;HTTP referrer&quot;: a chave é usada pelo servidor, não pelo navegador.
              Também é usada na busca semântica de ruas.
            </div>
            {atual?.gemini_key_final && (
              <div className="form-check mt-2">
                <input id="ia_gemini_rm" type="checkbox" className="form-check-input" checked={form.removerGemini} onChange={set('removerGemini')} />
                <label className="form-check-label" htmlFor="ia_gemini_rm">Remover a chave atual</label>
              </div>
            )}
          </div>
          <label className="form-label" htmlFor="ia_gemini_model">Modelo</label>
          <input id="ia_gemini_model" className="form-control" placeholder="gemini-flash-latest" value={form.geminiModel} onChange={set('geminiModel')} />
          <div className="form-text">Em branco usa <code>gemini-flash-latest</code>, que acompanha o modelo Flash mais recente.</div>
        </div>

        <div style={cardStyle}>
          <h3 className="h6 mb-3">
            OpenAI-compatível <span className="text-muted fw-normal">(opcional)</span>
            <StatusChave final={atual?.openai_key_final} />
          </h3>
          <div className="mb-3">
            <label className="form-label" htmlFor="ia_openai_key">Nova chave</label>
            <input
              id="ia_openai_key"
              type="password"
              className="form-control"
              autoComplete="off"
              placeholder={atual?.openai_key_final ? '•••• (em branco = manter a atual)' : 'Cole a chave aqui'}
              value={form.openaiKey}
              disabled={form.removerOpenai}
              onChange={set('openaiKey')}
            />
            {atual?.openai_key_final && (
              <div className="form-check mt-2">
                <input id="ia_openai_rm" type="checkbox" className="form-check-input" checked={form.removerOpenai} onChange={set('removerOpenai')} />
                <label className="form-check-label" htmlFor="ia_openai_rm">Remover a chave atual</label>
              </div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="ia_openai_url">URL base</label>
            <input id="ia_openai_url" className="form-control" placeholder="https://api.groq.com/openai/v1" value={form.openaiBaseUrl} onChange={set('openaiBaseUrl')} />
            <div className="form-text">
              Groq: <code>https://api.groq.com/openai/v1</code> · OpenRouter: <code>https://openrouter.ai/api/v1</code> · OpenAI: em branco
            </div>
          </div>
          <label className="form-label" htmlFor="ia_openai_model">Modelo</label>
          <input id="ia_openai_model" className="form-control" placeholder="gpt-4o-mini" value={form.openaiModel} onChange={set('openaiModel')} />
        </div>

        <div style={cardStyle}>
          <label className="form-label fw-semibold" htmlFor="ia_origens">Endereços do site autorizados</label>
          <textarea
            id="ia_origens"
            className="form-control"
            rows={3}
            placeholder={'https://lusilva710.github.io\nhttp://localhost:5173'}
            value={form.origens}
            onChange={set('origens')}
          />
          <div className="form-text">
            Um por linha, sem barra no final. Só esses endereços podem usar o chatbot. Se o site mudar de endereço
            (ex.: novo repositório), acrescente o novo aqui. Em branco = qualquer endereço.
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap mb-3">
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={testando} onClick={testar}>
            <i className="bi bi-plug me-1" aria-hidden="true" />
            {testando ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>
      </form>

      {teste && (
        <div style={{ ...cardStyle, maxWidth: 760 }} aria-live="polite">
          <h3 className="h6">{teste.ok ? '✅ Conexão funcionando' : '❌ Falha na conexão'}</h3>
          {teste.detalhe && <p className="mb-2">{teste.detalhe}</p>}
          <ul className="mb-0">
            {(teste.resultados || []).map((r) => (
              <li key={r.provider}>
                <strong>{r.provider}</strong> ({r.model}): {r.ok ? 'ok' : <span className="text-danger">{r.erro}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
