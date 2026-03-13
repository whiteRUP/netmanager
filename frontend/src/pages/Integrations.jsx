import { useState, useEffect } from 'react'
import { api } from '../api.js'

const SECTIONS = [
  { key:'adguard',      label:'AdGuard Home',    icon:'🛡️', flat:true },
  { key:'pihole',       label:'Pi-hole',          icon:'🕳️', flat:true },
  { key:'npm',          label:'Nginx Proxy Mgr',  icon:'🔄', flat:true },
  { key:'routers',      label:'Routers',          icon:'📡', flat:true },
  { key:'switches',     label:'Switches',         icon:'🔀', flat:true },
  { key:'dhcp',         label:'DHCP',             icon:'📋', flat:true },
  { key:'technitium',   label:'Technitium DNS',   icon:'🌐', flat:true },
  { key:'powerdns',     label:'PowerDNS',         icon:'⚡', flat:true },
]

const NESTED_SECTIONS = [
  { parentKey:'monitoring', key:'uptime_kuma',      label:'Uptime Kuma',       icon:'📈' },
  { parentKey:'monitoring', key:'netdata',           label:'Netdata',           icon:'📊' },
  { parentKey:'monitoring', key:'ntopng',            label:'ntopng',            icon:'🌊' },
  { parentKey:'monitoring', key:'zabbix',            label:'Zabbix',            icon:'⚠️' },
  { parentKey:'monitoring', key:'smokeping',         label:'Smokeping',         icon:'📡' },
  { parentKey:'monitoring', key:'speedtest_tracker', label:'Speedtest Tracker', icon:'💨' },
  { parentKey:'apps',       key:'home_assistant',    label:'Home Assistant',    icon:'🏠' },
  { parentKey:'apps',       key:'portainer',         label:'Portainer',         icon:'🐳' },
  { parentKey:'apps',       key:'node_red',          label:'Node-RED',          icon:'🔧' },
  { parentKey:'apps',       key:'omv',               label:'OpenMediaVault',    icon:'💾' },
  { parentKey:'apps',       key:'netbox',            label:'Netbox',            icon:'📦' },
]

const NOTIF_SECTIONS = [
  { key:'ntfy',     label:'ntfy',     icon:'🔔', parentKey:'notifications' },
  { key:'telegram', label:'Telegram', icon:'✈️', parentKey:'notifications' },
]

const TUNNEL_SECTIONS = [
  { key:'tailscale',  label:'Tailscale',   icon:'🔐' },
  { key:'cloudflare', label:'Cloudflare',  icon:'☁️' },
]

const SIDEBAR = [
  { group:'DNS & Proxy',  items: SECTIONS.slice(0,3) },
  { group:'Network',      items: SECTIONS.slice(3,6) },
  { group:'DNS Servers',  items: SECTIONS.slice(6) },
  { group:'Monitoring',   items: NESTED_SECTIONS.filter(s => s.parentKey === 'monitoring') },
  { group:'Apps',         items: NESTED_SECTIONS.filter(s => s.parentKey === 'apps') },
  { group:'Notifications',items: NOTIF_SECTIONS },
]

const DEFAULT_FIELDS = {
  url:'', username:'', password:'', api_key:'', api_token:'',
  token:'', bot_token:'', chat_id:'', topic:'',
  tailnet:'', snmp_community:'public', ip:'', email:'',
  name:'', enabled:false, role:'primary',
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}`
}

export default function Integrations() {
  const [config, setConfig]   = useState(null)
  const [active, setActive]   = useState(SECTIONS[0])
  const [expanded, setExpanded] = useState({})
  const [testResults, setTestResults] = useState({})
  const [saving, setSaving]   = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    try { setConfig(await api.integrations.getAll()) } catch {}
  }

  function getList() {
    if (!config) return []
    const sec = active.parentKey
      ? config[active.parentKey]?.[active.key]
      : config[active.key]
    return Array.isArray(sec) ? sec : []
  }

  async function addInstance() {
    const id = makeId(active.key)
    const inst = { ...DEFAULT_FIELDS, id, type: active.key, name: `New ${active.label}` }
    const section = active.parentKey ? active.parentKey : active.key
    const subkey = active.parentKey ? active.key : null

    if (subkey) {
      const updated = [...(config[section]?.[subkey] || []), inst]
      await api.integrations.updateSection(section, { ...config[section], [subkey]: updated })
    } else {
      await api.integrations.upsert(section, id, inst)
    }
    setExpanded(e => ({ ...e, [id]: true }))
    await load()
  }

  async function saveInstance(inst) {
    setSaving(s => ({ ...s, [inst.id]: true }))
    const section = active.parentKey || active.key
    const subkey = active.parentKey ? active.key : null
    try {
      if (subkey) {
        const list = [...(config[section]?.[subkey] || [])]
        const idx = list.findIndex(x => x.id === inst.id)
        if (idx >= 0) list[idx] = inst; else list.push(inst)
        await api.integrations.updateSection(section, { ...config[section], [subkey]: list })
      } else {
        await api.integrations.upsert(section, inst.id, inst)
      }
      await load()
    } catch {}
    setSaving(s => { const n = { ...s }; delete n[inst.id]; return n })
  }

  async function deleteInstance(id) {
    if (!confirm('Delete this integration?')) return
    const section = active.parentKey || active.key
    const subkey = active.parentKey ? active.key : null
    if (subkey) {
      const list = (config[section]?.[subkey] || []).filter(x => x.id !== id)
      await api.integrations.updateSection(section, { ...config[section], [subkey]: list })
    } else {
      await api.integrations.delete(section, id)
    }
    await load()
  }

  async function testConnection(inst) {
    setTestResults(r => ({ ...r, [inst.id]: { loading: true } }))
    try {
      const res = await api.integrations.test({
        type: inst.type || active.key,
        url: inst.url || inst.ip,
        username: inst.username, password: inst.password,
        api_key: inst.api_key, api_token: inst.api_token,
        token: inst.token, bot_token: inst.bot_token,
        chat_id: inst.chat_id,
      })
      setTestResults(r => ({ ...r, [inst.id]: res }))
    } catch (e) {
      setTestResults(r => ({ ...r, [inst.id]: { ok: false, detail: e.message } }))
    }
  }

  const list = getList()

  return (
    <div style={{ display:'flex', gap:0, height:'calc(100vh - 56px)', overflow:'hidden', margin:'-28px' }}>

      {/* Sidebar */}
      <div style={{ width:220, flexShrink:0, borderRight:'1px solid rgba(148,163,184,0.1)',
                    overflowY:'auto', padding:'16px 8px', background:'#0f172a' }}>
        {SIDEBAR.map(group => (
          <div key={group.group} style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'#475569', fontWeight:600, letterSpacing:'.06em',
                          textTransform:'uppercase', padding:'0 10px 6px' }}>{group.group}</div>
            {group.items.map(item => {
              const isActive = active.key === item.key && active.parentKey === item.parentKey
              const count = config
                ? (item.parentKey ? config[item.parentKey]?.[item.key] : config[item.key])?.length || 0
                : 0
              return (
                <button key={item.key} onClick={() => setActive(item)}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8,
                           padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer',
                           background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
                           color: isActive ? '#38bdf8' : '#94a3b8', fontSize:13, textAlign:'left' }}>
                  <span style={{ fontSize:15 }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize:11, background:'rgba(148,163,184,0.15)',
                                   color:'#64748b', borderRadius:8, padding:'1px 6px' }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto', padding:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700 }}>{active.icon} {active.label}</h1>
            <p style={{ fontSize:13, color:'#64748b', marginTop:3 }}>
              Add multiple instances — each saved automatically to integrations.json
            </p>
          </div>
          <button onClick={addInstance}
            style={{ padding:'8px 18px', background:'rgba(56,189,248,0.1)',
                     border:'1px solid rgba(56,189,248,0.3)', borderRadius:8,
                     color:'#38bdf8', fontSize:13, cursor:'pointer' }}>
            + Add instance
          </button>
        </div>

        {!config && <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>}

        {config && list.length === 0 && (
          <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>{active.icon}</div>
            <div style={{ fontSize:15, color:'#94a3b8', marginBottom:6 }}>No {active.label} instances</div>
            <div style={{ fontSize:13 }}>Click "Add instance" to configure your first one.</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {list.map(inst => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              open={!!expanded[inst.id]}
              testResult={testResults[inst.id]}
              saving={!!saving[inst.id]}
              onToggle={() => setExpanded(e => ({ ...e, [inst.id]: !e[inst.id] }))}
              onSave={updated => saveInstance(updated)}
              onDelete={() => deleteInstance(inst.id)}
              onTest={() => testConnection(inst)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function InstanceCard({ inst, open, testResult, saving, onToggle, onSave, onDelete, onTest }) {
  const [form, setForm] = useState({ ...inst })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { setForm({ ...inst }) }, [inst])

  const hasUrl = form.url !== undefined
  const hasIp = !hasUrl && form.ip !== undefined

  const fields = [
    ['Display name', 'name', 'text'],
    hasUrl && ['URL', 'url', 'url'],
    hasIp && ['IP address', 'ip', 'text'],
    form.email !== undefined && ['Email', 'email', 'email'],
    form.username !== undefined && ['Username', 'username', 'text'],
    form.password !== undefined && ['Password', 'password', 'password'],
    form.api_key !== undefined && ['API key', 'api_key', 'password'],
    form.api_token !== undefined && ['API token', 'api_token', 'password'],
    form.token !== undefined && ['Long-lived token', 'token', 'password'],
    form.bot_token !== undefined && ['Bot token', 'bot_token', 'password'],
    form.chat_id !== undefined && ['Chat ID', 'chat_id', 'text'],
    form.topic !== undefined && ['Topic', 'topic', 'text'],
    form.tailnet !== undefined && ['Tailnet', 'tailnet', 'text'],
    form.snmp_community !== undefined && ['SNMP community', 'snmp_community', 'text'],
  ].filter(Boolean)

  return (
    <div style={{ background:'#1e293b', border:'1px solid rgba(148,163,184,0.1)',
                  borderRadius:12, overflow:'hidden' }}>
      {/* Header */}
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:14,
                                        padding:'14px 18px', cursor:'pointer' }}
           onMouseEnter={e => e.currentTarget.style.background='rgba(148,163,184,0.04)'}
           onMouseLeave={e => e.currentTarget.style.background='transparent'}>
        <div style={{ width:36, height:36, borderRadius:8, background:'rgba(148,163,184,0.08)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>
          {form.enabled ? '🟢' : '⚫'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:500, fontSize:14 }}>{form.name}</div>
          <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace' }}>
            {form.url || form.ip || '—'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {form.role && (
            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6,
                           background: form.role === 'primary' ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.1)',
                           color: form.role === 'primary' ? '#38bdf8' : '#94a3b8' }}>
              {form.role}
            </span>
          )}
          <span style={{ fontSize:12, color: form.enabled ? '#22c55e' : '#64748b' }}>
            {form.enabled ? 'enabled' : 'disabled'}
          </span>
          <span style={{ color:'#64748b', transition:'.2s',
                         transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ borderTop:'1px solid rgba(148,163,184,0.08)', padding:'18px 18px 14px' }}>
          {/* Enabled toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={form.enabled}
                     onChange={e => set('enabled', e.target.checked)} />
              Enabled
            </label>
            {form.role !== undefined && (
              <select value={form.role} onChange={e => set('role', e.target.value)}
                style={{ padding:'4px 10px', fontSize:12, background:'#0f172a',
                         border:'1px solid rgba(148,163,184,0.2)', borderRadius:6, color:'#f1f5f9' }}>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            )}
          </div>

          {/* Fields grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            {fields.map(([label, key, type]) => (
              <div key={key} style={{ gridColumn: ['name','url','api_key','api_token','token','bot_token'].includes(key) ? '1/-1' : 'auto' }}>
                <div style={{ fontSize:12, color:'#94a3b8', marginBottom:5 }}>{label}</div>
                <input
                  type={type === 'password' ? 'password' : 'text'}
                  value={form[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={type === 'password' ? '••••••••' : ''}
                  style={{ width:'100%', padding:'8px 12px', background:'#0f172a',
                           border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                           color:'#f1f5f9', fontSize:13 }}
                />
              </div>
            ))}
          </div>

          {/* Test result */}
          {testResult && !testResult.loading && (
            <div style={{ padding:'8px 12px', borderRadius:8, marginBottom:12, fontSize:13,
                          background: testResult.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: testResult.ok ? '#22c55e' : '#ef4444',
                          border: `1px solid ${testResult.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
              {testResult.ok ? `✓ ${testResult.detail}` : `✕ ${testResult.detail}`}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => onSave(form)} disabled={saving}
              style={{ padding:'7px 18px', background:'#38bdf8', color:'#0f172a',
                       border:'none', borderRadius:8, fontWeight:600, fontSize:13, cursor:'pointer' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onTest}
              disabled={testResult?.loading}
              style={{ padding:'7px 16px', background:'transparent',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                       color:'#94a3b8', fontSize:13, cursor:'pointer' }}>
              {testResult?.loading ? 'Testing…' : 'Test connection'}
            </button>
            <button onClick={onDelete}
              style={{ marginLeft:'auto', padding:'7px 14px', background:'rgba(239,68,68,0.08)',
                       border:'1px solid rgba(239,68,68,0.2)', borderRadius:8,
                       color:'#ef4444', fontSize:13, cursor:'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
