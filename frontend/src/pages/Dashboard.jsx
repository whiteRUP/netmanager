import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { typeToIcon } from '../deviceTypes.js'

function toUtc(iso) {
  if (!iso) return null
  if (!iso.endsWith('Z') && !iso.includes('+')) return iso + 'Z'
  return iso
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
function levelIcon(l) { return l === 'critical' ? '🔴' : l === 'warning' ? '🟡' : '🔵' }

export default function Dashboard() {
  const [stats,   setStats]   = useState(null)
  const [alerts,  setAlerts]  = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const [s, a, h] = await Promise.all([
        api.devices.stats(),
        api.devices.alerts(false),
        api.scan.history(),
      ])
      setStats(s)
      setAlerts(a.slice(0, 8))
      setHistory(h.slice(0, 6))
    } catch {} finally { setLoading(false) }
  }

  const STAT_CARDS = stats ? [
    { label: 'Total',    value: stats.total,    color: 'var(--accent2)',  icon: '📡' },
    { label: 'Online',   value: stats.online,   color: 'var(--green)',    icon: '🟢', onClick: () => navigate('/devices?status=online') },
    { label: 'Offline',  value: stats.offline,  color: 'var(--red)',      icon: '🔴', onClick: () => navigate('/devices?status=offline') },
    { label: 'Verified', value: stats.verified, color: 'var(--purple)',   icon: '✅' },
    { label: 'Pending',  value: stats.pending,  color: 'var(--amber)',    icon: '⏳', onClick: () => navigate('/discovery') },
    { label: 'VLANs',    value: Object.keys(stats.vlans || {}).length, color: 'var(--cyan)', icon: '🔗' },
  ] : []

  const hasTypes    = stats?.types    && Object.keys(stats.types).length > 0
  const hasGroups   = stats?.groups   && Object.keys(stats.groups).length > 0
  const hasVlans    = stats?.vlans    && Object.keys(stats.vlans).length > 0
  const hasChanged  = stats?.recently_changed?.length > 0
  const hasOffline  = stats?.top_offline?.length > 0

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
        <button onClick={load} className="btn btn-ghost btn-sm">↻ Refresh</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: 12, marginBottom: 28 }}>
        {loading
          ? Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : STAT_CARDS.map(c => <StatCard key={c.label} {...c} />)
        }
      </div>

      {/* Getting started */}
      {!loading && stats?.total === 0 && (
        <div style={{
          padding: 28, marginBottom: 24,
          background: 'rgba(59,130,246,.05)',
          border: '1px solid rgba(59,130,246,.15)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>🚀 Getting started</div>
          <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.8 }}>
            Your network is empty. Click{' '}
            <strong style={{ color: 'var(--text)' }}>⚡ Ping scan</strong> in the sidebar for a quick sweep, or{' '}
            <strong style={{ color: 'var(--text)' }}>🔍 Full scan</strong> for deep discovery with device fingerprinting.
            Discovered devices appear in <strong style={{ color: 'var(--text)' }}>Discovery</strong> for review.
          </div>
        </div>
      )}

      {/* 2-col grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recent alerts */}
        <Section title="Recent alerts" action={{ label: 'View all', onClick: () => navigate('/alerts') }}>
          {alerts.length === 0
            ? <Empty icon="🔔" text="No alerts yet" />
            : alerts.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '9px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 14, marginTop: 1 }}>{levelIcon(a.level)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: a.read ? 400 : 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{timeAgo(a.created_at)}</div>
                  </div>
                  {!a.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />}
                </div>
              ))
          }
        </Section>

        {/* Scan history */}
        <Section title="Scan history" action={{ label: 'Full scan', onClick: () => api.scan.trigger('full').then(load) }}>
          {history.length === 0
            ? <Empty icon="🔍" text="No scans yet — use sidebar buttons" />
            : history.map(h => (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 14 }}>{h.scan_type === 'full' ? '🔍' : '⚡'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{h.scan_type === 'full' ? 'Full scan' : 'Ping scan'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(h.started_at)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>
                    {h.devices_found} found
                    {h.new_devices > 0 && <span style={{ color: 'var(--amber)' }}> · {h.new_devices} new</span>}
                  </div>
                  <span className={`badge badge-${h.status === 'completed' ? 'green' : 'red'}`} style={{ fontSize: 10 }}>
                    {h.status}
                  </span>
                </div>
              ))
          }
        </Section>

        {/* Device types */}
        {hasTypes && (
          <Section title="Device types">
            {Object.entries(stats.types).slice(0, 10).map(([t, count]) => {
              const pct = stats.total > 0 ? Math.min(100, (count / stats.total) * 100) : 0
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{typeToIcon(t)}</span>
                  <div style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</div>
                  <div style={{ width: 60, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>{count}</div>
                </div>
              )
            })}
          </Section>
        )}

        {/* Recently changed */}
        {hasChanged && (
          <Section title="Recently changed">
            {stats.recently_changed.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>{d.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{d.ip}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className={`badge badge-${d.status === 'online' ? 'green' : d.status === 'offline' ? 'red' : 'gray'}`} style={{ fontSize: 10 }}>{d.status}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{timeAgo(d.last_changed)}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Offline devices */}
        {hasOffline && (
          <Section title="Offline devices" action={{ label: 'View all', onClick: () => navigate('/devices?status=offline') }}>
            {stats.top_offline.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 18 }}>{d.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{d.ip}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                  {d.last_seen ? `Last seen ${timeAgo(d.last_seen)}` : 'Never seen'}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Groups */}
        {hasGroups && (
          <Section title="Device groups">
            {Object.entries(stats.groups).map(([g, count]) => (
              <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ flex: 1, fontSize: 13 }}>{g}</div>
                <div style={{ width: 80, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (count / stats.total) * 100)}%`, height: '100%', background: 'var(--purple)', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', minWidth: 20, textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </Section>
        )}

        {/* VLANs */}
        {hasVlans && (
          <Section title="VLANs">
            {Object.entries(stats.vlans).map(([v, count]) => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <code style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(59,130,246,.1)', padding: '2px 8px', borderRadius: 6 }}>{v}</code>
                <div style={{ flex: 1, height: 4, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, (count / stats.total) * 100)}%`, height: '100%', background: 'var(--cyan)', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', minWidth: 20, textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color, icon, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'var(--transition)', padding: '16px 18px' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
          {onClick ? '→' : ''}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--mono)' }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 6, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 48, height: 28, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 60, height: 11, borderRadius: 4, marginTop: 8 }} />
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {action && (
          <button onClick={action.onClick}
            style={{ fontSize: 12, color: 'var(--accent2)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
            {action.label} →
          </button>
        )}
      </div>
      <div style={{ padding: '4px 18px 14px' }}>{children}</div>
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text3)', fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
      {text}
    </div>
  )
}
