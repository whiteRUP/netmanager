import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

const NAV = [
  { to: '/dashboard',    icon: '⊞',  label: 'Dashboard'    },
  { to: '/devices',      icon: '📡', label: 'Devices'      },
  { to: '/discovery',    icon: '🔍', label: 'Discovery'    },
  { to: '/integrations', icon: '🔌', label: 'Integrations' },
  { to: '/alerts',       icon: '🔔', label: 'Alerts'       },
  { to: '/settings',     icon: '⚙️', label: 'Settings'     },
]

export default function Layout({ appName, onLogout }) {
  const [stats,    setStats]   = useState(null)
  const [scanning, setScanning] = useState(null) // 'ping'|'full'|null
  const [unread,   setUnread]  = useState(0)
  const wsRef = useRef(null)

  useEffect(() => {
    loadStats()
    const id = setInterval(loadStats, 20000)
    connectWS()
    return () => {
      clearInterval(id)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/events`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event?.startsWith('scan') || msg.event?.startsWith('device')) {
          loadStats()
        }
      } catch {}
    }
    ws.onclose = () => setTimeout(connectWS, 3000)
    wsRef.current = ws
  }

  async function loadStats() {
    try {
      const [s, alerts] = await Promise.all([
        api.devices.stats(),
        api.devices.alerts(true),
      ])
      setStats(s)
      setUnread(alerts.length)
    } catch {}
  }

  async function triggerScan(type) {
    if (scanning) return
    setScanning(type)
    try { await api.scan.trigger(type) } catch {}
    setTimeout(() => { setScanning(null); loadStats() }, 4000)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0
            }}>🌐</span>
            <span style={{
              fontWeight: 700, fontSize: 15,
              fontFamily: 'var(--mono)',
              color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
            }}>{appName}</span>
          </div>

          {stats && (
            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill label={`${stats.online} up`}    color="var(--green)" />
              <Pill label={`${stats.offline} down`} color="var(--red)" />
              {stats.pending > 0 && <Pill label={`${stats.pending} new`} color="var(--amber)" />}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, fontSize: 13,
              color: isActive ? 'var(--accent2)' : 'var(--text2)',
              background: isActive ? 'rgba(59,130,246,.1)' : 'transparent',
              transition: 'var(--transition)', position: 'relative',
              fontWeight: isActive ? 600 : 400,
              textDecoration: 'none',
            })}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {label === 'Alerts' && unread > 0 && (
                <span style={{
                  background: 'var(--red)', color: '#fff', fontSize: 10,
                  fontWeight: 700, borderRadius: 99, padding: '1px 5px', minWidth: 16,
                  textAlign: 'center',
                }}>{unread > 99 ? '99+' : unread}</span>
              )}
              {label === 'Discovery' && stats?.pending > 0 && (
                <span style={{
                  background: 'var(--amber)', color: '#0f172a', fontSize: 10,
                  fontWeight: 700, borderRadius: 99, padding: '1px 5px', minWidth: 16,
                  textAlign: 'center',
                }}>{stats.pending > 99 ? '99+' : stats.pending}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Scan buttons */}
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <button
            onClick={() => triggerScan('ping')}
            disabled={!!scanning}
            className="btn btn-ghost"
            style={{ justifyContent: 'center', fontSize: 12 }}
          >
            {scanning === 'ping' ? <Spinner /> : '⚡'}
            {scanning === 'ping' ? 'Scanning…' : 'Ping scan'}
          </button>
          <button
            onClick={() => triggerScan('full')}
            disabled={!!scanning}
            className="btn btn-ghost"
            style={{ justifyContent: 'center', fontSize: 12 }}
          >
            {scanning === 'full' ? <Spinner /> : '🔍'}
            {scanning === 'full' ? 'Scanning…' : 'Full scan'}
          </button>
        </div>

        {/* Logout */}
        <div style={{ padding: '0 8px 12px' }}>
          <button
            onClick={onLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: 28 }}>
        <Outlet />
      </main>
    </div>
  )
}

function Pill({ label, color }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 7px', borderRadius: 99,
      background: color + '18', color, border: `1px solid ${color}30`,
      fontWeight: 600,
    }}>{label}</span>
  )
}

function Spinner() {
  return (
    <span style={{
      width: 12, height: 12, border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)', borderRadius: '50%',
      display: 'inline-block', animation: 'spin .6s linear infinite',
    }} />
  )
}
