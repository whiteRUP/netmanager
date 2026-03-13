import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../api.js'

const NAV = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard' },
  { to: '/devices',      icon: '📡', label: 'Devices' },
  { to: '/discovery',    icon: '🔍', label: 'Discovery' },
  { to: '/integrations', icon: '🔌', label: 'Integrations' },
  { to: '/alerts',       icon: '🔔', label: 'Alerts' },
  { to: '/settings',     icon: '⚙️', label: 'Settings' },
]

export default function Layout({ onLogout }) {
  const [stats, setStats]       = useState(null)
  const [scanning, setScanning] = useState(false)
  const [unread, setUnread]     = useState(0)

  useEffect(() => {
    loadStats()
    const id = setInterval(loadStats, 15000)
    return () => clearInterval(id)
  }, [])

  async function loadStats() {
    try {
      const [s, alerts] = await Promise.all([
        api.devices.stats(),
        api.devices.alerts(true)
      ])
      setStats(s)
      setUnread(alerts.length)
    } catch {}
  }

  async function triggerScan(type) {
    setScanning(true)
    try { await api.scan.trigger(type) } catch {}
    setTimeout(() => { setScanning(false); loadStats() }, 3000)
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#1e293b',
        borderRight: '1px solid rgba(148,163,184,0.1)',
        display: 'flex', flexDirection: 'column',
        padding: '0 0 16px'
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🌐</span>
            <span style={{ fontWeight:700, fontSize:16 }}>NetManager</span>
          </div>
          {stats && (
            <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
              <Pill color="#22c55e" label={`${stats.online} online`} />
              <Pill color="#ef4444" label={`${stats.offline} offline`} />
              {stats.pending > 0 && <Pill color="#f59e0b" label={`${stats.pending} pending`} />}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, fontSize: 14,
              color: isActive ? '#38bdf8' : '#94a3b8',
              background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
              transition: '.15s',
              position: 'relative'
            })}>
              <span style={{ fontSize:16 }}>{icon}</span>
              {label}
              {label === 'Alerts' && unread > 0 && (
                <span style={{
                  marginLeft:'auto', background:'#ef4444', color:'#fff',
                  fontSize:11, fontWeight:700, borderRadius:10,
                  padding:'1px 6px', minWidth:18, textAlign:'center'
                }}>{unread}</span>
              )}
              {label === 'Discovery' && stats?.pending > 0 && (
                <span style={{
                  marginLeft:'auto', background:'#f59e0b', color:'#0f172a',
                  fontSize:11, fontWeight:700, borderRadius:10,
                  padding:'1px 6px', minWidth:18, textAlign:'center'
                }}>{stats.pending}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Scan buttons */}
        <div style={{ padding:'0 8px 8px', display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={() => triggerScan('ping')} disabled={scanning}
            style={{ padding:'7px 12px', background:'transparent',
                     border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                     color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
            {scanning ? '⏳ Scanning…' : '⚡ Ping scan'}
          </button>
          <button onClick={() => triggerScan('full')} disabled={scanning}
            style={{ padding:'7px 12px', background:'transparent',
                     border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                     color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
            🔍 Full scan
          </button>
        </div>

        {/* Logout */}
        <div style={{ padding:'0 8px' }}>
          <button onClick={onLogout}
            style={{ width:'100%', padding:'7px 12px', background:'transparent',
                     border:'1px solid rgba(148,163,184,0.15)', borderRadius:8,
                     color:'#64748b', fontSize:13, cursor:'pointer' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflowY:'auto', padding:28, background:'#0f172a' }}>
        <Outlet />
      </main>
    </div>
  )
}

function Pill({ color, label }) {
  return (
    <span style={{
      fontSize:11, padding:'2px 8px', borderRadius:20,
      background: color + '20', color, border:`1px solid ${color}40`
    }}>{label}</span>
  )
}
