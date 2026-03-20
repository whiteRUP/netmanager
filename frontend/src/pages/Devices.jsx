import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { DEVICE_TYPES, ICON_PALETTE, typeToIcon } from '../deviceTypes.js'

const STATUS_COLOR = { online:'#22c55e', offline:'#ef4444', unknown:'#64748b' }
const IP_TYPES = ['unknown','dynamic','static','reserved','conflict']

export default function Devices() {
  const [devices, setDevices]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState({ status:'', verified:'' })
  const [editModal, setEditModal] = useState(null)

  useEffect(() => { load() }, [search, filter])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (search)               params.search   = search
      if (filter.status)        params.status   = filter.status
      if (filter.verified !== '') params.verified = filter.verified
      setDevices(await api.devices.list(params))
    } catch {} finally { setLoading(false) }
  }

  async function verify(id) {
    await api.devices.verify(id)
    setDevices(ds => ds.map(d => d.id === id ? { ...d, verified: true } : d))
  }

  async function remove(id) {
    if (!confirm('Delete this device?')) return
    await api.devices.delete(id)
    setDevices(ds => ds.filter(d => d.id !== id))
  }

  function handleSaved(updated) {
    setDevices(ds => ds.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    setEditModal(null)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Devices</h1>
        <span style={{ color:'#64748b', fontSize:13 }}>{devices.length} devices</span>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input placeholder="Search name, IP, MAC, hostname…" value={search}
               onChange={e => setSearch(e.target.value)}
               style={{ flex:'1 1 220px', padding:'8px 12px', background:'#1e293b',
                        border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                        color:'#f1f5f9', fontSize:13 }} />
        <SSelect value={filter.status} onChange={v => setFilter(f => ({ ...f, status: v }))}
          options={[['','All status'],['online','Online'],['offline','Offline'],['unknown','Unknown']]} />
        <SSelect value={filter.verified} onChange={v => setFilter(f => ({ ...f, verified: v }))}
          options={[['','All'],['true','Verified'],['false','Unverified']]} />
        <button onClick={load}
          style={{ padding:'8px 14px', background:'rgba(56,189,248,0.1)',
                   border:'1px solid rgba(56,189,248,0.2)', borderRadius:8,
                   color:'#38bdf8', fontSize:13, cursor:'pointer' }}>↻</button>
      </div>

      {loading && <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>}

      {!loading && devices.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
          <div style={{ fontSize:15, color:'#94a3b8' }}>No devices found</div>
          <div style={{ fontSize:13, marginTop:6 }}>Run a scan from the sidebar to discover devices.</div>
        </div>
      )}

      {!loading && devices.length > 0 && (
        <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                      borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.1)' }}>
                {['Device','IP','MAC','Type','VLAN','Status',''].map(h => (
                  <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:11,
                                       color:'#64748b', fontWeight:600, letterSpacing:'.04em',
                                       textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <DeviceRow key={d.id} d={d}
                  onEdit={() => setEditModal(d)}
                  onVerify={() => verify(d.id)}
                  onDelete={() => remove(d.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editModal && (
        <EditModal device={editModal} onClose={() => setEditModal(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

function DeviceRow({ d, onEdit, onVerify, onDelete }) {
  const icon = d.icon || typeToIcon(d.device_type)
  return (
    <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.06)' }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(148,163,184,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <td style={{ padding:'11px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                        background: STATUS_COLOR[d.status] || '#64748b' }} />
          <span style={{ fontSize:18 }}>{icon}</span>
          <div>
            <div style={{ fontWeight:500, fontSize:13 }}>{d.name}</div>
            {d.hostname && <div style={{ fontSize:11, color:'#64748b' }}>{d.hostname}</div>}
          </div>
          {d.verified && (
            <span style={{ fontSize:10, background:'rgba(34,197,94,0.12)',
                           color:'#22c55e', borderRadius:4, padding:'1px 6px' }}>✓</span>
          )}
        </div>
      </td>
      <td style={{ padding:'11px 14px', fontFamily:'monospace', fontSize:12, color:'#94a3b8' }}>{d.ip}</td>
      <td style={{ padding:'11px 14px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>
        {d.mac === '00:00:00:00:00:00'
          ? <span style={{ color:'#334155', fontStyle:'italic' }}>unknown</span>
          : d.mac}
      </td>
      <td style={{ padding:'11px 14px' }}>
        <div style={{ fontSize:12, color:'#cbd5e1' }}>{d.device_type || 'Unknown'}</div>
        {d.manufacturer && d.manufacturer !== 'Unknown' && (
          <div style={{ fontSize:11, color:'#475569' }}>{d.manufacturer}</div>
        )}
      </td>
      <td style={{ padding:'11px 14px' }}>
        {d.vlan && (
          <span style={{ fontSize:11, background:'rgba(56,189,248,0.1)',
                         color:'#38bdf8', borderRadius:4, padding:'2px 6px' }}>{d.vlan}</span>
        )}
      </td>
      <td style={{ padding:'11px 14px' }}>
        <span style={{ fontSize:12, color: STATUS_COLOR[d.status], textTransform:'capitalize' }}>
          {d.status}
        </span>
      </td>
      <td style={{ padding:'11px 14px' }}>
        <div style={{ display:'flex', gap:5 }}>
          <Btn onClick={onEdit} title="Edit">✏️</Btn>
          {!d.verified && <Btn onClick={onVerify} title="Mark verified">✅</Btn>}
          <Btn onClick={onDelete} title="Delete" danger>🗑️</Btn>
        </div>
      </td>
    </tr>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────

function EditModal({ device, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:         device.name         || '',
    device_type:  device.device_type  || 'Unknown',
    icon:         device.icon         || typeToIcon(device.device_type) || '❓',
    location:     device.location     || '',
    group_name:   device.group_name   || 'General',
    vlan:         device.vlan         || '',
    ip_type:      device.ip_type      || 'unknown',
    notes:        device.notes        || '',
    manufacturer: device.manufacturer || '',
  })
  const [customType,  setCustomType]  = useState('')
  const [addingType,  setAddingType]  = useState(false)
  const [extraTypes,  setExtraTypes]  = useState(() => {
    const known = DEVICE_TYPES.map(d => d.type)
    return device.device_type && !known.includes(device.device_type) ? [device.device_type] : []
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function pickType(t) {
    set('device_type', t)
    // Auto-set icon only if current icon is default unknown
    const suggestedIcon = typeToIcon(t)
    if (form.icon === '❓' || form.icon === typeToIcon(form.device_type)) {
      set('icon', suggestedIcon)
    }
  }

  function confirmCustomType() {
    const t = customType.trim()
    if (!t) return
    if (!extraTypes.includes(t)) setExtraTypes(et => [...et, t])
    pickType(t)
    setAddingType(false)
    setCustomType('')
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const updated = await api.devices.update(device.id, form)
      onSaved({ ...device, ...form, ...(updated || {}) })
    } catch(e) {
      setError(e.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const allTypes = [...DEVICE_TYPES.map(d => d.type), ...extraTypes]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000,
                  display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#1e293b', borderRadius:16, width:'100%', maxWidth:640,
                    maxHeight:'90vh', overflowY:'auto',
                    border:'1px solid rgba(148,163,184,0.15)' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(148,163,184,0.1)',
                      display:'flex', alignItems:'center', gap:12, position:'sticky',
                      top:0, background:'#1e293b', zIndex:1 }}>
          <span style={{ fontSize:24 }}>{form.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>{device.name}</div>
            <div style={{ fontFamily:'monospace', fontSize:12, color:'#64748b' }}>
              {device.ip}
              {device.mac !== '00:00:00:00:00:00' && ` · ${device.mac}`}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background:'transparent', border:'none', color:'#64748b',
                     fontSize:22, cursor:'pointer', lineHeight:1, padding:'0 4px' }}>×</button>
        </div>

        <div style={{ padding:'20px 22px' }}>
          {error && (
            <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                          borderRadius:8, padding:'8px 12px', color:'#ef4444',
                          fontSize:13, marginBottom:16 }}>{error}</div>
          )}

          {/* Name + Manufacturer */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
            <Field label="Display name"><Inp value={form.name} onChange={v => set('name', v)} /></Field>
            <Field label="Manufacturer"><Inp value={form.manufacturer} onChange={v => set('manufacturer', v)} /></Field>
          </div>

          {/* Type chips */}
          <Field label="Device type" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, padding:'10px', background:'#0f172a',
                          borderRadius:10, border:'1px solid rgba(148,163,184,0.1)' }}>
              {allTypes.map(t => (
                <button key={t} onClick={() => pickType(t)}
                  style={{ padding:'5px 11px', fontSize:12, borderRadius:20, cursor:'pointer',
                           transition:'.15s',
                           border: form.device_type === t ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                           background: form.device_type === t ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.04)',
                           color: form.device_type === t ? '#38bdf8' : '#94a3b8' }}>
                  {typeToIcon(t)} {t}
                </button>
              ))}
              {addingType ? (
                <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                  <input value={customType} onChange={e => setCustomType(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmCustomType()}
                    placeholder="Custom type…" autoFocus
                    style={{ padding:'5px 10px', fontSize:12, background:'#1e293b',
                             border:'1px solid rgba(56,189,248,0.4)', borderRadius:20,
                             color:'#f1f5f9', width:130 }} />
                  <button onClick={confirmCustomType}
                    style={{ padding:'5px 10px', fontSize:12, background:'rgba(56,189,248,0.15)',
                             border:'1px solid rgba(56,189,248,0.3)', borderRadius:20,
                             color:'#38bdf8', cursor:'pointer' }}>Add</button>
                  <button onClick={() => { setAddingType(false); setCustomType('') }}
                    style={{ fontSize:14, background:'transparent', border:'none',
                             color:'#64748b', cursor:'pointer' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingType(true)}
                  style={{ padding:'5px 11px', fontSize:12, borderRadius:20, cursor:'pointer',
                           border:'1px dashed rgba(148,163,184,0.25)',
                           background:'transparent', color:'#64748b' }}>
                  + Add type
                </button>
              )}
            </div>
          </Field>

          {/* Icon picker */}
          <Field label="Icon" style={{ marginBottom:18 }}>
            <div style={{ background:'#0f172a', borderRadius:10, padding:10,
                          border:'1px solid rgba(148,163,184,0.1)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'rgba(56,189,248,0.1)',
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                  {form.icon}
                </div>
                <span style={{ fontSize:12, color:'#64748b' }}>Click any emoji to change</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
                {ICON_PALETTE.map(em => (
                  <button key={em} onClick={() => set('icon', em)} title={em}
                    style={{ width:32, height:32, fontSize:17, cursor:'pointer', borderRadius:6,
                             transition:'.1s',
                             border: form.icon === em ? '2px solid #38bdf8' : '1px solid transparent',
                             background: form.icon === em ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.04)' }}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          {/* Location, Group, VLAN, IP type */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <Field label="Location">
              <Inp value={form.location} onChange={v => set('location', v)} placeholder="e.g. Living room" />
            </Field>
            <Field label="Group">
              <Inp value={form.group_name} onChange={v => set('group_name', v)} placeholder="e.g. IoT, Servers" />
            </Field>
            <Field label="VLAN">
              <Inp value={form.vlan} onChange={v => set('vlan', v)} placeholder="e.g. VLAN10" />
            </Field>
            <Field label="IP type">
              <select value={form.ip_type} onChange={e => set('ip_type', e.target.value)}
                style={{ width:'100%', padding:'8px 10px', background:'#0f172a', color:'#f1f5f9',
                         border:'1px solid rgba(148,163,184,0.2)', borderRadius:8, fontSize:13 }}>
                {IP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Notes" style={{ marginBottom:20 }}>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Optional notes…"
              style={{ width:'100%', padding:'8px 10px', background:'#0f172a', color:'#f1f5f9',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                       fontSize:13, resize:'vertical', boxSizing:'border-box' }} />
          </Field>

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save} disabled={saving}
              style={{ padding:'9px 24px', background:'#38bdf8', color:'#0f172a',
                       border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={onClose}
              style={{ padding:'9px 18px', background:'transparent',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                       color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize:11, color:'#64748b', marginBottom:5, fontWeight:600,
                    textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</div>
      {children}
    </div>
  )
}
function Inp({ value, onChange, placeholder }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width:'100%', padding:'8px 10px', background:'#0f172a', color:'#f1f5f9',
               border:'1px solid rgba(148,163,184,0.2)', borderRadius:8, fontSize:13,
               boxSizing:'border-box' }} />
  )
}
function SSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding:'8px 12px', background:'#1e293b',
               border:'1px solid rgba(148,163,184,0.2)',
               borderRadius:8, color:'#f1f5f9', fontSize:13 }}>
      {options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}
function Btn({ onClick, children, title, danger }) {
  return (
    <button onClick={onClick} title={title}
      style={{ padding:'4px 8px', background:'transparent', cursor:'pointer', fontSize:13,
               border:`1px solid rgba(148,163,184,${danger?'0.25':'0.12'})`, borderRadius:6 }}>
      {children}
    </button>
  )
}
