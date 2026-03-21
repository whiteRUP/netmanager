import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { suggestType, typeToIcon, typeToColor, DEVICE_TYPES, ICON_PALETTE, getPortHints } from '../deviceTypes.js'

export default function Discovery() {
  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState({})
  const [approveModal, setApproveModal] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { setPending(await api.pending.list()) }
    catch {} finally { setLoading(false) }
  }

  async function reject(id) {
    setBusy(b => ({ ...b, [id]: 'reject' }))
    try {
      await api.pending.reject(id)
      setPending(p => p.filter(d => d.id !== id))
    } catch {}
    finally { setBusy(b => { const n = { ...b }; delete n[id]; return n }) }
  }

  async function doApprove(id) {
    setBusy(b => ({ ...b, [id]: 'approve' }))
    try {
      await api.pending.approve(id)
      setPending(p => p.filter(d => d.id !== id))
      setApproveModal(null)
    } catch {}
    finally { setBusy(b => { const n = { ...b }; delete n[id]; return n }) }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Discovery queue</h1>
          {pending.length > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
              {pending.length} device{pending.length !== 1 ? 's' : ''} awaiting review
            </div>
          )}
        </div>
        <button onClick={load} className="btn btn-ghost btn-sm">↻ Refresh</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 90 }} />
          ))}
        </div>
      )}

      {!loading && pending.length === 0 && (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Queue is empty</div>
          <div className="empty-sub">Run a Full scan to discover new devices on your network.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map(d => {
          const suggestion = suggestType({
            open_ports: d.open_ports || [],
            manufacturer: d.manufacturer || '',
            hostname: d.hostname || '',
            detected_type: d.detected_type || '',
          })
          const hints = getPortHints(d.open_ports || [])
          const confColor = d.confidence >= 75 ? 'var(--green)' : d.confidence >= 45 ? 'var(--amber)' : 'var(--red)'

          return (
            <div key={d.id} className="card fade-in" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              {/* Confidence ring */}
              <div style={{ flexShrink: 0, textAlign: 'center', width: 56 }}>
                <ConfRing pct={d.confidence} color={confColor} />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>confidence</div>
              </div>

              {/* Device icon */}
              <div style={{ fontSize: 28, flexShrink: 0, width: 36, textAlign: 'center' }}>
                {typeToIcon(suggestion.type)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 14 }}>{d.ip}</span>
                  <TypeBadge type={suggestion.type} confidence={suggestion.confidence} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: hints.length > 0 ? 6 : 0 }}>
                  {d.mac === '00:00:00:00:00:00'
                    ? <span style={{ fontStyle: 'italic' }}>MAC unknown (cross-subnet)</span>
                    : <span style={{ fontFamily: 'var(--mono)' }}>{d.mac}</span>
                  }
                  {d.manufacturer && d.manufacturer !== 'Unknown' && (
                    <span style={{ marginLeft: 8 }}>· {d.manufacturer}</span>
                  )}
                  {d.hostname && (
                    <span style={{ marginLeft: 8 }}>· {d.hostname}</span>
                  )}
                </div>
                {hints.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {hints.map(h => (
                      <span key={h.label} style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 99,
                        background: h.color + '15', color: h.color,
                        border: `1px solid ${h.color}25`,
                      }}>{h.label}</span>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                      ports: {(d.open_ports || []).slice(0, 6).join(', ')}{(d.open_ports || []).length > 6 ? '…' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setApproveModal({ ...d, _suggestion: suggestion })}
                  disabled={!!busy[d.id]}
                  className="btn btn-success"
                >
                  ✓ Approve
                </button>
                <button
                  onClick={() => reject(d.id)}
                  disabled={!!busy[d.id]}
                  className="btn btn-danger btn-sm"
                >
                  {busy[d.id] === 'reject' ? '…' : '✕'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {approveModal && (
        <ApproveModal
          device={approveModal}
          busy={!!busy[approveModal.id]}
          onConfirm={() => doApprove(approveModal.id)}
          onClose={() => setApproveModal(null)}
        />
      )}
    </div>
  )
}

// ── Approve Modal ─────────────────────────────────────────────────
function ApproveModal({ device, busy, onConfirm, onClose }) {
  const suggestion = device._suggestion
  const [type, setType] = useState(suggestion.type)
  const [icon, setIcon] = useState(typeToIcon(suggestion.type))

  function pickType(t) {
    setType(t)
    setIcon(typeToIcon(t))
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Approve device</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{device.ip}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Suggestion banner */}
          {suggestion.confidence !== 'low' && (
            <div style={{
              background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.15)',
              borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{typeToIcon(suggestion.type)}</span>
              <div>
                <div style={{ fontSize: 13 }}>Suggested: <strong style={{ color: 'var(--accent2)' }}>{suggestion.type}</strong></div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  {suggestion.confidence === 'high' ? '🟢 High' : '🟡 Medium'} confidence — based on ports & manufacturer
                </div>
              </div>
            </div>
          )}

          {/* Type picker */}
          <div className="field" style={{ marginBottom: 16 }}>
            <label>Confirm device type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 10, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              {DEVICE_TYPES.filter(d => d.type !== 'Unknown').map(dt => {
                const active = type === dt.type
                return (
                  <button key={dt.type} onClick={() => pickType(dt.type)}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 99, cursor: 'pointer',
                      transition: 'var(--transition)',
                      border: active ? `1px solid ${dt.color}` : '1px solid var(--border2)',
                      background: active ? dt.color + '20' : 'transparent',
                      color: active ? dt.color : 'var(--text2)',
                    }}>
                    {dt.icon} {dt.type}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Icon picker */}
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Icon — selected: {icon}</label>
            <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 10, border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {ICON_PALETTE.map(em => (
                <button key={em} onClick={() => setIcon(em)}
                  style={{
                    width: 32, height: 32, fontSize: 17, cursor: 'pointer', borderRadius: 6,
                    border: icon === em ? '2px solid var(--accent)' : '1px solid transparent',
                    background: icon === em ? 'rgba(59,130,246,.15)' : 'rgba(99,120,172,.06)',
                  }}>{em}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onConfirm} disabled={busy} className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }}>
              {busy ? 'Approving…' : `✓ Approve as ${type}`}
            </button>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfRing({ pct, color }) {
  const r = 20, c = 2 * Math.PI * r
  const fill = (pct / 100) * c
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--surface2)" strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${fill} ${c - fill}`} strokeLinecap="round"
        transform="rotate(-90 26 26)" />
      <text x="26" y="31" textAnchor="middle" fill={color} fontSize="11" fontWeight="700"
        fontFamily="var(--mono)">{pct}%</text>
    </svg>
  )
}

function TypeBadge({ type, confidence }) {
  const color = typeToColor(type)
  if (type === 'Unknown') {
    return <span className="badge badge-gray">Unknown</span>
  }
  return (
    <span style={{
      fontSize: 11, padding: '2px 9px', borderRadius: 99,
      background: color + '18', color, border: `1px solid ${color}30`,
      fontWeight: 600,
    }}>
      {typeToIcon(type)} {type}
    </span>
  )
}
