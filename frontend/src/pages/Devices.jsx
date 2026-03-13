import { useState, useEffect } from 'react'
import { api } from '../api.js'

const STATUS_COLOR = { online:'#22c55e', offline:'#ef4444', unknown:'#64748b' }

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState({ status:'', group_name:'', verified:'' })
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving]   = useState(false)

  useEffect(() => { load() }, [search, filter])

  async function load() {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (filter.status) params.status = filter.status
      if (filter.group_name) params.group_name = filter.group_name
      if (filter.verified !== '') params.verified = filter.verified
      const data = await api.devices.list(params)
      setDevices(data)
    } catch {} finally {
      setLoading(false)
    }
  }

  function startEdit(d) {
    setEditing(d.id)
    setEditForm({
      name: d.name, device_type: d.device_type,
      icon: d.icon, location: d.location || '',
      group_name: d.group_name || '', vlan: d.vlan || '',
      ip_type: d.ip_type, notes: d.notes || '',
    })
  }

  async function saveEdit(id) {
    setSaving(true)
    try {
      const updated = await api.devices.update(id, editForm)
      setDevices(ds => ds.map(d => d.id === id ? { ...d, ...updated } : d))
      setEditing(null)
    } catch {} finally { setSaving(false) }
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

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700 }}>Devices</h1>
        <span style={{ color:'#64748b', fontSize:13 }}>{devices.length} devices</span>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        <input placeholder="Search name, IP, MAC…" value={search}
               onChange={e => setSearch(e.target.value)}
               style={{ flex:'1 1 200px', padding:'8px 12px', background:'#1e293b',
                        border:'1px solid rgba(148,163,184,0.2)', borderRadius:8, color:'#f1f5f9' }} />
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          style={{ padding:'8px 12px', background:'#1e293b', border:'1px solid rgba(148,163,184,0.2)',
                   borderRadius:8, color:'#f1f5f9' }}>
          <option value="">All status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select value={filter.verified} onChange={e => setFilter(f => ({ ...f, verified: e.target.value }))}
          style={{ padding:'8px 12px', background:'#1e293b', border:'1px solid rgba(148,163,184,0.2)',
                   borderRadius:8, color:'#f1f5f9' }}>
          <option value="">All</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      {loading && <div style={{ color:'#64748b', textAlign:'center', padding:40 }}>Loading…</div>}

      {!loading && devices.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📡</div>
          <div style={{ fontSize:16, marginBottom:8, color:'#94a3b8' }}>No devices yet</div>
          <div style={{ fontSize:14 }}>Run a scan from the sidebar to discover devices on your network.</div>
        </div>
      )}

      {/* Table */}
      {!loading && devices.length > 0 && (
        <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                      borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.1)' }}>
                {['Device','IP','MAC','Type','VLAN','Status',''].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:12,
                                       color:'#64748b', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                editing === d.id
                  ? <EditRow key={d.id} d={d} form={editForm}
                             setForm={setEditForm} saving={saving}
                             onSave={() => saveEdit(d.id)}
                             onCancel={() => setEditing(null)} />
                  : <DeviceRow key={d.id} d={d}
                               onEdit={() => startEdit(d)}
                               onVerify={() => verify(d.id)}
                               onDelete={() => remove(d.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DeviceRow({ d, onEdit, onVerify, onDelete }) {
  return (
    <tr style={{ borderBottom:'1px solid rgba(148,163,184,0.06)',
                 transition:'.1s' }}
        onMouseEnter={e => e.currentTarget.style.background='rgba(148,163,184,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <td style={{ padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                        background: STATUS_COLOR[d.status] || '#64748b' }} />
          <span style={{ fontSize:16 }}>{d.icon || '❓'}</span>
          <div>
            <div style={{ fontWeight:500, fontSize:13 }}>{d.name}</div>
            {d.hostname && <div style={{ fontSize:11, color:'#64748b' }}>{d.hostname}</div>}
          </div>
          {d.verified && <span style={{ fontSize:10, background:'rgba(34,197,94,0.15)',
                                        color:'#22c55e', borderRadius:4, padding:'1px 6px' }}>✓</span>}
        </div>
      </td>
      <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:13, color:'#94a3b8' }}>{d.ip}</td>
      <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:11, color:'#64748b' }}>{d.mac}</td>
      <td style={{ padding:'12px 16px', fontSize:13 }}>{d.device_type}</td>
      <td style={{ padding:'12px 16px' }}>
        {d.vlan && <span style={{ fontSize:11, background:'rgba(56,189,248,0.1)',
                                  color:'#38bdf8', borderRadius:4, padding:'2px 6px' }}>{d.vlan}</span>}
      </td>
      <td style={{ padding:'12px 16px' }}>
        <span style={{ fontSize:12, color: STATUS_COLOR[d.status], textTransform:'capitalize' }}>
          {d.status}
        </span>
      </td>
      <td style={{ padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:6 }}>
          <Btn onClick={onEdit} title="Edit">✏️</Btn>
          {!d.verified && <Btn onClick={onVerify} title="Verify">✅</Btn>}
          <Btn onClick={onDelete} title="Delete" danger>🗑️</Btn>
        </div>
      </td>
    </tr>
  )
}

function EditRow({ d, form, setForm, saving, onSave, onCancel }) {
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  const inp = { padding:'5px 8px', background:'#0f172a', border:'1px solid rgba(148,163,184,0.3)',
                borderRadius:6, color:'#f1f5f9', fontSize:12, width:'100%' }
  return (
    <tr style={{ background:'rgba(56,189,248,0.04)', borderBottom:'1px solid rgba(148,163,184,0.1)' }}>
      <td style={{ padding:'10px 16px' }} colSpan={6}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
          {[
            ['Name', 'name'], ['Icon', 'icon'], ['Type', 'device_type'],
            ['Location', 'location'], ['Group', 'group_name'], ['VLAN', 'vlan'],
          ].map(([label, key]) => (
            <div key={key}>
              <div style={{ fontSize:11, color:'#64748b', marginBottom:3 }}>{label}</div>
              <input style={inp} value={form[key] || ''} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:11, color:'#64748b', marginBottom:3 }}>Notes</div>
            <input style={inp} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
      </td>
      <td style={{ padding:'10px 16px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <button onClick={onSave} disabled={saving}
            style={{ padding:'5px 12px', background:'#22c55e', color:'#fff',
                     border:'none', borderRadius:6, fontSize:12, cursor:'pointer' }}>
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={onCancel}
            style={{ padding:'5px 12px', background:'transparent',
                     border:'1px solid rgba(148,163,184,0.2)', borderRadius:6,
                     color:'#94a3b8', fontSize:12, cursor:'pointer' }}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

function Btn({ onClick, children, title, danger }) {
  return (
    <button onClick={onClick} title={title}
      style={{ padding:'4px 8px', background:'transparent',
               border:`1px solid rgba(148,163,184,${danger?'0.3':'0.15'})`,
               borderRadius:6, cursor:'pointer', fontSize:13 }}>
      {children}
    </button>
  )
}
