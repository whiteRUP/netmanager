import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api.js'
import { DEVICE_TYPES, ICON_PALETTE, typeToIcon, typeToColor } from '../deviceTypes.js'

const STATUS_COLOR = { online: 'var(--green)', offline: 'var(--red)', unknown: 'var(--text3)' }
const IP_TYPES = ['unknown', 'dynamic', 'static', 'reserved', 'conflict']

export default function Devices() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)

  const [devices,    setDevices]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState({
    status:   params.get('status') || '',
    verified: '',
  })
  const [editDevice, setEditDevice] = useState(null)

  useEffect(() => { load() }, [search, filter])

  async function load() {
    setLoading(true)
    try {
      const p = {}
      if (search)                p.search   = search
      if (filter.status)         p.status   = filter.status
      if (filter.verified !== '') p.verified = filter.verified
      setDevices(await api.devices.list(p))
    } catch {} finally { setLoading(false) }
  }

  async function verify(id) {
    await api.devices.verify(id)
    setDevices(ds => ds.map(d => d.id === id ? { ...d, verified: true } : d))
  }

  async function remove(id) {
    if (!confirm('Delete this device? This cannot be undone.')) return
    await api.devices.delete(id)
    setDevices(ds => ds.filter(d => d.id !== id))
  }

  function onSaved(updated) {
    setDevices(ds => ds.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    setEditDevice(null)
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Devices</h1>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search name, IP, MAC, hostname…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input"
          style={{ flex: '1 1 200px' }}
        />
        <SSelect value={filter.status} onChange={v => setFilter(f => ({ ...f, status: v }))}
          options={[['', 'All status'], ['online', 'Online'], ['offline', 'Offline'], ['unknown', 'Unknown']]} />
        <SSelect value={filter.verified} onChange={v => setFilter(f => ({ ...f, verified: v }))}
          options={[['', 'All'], ['true', 'Verified'], ['false', 'Unverified']]} />
        <button onClick={load} className="btn btn-ghost btn-sm">↻</button>
      </div>

      {loading && <Skeleton />}

      {!loading && devices.length === 0 && (
        <div className="empty">
          <div className="empty-icon">📡</div>
          <div className="empty-title">No devices found</div>
          <div className="empty-sub">Run a scan from the sidebar to discover devices on your network.</div>
        </div>
      )}

      {!loading && devices.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                {['Device', 'IP Address', 'MAC', 'Type', 'VLAN', 'Status', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <DeviceRow key={d.id} device={d}
                  onEdit={() => setEditDevice(d)}
                  onVerify={() => verify(d.id)}
                  onDelete={() => remove(d.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editDevice && (
        <EditModal
          device={editDevice}
          onClose={() => setEditDevice(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}

function DeviceRow({ device: d, onEdit, onVerify, onDelete }) {
  const icon = d.icon || typeToIcon(d.device_type)
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`dot dot-${d.status}`} />
          <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
          <div>
            <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {d.name}
              {d.verified && (
                <span title="Verified" style={{
                  fontSize: 10, background: 'rgba(34,197,94,.12)', color: 'var(--green)',
                  border: '1px solid rgba(34,197,94,.25)', borderRadius: 99, padding: '1px 6px',
                }}>✓ verified</span>
              )}
            </div>
            {d.hostname && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{d.hostname}</div>}
          </div>
        </div>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text2)' }}>{d.ip}</td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
        {d.mac === '00:00:00:00:00:00'
          ? <span style={{ fontStyle: 'italic', color: 'var(--text3)' }}>unknown</span>
          : d.mac}
      </td>
      <td>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{d.device_type || 'Unknown'}</div>
        {d.manufacturer && d.manufacturer !== 'Unknown' && (
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{d.manufacturer}</div>
        )}
      </td>
      <td>
        {d.vlan && (
          <span className="badge badge-blue" style={{ fontSize: 10 }}>{d.vlan}</span>
        )}
      </td>
      <td>
        <span style={{ fontSize: 12, color: STATUS_COLOR[d.status] || 'var(--text3)', textTransform: 'capitalize' }}>
          {d.status}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onEdit} className="btn btn-ghost btn-sm" title="Edit">✏️</button>
          {!d.verified && <button onClick={onVerify} className="btn btn-ghost btn-sm" title="Verify">✅</button>}
          {d.web_url && (
            <a href={d.web_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open web UI">🔗</a>
          )}
          <button onClick={onDelete} className="btn btn-danger btn-sm" title="Delete">🗑️</button>
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
    manufacturer: device.manufacturer || '',
    hostname:     device.hostname     || '',
    location:     device.location     || '',
    group_name:   device.group_name   || 'General',
    vlan:         device.vlan         || '',
    ip_type:      device.ip_type      || 'unknown',
    web_url:      device.web_url      || '',
    notes:        device.notes        || '',
  })
  const [extraTypes,  setExtraTypes]  = useState(() => {
    const known = DEVICE_TYPES.map(d => d.type)
    return device.device_type && !known.includes(device.device_type) ? [device.device_type] : []
  })
  const [addingType, setAddingType] = useState(false)
  const [customType, setCustomType] = useState('')
  const [saving,   setSaving] = useState(false)
  const [error,    setError]  = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function pickType(t) {
    set('device_type', t)
    if (form.icon === '❓' || form.icon === typeToIcon(form.device_type)) {
      set('icon', typeToIcon(t))
    }
  }

  function confirmCustom() {
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
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const allTypes = [...DEVICE_TYPES.map(d => d.type), ...extraTypes]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>{form.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{device.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                {device.ip}{device.mac && device.mac !== '00:00:00:00:00:00' && ` · ${device.mac}`}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          )}

          {/* Name + Manufacturer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div className="field"><label>Display name</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="field"><label>Manufacturer</label><input className="input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} /></div>
          </div>

          {/* Type chips */}
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Device type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 10, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              {allTypes.map(t => {
                const color = typeToColor(t)
                const active = form.device_type === t
                return (
                  <button key={t} onClick={() => pickType(t)}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 99, cursor: 'pointer',
                      transition: 'var(--transition)',
                      border: active ? `1px solid ${color}` : '1px solid var(--border2)',
                      background: active ? color + '20' : 'transparent',
                      color: active ? color : 'var(--text2)',
                    }}>
                    {typeToIcon(t)} {t}
                  </button>
                )
              })}
              {addingType ? (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input value={customType} onChange={e => setCustomType(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && confirmCustom()}
                    placeholder="Type name…" autoFocus
                    style={{ width: 120, padding: '4px 10px', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 99, color: 'var(--text)', outline: 'none' }} />
                  <button onClick={confirmCustom} className="btn btn-primary btn-sm">Add</button>
                  <button onClick={() => { setAddingType(false); setCustomType('') }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setAddingType(true)}
                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 99, cursor: 'pointer', border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text3)' }}>
                  + Add type
                </button>
              )}
            </div>
          </div>

          {/* Icon picker */}
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Icon — current: {form.icon}</label>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 10, border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {ICON_PALETTE.map(em => (
                <button key={em} onClick={() => set('icon', em)}
                  style={{
                    width: 32, height: 32, fontSize: 17, cursor: 'pointer', borderRadius: 6,
                    border: form.icon === em ? '2px solid var(--accent)' : '1px solid transparent',
                    background: form.icon === em ? 'rgba(59,130,246,.15)' : 'rgba(99,120,172,.06)',
                  }}>{em}</button>
              ))}
            </div>
          </div>

          {/* Other fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="field"><label>Hostname</label><input className="input" value={form.hostname} onChange={e => set('hostname', e.target.value)} /></div>
            <div className="field"><label>Location</label><input className="input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Living room, Rack 1…" /></div>
            <div className="field"><label>Group</label><input className="input" value={form.group_name} onChange={e => set('group_name', e.target.value)} placeholder="IoT, Servers…" /></div>
            <div className="field"><label>VLAN</label><input className="input" value={form.vlan} onChange={e => set('vlan', e.target.value)} placeholder="VLAN10, 192.168.10.x…" /></div>
            <div className="field"><label>IP type</label>
              <select className="input" value={form.ip_type} onChange={e => set('ip_type', e.target.value)}>
                {IP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Web UI URL</label><input className="input" value={form.web_url} onChange={e => set('web_url', e.target.value)} placeholder="http://192.168.1.1" /></div>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Notes</label>
            <textarea className="input" value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Optional notes…"
              style={{ resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input" style={{ width: 'auto', flex: 'none' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function Skeleton() {
  return (
    <div className="card" style={{ padding: 0 }}>
      {Array(6).fill(0).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 4 }} />
          <div className="skeleton" style={{ flex: 1, height: 20, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 100, height: 20, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
