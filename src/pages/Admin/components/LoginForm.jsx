import { useState } from 'react'
import { supabase } from '@lib/supabase.js'

export function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(`Erro: ${err.message}`)
      return
    }
    onSuccess(data.user)
  }

  return (
    <div className="login-container" style={{ display: 'flex' }}>
      <div className="login-card">
        <div className="login-header">
          <i className="bi bi-shield-lock-fill" aria-hidden="true" />
          <h2>Painel Administrativo</h2>
          <p>Toponímia Urbana de Ouro Branco</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Senha</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            <span className="btn-text">{loading ? 'Entrando...' : 'Entrar'}</span>
            {loading && <span className="spinner-border spinner-border-sm ms-2" role="status" />}
          </button>
          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </form>
      </div>
    </div>
  )
}
