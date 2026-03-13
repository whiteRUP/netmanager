import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [scanForm, setScanForm] = useState({})
  const [pwForm, setPwForm]     = useState({ current_password:'', new_password:'', confirm:'' })
  const [nameForm, setNameForm] = useState({ app_name:'' })
  const [msgs, setMsgs]         = useState({})
  const [busy, setBusy]         = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const s = await api.settings.get()
      setSettings(s)
      setScanForm({ scan_network: s.scan_network, ping_interval: s.ping_interval,
                    full_scan_interval: s.full_scan_interval })
      setNameForm({ app_name: s.app_name })
    } catch {}
  }

  function msg(key, text, isErr) {
    setMsgs(m => ({ ...m, [key]: { text, err: isErr } }))
    setTimeout(() => setMsgs(m => { const n = { ...m }; delete n[key]; return n }), 3000)
  }

  async function saveScan() {
    setBusy(b => ({ ...b, scan: true }))
    try {
      await api.settings.updateScan({
        scan_network:       scanForm.scan_network,
        ping_interval:      Number(scanForm.ping_interval),
        full_scan_interval: Number(scanForm.full_scan_interval),
      })
      msg('scan', 'Scan settings saved')
    } catch (e) { msg('scan', e.message, true) }
    setBusy(b => ({ ...b, scan: false }))
  }

  async function savePassword() {
    if (pwForm.new_password !== pwForm.confirm)
      return msg('pw', 'Passwords do not match', true)
    setBusy(b => ({ ...b, pw: true }))
    try {
      await api.settings.changePassword({
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      msg('pw', 'Password changed')
      setPwForm({ current_password:'', new_password:'', confirm:'' })
    } catch (e) { msg('pw', e.message, true) }
    setBusy(b => ({ ...b, pw: false }))
  }

  async function saveName() {
    setBusy(b => ({ ...b, name: true }))
    try {
      await api.settings.changeAppName(nameForm)
      msg('name', 'App name updated')
      await load()
    } catch (e) { msg('name', e.message, true) }
    setBusy(b => ({ ...b, name: false }))
  }

  if (!settings) return <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>

  return (
    <div style={{ maxWidth:640 }}>
      <h1 style={{ fontSize:20, fontWeight:700, marginBottom:24 }}>Settings</h1>

      <Card title="Scan settings">
        <Field label="Network range (CIDR)">
          <input value={scanForm.scan_network || ''} style={inp}
                 onChange={e => setScanForm(f => ({ ...f, scan_network: e.target.value }))} />
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Ping interval (seconds)">
            <input type="number" value={scanForm.ping_interval || ''} style={inp}
                   onChange={e => setScanForm(f => ({ ...f, ping_interval: e.target.value }))} />
          </Field>
          <Field label="Full scan interval (seconds)">
            <input type="number" value={scanForm.full_scan_interval || ''} style={inp}
                   onChange={e => setScanForm(f => ({ ...f, full_scan_interval: e.target.value }))} />
          </Field>
        </div>
        <Msg msg={msgs.scan} />
        <button style={btn} onClick={saveScan} disabled={busy.scan}>
          {busy.scan ? 'Saving…' : 'Save scan settings'}
        </button>
      </Card>

      <Card title="App name">
        <Field label="Display name">
          <input value={nameForm.app_name || ''} style={inp}
                 onChange={e => setNameForm({ app_name: e.target.value })} />
        </Field>
        <Msg msg={msgs.name} />
        <button style={btn} onClick={saveName} disabled={busy.name}>
          {busy.name ? 'Saving…' : 'Save'}
        </button>
      </Card>

      <Card title="Change password">
        <Field label="Current password">
          <input type="password" value={pwForm.current_password} style={inp}
                 onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} />
        </Field>
        <Field label="New password">
          <input type="password" value={pwForm.new_password} style={inp}
                 onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" value={pwForm.confirm} style={inp}
                 onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
        </Field>
        <Msg msg={msgs.pw} />
        <button style={btn} onClick={savePassword} disabled={busy.pw}>
          {busy.pw ? 'Saving…' : 'Change password'}
        </button>
      </Card>

      <Card title="About">
        <div style={{ fontSize:13, color:'#94a3b8', lineHeight:1.8 }}>
          <div>Admin user: <strong style={{ color:'#f1f5f9' }}>{settings.admin_username}</strong></div>
          <div>Backend port: <strong style={{ color:'#f1f5f9' }}>{settings.backend_port}</strong></div>
          <div>API docs: <a href="/api/docs" target="_blank"
                            style={{ color:'#38bdf8' }}>/api/docs</a></div>
        </div>
      </Card>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:24, marginBottom:16 }}>
      <div style={{ fontWeight:600, marginBottom:16, fontSize:15 }}>{title}</div>
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{label}</div>
      {children}
    </div>
  )
}

function Msg({ msg }) {
  if (!msg) return null
  return (
    <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:13,
                  background: msg.err ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                  color: msg.err ? '#ef4444' : '#22c55e',
                  border: `1px solid ${msg.err ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}` }}>
      {msg.text}
    </div>
  )
}

const inp = { width:'100%', padding:'8px 12px', background:'#0f172a',
              border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
              color:'#f1f5f9', fontSize:13 }
const btn = { padding:'8px 20px', background:'#38bdf8', color:'#0f172a',
              border:'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer' }
