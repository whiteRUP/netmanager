import { useState } from 'react'
import { api } from '../api.js'

const S = {
  wrap: { minHeight:'100vh', display:'flex', alignItems:'center',
          justifyContent:'center', padding:24 },
  card: { background:'#1e293b', border:'1px solid rgba(148,163,184,0.15)',
          borderRadius:16, padding:40, width:'100%', maxWidth:480 },
  logo: { display:'flex', alignItems:'center', gap:12, marginBottom:32 },
  logoIcon: { width:44, height:44, background:'#0f172a', borderRadius:12,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:22 },
  title: { fontSize:22, fontWeight:700 },
  sub:   { color:'#94a3b8', fontSize:13, marginTop:2 },
  step:  { display:'flex', gap:8, marginBottom:32 },
  dot:   (a) => ({ width:8, height:8, borderRadius:'50%', marginTop:6,
                   background: a ? '#38bdf8' : '#334155', transition:'.2s' }),
  label: { fontSize:12, color:'#94a3b8', marginBottom:6 },
  input: { width:'100%', marginBottom:16, padding:'10px 14px',
           background:'#0f172a', border:'1px solid rgba(148,163,184,0.2)',
           borderRadius:8, color:'#f1f5f9', fontSize:14 },
  btn:   { width:'100%', padding:'11px 0', background:'#38bdf8',
           color:'#0f172a', border:'none', borderRadius:8,
           fontWeight:700, fontSize:15, cursor:'pointer', marginTop:8 },
  err:   { background:'rgba(239,68,68,0.12)', color:'#ef4444',
           border:'1px solid rgba(239,68,68,0.2)', borderRadius:8,
           padding:'10px 14px', fontSize:13, marginBottom:16 },
  sectionTitle: { fontSize:13, fontWeight:600, color:'#94a3b8',
                  textTransform:'uppercase', letterSpacing:'.06em',
                  marginBottom:16, marginTop:8 },
  row: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
}

const STEPS = ['Account', 'Network', 'Done']

export default function SetupWizard({ onComplete }) {
  const [step, setStep]     = useState(0)
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm]     = useState({
    username: '', password: '', confirm: '',
    app_name: 'NetManager',
    scan_network: '192.168.1.0/24',
    ping_interval: 60,
    full_scan_interval: 900,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit() {
    setErr('')
    if (step === 0) {
      if (form.username.length < 3) return setErr('Username must be at least 3 characters')
      if (form.password.length < 6) return setErr('Password must be at least 6 characters')
      if (form.password !== form.confirm) return setErr('Passwords do not match')
      setStep(1)
      return
    }
    if (step === 1) {
      setLoading(true)
      try {
        await api.setup.init({
          username:           form.username,
          password:           form.password,
          app_name:           form.app_name,
          scan_network:       form.scan_network,
          ping_interval:      Number(form.ping_interval),
          full_scan_interval: Number(form.full_scan_interval),
        })
        setStep(2)
      } catch (e) {
        setErr(e.message)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🌐</div>
          <div>
            <div style={S.title}>NetManager</div>
            <div style={S.sub}>Initial setup</div>
          </div>
        </div>

        <div style={S.step}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={S.dot(i <= step)} />
              <span style={{ fontSize:12, color: i <= step ? '#38bdf8' : '#64748b' }}>{s}</span>
              {i < STEPS.length - 1 && <div style={{ flex:1, height:1, background:'#334155', minWidth:20 }} />}
            </div>
          ))}
        </div>

        {err && <div style={S.err}>{err}</div>}

        {step === 0 && (
          <>
            <div style={S.sectionTitle}>Create admin account</div>
            <div style={S.label}>Username</div>
            <input style={S.input} value={form.username}
                   onChange={e => set('username', e.target.value)}
                   placeholder="admin" autoFocus />
            <div style={S.label}>Password</div>
            <input style={S.input} type="password" value={form.password}
                   onChange={e => set('password', e.target.value)}
                   placeholder="At least 6 characters" />
            <div style={S.label}>Confirm password</div>
            <input style={S.input} type="password" value={form.confirm}
                   onChange={e => set('confirm', e.target.value)}
                   placeholder="Repeat password"
                   onKeyDown={e => e.key === 'Enter' && submit()} />
            <button style={S.btn} onClick={submit}>Continue →</button>
          </>
        )}

        {step === 1 && (
          <>
            <div style={S.sectionTitle}>App & network settings</div>
            <div style={S.label}>App name</div>
            <input style={S.input} value={form.app_name}
                   onChange={e => set('app_name', e.target.value)} />
            <div style={S.label}>Network range (CIDR)</div>
            <input style={S.input} value={form.scan_network}
                   onChange={e => set('scan_network', e.target.value)}
                   placeholder="192.168.1.0/24" />
            <div style={S.row}>
              <div>
                <div style={S.label}>Ping interval (sec)</div>
                <input style={{ ...S.input, marginBottom:0 }} type="number"
                       value={form.ping_interval}
                       onChange={e => set('ping_interval', e.target.value)} />
              </div>
              <div>
                <div style={S.label}>Full scan (sec)</div>
                <input style={{ ...S.input, marginBottom:0 }} type="number"
                       value={form.full_scan_interval}
                       onChange={e => set('full_scan_interval', e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <button style={{ ...S.btn, background:'#334155', color:'#f1f5f9',
                               flex:'0 0 auto', width:'auto', padding:'11px 20px' }}
                      onClick={() => setStep(0)}>← Back</button>
              <button style={{ ...S.btn, flex:1, marginTop:0 }}
                      onClick={submit} disabled={loading}>
                {loading ? 'Setting up…' : 'Complete setup'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Setup complete!</div>
            <div style={{ color:'#94a3b8', marginBottom:28, fontSize:14 }}>
              Your NetManager instance is ready. Log in to get started.
            </div>
            <button style={S.btn} onClick={onComplete}>Go to login →</button>
          </div>
        )}
      </div>
    </div>
  )
}
