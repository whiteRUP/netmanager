import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
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
      setAlerts(a.slice(0, 10))
      setHistory(h.slice(0, 5))
    } catch {}
  }

  const cards = stats ? [
    { label:'Total devices',  value: stats.total,    color:'#38bdf8' },
    { label:'Online',         value: stats.online,   color:'#22c55e' },
    { label:'Offline',        value: stats.offline,  color:'#ef4444' },
    { label:'Verified',       value: stats.verified, color:'#a78bfa' },
    { label:'Pending review', value: stats.pending,  color:'#f59e0b' },
    { label:'VLANs',          value: Object.keys(stats.vlans || {}).length, color:'#38bdf8' },
  ] : []

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Dashboard</h1>
        <button onClick={load} style={{ padding:'6px 14px', background:'rgba(56,189,248,0.1)',
          border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, color:'#38bdf8', fontSize:13 }}>
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
        {cards.length === 0
          ? Array(6).fill(0).map((_, i) => <StatCardSkeleton key={i} />)
          : cards.map(c => <StatCard key={c.label} {...c} />)
        }
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Recent alerts */}
        <Section title="Recent alerts" action={{ label:'View all', onClick:() => navigate('/alerts') }}>
          {alerts.length === 0
            ? <Empty icon="🔔" text="No alerts yet" />
            : alerts.map(a => (
                <div key={a.id} style={{
                  padding:'10px 14px', borderRadius:8,
                  background: a.read ? 'transparent' : 'rgba(56,189,248,0.05)',
                  border:'1px solid rgba(148,163,184,0.1)', marginBottom:6,
                  display:'flex', alignItems:'flex-start', gap:10
                }}>
                  <span style={{ color: levelColor(a.level), fontSize:16 }}>
                    {levelIcon(a.level)}
                  </span>
                  <div>
                    <div style={{ fontSize:13, fontWeight: a.read ? 400 : 600 }}>{a.title}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))
          }
        </Section>

        {/* Scan history */}
        <Section title="Scan history" action={{ label:'Run scan', onClick:() => api.scan.trigger('full').then(load) }}>
          {history.length === 0
            ? <Empty icon="🔍" text="No scans run yet. Use the sidebar buttons to scan." />
            : history.map(h => (
                <div key={h.id} style={{
                  padding:'10px 14px', borderRadius:8,
                  border:'1px solid rgba(148,163,184,0.1)', marginBottom:6,
                  display:'flex', alignItems:'center', gap:10
                }}>
                  <span>{h.scan_type === 'full' ? '🔍' : '⚡'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13 }}>{h.scan_type === 'full' ? 'Full scan' : 'Ping scan'}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{timeAgo(h.started_at)}</div>
                  </div>
                  <div style={{ fontSize:12, color:'#94a3b8', textAlign:'right' }}>
                    {h.devices_found} found
                    {h.new_devices > 0 && <span style={{ color:'#f59e0b' }}> · {h.new_devices} new</span>}
                  </div>
                  <span style={{ fontSize:12, color: h.status === 'completed' ? '#22c55e' : '#ef4444' }}>
                    {h.status}
                  </span>
                </div>
              ))
          }
        </Section>

        {/* Groups */}
        {stats?.groups && Object.keys(stats.groups).length > 0 && (
          <Section title="Device groups">
            {Object.entries(stats.groups).map(([g, count]) => (
              <div key={g} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ flex:1, fontSize:13 }}>{g}</div>
                <div style={{ width:80, height:6, background:'#334155', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,(count/stats.total)*100)}%`,
                                height:'100%', background:'#38bdf8', borderRadius:3 }} />
                </div>
                <div style={{ fontSize:13, color:'#94a3b8', minWidth:24, textAlign:'right' }}>{count}</div>
              </div>
            ))}
          </Section>
        )}

        {/* VLANs */}
        {stats?.vlans && Object.keys(stats.vlans).length > 0 && (
          <Section title="VLANs">
            {Object.entries(stats.vlans).map(([v, count]) => (
              <div key={v} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ fontSize:12, fontFamily:'monospace', color:'#38bdf8',
                              background:'rgba(56,189,248,0.1)', padding:'2px 8px', borderRadius:6 }}>
                  {v}
                </div>
                <div style={{ fontSize:13, color:'#94a3b8' }}>{count} devices</div>
              </div>
            ))}
          </Section>
        )}

      </div>

      {/* Getting started */}
      {stats && stats.total === 0 && (
        <div style={{ marginTop:24, padding:24, background:'rgba(56,189,248,0.05)',
                      border:'1px solid rgba(56,189,248,0.2)', borderRadius:12 }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>🚀 Getting started</div>
          <div style={{ color:'#94a3b8', fontSize:14, lineHeight:1.7 }}>
            Your network is empty. Use <strong style={{ color:'#f1f5f9' }}>⚡ Ping scan</strong> in the sidebar for a quick sweep,
            or <strong style={{ color:'#f1f5f9' }}>🔍 Full scan</strong> for deep discovery with port detection.
            Then head to <strong style={{ color:'#f1f5f9' }}>Discovery</strong> to review and approve found devices.
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:'16px 20px' }}>
      <div style={{ fontSize:28, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:12, color:'#64748b', marginTop:4 }}>{label}</div>
    </div>
  )
}

function StatCardSkeleton() {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:'16px 20px', opacity:.5 }}>
      <div style={{ width:40, height:28, background:'#334155', borderRadius:6 }} />
      <div style={{ width:80, height:12, background:'#334155', borderRadius:4, marginTop:8 }} />
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>{title}</div>
        {action && (
          <button onClick={action.onClick}
            style={{ fontSize:12, color:'#38bdf8', background:'transparent',
                     border:'none', cursor:'pointer', padding:0 }}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'24px 0', color:'#64748b', fontSize:13 }}>
      <div style={{ fontSize:28, marginBottom:8 }}>{icon}</div>
      {text}
    </div>
  )
}

function levelIcon(l) { return l==='critical' ? '🔴' : l==='warning' ? '🟡' : '🔵' }
function levelColor(l) { return l==='critical' ? '#ef4444' : l==='warning' ? '#f59e0b' : '#38bdf8' }

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}
