import { useState } from 'react'
import { api } from '../api.js'

const S = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center',
          justifyContent:'center', padding:24 },
  card: { background:'#1e293b', border:'1px solid rgba(148,163,184,0.15)',
          borderRadius:16, padding:40, width:'100%', maxWidth:400 },
  logo: { textAlign:'center', marginBottom:32 },
  icon: { fontSize:40, display:'block', marginBottom:12 },
  title: { fontSize:22, fontWeight:700 },
  sub:   { color:'#94a3b8', fontSize:13, marginTop:4 },
  label: { fontSize:12, color:'#94a3b8', marginBottom:6 },
  input: { width:'100%', marginBottom:16, padding:'10px 14px',
           background:'#0f172a', border:'1px solid rgba(148,163,184,0.2)',
           borderRadius:8, color:'#f1f5f9', fontSize:14 },
  btn:   { width:'100%', padding:'11px 0', background:'#38bdf8',
           color:'#0f172a', border:'none', borderRadius:8,
           fontWeight:700, fontSize:15, cursor:'pointer' },
  err:   { background:'rgba(239,68,68,0.12)', color:'#ef4444',
           border:'1px solid rgba(239,68,68,0.2)', borderRadius:8,
           padding:'10px 14px', fontSize:13, marginBottom:16 },
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr]           = useState('')
  const [loading, setLoading]   = useState(false)

  async function submit() {
    setErr('')
    setLoading(true)
    try {
      const data = await api.auth.login(username, password)
      localStorage.setItem('nm_token', data.access_token)
      onLogin()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>
          <span style={S.icon}>🌐</span>
          <div style={S.title}>NetManager</div>
          <div style={S.sub}>Sign in to continue</div>
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={S.label}>Username</div>
        <input style={S.input} value={username} autoFocus
               onChange={e => setUsername(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && submit()} />

        <div style={S.label}>Password</div>
        <input style={S.input} type="password" value={password}
               onChange={e => setPassword(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && submit()} />

        <button style={S.btn} onClick={submit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
