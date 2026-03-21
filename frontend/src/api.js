const BASE = '/api'

function token() { return localStorage.getItem('nm_token') || '' }

function hdrs() {
  return {
    'Content-Type': 'application/json',
    ...(token() ? { Authorization: `Bearer ${token()}` } : {})
  }
}

async function safeJson(res) {
  const text = await res.text()
  if (!text.trim()) return {}
  try { return JSON.parse(text) }
  catch { return { detail: `Server error (HTTP ${res.status})` } }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: hdrs(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  if (res.status === 401) {
    localStorage.removeItem('nm_token')
    window.location.reload()
    return
  }
  const data = await safeJson(res)
  if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`)
  return data
}

const get   = p      => req('GET',    p)
const post  = (p, b) => req('POST',   p, b)
const put   = (p, b) => req('PUT',    p, b)
const patch = (p, b) => req('PATCH',  p, b)
const del   = p      => req('DELETE', p)

export const api = {
  setup: {
    status: ()     => get('/setup/status'),
    init:   (data) => post('/setup/init', data),
  },
  auth: {
    login: async (username, password) => {
      const form = new URLSearchParams({ username, password })
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      return data
    },
    me: () => get('/auth/me'),
  },
  devices: {
    list:       (params = {}) => get('/devices?' + new URLSearchParams(params)),
    stats:      ()            => get('/devices/stats'),
    get:        (id)          => get(`/devices/${id}`),
    update:     (id, data)    => patch(`/devices/${id}`, data),
    verify:     (id)          => post(`/devices/${id}/verify`),
    delete:     (id)          => del(`/devices/${id}`),
    alerts:     (unread)      => get(`/devices/alerts${unread ? '?unread_only=true' : ''}`),
    markRead:   (id)          => post(`/devices/alerts/${id}/read`),
    markAllRead:()            => post('/devices/alerts/read-all'),
  },
  pending: {
    list:    ()   => get('/devices/pending/list'),
    approve: (id) => post(`/devices/pending/${id}/approve`),
    reject:  (id) => post(`/devices/pending/${id}/reject`),
  },
  scan: {
    trigger: (type = 'ping') => post(`/scan/trigger?scan_type=${type}`),
    status:  ()              => get('/scan/status'),
    history: ()              => get('/scan/history'),
  },
  integrations: {
    getAll:         ()                  => get('/integrations'),
    updateSection:  (section, data)     => put(`/integrations/${section}`, data),
    upsert:         (section, id, data) => put(`/integrations/${section}/${id}`, data),
    delete:         (section, id)       => del(`/integrations/${section}/${id}`),
    test:           (data)              => post('/integrations/test', data),
  },
  settings: {
    get:            ()     => get('/settings'),
    updateScan:     (data) => put('/settings/scan', data),
    changePassword: (data) => put('/settings/password', data),
    changeAppName:  (data) => put('/settings/app-name', data),
  },
}
