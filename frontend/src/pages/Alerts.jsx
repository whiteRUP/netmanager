import { useState, useEffect } from 'react'
import { api } from '../api.js'

function toUtc(iso) {
  if (!iso) return null
  return (!iso.endsWith('Z') && !iso.includes('+')) ? iso + 'Z' : iso
}
function timeAgo(iso) {
  const t = toUtc(iso)
  if (!t) return ''
  const diff = Date.now() - new Date(t).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const LEVEL_META = {
  critical: { icon: '🔴', color: 'var(--red)',   bg: 'rgba(239,68,68,.08)',   border: 'rgba(239,68,68,.2)' },
  warning:  { icon: '🟡', color: 'var(--amber)', bg: 'rgba(245,158,11,.06)',  border: 'rgba(245,158,11,.18)' },
  info:     { icon: '🔵', color: 'var(--accent2)', bg: 'rgba(59,130,246,.05)', border: 'rgba(59,130,246,.15)' },
}

export default function Alerts() {
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')  // all | unread | critical | warning | info

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setAlerts(await api.devices.alerts(false)) }
    catch {} finally { setLoading(false) }
  }

  async function markRead(id) {
    await api.devices.markRead(id)
    setAlerts(as => as.map(a => a.id === id ? { ...a, read: true } : a))
  }

  async function markAllRead() {
    await api.devices.markAllRead()
    setAlerts(as => as.map(a => ({ ...a, read: true })))
  }

  const displayed = alerts.filter(a => {
    if (filter === 'unread')   return !a.read
    if (filter === 'critical') return a.level === 'critical'
    if (filter === 'warning')  return a.level === 'warning'
    if (filter === 'info')     return a.level === 'info'
    return true
  })

  const unreadCount = alerts.filter(a => !a.read).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Alerts</h1>
          {unreadCount > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
              {unreadCount} unread
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn btn-ghost btn-sm">
              ✓ Mark all read
            </button>
          )}
          <button onClick={load} className="btn btn-ghost btn-sm">↻ Refresh</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'all',      label: `All (${alerts.length})` },
          { key: 'unread',   label: `Unread (${unreadCount})` },
          { key: 'critical', label: '🔴 Critical' },
          { key: 'warning',  label: '🟡 Warning' },
          { key: 'info',     label: '🔵 Info' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '7px 14px', fontSize: 13, border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: 'var(--font)',
              color: filter === f.key ? 'var(--accent2)' : 'var(--text3)',
              borderBottom: filter === f.key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'var(--transition)', marginBottom: -1,
            }}
          >{f.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🔔</div>
          <div className="empty-title">No alerts</div>
          <div className="empty-sub">{filter === 'all' ? 'Alerts appear here when devices go offline or new devices are found.' : 'No alerts match this filter.'}</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayed.map(a => {
          const meta = LEVEL_META[a.level] || LEVEL_META.info
          return (
            <div
              key={a.id}
              className="fade-in"
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 14,
                padding: '14px 18px', borderRadius: 'var(--radius-lg)',
                background: a.read ? 'var(--surface)' : meta.bg,
                border: `1px solid ${a.read ? 'var(--border)' : meta.border}`,
                opacity: a.read ? 0.65 : 1,
                transition: 'var(--transition)',
              }}
            >
              <span style={{ fontSize: 20, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: a.read ? 400 : 600, fontSize: 14, marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{a.message}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>{timeAgo(a.created_at)}</div>
              </div>
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge badge-${a.level === 'critical' ? 'red' : a.level === 'warning' ? 'amber' : 'blue'}`}
                  style={{ fontSize: 10 }}>{a.level}</span>
                {!a.read && (
                  <button onClick={() => markRead(a.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                    Mark read
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
