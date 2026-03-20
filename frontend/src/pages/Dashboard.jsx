import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { typeToIcon } from '../deviceTypes.js'

function utc(iso) {
  if (!iso) return ''
  if (!iso.endsWith('Z') && !iso.includes('+')) iso += 'Z'
  return iso
}
function timeAgo(iso) {
  const t = utc(iso)
  if (!t) return ''
  const diff = Date.now() - new Date(t).getTime()
  const s = Math.floor(diff/1000)
  if (s < 60)  return `${s}s ago`
  const m = Math.floor(s/60)
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m/60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}
function levelIcon(l)  { return l==='critical'?'🔴':l==='warning'?'🟡':'🔵' }
function levelColor(l) { return l==='critical'?'#ef4444':l==='warning'?'#f59e0b':'#38bdf8' }

export default function Dashboard() {
  const [stats,   setStats]   = useState(null)
  const [alerts,  setAlerts]  = useState([])
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
      setHistory(h.slice(0, 6))
    } catch {}
  }

  const statCards = stats ? [
    { label:'Total devices',  value: stats.total,      color:'#38bdf8', icon:'📡' },
    { label:'Online',         value: stats.online,     color:'#22c55e', icon:'🟢' },
    { label:'Offline',        value: stats.offline,    color:'#ef4444', icon:'🔴' },
    { label:'Verified',       value: stats.verified,   color:'#a78bfa', icon:'✅' },
    { label:'Pending review', value: stats.pending,    color:'#f59e0b', icon:'⏳', onClick:() => navigate('/discovery') },
    { label:'VLANs',          value: Object.keys(stats.vlans||{}).length, color:'#38bdf8', icon:'🔗' },
  ] : []

  const hasGroups = stats?.groups && Object.keys(stats.groups).length > 0
  const hasVlans  = stats?.vlans  && Object.keys(stats.vlans).length  > 0
  const hasTypes  = stats?.types  && Object.keys(stats.types).length  > 0
  const hasChanged = stats?.recently_changed?.length > 0
  const hasOffline = stats?.top_offline?.length > 0

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Dashboard</h1>
        <button onClick={load}
          style={{ padding:'6px 14px', background:'rgba(56,189,248,0.1)',
                   border:'1px solid rgba(56,189,248,0.3)', borderRadius:8,
                   color:'#38bdf8', fontSize:13, cursor:'pointer' }}>
          Refresh
        </button>
      </div>

      {/* Stat cards row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:12, marginBottom:28 }}>
        {statCards.length === 0
          ? Array(6).fill(0).map((_,i) => <SkeletonCard key={i} />)
          : statCards.map(c => (
              <StatCard key={c.label} {...c} />
            ))}
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* Recent alerts */}
        <Section title="Recent alerts" action={{ label:'View all', onClick:() => navigate('/alerts') }}>
          {alerts.length === 0
            ? <Empty icon="🔔" text="No alerts yet" />
            : alerts.map(a => (
                <div key={a.id} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6,
                  background: a.read ? 'transparent' : 'rgba(56,189,248,0.04)',
                  border:'1px solid rgba(148,163,184,0.08)',
                  display:'flex', alignItems:'flex-start', gap:10 }}>
                  <span style={{ fontSize:16 }}>{levelIcon(a.level)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight: a.read ? 400 : 600,
                                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {a.title}
                    </div>
                    <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>{timeAgo(a.created_at)}</div>
                  </div>
                  {!a.read && <div style={{ width:7, height:7, borderRadius:'50%',
                                            background:'#38bdf8', marginTop:4, flexShrink:0 }} />}
                </div>
              ))}
        </Section>

        {/* Scan history */}
        <Section title="Scan history" action={{ label:'Full scan', onClick:() => api.scan.trigger('full').then(load) }}>
          {history.length === 0
            ? <Empty icon="🔍" text="No scans yet — use sidebar buttons" />
            : history.map(h => (
                <div key={h.id} style={{ padding:'10px 12px', borderRadius:8, marginBottom:6,
                  border:'1px solid rgba(148,163,184,0.08)',
                  display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:16 }}>{h.scan_type === 'full' ? '🔍' : '⚡'}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13 }}>{h.scan_type === 'full' ? 'Full scan' : 'Ping scan'}</div>
                    <div style={{ fontSize:11, color:'#64748b' }}>{timeAgo(h.started_at)}</div>
                  </div>
                  <div style={{ fontSize:12, color:'#94a3b8', textAlign:'right' }}>
                    {h.devices_found} found
                    {h.new_devices > 0 && <span style={{ color:'#f59e0b' }}> · {h.new_devices} new</span>}
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                    color: h.status==='completed'?'#22c55e':'#ef4444',
                    background: h.status==='completed'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)' }}>
                    {h.status}
                  </span>
                </div>
              ))}
        </Section>

        {/* Device types breakdown */}
        {hasTypes && (
          <Section title="Device types">
            {Object.entries(stats.types).slice(0, 10).map(([t, count]) => {
              const pct = stats.total > 0 ? Math.min(100, (count / stats.total) * 100) : 0
              return (
                <div key={t} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ fontSize:14, width:22, textAlign:'center', flexShrink:0 }}>
                    {typeToIcon(t)}
                  </div>
                  <div style={{ flex:1, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t}</div>
                  <div style={{ width:70, height:5, background:'#334155', borderRadius:3, overflow:'hidden', flexShrink:0 }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:'#38bdf8', borderRadius:3 }} />
                  </div>
                  <div style={{ fontSize:12, color:'#94a3b8', minWidth:18, textAlign:'right', flexShrink:0 }}>{count}</div>
                </div>
              )
            })}
          </Section>
        )}

        {/* Recently changed */}
        {hasChanged && (
          <Section title="Recently changed">
            {stats.recently_changed.map(d => (
              <div key={d.id} style={{ padding:'9px 12px', borderRadius:8, marginBottom:6,
                border:'1px solid rgba(148,163,184,0.08)',
                display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>{d.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>{d.ip}</div>
                </div>
                <div style={{ display:'flex', flex:'column', alignItems:'flex-end', gap:4 }}>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                    color: d.status==='online'?'#22c55e':'#ef4444',
                    background: d.status==='online'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)' }}>
                    {d.status}
                  </span>
                  <div style={{ fontSize:11, color:'#64748b' }}>{timeAgo(d.last_changed)}</div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Top offline */}
        {hasOffline && (
          <Section title="Offline devices" action={{ label:'View all', onClick:() => navigate('/devices') }}>
            {stats.top_offline.map(d => (
              <div key={d.id} style={{ padding:'9px 12px', borderRadius:8, marginBottom:6,
                border:'1px solid rgba(239,68,68,0.1)',
                display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>{d.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'#64748b', fontFamily:'monospace' }}>{d.ip}</div>
                </div>
                <div style={{ fontSize:11, color:'#64748b' }}>
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
              <div key={g} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ flex:1, fontSize:13 }}>{g}</div>
                <div style={{ width:80, height:5, background:'#334155', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,(count/stats.total)*100)}%`, height:'100%', background:'#a78bfa', borderRadius:3 }} />
                </div>
                <div style={{ fontSize:12, color:'#94a3b8', minWidth:20, textAlign:'right' }}>{count}</div>
              </div>
            ))}
          </Section>
        )}

        {/* VLANs */}
        {hasVlans && (
          <Section title="VLANs">
            {Object.entries(stats.vlans).map(([v, count]) => (
              <div key={v} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <code style={{ fontSize:12, color:'#38bdf8', background:'rgba(56,189,248,0.1)',
                                padding:'2px 9px', borderRadius:6 }}>{v}</code>
                <div style={{ flex:1, height:5, background:'#334155', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(100,(count/stats.total)*100)}%`, height:'100%', background:'#38bdf8', borderRadius:3 }} />
                </div>
                <div style={{ fontSize:12, color:'#94a3b8', minWidth:20, textAlign:'right' }}>{count}</div>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* Getting started */}
      {stats && stats.total === 0 && (
        <div style={{ marginTop:28, padding:28, background:'rgba(56,189,248,0.04)',
                      border:'1px solid rgba(56,189,248,0.15)', borderRadius:14 }}>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:10 }}>🚀 Getting started</div>
          <div style={{ color:'#94a3b8', fontSize:14, lineHeight:1.8 }}>
            Your network is empty. Click <strong style={{ color:'#f1f5f9' }}>⚡ Ping scan</strong> in the sidebar
            for a quick sweep, or <strong style={{ color:'#f1f5f9' }}>🔍 Full scan</strong> for deep discovery
            with port detection. Then go to <strong style={{ color:'#f1f5f9' }}>Discovery</strong> to approve devices.
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, icon, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
               borderRadius:12, padding:'16px 20px',
               cursor: onClick ? 'pointer' : 'default',
               transition:'.15s' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontSize:20 }}>{icon}</span>
      </div>
      <div style={{ fontSize:30, fontWeight:800, color, lineHeight:1 }}>{value ?? '—'}</div>
      <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>{label}</div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:'16px 20px', opacity:.4 }}>
      <div style={{ width:28, height:28, background:'#334155', borderRadius:6, marginBottom:10 }} />
      <div style={{ width:44, height:30, background:'#334155', borderRadius:6 }} />
      <div style={{ width:80, height:12, background:'#334155', borderRadius:4, marginTop:8 }} />
    </div>
  )
}

function Section({ title, action, children }) {
  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontSize:14, fontWeight:600 }}>{title}</div>
        {action && (
          <button onClick={action.onClick}
            style={{ fontSize:12, color:'#38bdf8', background:'transparent',
                     border:'none', cursor:'pointer', padding:0 }}>
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ icon, text }) {
  return (
    <div style={{ textAlign:'center', padding:'28px 0', color:'#64748b', fontSize:13 }}>
      <div style={{ fontSize:30, marginBottom:10 }}>{icon}</div>
      {text}
    </div>
  )
}
