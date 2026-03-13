import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Discovery() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setPending(await api.pending.list()) }
    catch {} finally { setLoading(false) }
  }

  async function act(id, action) {
    setBusy(b => ({ ...b, [id]: action }))
    try {
      if (action === 'approve') await api.pending.approve(id)
      else await api.pending.reject(id)
      setPending(p => p.filter(d => d.id !== id))
    } catch {} finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Discovery queue</h1>
        <button onClick={load}
          style={{ padding:'6px 14px', background:'rgba(56,189,248,0.1)',
                   border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, color:'#38bdf8', fontSize:13 }}>
          Refresh
        </button>
      </div>

      {loading && <div style={{ color:'#64748b', textAlign:'center', padding:40 }}>Loading…</div>}

      {!loading && pending.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
          <div style={{ fontSize:16, marginBottom:8, color:'#94a3b8' }}>No pending devices</div>
          <div style={{ fontSize:14 }}>Run a full scan to discover new devices on your network.</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {pending.map(d => (
          <div key={d.id} style={{ background:'#1e293b',
                                    border:'1px solid rgba(148,163,184,0.1)',
                                    borderRadius:12, padding:20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16 }}>

              {/* Confidence ring */}
              <div style={{ flexShrink:0, textAlign:'center' }}>
                <div style={{ width:56, height:56, borderRadius:'50%',
                              background:`conic-gradient(${confidenceColor(d.confidence)} ${d.confidence * 3.6}deg, #334155 0)`,
                              display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background:'#1e293b',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, fontWeight:700 }}>
                    {d.confidence}%
                  </div>
                </div>
                <div style={{ fontSize:10, color:'#64748b', marginTop:4 }}>confidence</div>
              </div>

              {/* Info */}
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:16 }}>{d.ip}</span>
                  {d.detected_type && (
                    <span style={{ fontSize:12, background:'rgba(56,189,248,0.1)',
                                   color:'#38bdf8', borderRadius:6, padding:'2px 8px' }}>
                      {d.detected_type}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace', marginBottom:8 }}>
                  {d.mac === '00:00:00:00:00:00' ? 'MAC unknown (cross-subnet)' : d.mac} {d.manufacturer && d.manufacturer !== 'Unknown' && `· ${d.manufacturer}`}
                </div>

                {/* Signals */}
                {d.signals?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                    {d.signals.map(s => (
                      <span key={s} style={{ fontSize:11, background:'rgba(245,158,11,0.1)',
                                             color:'#f59e0b', borderRadius:6, padding:'2px 8px' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Open ports */}
                {d.open_ports?.length > 0 && (
                  <div style={{ fontSize:12, color:'#64748b' }}>
                    Ports: {d.open_ports.map(p => (
                      <span key={p} style={{ fontFamily:'monospace', background:'#334155',
                                             borderRadius:4, padding:'1px 5px', marginRight:4 }}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button onClick={() => act(d.id, 'approve')} disabled={!!busy[d.id]}
                  style={{ padding:'8px 16px', background:'rgba(34,197,94,0.15)',
                           border:'1px solid rgba(34,197,94,0.3)', borderRadius:8,
                           color:'#22c55e', fontSize:13, cursor:'pointer' }}>
                  {busy[d.id] === 'approve' ? '…' : '✓ Approve'}
                </button>
                <button onClick={() => act(d.id, 'reject')} disabled={!!busy[d.id]}
                  style={{ padding:'8px 16px', background:'rgba(239,68,68,0.1)',
                           border:'1px solid rgba(239,68,68,0.2)', borderRadius:8,
                           color:'#ef4444', fontSize:13, cursor:'pointer' }}>
                  {busy[d.id] === 'reject' ? '…' : '✕ Reject'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function confidenceColor(c) {
  if (c >= 80) return '#22c55e'
  if (c >= 50) return '#f59e0b'
  return '#ef4444'
}
