import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Settings() {
  const [settings, setSettings] = useState(null)
  const [scan,     setScan]     = useState({ scan_network: '', ping_interval: 60, full_scan_interval: 900 })
  const [appName,  setAppName]  = useState('')
  const [pwd,      setPwd]      = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving,   setSaving]   = useState({})
  const [msg,      setMsg]      = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const s = await api.settings.get()
      setSettings(s)
      setScan({
        scan_network:       s.scan_network       || '192.168.1.0/24',
        ping_interval:      s.ping_interval      || 60,
        full_scan_interval: s.full_scan_interval || 900,
      })
      setAppName(s.app_name || 'NetManager')
    } catch {}
  }

  async function saveScan() {
    setSaving(s => ({ ...s, scan: true })); setMsg(m => ({ ...m, scan: '' }))
    try {
      await api.settings.updateScan(scan)
      setMsg(m => ({ ...m, scan: '✓ Saved' }))
      setTimeout(() => setMsg(m => ({ ...m, scan: '' })), 3000)
    } catch (e) {
      setMsg(m => ({ ...m, scan: `✕ ${e.message}` }))
    } finally { setSaving(s => ({ ...s, scan: false })) }
  }

  async function saveAppName() {
    setSaving(s => ({ ...s, name: true })); setMsg(m => ({ ...m, name: '' }))
    try {
      await api.settings.changeAppName({ app_name: appName })
      setMsg(m => ({ ...m, name: '✓ Saved — reload to see in sidebar' }))
      setTimeout(() => setMsg(m => ({ ...m, name: '' })), 4000)
    } catch (e) {
      setMsg(m => ({ ...m, name: `✕ ${e.message}` }))
    } finally { setSaving(s => ({ ...s, name: false })) }
  }

  async function savePassword() {
    if (pwd.new_password !== pwd.confirm) {
      return setMsg(m => ({ ...m, pwd: '✕ Passwords do not match' }))
    }
    if (pwd.new_password.length < 6) {
      return setMsg(m => ({ ...m, pwd: '✕ Password must be at least 6 characters' }))
    }
    setSaving(s => ({ ...s, pwd: true })); setMsg(m => ({ ...m, pwd: '' }))
    try {
      await api.settings.changePassword({
        current_password: pwd.current_password,
        new_password:     pwd.new_password,
      })
      setPwd({ current_password: '', new_password: '', confirm: '' })
      setMsg(m => ({ ...m, pwd: '✓ Password changed' }))
      setTimeout(() => setMsg(m => ({ ...m, pwd: '' })), 3000)
    } catch (e) {
      setMsg(m => ({ ...m, pwd: `✕ ${e.message}` }))
    } finally { setSaving(s => ({ ...s, pwd: false })) }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 28 }}>Settings</h1>

      {/* App name */}
      <Section title="App name" subtitle="Shown in the sidebar and browser tab.">
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Display name</label>
          <input className="input" value={appName} onChange={e => setAppName(e.target.value)} />
        </div>
        <Row>
          <button onClick={saveAppName} disabled={saving.name} className="btn btn-primary btn-sm">
            {saving.name ? 'Saving…' : 'Save name'}
          </button>
          {msg.name && <FeedbackMsg text={msg.name} />}
        </Row>
      </Section>

      {/* Scan settings */}
      <Section title="Scan settings" subtitle="Configure network range and scan frequency.">
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Network range</label>
          <input className="input" value={scan.scan_network}
            onChange={e => setScan(s => ({ ...s, scan_network: e.target.value }))}
            placeholder="192.168.1.0/24 or 192.168.1.0/24, 10.0.0.0/24" />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
            Comma-separate multiple CIDRs for multiple VLANs.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div className="field">
            <label>Ping interval (seconds)</label>
            <input className="input" type="number" min={10} max={3600}
              value={scan.ping_interval}
              onChange={e => setScan(s => ({ ...s, ping_interval: +e.target.value }))} />
          </div>
          <div className="field">
            <label>Full scan interval (seconds)</label>
            <input className="input" type="number" min={60} max={86400}
              value={scan.full_scan_interval}
              onChange={e => setScan(s => ({ ...s, full_scan_interval: +e.target.value }))} />
          </div>
        </div>
        <div style={{
          background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.15)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--accent2)' }}>💡</strong>{' '}
          Ping scan only checks online/offline. Full scan discovers new devices and updates ports — it's heavier on the network.
          Suggested: ping every 60s, full scan every 900s (15 min).
        </div>
        <Row>
          <button onClick={saveScan} disabled={saving.scan} className="btn btn-primary btn-sm">
            {saving.scan ? 'Saving…' : 'Save scan settings'}
          </button>
          {msg.scan && <FeedbackMsg text={msg.scan} />}
        </Row>
      </Section>

      {/* Password */}
      <Section title="Change password" subtitle="Minimum 6 characters.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          <div className="field">
            <label>Current password</label>
            <input className="input" type="password" value={pwd.current_password}
              onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))} />
          </div>
          <div className="field">
            <label>New password</label>
            <input className="input" type="password" value={pwd.new_password}
              onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input className="input" type="password" value={pwd.confirm}
              onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} />
          </div>
        </div>
        <Row>
          <button onClick={savePassword} disabled={saving.pwd} className="btn btn-primary btn-sm">
            {saving.pwd ? 'Changing…' : 'Change password'}
          </button>
          {msg.pwd && <FeedbackMsg text={msg.pwd} />}
        </Row>
      </Section>

      {/* Info */}
      <Section title="About" subtitle="">
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
          <div>NetManager v2.0 — self-hosted LAN device manager</div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)' }}>
            Data stored in SQLite · Config in integrations.json · Logs via Docker
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function Row({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{children}</div>
}

function FeedbackMsg({ text }) {
  const ok = text.startsWith('✓')
  return (
    <span style={{ fontSize: 12, color: ok ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>
      {text}
    </span>
  )
}
