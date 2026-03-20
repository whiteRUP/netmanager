import { useState, useEffect } from 'react'
import { api } from '../api.js'

// ── Device type library + icon suggestions ──────────────────────
const DEVICE_TYPES = [
  { type:'Router / AP',      icon:'📡', tags:['router','gateway','ap','access point','wifi'] },
  { type:'Switch',           icon:'🔀', tags:['switch','cisco','netgear','tp-link','managed'] },
  { type:'PC / Laptop',      icon:'💻', tags:['windows','linux','desktop','laptop','workstation','rdp'] },
  { type:'Server / SBC',     icon:'🖥️', tags:['server','proxmox','ubuntu','debian','esxi','node'] },
  { type:'Virtual Machine',  icon:'🖼️', tags:['vmware','qemu','vm','virtualbox','hyperv'] },
  { type:'Raspberry Pi',     icon:'🍓', tags:['raspberrypi','pi','rpi','raspberry','arm'] },
  { type:'IoT Device',       icon:'🔌', tags:['iot','esp','shelly','sonoff','tasmota','mqtt','smart','zigbee'] },
  { type:'Home Assistant',   icon:'🏠', tags:['home assistant','hassio','hass','ha'] },
  { type:'IP Camera',        icon:'📷', tags:['camera','cam','rtsp','nvr','dvr','hikvision','dahua','ipcam'] },
  { type:'NAS',              icon:'💾', tags:['nas','synology','qnap','storage','omv'] },
  { type:'Printer',          icon:'🖨️', tags:['printer','print','brother','canon','epson','hp','ipp'] },
  { type:'Phone / Tablet',   icon:'📱', tags:['phone','iphone','ipad','android','mobile','galaxy','xiaomi'] },
  { type:'Smart Speaker',    icon:'🔊', tags:['echo','alexa','google home','nest','speaker','chromecast'] },
  { type:'Media Player',     icon:'📺', tags:['plex','jellyfin','emby','kodi','fire tv','apple tv','roku','media'] },
  { type:'Game Console',     icon:'🎮', tags:['playstation','xbox','nintendo','ps4','ps5','switch'] },
  { type:'Portainer',        icon:'🐳', tags:['portainer','docker','container','9000','9443'] },
  { type:'DNS Server',       icon:'🌐', tags:['dns','pihole','adguard','bind','unbound','technitium'] },
  { type:'Media Server',     icon:'🎬', tags:['plex','jellyfin','emby','media server','32400'] },
  { type:'UPS',              icon:'🔋', tags:['ups','apc','eaton','battery','power'] },
  { type:'Network Device',   icon:'🔗', tags:['snmp','network','device','161'] },
  { type:'Linux Device',     icon:'🐧', tags:['linux','ubuntu','debian','centos','arch','fedora'] },
  { type:'Windows Device',   icon:'🪟', tags:['windows','win','rdp','3389'] },
  { type:'Apple / macOS',    icon:'🍎', tags:['apple','macos','macbook','imac','mac'] },
  { type:'Unknown',          icon:'❓', tags:[] },
]

// Suggest types based on open ports + hostname + manufacturer
function suggestTypes(pending) {
  const text = [
    pending.hostname || '',
    pending.manufacturer || '',
    pending.detected_type || '',
  ].join(' ').toLowerCase()
  const ports = pending.open_ports ? JSON.parse(pending.open_ports) : []

  const ranked = DEVICE_TYPES.map(dt => {
    let score = 0
    // Detected type match
    if (pending.detected_type && dt.type === pending.detected_type) score += 40
    // Tag match against text
    for (const tag of dt.tags) {
      if (text.includes(tag)) score += 10
    }
    // Port-specific boost
    if (ports.includes(8123) && dt.type === 'Home Assistant') score += 30
    if (ports.includes(9000) && dt.type === 'Portainer')      score += 30
    if ((ports.includes(554) || ports.includes(8554)) && dt.type === 'IP Camera') score += 30
    if ((ports.includes(1883) || ports.includes(8883)) && dt.type === 'IoT Device') score += 30
    if (ports.includes(9100) && dt.type === 'Printer')        score += 30
    if (ports.includes(32400) && dt.type === 'Media Player')  score += 30
    if (ports.includes(3389) && dt.type === 'Windows Device') score += 20
    return { ...dt, score }
  }).filter(dt => dt.score > 0 || dt.type === 'Unknown')
     .sort((a, b) => b.score - a.score)

  return ranked.slice(0, 6)
}

function ConfidenceRing({ pct, size=52 }) {
  const r = (size - 8) / 2, c = size / 2
  const circ = 2 * Math.PI * r
  const color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#f59e0b' : '#64748b'
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="#1e3a5f" strokeWidth={5} />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct/100)} strokeLinecap="round" />
      <text x={c} y={c+1} textAnchor="middle" dominantBaseline="middle" fill={color}
        fontSize={11} fontWeight={700} style={{ transform:'rotate(90deg)', transformOrigin:`${c}px ${c}px` }}>
        {pct}%
      </text>
    </svg>
  )
}

function ApproveModal({ pending, onClose, onApprove }) {
  const [name, setName]         = useState(pending.hostname || pending.ip)
  const [type, setType]         = useState(pending.detected_type || 'Unknown')
  const [icon, setIcon]         = useState(() => {
    const match = DEVICE_TYPES.find(d => d.type === (pending.detected_type || 'Unknown'))
    return match?.icon || '❓'
  })
  const [group, setGroup]       = useState('General')
  const [showAddType, setShowAddType] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeIcon, setNewTypeIcon] = useState('🔧')
  const [customTypes, setCustomTypes] = useState([])

  const ports = pending.open_ports ? JSON.parse(pending.open_ports) : []
  const suggestions = suggestTypes(pending)

  const allTypes = [...DEVICE_TYPES, ...customTypes]

  function selectType(dt) {
    setType(dt.type)
    setIcon(dt.icon)
  }

  function addCustomType() {
    if (!newTypeName.trim()) return
    const dt = { type: newTypeName.trim(), icon: newTypeIcon, tags: [] }
    setCustomTypes(c => [...c, dt])
    selectType(dt)
    setShowAddType(false)
    setNewTypeName(''); setNewTypeIcon('🔧')
  }

  const inp = { padding:'8px 12px', background:'#0f172a', fontSize:13,
                border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                color:'#f1f5f9', boxSizing:'border-box' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000,
                  display:'flex', alignItems:'center', justifyContent:'center' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#1e293b', borderRadius:16, padding:28, width:520,
                    maxHeight:'90vh', overflowY:'auto', border:'1px solid rgba(148,163,184,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:700 }}>Approve device</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748b',
                                             fontSize:20, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Detected info summary */}
        <div style={{ background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.15)',
                      borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:13 }}>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <span>📍 <strong style={{ color:'#f1f5f9' }}>{pending.ip}</strong></span>
            {pending.mac !== '00:00:00:00:00:00' && <span>🔗 <code style={{ color:'#94a3b8' }}>{pending.mac}</code></span>}
            {pending.manufacturer && pending.manufacturer !== 'Unknown' && <span>🏭 {pending.manufacturer}</span>}
            {pending.hostname && <span>🖥️ {pending.hostname}</span>}
          </div>
          {ports.length > 0 && (
            <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
              {ports.map(p => (
                <span key={p} style={{ fontSize:11, padding:'2px 7px', borderRadius:5,
                                       background:'rgba(148,163,184,0.1)', color:'#94a3b8' }}>:{p}</span>
              ))}
            </div>
          )}
        </div>

        {/* Display name */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6, fontWeight:500 }}>Display name</div>
          <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, width:'100%' }} />
        </div>

        {/* Group */}
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6, fontWeight:500 }}>Group</div>
          <input value={group} onChange={e => setGroup(e.target.value)}
            placeholder="General" style={{ ...inp, width:'100%' }} />
        </div>

        {/* Type suggestions */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontSize:12, color:'#94a3b8', fontWeight:500 }}>Device type</div>
            <button onClick={() => setShowAddType(s => !s)}
              style={{ fontSize:12, color:'#38bdf8', background:'none', border:'none', cursor:'pointer' }}>
              + Add custom type
            </button>
          </div>

          {/* Suggestions row */}
          {suggestions.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              {suggestions.map(dt => (
                <button key={dt.type} onClick={() => selectType(dt)}
                  style={{ padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
                           fontSize:12, display:'flex', alignItems:'center', gap:5, transition:'.12s',
                           background: type === dt.type ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.08)',
                           color: type === dt.type ? '#38bdf8' : '#94a3b8',
                           outline: type === dt.type ? '1px solid rgba(56,189,248,0.4)' : 'none' }}>
                  <span>{dt.icon}</span> {dt.type}
                  {dt.score > 0 && type !== dt.type && (
                    <span style={{ fontSize:10, color:'#475569', marginLeft:2 }}>({dt.score})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Full type dropdown */}
          <select value={type} onChange={e => {
              setType(e.target.value)
              const match = allTypes.find(d => d.type === e.target.value)
              if (match) setIcon(match.icon)
            }}
            style={{ ...inp, width:'100%' }}>
            {allTypes.map(dt => (
              <option key={dt.type} value={dt.type}>{dt.icon} {dt.type}</option>
            ))}
          </select>
        </div>

        {/* Add custom type inline */}
        {showAddType && (
          <div style={{ background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.15)',
                        borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#38bdf8', fontWeight:600, marginBottom:10 }}>New custom type</div>
            <div style={{ display:'flex', gap:8, marginBottom:8 }}>
              <input value={newTypeIcon} onChange={e => setNewTypeIcon(e.target.value)}
                style={{ ...inp, width:60, textAlign:'center', fontSize:20 }} maxLength={2} />
              <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                placeholder="Type name…" style={{ ...inp, flex:1 }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={addCustomType}
                style={{ padding:'6px 16px', background:'#38bdf8', color:'#0f172a',
                         border:'none', borderRadius:7, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                Add
              </button>
              <button onClick={() => setShowAddType(false)}
                style={{ padding:'6px 12px', background:'transparent',
                         border:'1px solid rgba(148,163,184,0.2)', borderRadius:7,
                         color:'#94a3b8', fontSize:12, cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Icon picker */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:12, color:'#94a3b8', marginBottom:8, fontWeight:500 }}>
            Icon — selected: <span style={{ fontSize:20 }}>{icon}</span>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['📡','🔀','💻','🖥️','🍓','🔌','🏠','📷','💾','🖨️','📱','🔊','📺','🎮','🐳','🌐','🎬','🔋','🔗','🐧','🪟','🍎','⚡','🔧','🛡️','🕳️','📦','❓'].map(em => (
              <button key={em} onClick={() => setIcon(em)}
                style={{ width:36, height:36, border:'none', borderRadius:8, fontSize:18, cursor:'pointer',
                         background: icon === em ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.08)',
                         outline: icon === em ? '1px solid rgba(56,189,248,0.4)' : 'none',
                         transition:'.1s' }}>
                {em}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={() => onApprove({ name: name.trim() || pending.ip, device_type: type, icon, group_name: group })}
            style={{ flex:1, padding:'10px', background:'#22c55e', color:'#fff',
                     border:'none', borderRadius:9, fontWeight:700, fontSize:14, cursor:'pointer' }}>
            ✓ Approve
          </button>
          <button onClick={onClose}
            style={{ padding:'10px 20px', background:'transparent',
                     border:'1px solid rgba(148,163,184,0.2)', borderRadius:9,
                     color:'#94a3b8', fontSize:14, cursor:'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Discovery() {
  const [queue, setQueue]   = useState([])
  const [loading, setLoading] = useState(true)
  const [modalPending, setModalPending] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setQueue(await api.pending.list()) } catch {}
    finally { setLoading(false) }
  }

  async function approve(pending, overrides) {
    try {
      await api.pending.approve(pending.id, overrides)
      setModalPending(null)
      await load()
    } catch(e) { alert('Approve failed: ' + e.message) }
  }

  async function reject(id) {
    try { await api.pending.reject(id); await load() }
    catch(e) { alert('Reject failed: ' + e.message) }
  }

  const pending = queue.filter(d => d.status === 'pending')

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Discovery queue</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:3 }}>
            {pending.length === 0 ? 'No new devices' : `${pending.length} device${pending.length>1?'s':''} waiting for review`}
          </p>
        </div>
        <button onClick={load}
          style={{ padding:'7px 16px', background:'rgba(56,189,248,0.1)',
                   border:'1px solid rgba(56,189,248,0.3)', borderRadius:8,
                   color:'#38bdf8', fontSize:13, cursor:'pointer' }}>
          Refresh
        </button>
      </div>

      {loading && <div style={{ color:'#64748b', textAlign:'center', padding:60 }}>Loading…</div>}

      {!loading && pending.length === 0 && (
        <div style={{ textAlign:'center', padding:80, color:'#64748b' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🔍</div>
          <div style={{ fontSize:16, color:'#94a3b8', marginBottom:6 }}>Queue is clear</div>
          <div style={{ fontSize:13 }}>Run a full scan from the sidebar to discover new devices.</div>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {pending.map(d => {
          const ports = d.open_ports ? JSON.parse(d.open_ports) : []
          const isUnknownMac = d.mac === '00:00:00:00:00:00'
          const typeMatch = DEVICE_TYPES.find(t => t.type === d.detected_type)
          const typeIcon  = typeMatch?.icon || '❓'
          return (
            <div key={d.id} style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                                     borderRadius:12, padding:'16px 20px',
                                     display:'flex', alignItems:'center', gap:16 }}>
              <ConfidenceRing pct={d.confidence} />

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:15, fontFamily:'monospace' }}>{d.ip}</span>
                  <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20,
                                 background:'rgba(56,189,248,0.1)', color:'#38bdf8',
                                 border:'1px solid rgba(56,189,248,0.2)' }}>
                    {typeIcon} {d.detected_type || 'Unknown'}
                  </span>
                  {d.hostname && (
                    <span style={{ fontSize:12, color:'#64748b' }}>{d.hostname}</span>
                  )}
                </div>

                <div style={{ fontSize:12, color:'#64748b', marginBottom:8, display:'flex', gap:12, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'monospace', color: isUnknownMac ? '#475569' : '#94a3b8' }}>
                    {isUnknownMac ? 'MAC unknown (cross-subnet)' : d.mac}
                  </span>
                  {d.manufacturer && d.manufacturer !== 'Unknown' && (
                    <span>🏭 {d.manufacturer}</span>
                  )}
                </div>

                {ports.length > 0 && (
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {ports.map(p => (
                      <span key={p} style={{ fontSize:11, padding:'2px 7px', borderRadius:5,
                                             background:'rgba(148,163,184,0.08)', color:'#64748b' }}>:{p}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                <button onClick={() => setModalPending(d)}
                  style={{ padding:'8px 18px', background:'rgba(34,197,94,0.12)',
                           border:'1px solid rgba(34,197,94,0.3)', borderRadius:8,
                           color:'#22c55e', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  ✓ Approve
                </button>
                <button onClick={() => reject(d.id)}
                  style={{ padding:'8px 14px', background:'rgba(239,68,68,0.08)',
                           border:'1px solid rgba(239,68,68,0.2)', borderRadius:8,
                           color:'#ef4444', fontSize:13, cursor:'pointer' }}>
                  ✕ Reject
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {modalPending && (
        <ApproveModal
          pending={modalPending}
          onClose={() => setModalPending(null)}
          onApprove={overrides => approve(modalPending, overrides)}
        />
      )}
    </div>
  )
}
