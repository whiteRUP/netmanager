// Single source of truth for device types — used by Devices, Discovery, Dashboard, scanner.

export const DEVICE_TYPES = [
  { type: 'Router',          icon: '📡', color: '#38bdf8', keywords: ['router','gateway','openwrt','opnsense','pfsense'] },
  { type: 'Switch',          icon: '🔀', color: '#0ea5e9', keywords: ['switch','cisco','netgear switch'] },
  { type: 'Access Point',    icon: '📶', color: '#38bdf8', keywords: ['access point','ap','unifi','ubiquiti','aruba'] },
  { type: 'Firewall',        icon: '🛡️', color: '#6366f1', keywords: ['firewall','opnsense','pfsense','sophos','fortinet'] },
  { type: 'MikroTik',        icon: '⚡', color: '#38bdf8', keywords: ['mikrotik','routerboard','chr'] },
  { type: 'Server',          icon: '🖧',  color: '#a78bfa', keywords: ['server','proxmox','esxi','vmware server','truenas','debian server'] },
  { type: 'PC/Desktop',      icon: '🖥️', color: '#8b5cf6', keywords: ['desktop','pc','workstation','imac','intel nuc'] },
  { type: 'Laptop',          icon: '💻', color: '#7c3aed', keywords: ['laptop','notebook','macbook','thinkpad','chromebook'] },
  { type: 'Mobile/Phone',    icon: '📱', color: '#f59e0b', keywords: ['phone','mobile','iphone','android','pixel','oneplus','xiaomi','redmi'] },
  { type: 'Tablet',          icon: '📲', color: '#f97316', keywords: ['tablet','ipad','galaxy tab','surface'] },
  { type: 'Smart TV',        icon: '📺', color: '#ec4899', keywords: ['tv','roku','firetv','chromecast','android tv','webos','tizen','fire stick'] },
  { type: 'Game Console',    icon: '🎮', color: '#818cf8', keywords: ['playstation','ps4','ps5','xbox','nintendo switch','gaming console'] },
  { type: 'IP Camera',       icon: '📷', color: '#f97316', keywords: ['camera','cam','rtsp','dahua','hikvision','reolink','amcrest','wyze','dvr','nvr'] },
  { type: 'NAS/Storage',     icon: '💾', color: '#64748b', keywords: ['nas','synology','qnap','truenas','freenas','omv','storage','diskstation'] },
  { type: 'Printer',         icon: '🖨️', color: '#94a3b8', keywords: ['printer','print','brother','canon printer','epson','hp printer'] },
  { type: 'IoT Device',      icon: '💡', color: '#22c55e', keywords: ['iot','esp','arduino','sonoff','shelly','tasmota','tuya','zigbee','zwave','ewelink'] },
  { type: 'Smart Plug',      icon: '🔌', color: '#4ade80', keywords: ['smart plug','outlet','kasa','meross','tp-link plug'] },
  { type: 'Smart Speaker',   icon: '🔊', color: '#fbbf24', keywords: ['echo','alexa','google home','homepod','sonos','smart speaker'] },
  { type: 'Home Assistant',  icon: '🏠', color: '#f59e0b', keywords: ['home assistant','homeassistant','hass','hassio'] },
  { type: 'Media Server',    icon: '🎬', color: '#e879f9', keywords: ['plex','jellyfin','emby','media server','kodi'] },
  { type: 'Raspberry Pi',    icon: '🫐', color: '#ef4444', keywords: ['raspberry','pi','raspbian','raspberry pi'] },
  { type: 'Apple Device',    icon: '🍎', color: '#e2e8f0', keywords: ['apple','macos','imac','mac mini','macbook air','mac pro'] },
  { type: 'Virtual Machine', icon: '🔲', color: '#475569', keywords: ['vm','virtual','docker','proxmox','vmware','virtualbox','kvm','container'] },
  { type: 'Network UPS',     icon: '🔋', color: '#84cc16', keywords: ['ups','apc','cyberpower','eaton','battery backup'] },
  { type: 'VPN Server',      icon: '🔐', color: '#a78bfa', keywords: ['vpn','wireguard','openvpn'] },
  { type: 'DNS Server',      icon: '🌐', color: '#22d3ee', keywords: ['dns','pihole','adguard','technitium','bind','unbound'] },
  { type: 'Unknown',         icon: '❓', color: '#475569', keywords: [] },
]

export const ICON_PALETTE = [
  '📡','🔀','📶','🛡️','🖥️','💻','📱','📲','📺','💡',
  '📷','💾','🖨️','🔲','🏠','🍎','🤖','🎮','🔌','🌐',
  '🫐','⚡','❓','🖧', '🔐','🔑','🔒','⚙️','🧩','📦',
  '🐳','🔧','🌊','📊','📈','⚠️','🔔','✈️','☁️','🏷️',
  '🔊','🎬','🔋','🔵','🔴','🟢','💎','🧲','🖱️','🎯',
]

export function typeToIcon(type) {
  return DEVICE_TYPES.find(d => d.type === type)?.icon ?? '❓'
}
export function typeToColor(type) {
  return DEVICE_TYPES.find(d => d.type === type)?.color ?? '#475569'
}

/** Suggest device type from discovery signals */
export function suggestType({ open_ports = [], manufacturer = '', hostname = '', detected_type = '' }) {
  const ports = open_ports.map(Number)
  const mfr   = (manufacturer || '').toLowerCase()
  const host  = (hostname || '').toLowerCase().replace(/\.(local|lan)$/, '')
  const det   = (detected_type || '').toLowerCase()

  // Strong port signals
  if (ports.includes(8123))                    return { type: 'Home Assistant', confidence: 'high' }
  if (ports.includes(32400))                   return { type: 'Media Server',   confidence: 'high' }
  if (ports.includes(8096) || ports.includes(8920)) return { type: 'Media Server', confidence: 'high' }
  if (ports.includes(554) || ports.includes(8554))  return { type: 'IP Camera',   confidence: 'high' }
  if (ports.includes(1883) || ports.includes(8883)) return { type: 'IoT Device',  confidence: 'high' }
  if (ports.includes(1880))                    return { type: 'IoT Device',   confidence: 'medium' }
  if (ports.includes(9100) || ports.includes(631))  return { type: 'Printer',     confidence: 'high' }
  if (ports.includes(51820) || ports.includes(1194)) return { type: 'VPN Server', confidence: 'medium' }
  if (ports.includes(53) && !ports.includes(80))    return { type: 'DNS Server',  confidence: 'medium' }
  if (ports.includes(3389))                    return { type: 'PC/Desktop',   confidence: 'medium' }
  if (ports.includes(5000) || ports.includes(5001)) return { type: 'NAS/Storage', confidence: 'medium' }
  if (ports.includes(9000) || ports.includes(9443)) return { type: 'Virtual Machine', confidence: 'medium' }

  // Manufacturer signals
  if (mfr.includes('raspberry') || host.includes('raspberry') || host.includes('rpi'))
    return { type: 'Raspberry Pi', confidence: 'high' }
  if (mfr.includes('synology') || host.includes('synology') || host.includes('diskstation'))
    return { type: 'NAS/Storage', confidence: 'high' }
  if (mfr.includes('qnap') || host.includes('qnap'))
    return { type: 'NAS/Storage', confidence: 'high' }
  if (mfr.includes('apple') || host.includes('iphone') || host.includes('macbook'))
    return { type: 'Apple Device', confidence: 'high' }
  if (mfr.includes('espressif') || mfr.includes('allterco') || host.includes('esp') || host.includes('shelly') || host.includes('tasmota'))
    return { type: 'IoT Device', confidence: 'high' }
  if (mfr.includes('mikrotik') || host.includes('mikrotik'))
    return { type: 'MikroTik', confidence: 'high' }
  if (mfr.includes('hikvision') || mfr.includes('dahua') || mfr.includes('reolink'))
    return { type: 'IP Camera', confidence: 'high' }
  if (mfr.includes('ubiquiti') || mfr.includes('ubnt'))
    return { type: 'Access Point', confidence: 'medium' }

  // Hostname signals
  if (host.includes('homeassistant') || host.includes('hassio'))
    return { type: 'Home Assistant', confidence: 'high' }
  if (host.includes('plex') || host.includes('jellyfin') || host.includes('emby'))
    return { type: 'Media Server', confidence: 'high' }
  if (host.includes('nas') || host.includes('storage'))
    return { type: 'NAS/Storage', confidence: 'medium' }
  if (host.includes('router') || host.includes('gateway') || host.includes('opnsense') || host.includes('pfsense'))
    return { type: 'Router', confidence: 'medium' }
  if (host.includes('printer') || host.includes('brother') || host.includes('epson'))
    return { type: 'Printer', confidence: 'high' }

  // Port combos
  if (ports.includes(22) && ports.includes(80) && ports.includes(443))
    return { type: 'Server', confidence: 'medium' }
  if (ports.includes(80) || ports.includes(443))
    return { type: 'Server', confidence: 'low' }

  // Fall back to scanner's detected_type
  if (det && det !== 'unknown') {
    const match = DEVICE_TYPES.find(d => d.type.toLowerCase() === det)
    if (match) return { type: match.type, confidence: 'medium' }
  }

  return { type: 'Unknown', confidence: 'low' }
}

// Port hint tags for Discovery display
export const PORT_HINTS = [
  { ports: [8123],        label: 'Home Assistant', color: '#f59e0b' },
  { ports: [1883, 8883],  label: 'MQTT',           color: '#22c55e' },
  { ports: [554, 8554],   label: 'RTSP/Camera',    color: '#f97316' },
  { ports: [32400],       label: 'Plex',           color: '#e879f9' },
  { ports: [8096, 8920],  label: 'Jellyfin',       color: '#06b6d4' },
  { ports: [1880],        label: 'Node-RED',       color: '#ef4444' },
  { ports: [9000, 9443],  label: 'Portainer',      color: '#38bdf8' },
  { ports: [5000, 5001],  label: 'NAS (DSM)',      color: '#64748b' },
  { ports: [22],          label: 'SSH',            color: '#a78bfa' },
  { ports: [53],          label: 'DNS',            color: '#22d3ee' },
  { ports: [9100, 631],   label: 'Printer',        color: '#94a3b8' },
  { ports: [3389],        label: 'RDP',            color: '#8b5cf6' },
  { ports: [51820],       label: 'WireGuard',      color: '#6366f1' },
]

export function getPortHints(ports) {
  const set = new Set(ports.map(Number))
  return PORT_HINTS.filter(h => h.ports.some(p => set.has(p)))
}
