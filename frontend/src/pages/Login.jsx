import { useState } from 'react'
import { api } from '../api.js'

export default function Login({ appName, onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!username || !password) return setError('Enter username and password')
    setError(''); setLoading(true)
    try {
      const data = await api.auth.login(username, password)
      localStorage.setItem('nm_token', data.access_token)
      onLogin()
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 20,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '32px 32px 24px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(59,130,246,.1) 0%, transparent 60%)',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{appName}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Sign in to continue</div>
        </div>

        <form onSubmit={submit} style={{ padding: '28px 32px' }}>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          )}

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input
              className="input" value={username} autoFocus
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="field" style={{ marginBottom: 22 }}>
            <label>Password</label>
            <input
              className="input" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
