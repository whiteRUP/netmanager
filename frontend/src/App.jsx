import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api.js'
import SetupWizard from './pages/SetupWizard.jsx'
import Login from './pages/Login.jsx'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Devices from './pages/Devices.jsx'
import Discovery from './pages/Discovery.jsx'
import Integrations from './pages/Integrations.jsx'
import Settings from './pages/Settings.jsx'
import Alerts from './pages/Alerts.jsx'

export default function App() {
  const [ready, setReady]             = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const [authed, setAuthed]           = useState(false)

  useEffect(() => {
    async function boot() {
      try {
        const s = await api.setup.status()
        setSetupComplete(s.setup_complete)
        if (s.setup_complete && localStorage.getItem('nm_token')) {
          try {
            await api.auth.me()
            setAuthed(true)
          } catch {
            localStorage.removeItem('nm_token')
          }
        }
      } catch {
        // backend unreachable — show error state below
      } finally {
        setReady(true)
      }
    }
    boot()
  }, [])

  if (!ready) return <Splash />

  if (!setupComplete) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={() => { localStorage.removeItem('nm_token'); setAuthed(false) }} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="devices"      element={<Devices />} />
          <Route path="discovery"    element={<Discovery />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="alerts"       element={<Alerts />} />
          <Route path="settings"     element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Splash() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  height:'100vh', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid #334155',
                    borderTopColor:'#38bdf8', borderRadius:'50%',
                    animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
