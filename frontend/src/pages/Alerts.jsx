import { useState, useEffect } from 'react'
import { api } from '../api.js'

const LEVEL_COLOR = { critical:'#ef4444', warning:'#f59e0b', info:'#38bdf8' }
const LEVEL_BG    = { critical:'rgba(239,68,68,0.08)', warning:'rgba(245,158,11,0.08)', info:'rgba(56,189,248,0.08)' }
const LEVEL_ICON  = { critical:'🔴', warning:'🟡', info:'🔵' }

export default function Alerts() {
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)

  useEffect(() => { load() }, [unreadOnly])

  async function load() {
    setLoading(true)
    try { setAlerts(await api.devices.alerts(unreadOnly)) }
    catch {} finally { setLoading(false) }
  }

  async function markRead(id) {
    await api.devices.markRead(id)
    setAlerts(a => a.map(x => x.id === id ? { ...x, read: true } : x))
  }

  async function markAll() {
    await api.devices.markAllRead()
    setAlerts(a => a.map(x => ({ ...x, read: true })))
  }

  const unread = alerts.filter(a => !a.read).length

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Alerts</h1>
          {unread > 0 && (
            <span style={{ background:'#ef4444', color:'#fff', borderRadius:12,
                           padding:'2px 8px', fontSize:12, fontWeight:700 }}>{unread} unread</span>
          )}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#94a3b8', cursor:'pointer' }}>
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          {unread > 0 && (
            <button onClick={markAll}
              style={{ padding:'6px 14px', background:'transparent',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                       color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{ color:'#64748b', textAlign:'center', padding:40 }}>Loading…</div>}

      {!loading && alerts.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔔</div>
          <div style={{ fontSize:16, color:'#94a3b8' }}>No alerts</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {alerts.map(a => (
          <div key={a.id} onClick={() => !a.read && markRead(a.id)}
            style={{ padding:'14px 18px', borderRadius:10,
                     background: a.read ? '#1e293b' : LEVEL_BG[a.level],
                     border: `1px solid ${a.read ? 'rgba(148,163,184,0.1)' : LEVEL_COLOR[a.level] + '30'}`,
                     display:'flex', gap:14, alignItems:'flex-start',
                     cursor: a.read ? 'default' : 'pointer', transition:'.15s',
                     opacity: a.read ? 0.6 : 1 }}>
            <span style={{ fontSize:18, flexShrink:0, marginTop:1 }}>{LEVEL_ICON[a.level]}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight: a.read ? 400 : 600, fontSize:14, marginBottom:3 }}>{a.title}</div>
              <div style={{ fontSize:13, color:'#94a3b8' }}>{a.message}</div>
            </div>
            <div style={{ fontSize:12, color:'#64748b', flexShrink:0, textAlign:'right' }}>
              <div>{new Date(a.created_at).toLocaleDateString()}</div>
              <div>{new Date(a.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
