import { useState, useEffect, useCallback } from 'react'
import { api } from '../api.js'

const ALL_INTEGRATIONS = [
  { key:'adguard',           label:'AdGuard Home',      icon:'🛡️',  group:'DNS & Proxy',   nested:null,            fields:['name','url','username','password'] },
  { key:'pihole',            label:'Pi-hole',            icon:'🕳️',  group:'DNS & Proxy',   nested:null,            fields:['name','url','api_key'] },
  { key:'technitium',        label:'Technitium DNS',     icon:'🌐',  group:'DNS & Proxy',   nested:null,            fields:['name','url','api_token'] },
  { key:'powerdns',          label:'PowerDNS',           icon:'⚡',  group:'DNS & Proxy',   nested:null,            fields:['name','url','api_key'] },
  { key:'npm',               label:'Nginx Proxy Mgr',   icon:'🔄',  group:'DNS & Proxy',   nested:null,            fields:['name','url','username','password'] },
  { key:'routers',           label:'Routers',            icon:'📡',  group:'Network',       nested:null,            fields:['name','ip','username','password','snmp_community'] },
  { key:'switches',          label:'Switches',           icon:'🔀',  group:'Network',       nested:null,            fields:['name','ip','username','password','snmp_community'] },
  { key:'dhcp',              label:'DHCP',               icon:'📋',  group:'Network',       nested:null,            fields:['name','url','api_key'] },
  { key:'uptime_kuma',       label:'Uptime Kuma',        icon:'📈',  group:'Monitoring',    nested:'monitoring',    fields:['name','url','username','password'] },
  { key:'netdata',           label:'Netdata',            icon:'📊',  group:'Monitoring',    nested:'monitoring',    fields:['name','url','api_key'] },
  { key:'ntopng',            label:'ntopng',             icon:'🌊',  group:'Monitoring',    nested:'monitoring',    fields:['name','url','username','password'] },
  { key:'zabbix',            label:'Zabbix',             icon:'⚠️',  group:'Monitoring',    nested:'monitoring',    fields:['name','url','username','password'] },
  { key:'smokeping',         label:'Smokeping',          icon:'💨',  group:'Monitoring',    nested:'monitoring',    fields:['name','url'] },
  { key:'speedtest_tracker', label:'Speedtest Tracker',  icon:'🚀',  group:'Monitoring',    nested:'monitoring',    fields:['name','url','api_key'] },
  { key:'home_assistant',    label:'Home Assistant',     icon:'🏠',  group:'Apps',          nested:'apps',          fields:['name','url','token'] },
  { key:'portainer',         label:'Portainer',          icon:'🐳',  group:'Apps',          nested:'apps',          fields:['name','url','api_key'] },
  { key:'node_red',          label:'Node-RED',           icon:'🔧',  group:'Apps',          nested:'apps',          fields:['name','url','username','password'] },
  { key:'omv',               label:'OpenMediaVault',     icon:'💾',  group:'Apps',          nested:'apps',          fields:['name','url','username','password'] },
  { key:'netbox',            label:'Netbox',             icon:'📦',  group:'Apps',          nested:'apps',          fields:['name','url','api_token'] },
  { key:'ntfy',              label:'ntfy',               icon:'🔔',  group:'Notifications', nested:'notifications', fields:['name','url','topic','token'] },
  { key:'telegram',          label:'Telegram',           icon:'✈️',  group:'Notifications', nested:'notifications', fields:['name','bot_token','chat_id'] },
]
const FIELD_LABELS    = { name:'Display name', url:'URL', ip:'IP address', username:'Username', password:'Password', api_key:'API key', api_token:'API token', token:'Long-lived token', bot_token:'Bot token', chat_id:'Chat ID', topic:'Topic', snmp_community:'SNMP community' }
const PASSWORD_FIELDS = new Set(['password','api_key','api_token','token','bot_token'])
const WIDE_FIELDS     = new Set(['name','url','api_key','api_token','token','bot_token'])
const GROUPS          = [...new Set(ALL_INTEGRATIONS.map(i => i.group))]

function makeId(k) { return `${k}-${Date.now()}` }
function blankInstance(integ) {
  const inst = { id: makeId(integ.key), type: integ.key, name: `New ${integ.label}`, enabled: false, role: 'primary' }
  for (const f of integ.fields) if (!(f in inst)) inst[f] = ''
  return inst
}
function getList(config, integ) {
  if (!config || !integ) return []
  const raw = integ.nested ? config[integ.nested]?.[integ.key] : config[integ.key]
  return Array.isArray(raw) ? raw : []
}
async function saveList(config, integ, newList) {
  if (integ.nested) {
    const current = config[integ.nested] || {}
    await api.integrations.updateSection(integ.nested, { ...current, [integ.key]: newList })
  } else {
    await api.integrations.updateSection(integ.key, newList)
  }
}

export default function Integrations() {
  const [config, setConfig]           = useState(null)
  const [loadErr, setLoadErr]         = useState('')
  const [active, setActive]           = useState(ALL_INTEGRATIONS[0])
  const [expanded, setExpanded]       = useState({})
  const [testResults, setTestResults] = useState({})
  const [saving, setSaving]           = useState({})
  const [adding, setAdding]           = useState(false)
  const [addError, setAddError]       = useState('')

  const load = useCallback(async () => {
    try { setLoadErr(''); setConfig(await api.integrations.getAll()) }
    catch(e) { setLoadErr(e.message || 'Failed to load') }
  }, [])

  useEffect(() => { load() }, [load])

  async function addInstance() {
    if (!config) return
    setAdding(true); setAddError('')
    try {
      const inst = blankInstance(active)
      await saveList(config, active, [...getList(config, active), inst])
      setExpanded(e => ({ ...e, [inst.id]: true }))
      await load()
    } catch(e) { setAddError(e.message || 'Add failed — check backend logs') }
    finally    { setAdding(false) }
  }

  async function saveInstance(updated) {
    setSaving(s => ({ ...s, [updated.id]: true }))
    try {
      const list = getList(config, active)
      const idx  = list.findIndex(x => x.id === updated.id)
      const next = idx >= 0 ? list.map((x,i) => i===idx ? updated : x) : [...list, updated]
      await saveList(config, active, next)
      await load()
    } catch(e) { alert('Save failed: ' + e.message) }
    finally    { setSaving(s => { const n={...s}; delete n[updated.id]; return n }) }
  }

  async function deleteInstance(id) {
    if (!window.confirm('Delete this integration?')) return
    try {
      await saveList(config, active, getList(config, active).filter(x => x.id !== id))
      await load()
    } catch(e) { alert('Delete failed: ' + e.message) }
  }

  async function testConnection(inst) {
    setTestResults(r => ({ ...r, [inst.id]: { loading: true } }))
    try {
      const res = await api.integrations.test({
        type: inst.type || active.key, url: inst.url || inst.ip,
        username: inst.username, password: inst.password,
        api_key: inst.api_key, api_token: inst.api_token,
        token: inst.token, bot_token: inst.bot_token, chat_id: inst.chat_id,
      })
      setTestResults(r => ({ ...r, [inst.id]: res }))
    } catch(e) { setTestResults(r => ({ ...r, [inst.id]: { ok: false, detail: e.message } })) }
  }

  const list = getList(config, active)
  return (
    <div style={{ display:'flex', height:'calc(100vh - 56px)', overflow:'hidden', margin:'-28px' }}>
      {/* Sidebar */}
      <div style={{ width:230, flexShrink:0, borderRight:'1px solid rgba(148,163,184,0.1)',
                    overflowY:'auto', padding:'16px 8px', background:'#0f172a' }}>
        {GROUPS.map(group => (
          <div key={group} style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, color:'#475569', fontWeight:600, letterSpacing:'.06em',
                          textTransform:'uppercase', padding:'0 10px 8px' }}>{group}</div>
            {ALL_INTEGRATIONS.filter(i => i.group === group).map(integ => {
              const count    = config ? getList(config, integ).length : 0
              const isActive = active.key === integ.key
              return (
                <button key={integ.key}
                  onClick={() => { setActive(integ); setAddError('') }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8,
                           padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer',
                           background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
                           color: isActive ? '#38bdf8' : '#94a3b8', fontSize:13, textAlign:'left' }}>
                  <span style={{ fontSize:15 }}>{integ.icon}</span>
                  <span style={{ flex:1 }}>{integ.label}</span>
                  {count > 0 && (
                    <span style={{ fontSize:11, background:'rgba(148,163,184,0.12)',
                                   color:'#64748b', borderRadius:8, padding:'1px 7px' }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex:1, overflowY:'auto', padding:28 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{active.icon} {active.label}</h1>
            <p style={{ fontSize:13, color:'#64748b' }}>Saved to <code style={{ color:'#94a3b8' }}>integrations.json</code></p>
          </div>
          <button onClick={addInstance} disabled={adding || !config}
            style={{ padding:'9px 22px', minWidth:140,
                     background: adding||!config ? 'rgba(148,163,184,0.05)' : 'rgba(56,189,248,0.12)',
                     border: `1px solid ${adding||!config ? 'rgba(148,163,184,0.15)' : 'rgba(56,189,248,0.35)'}`,
                     borderRadius:8, color: adding||!config ? '#475569' : '#38bdf8',
                     fontSize:13, fontWeight:600, cursor: adding||!config ? 'default' : 'pointer' }}>
            {adding ? '⏳ Adding…' : '＋ Add instance'}
          </button>
        </div>

        {loadErr && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                        borderRadius:8, padding:'10px 14px', color:'#ef4444', fontSize:13, marginBottom:16 }}>
            ⚠️ {loadErr} <button onClick={load} style={{ color:'#ef4444', textDecoration:'underline', background:'none', border:'none', cursor:'pointer', fontSize:13 }}>Retry</button>
          </div>
        )}
        {addError && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
                        borderRadius:8, padding:'10px 14px', color:'#ef4444', fontSize:13, marginBottom:16 }}>
            ✕ {addError}
          </div>
        )}

        {!config && !loadErr && <div style={{ color:'#64748b', padding:40, textAlign:'center' }}>Loading…</div>}

        {config && list.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#64748b' }}>
            <div style={{ fontSize:48, marginBottom:14 }}>{active.icon}</div>
            <div style={{ fontSize:15, color:'#94a3b8', marginBottom:6 }}>No {active.label} instances</div>
            <div style={{ fontSize:13 }}>Click "Add instance" to configure one.</div>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {list.map(inst => (
            <InstanceCard key={inst.id} inst={inst} integ={active}
              open={!!expanded[inst.id]} testResult={testResults[inst.id]} saving={!!saving[inst.id]}
              onToggle={() => setExpanded(e => ({ ...e, [inst.id]: !e[inst.id] }))}
              onSave={saveInstance} onDelete={() => deleteInstance(inst.id)} onTest={testConnection} />
          ))}
        </div>
      </div>
    </div>
  )
}

function InstanceCard({ inst, integ, open, testResult, saving, onToggle, onSave, onDelete, onTest }) {
  const [form, setForm] = useState({ ...inst })
  useEffect(() => { setForm({ ...inst }) }, [inst])
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))
  const fields = integ.fields || ['name','url']
  const inp = { width:'100%', padding:'8px 12px', background:'#0f172a', fontSize:13,
                border:'1px solid rgba(148,163,184,0.2)', borderRadius:8, color:'#f1f5f9', boxSizing:'border-box' }
  return (
    <div style={{ background:'#1e293b', border:`1px solid ${open?'rgba(56,189,248,0.2)':'rgba(148,163,184,0.1)'}`,
                  borderRadius:12, overflow:'hidden', transition:'.15s' }}>
      <div onClick={onToggle}
        style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', cursor:'pointer', userSelect:'none' }}>
        <div style={{ width:38, height:38, borderRadius:9, background:'rgba(148,163,184,0.08)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
          {form.enabled ? '🟢' : '⚫'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:14, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {form.name || '(unnamed)'}
          </div>
          <div style={{ fontSize:12, color:'#64748b', fontFamily:'monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {form.url || form.ip || '—'}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:12, padding:'2px 8px', borderRadius:20,
                         background: form.enabled?'rgba(34,197,94,0.1)':'rgba(100,116,139,0.1)',
                         color: form.enabled?'#22c55e':'#64748b',
                         border:`1px solid ${form.enabled?'rgba(34,197,94,0.2)':'rgba(100,116,139,0.15)'}` }}>
            {form.enabled?'enabled':'disabled'}
          </span>
          <span style={{ color:'#64748b', fontSize:12, display:'inline-block', transition:'.2s',
                         transform: open?'rotate(90deg)':'none' }}>▶</span>
        </div>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid rgba(148,163,184,0.08)', padding:'18px 18px 16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={!!form.enabled} onChange={e => set('enabled', e.target.checked)} />
              Enabled
            </label>
            <select value={form.role||'primary'} onChange={e => set('role', e.target.value)}
              style={{ padding:'4px 10px', fontSize:12, background:'#0f172a',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:6, color:'#f1f5f9' }}>
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {fields.map(key => (
              <div key={key} style={{ gridColumn: WIDE_FIELDS.has(key)?'1/-1':'auto' }}>
                <div style={{ fontSize:11, color:'#94a3b8', marginBottom:5, fontWeight:500 }}>{FIELD_LABELS[key]||key}</div>
                <input type={PASSWORD_FIELDS.has(key)?'password':'text'}
                  value={form[key]||''} onChange={e => set(key, e.target.value)}
                  placeholder={PASSWORD_FIELDS.has(key)?'••••••••':''} style={inp} />
              </div>
            ))}
          </div>
          {testResult && !testResult.loading && (
            <div style={{ padding:'9px 12px', borderRadius:8, marginBottom:12, fontSize:13,
                          background: testResult.ok?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.08)',
                          color: testResult.ok?'#22c55e':'#ef4444',
                          border:`1px solid ${testResult.ok?'rgba(34,197,94,0.2)':'rgba(239,68,68,0.2)'}` }}>
              {testResult.ok ? `✓ ${testResult.detail}` : `✕ ${testResult.detail}`}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => onSave(form)} disabled={saving}
              style={{ padding:'8px 22px', background:saving?'#334155':'#38bdf8', color:'#0f172a',
                       border:'none', borderRadius:8, fontWeight:700, fontSize:13, cursor:saving?'default':'pointer' }}>
              {saving?'Saving…':'Save'}
            </button>
            <button onClick={() => onTest(form)} disabled={!!testResult?.loading}
              style={{ padding:'8px 16px', background:'transparent',
                       border:'1px solid rgba(148,163,184,0.2)', borderRadius:8,
                       color:testResult?.loading?'#475569':'#94a3b8', fontSize:13, cursor:testResult?.loading?'default':'pointer' }}>
              {testResult?.loading?'⏳ Testing…':'🔌 Test'}
            </button>
            <button onClick={onDelete}
              style={{ marginLeft:'auto', padding:'8px 14px', background:'rgba(239,68,68,0.06)',
                       border:'1px solid rgba(239,68,68,0.18)', borderRadius:8, color:'#ef4444', fontSize:13, cursor:'pointer' }}>
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
