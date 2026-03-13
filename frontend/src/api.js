const BASE = '/api'

function token() {
  return localStorage.getItem('nm_token') || ''
}

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
    ...extra
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  if (res.status === 401) {
    localStorage.removeItem('nm_token')
    window.location.reload()
    return
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

const get  = path        => req('GET',    path)
const post = (path, b)   => req('POST',   path, b)
const put  = (path, b)   => req('PUT',    path, b)
const patch = (path, b)  => req('PATCH',  path, b)
const del  = path        => req('DELETE', path)

// ── Setup ─────────────────────────────────────────────────────
export const api = {
  setup: {
    status:  ()       => get('/setup/status'),
    init:    (data)   => post('/setup/init', data),
  },

  // ── Auth ───────────────────────────────────────────────────
  auth: {
    login: async (username, password) => {
      const form = new URLSearchParams({ username, password })
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      return data
    },
    me: () => get('/auth/me'),
  },

  // ── Devices ────────────────────────────────────────────────
  devices: {
    list:      (params = {}) => get('/devices?' + new URLSearchParams(params)),
    stats:     ()            => get('/devices/stats'),
    get:       (id)          => get(`/devices/${id}`),
    update:    (id, data)    => patch(`/devices/${id}`, data),
    verify:    (id)          => post(`/devices/${id}/verify`),
    delete:    (id)          => del(`/devices/${id}`),
    alerts:    (unread)      => get(`/devices/alerts${unread ? '?unread_only=true' : ''}`),
    markRead:  (id)          => post(`/devices/alerts/${id}/read`),
    markAllRead: ()          => post('/devices/alerts/read-all'),
  },

  // ── Discovery ──────────────────────────────────────────────
  pending: {
    list:    ()   => get('/devices/pending/list'),
    approve: (id) => post(`/devices/pending/${id}/approve`),
    reject:  (id) => post(`/devices/pending/${id}/reject`),
  },

  // ── Scan ───────────────────────────────────────────────────
  scan: {
    trigger: (type = 'ping') => post(`/scan/trigger?scan_type=${type}`),
    status:  ()              => get('/scan/status'),
    history: ()              => get('/scan/history'),
  },

  // ── Integrations ───────────────────────────────────────────
  integrations: {
    getAll:       ()                   => get('/integrations'),
    updateSection:(section, data)      => put(`/integrations/${section}`, data),
    upsert:       (section, id, data)  => put(`/integrations/${section}/${id}`, data),
    delete:       (section, id)        => del(`/integrations/${section}/${id}`),
    test:         (data)               => post('/integrations/test', data),
  },

  // ── Settings ───────────────────────────────────────────────
  settings: {
    get:           ()     => get('/settings'),
    updateScan:    (data) => put('/settings/scan', data),
    changePassword:(data) => put('/settings/password', data),
    changeAppName: (data) => put('/settings/app-name', data),
  },
}
