import { useState, useEffect } from 'react'
import { api } from '../api.js'

// Field definitions per integration type
const TYPE_FIELDS = {
  adguard:          ['name', 'url', 'username', 'password'],
  pihole:           ['name', 'url', 'api_token'],
  npm:              ['name', 'url', 'username', 'password'],
  routers:          ['name', 'ip', 'username', 'password'],
  switches:         ['name', 'ip', 'username', 'password'],
  dhcp:             ['name', 'url', 'api_key'],
  technitium:       ['name', 'url', 'username', 'password'],
  powerdns:         ['name', 'url', 'api_key'],
  uptime_kuma:      ['name', 'url', 'username', 'password'],
  netdata:          ['name', 'url', 'api_key'],
  ntopng:           ['name', 'url', 'username', 'password'],
  zabbix:           ['name', 'url', 'username', 'password'],
  smokeping:        ['name', 'url'],
  speedtest_tracker:['name', 'url', 'api_key'],
  home_assistant:   ['name', 'url', 'token'],
  portainer:        ['name', 'url', 'api_key'],
  node_red:         ['name', 'url', 'username', 'password'],
  omv:              ['name', 'url', 'username', 'password'],
  netbox:           ['name', 'url', 'api_token'],
  ntfy:             ['name', 'url', 'topic', 'token'],
  telegram:         ['name', 'bot_token', 'chat_id'],
}

const FIELD_LABELS = {
  name: 'Display name', url: 'URL / Base URL', ip: 'IP address',
  username: 'Username', password: 'Password', api_key: 'API key',
  api_token: 'API token', token: 'Long-lived token', bot_token: 'Bot token',
  chat_id: 'Chat ID', topic: 'ntfy Topic',
}

const PASSWORD_FIELDS = new Set(['password', 'api_key', 'api_token', 'token', 'bot_token'])
const WIDE_FIELDS     = new Set(['name', 'url', 'api_key', 'api_token', 'token', 'bot_token'])

const SIDEBAR_GROUPS = [
  {
    group: 'DNS & Ad-block',
    items: [
      { key: 'adguard',    label: 'AdGuard Home',   icon: '🛡️' },
      { key: 'pihole',     label: 'Pi-hole',         icon: '🕳️' },
      { key: 'technitium', label: 'Technitium DNS',  icon: '🌐' },
      { key: 'powerdns',   label: 'PowerDNS',        icon: '⚡' },
    ],
  },
  {
    group: 'Proxy & DHCP',
    items: [
      { key: 'npm',    label: 'Nginx Proxy Mgr', icon: '🔄' },
      { key: 'dhcp',   label: 'DHCP Server',     icon: '📋' },
    ],
  },
  {
    group: 'Network',
    items: [
      { key: 'routers',  label: 'Routers',   icon: '📡' },
      { key: 'switches', label: 'Switches',  icon: '🔀' },
    ],
  },
  {
    group: 'Monitoring',
    items: [
      { key: 'uptime_kuma',       label: 'Uptime Kuma',       icon: '📈', parent: 'monitoring' },
      { key: 'netdata',            label: 'Netdata',           icon: '📊', parent: 'monitoring' },
      { key: 'ntopng',             label: 'ntopng',            icon: '🌊', parent: 'monitoring' },
      { key: 'zabbix',             label: 'Zabbix',            icon: '⚠️', parent: 'monitoring' },
      { key: 'smokeping',          label: 'Smokeping',         icon: '📡', parent: 'monitoring' },
      { key: 'speedtest_tracker',  label: 'Speedtest Tracker', icon: '💨', parent: 'monitoring' },
    ],
  },
  {
    group: 'Apps',
    items: [
      { key: 'home_assistant', label: 'Home Assistant', icon: '🏠', parent: 'apps' },
      { key: 'portainer',      label: 'Portainer',      icon: '🐳', parent: 'apps' },
      { key: 'node_red',       label: 'Node-RED',       icon: '🔧', parent: 'apps' },
      { key: 'omv',            label: 'OpenMediaVault', icon: '💾', parent: 'apps' },
      { key: 'netbox',         label: 'Netbox',         icon: '📦', parent: 'apps' },
    ],
  },
  {
    group: 'Notifications',
    items: [
      { key: 'ntfy',     label: 'ntfy',     icon: '🔔', parent: 'notifications' },
      { key: 'telegram', label: 'Telegram', icon: '✈️', parent: 'notifications' },
    ],
  },
]

function makeId(key) { return `${key}-${Date.now()}` }

function blankInstance(key, label, fields) {
  const inst = { id: makeId(key), type: key, name: `New ${label}`, enabled: false, role: 'primary' }
  for (const f of fields) if (!(f in inst)) inst[f] = ''
  return inst
}

function getList(config, item) {
  if (!config) return []
  const raw = item.parent ? config[item.parent]?.[item.key] : config[item.key]
  return Array.isArray(raw) ? raw : []
}

export default function Integrations() {
  const [config,      setConfig]      = useState(null)
  const [active,      setActive]      = useState(SIDEBAR_GROUPS[0].items[0])
  const [expanded,    setExpanded]    = useState({})
  const [testResults, setTestResults] = useState({})
  const [saving,      setSaving]      = useState({})
  const [error,       setError]       = useState('')
  const [adding,      setAdding]      = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try { setConfig(await api.integrations.getAll()) } catch {}
  }

  async function addInstance() {
    if (!config || adding) return
    setAdding(true); setError('')
    try {
      const fields = TYPE_FIELDS[active.key] || ['name', 'url']
      const inst   = blankInstance(active.key, active.label, fields)
      const section = active.parent || active.key
      const subkey  = active.parent ? active.key : null

      if (subkey) {
        const current = config[section] || {}
        const list    = Array.isArray(current[subkey]) ? [...current[subkey]] : []
        list.push(inst)
        await api.integrations.updateSection(section, { ...current, [subkey]: list })
      } else {
        await api.integrations.upsert(section, inst.id, inst)
      }
      setExpanded(e => ({ ...e, [inst.id]: true }))
      await load()
    } catch (e) {
      setError(e.message || 'Failed to add instance')
    } finally { setAdding(false) }
  }

  async function saveInstance(inst) {
    setSaving(s => ({ ...s, [inst.id]: true })); setError('')
    try {
      const section = active.parent || active.key
      const subkey  = active.parent ? active.key : null
      if (subkey) {
        const current = config[section] || {}
        const list    = Array.isArray(current[subkey]) ? [...current[subkey]] : []
        const idx     = list.findIndex(x => x.id === inst.id)
        if (idx >= 0) list[idx] = inst; else list.push(inst)
        await api.integrations.updateSection(section, { ...current, [subkey]: list })
      } else {
        await api.integrations.upsert(section, inst.id, inst)
      }
      await load()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally { setSaving(s => { const n = { ...s }; delete n[inst.id]; return n }) }
  }

  async function deleteInstance(id) {
    if (!confirm('Delete this integration?')) return
    setError('')
    try {
      const section = active.parent || active.key
      const subkey  = active.parent ? active.key : null
      if (subkey) {
        const current = config[section] || {}
        const list    = (current[subkey] || []).filter(x => x.id !== id)
        await api.integrations.updateSection(section, { ...current, [subkey]: list })
      } else {
        await api.integrations.delete(section, id)
      }
      await load()
    } catch (e) { setError(e.message) }
  }

  async function testConnection(inst) {
    setTestResults(r => ({ ...r, [inst.id]: { loading: true } }))
    try {
      const res = await api.integrations.test({
        type:      inst.type || active.key,
        url:       inst.url || inst.ip,
        username:  inst.username,
        password:  inst.password,
        api_key:   inst.api_key,
        api_token: inst.api_token,
        token:     inst.token,
        bot_token: inst.bot_token,
        chat_id:   inst.chat_id,
      })
      setTestResults(r => ({ ...r, [inst.id]: res }))
    } catch (e) {
      setTestResults(r => ({ ...r, [inst.id]: { ok: false, detail: e.message } }))
    }
  }

  const list = getList(config, active)

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)', overflow: 'hidden', margin: '-28px' }}>

      {/* Sidebar */}
      <div style={{
        width: 210, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto', padding: '14px 8px',
        background: 'var(--surface)',
      }}>
        {SIDEBAR_GROUPS.map(group => (
          <div key={group.group} style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 10, color: 'var(--text3)', fontWeight: 700,
              letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '0 10px 6px',
            }}>{group.group}</div>
            {group.items.map(item => {
              const isActive = active.key === item.key
              const count = config
                ? getList(config, item).length
                : 0
              return (
                <button key={item.key}
                  onClick={() => { setActive(item); setError('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: isActive ? 'rgba(59,130,246,.1)' : 'transparent',
                    color: isActive ? 'var(--accent2)' : 'var(--text2)',
                    fontSize: 13, textAlign: 'left', transition: 'var(--transition)',
                  }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {count > 0 && (
                    <span style={{
                      fontSize: 10, background: 'rgba(99,120,172,.15)',
                      color: 'var(--text3)', borderRadius: 99, padding: '1px 6px',
                    }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>{active.icon} {active.label}</h1>
            <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
              Add multiple instances — each saved to integrations.json
            </p>
          </div>
          <button
            onClick={addInstance}
            disabled={adding || !config}
            className="btn btn-primary"
          >
            {adding ? '…' : '+ Add instance'}
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'transparent', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        )}

        {!config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array(2).fill(0).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 64 }} />
            ))}
          </div>
        )}

        {config && list.length === 0 && (
          <div className="empty">
            <div className="empty-icon">{active.icon}</div>
            <div className="empty-title">No {active.label} instances</div>
            <div className="empty-sub">Click "+ Add instance" to configure one.</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(inst => (
            <InstanceCard
              key={inst.id}
              inst={inst}
              typeKey={active.key}
              open={!!expanded[inst.id]}
              testResult={testResults[inst.id]}
              saving={!!saving[inst.id]}
              onToggle={() => setExpanded(e => ({ ...e, [inst.id]: !e[inst.id] }))}
              onSave={saveInstance}
              onDelete={() => deleteInstance(inst.id)}
              onTest={() => testConnection(inst)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Instance Card ─────────────────────────────────────────────────

function InstanceCard({ inst, typeKey, open, testResult, saving, onToggle, onSave, onDelete, onTest }) {
  const [form, setForm] = useState({ ...inst })
  useEffect(() => { setForm({ ...inst }) }, [inst])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const fields = TYPE_FIELDS[typeKey] || ['name', 'url']

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', transition: 'var(--transition)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,120,172,.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: form.enabled ? 'rgba(34,197,94,.15)' : 'rgba(99,120,172,.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>
          {form.enabled ? '🟢' : '⚫'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name || '(unnamed)'}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {form.url || form.ip || '—'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: form.enabled ? 'var(--green)' : 'var(--text3)' }}>
            {form.enabled ? 'enabled' : 'disabled'}
          </span>
          <span style={{ color: 'var(--text3)', display: 'inline-block', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '18px 18px 16px' }}>
          {/* Enabled + role */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.enabled} onChange={e => set('enabled', e.target.checked)} />
              Enabled
            </label>
            {'role' in form && (
              <select value={form.role || 'primary'} onChange={e => set('role', e.target.value)}
                className="input" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
              </select>
            )}
          </div>

          {/* Fields grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {fields.map(key => (
              <div key={key} className="field"
                style={{ gridColumn: WIDE_FIELDS.has(key) ? '1 / -1' : 'auto' }}>
                <label>{FIELD_LABELS[key] || key}</label>
                <input
                  className="input"
                  type={PASSWORD_FIELDS.has(key) ? 'password' : 'text'}
                  value={form[key] || ''}
                  onChange={e => set(key, e.target.value)}
                  placeholder={PASSWORD_FIELDS.has(key) ? '••••••••' : ''}
                />
              </div>
            ))}
          </div>

          {/* Test result */}
          {testResult && !testResult.loading && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: testResult.ok ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              color: testResult.ok ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${testResult.ok ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.2)'}`,
            }}>
              {testResult.ok ? '✓ ' : '✕ '}{testResult.detail}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onSave(form)} disabled={saving} className="btn btn-primary btn-sm">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onTest} disabled={testResult?.loading} className="btn btn-ghost btn-sm">
              {testResult?.loading ? 'Testing…' : 'Test connection'}
            </button>
            <button onClick={onDelete} className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
