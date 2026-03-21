import { useState } from 'react'
import { api } from '../api.js'

const STEPS = ['Account', 'Network', 'Finish']

export default function SetupWizard({ onComplete }) {
  const [step,    setStep]    = useState(0)
  const [form,    setForm]    = useState({
    username: '', password: '', confirm: '',
    app_name: 'NetManager', scan_network: '192.168.1.0/24',
  })
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    setError(''); setLoading(true)
    try {
      await api.setup.init({
        username:     form.username,
        password:     form.password,
        app_name:     form.app_name,
        scan_network: form.scan_network,
      })
      onComplete(form.app_name)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  function next() {
    if (step === 0) {
      if (!form.username.trim()) return setError('Username is required')
      if (form.password.length < 6) return setError('Password must be at least 6 characters')
      if (form.password !== form.confirm) return setError('Passwords do not match')
    }
    if (step === 1) {
      if (!form.scan_network.trim()) return setError('Network range is required')
    }
    setError('')
    if (step < 2) setStep(s => s + 1)
    else submit()
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 20,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 24px',
          background: 'linear-gradient(135deg, rgba(59,130,246,.12) 0%, transparent 60%)',
          borderBottom: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌐</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>NetManager</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Initial setup — takes 30 seconds</div>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              fontSize: 12, fontWeight: 600,
              color: i === step ? 'var(--accent2)' : i < step ? 'var(--green)' : 'var(--text3)',
              borderBottom: i === step ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'var(--transition)',
            }}>
              {i < step ? '✓ ' : `${i + 1}. `}{label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px' }}>
          {error && (
            <div className="error-banner" style={{ marginBottom: 20 }}>
              <span>{error}</span>
              <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>App name</label>
                <input className="input" value={form.app_name}
                  onChange={e => set('app_name', e.target.value)}
                  placeholder="NetManager" />
              </div>
              <div className="field">
                <label>Username</label>
                <input className="input" value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="admin" autoFocus />
              </div>
              <div className="field">
                <label>Password</label>
                <input className="input" type="password" value={form.password}
                  onChange={e => set('password', e.target.value)} />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <input className="input" type="password" value={form.confirm}
                  onChange={e => set('confirm', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && next()} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="field">
                <label>Network range to scan</label>
                <input className="input" value={form.scan_network}
                  onChange={e => set('scan_network', e.target.value)}
                  placeholder="192.168.1.0/24"
                  autoFocus />
              </div>
              <div style={{
                background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.2)',
                borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--text2)',
                lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--accent2)' }}>💡 Tips</strong><br />
                • Single network: <code style={{ color: 'var(--accent2)' }}>192.168.1.0/24</code><br />
                • Multiple VLANs: <code style={{ color: 'var(--accent2)' }}>192.168.1.0/24, 10.0.0.0/24</code><br />
                • Requires <code style={{ color: 'var(--accent2)' }}>network_mode: host</code> in Docker
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ready to launch</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 8 }}>
                <strong style={{ color: 'var(--text)' }}>{form.app_name}</strong> will be configured with:<br />
                User: <code style={{ color: 'var(--accent2)' }}>{form.username}</code><br />
                Network: <code style={{ color: 'var(--accent2)' }}>{form.scan_network}</code>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            {step > 0 && (
              <button
                onClick={() => { setError(''); setStep(s => s - 1) }}
                className="btn btn-ghost"
              >
                ← Back
              </button>
            )}
            <button
              onClick={next}
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {loading ? 'Setting up…' : step < 2 ? 'Next →' : '✓ Complete setup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
