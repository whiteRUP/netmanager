import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api.js'
import SetupWizard from './pages/SetupWizard.jsx'
import Login       from './pages/Login.jsx'
import Layout      from './components/Layout.jsx'
import Dashboard   from './pages/Dashboard.jsx'
import Devices     from './pages/Devices.jsx'
import Discovery   from './pages/Discovery.jsx'
import Integrations from './pages/Integrations.jsx'
import Alerts      from './pages/Alerts.jsx'
import Settings    from './pages/Settings.jsx'

export default function App() {
  const [ready, setReady]               = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const [authed, setAuthed]             = useState(false)
  const [appName, setAppName]           = useState('NetManager')

  useEffect(() => {
    ;(async () => {
      try {
        const s = await api.setup.status()
        setSetupComplete(s.setup_complete)
        setAppName(s.app_name || 'NetManager')
        if (s.setup_complete && localStorage.getItem('nm_token')) {
          try {
            await api.auth.me()
            setAuthed(true)
          } catch {
            localStorage.removeItem('nm_token')
          }
        }
      } catch {
        // backend unreachable
      } finally {
        setReady(true)
      }
    })()
  }, [])

  if (!ready) return <Splash />

  if (!setupComplete) {
    return (
      <SetupWizard
        onComplete={(name) => {
          setAppName(name)
          setSetupComplete(true)
        }}
      />
    )
  }

  if (!authed) {
    return (
      <Login
        appName={appName}
        onLogin={() => setAuthed(true)}
      />
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              appName={appName}
              onLogout={() => { localStorage.removeItem('nm_token'); setAuthed(false) }}
            />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="devices"      element={<Devices />} />
          <Route path="discovery"    element={<Discovery />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="alerts"       element={<Alerts />} />
          <Route path="settings"     element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function Splash() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 16
    }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid var(--border2)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin .7s linear infinite'
      }} />
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>Starting…</span>
    </div>
  )
}
