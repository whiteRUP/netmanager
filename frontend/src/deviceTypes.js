// Central device type registry — used across Devices, Discovery, Dashboard, scanner suggestion

export const DEVICE_TYPES = [
  { type: 'Router',           icon: '📡', color: '#38bdf8',
    keywords: ['router','gateway','openwrt','opnsense','pfsense','mikrotik','tp-link','asus','netgear','dlink','d-link','zyxel','ubiquiti','edgerouter'] },
  { type: 'Switch',           icon: '🔀', color: '#0ea5e9',
    keywords: ['switch','managed switch','cisco','netgear','tplink','hp procurve'] },
  { type: 'Access Point',     icon: '📶', color: '#38bdf8',
    keywords: ['access point','ap ','wifi ap','unifi','ubiquiti ap','aruba'] },
  { type: 'Firewall',         icon: '🛡️', color: '#6366f1',
    keywords: ['firewall','opnsense','pfsense','fortinet','sophos'] },
  { type: 'Server',           icon: '🖧', color: '#a78bfa',
    keywords: ['server','ubuntu server','debian','centos','proxmox','esxi','vmware','truenas'] },
  { type: 'PC/Desktop',       icon: '🖥️', color: '#8b5cf6',
    keywords: ['desktop','pc','workstation','windows','linux pc','dell','hp desktop','intel nuc'] },
  { type: 'Laptop',           icon: '💻', color: '#7c3aed',
    keywords: ['laptop','notebook','macbook','thinkpad','chromebook'] },
  { type: 'Mobile/Phone',     icon: '📱', color: '#f59e0b',
    keywords: ['phone','mobile','android','iphone','samsung phone','xiaomi','oneplus','pixel'] },
  { type: 'Tablet',           icon: '📲', color: '#f97316',
    keywords: ['tablet','ipad','galaxy tab','surface'] },
  { type: 'Smart TV',         icon: '📺', color: '#ec4899',
    keywords: ['smart tv','tv','roku','firetv','fire stick','chromecast','android tv','webos','tizen'] },
  { type: 'Game Console',     icon: '🎮', color: '#818cf8',
    keywords: ['playstation','ps4','ps5','xbox','nintendo','switch console','gaming'] },
  { type: 'IP Camera',        icon: '📷', color: '#f97316',
    keywords: ['camera','cam','ip cam','rtsp','dahua','hikvision','reolink','amcrest','wyze'] },
  { type: 'NAS/Storage',      icon: '💾', color: '#64748b',
    keywords: ['nas','synology','qnap','omv','truenas','freenas','storage'] },
  { type: 'Printer',          icon: '🖨️', color: '#94a3b8',
    keywords: ['printer','print','hp laserjet','brother','canon printer','epson'] },
  { type: 'IoT Device',       icon: '💡', color: '#22c55e',
    keywords: ['iot','esp','arduino','sonoff','shelly','tasmota','tuya','zigbee','zwave','smart home','ewelink'] },
  { type: 'Smart Plug',       icon: '🔌', color: '#4ade80',
    keywords: ['smart plug','outlet','tp-link plug','kasa','meross'] },
  { type: 'Smart Speaker',    icon: '🔊', color: '#fbbf24',
    keywords: ['echo','alexa','google home','homepod','smart speaker','sonos'] },
  { type: 'Home Assistant',   icon: '🏠', color: '#f59e0b',
    keywords: ['home assistant','homeassistant','hass'] },
  { type: 'Media Server',     icon: '🎬', color: '#e879f9',
    keywords: ['plex','jellyfin','emby','media server','kodi'] },
  { type: 'Raspberry Pi',     icon: '🫐', color: '#ef4444',
    keywords: ['raspberry','pi','raspbian','raspberry pi'] },
  { type: 'Virtual Machine',  icon: '🔲', color: '#475569',
    keywords: ['vm','virtual','docker','proxmox','vmware','virtualbox','kvm'] },
  { type: 'Apple Device',     icon: '🍎', color: '#e2e8f0',
    keywords: ['apple','macos','imac','mac mini','macbook air','mac pro'] },
  { type: 'Network UPS',      icon: '🔋', color: '#84cc16',
    keywords: ['ups','apc','cyberpower','eaton','battery backup'] },
  { type: 'VPN Server',       icon: '🔐', color: '#a78bfa',
    keywords: ['vpn','wireguard','openvpn'] },
  { type: 'DNS Server',       icon: '🌐', color: '#22d3ee',
    keywords: ['dns','pihole','adguard','technitium','bind','unbound'] },
  { type: 'MikroTik',         icon: '⚡', color: '#38bdf8',
    keywords: ['mikrotik','routerboard','chr'] },
  { type: 'Unknown',          icon: '❓', color: '#475569',
    keywords: [] },
]

export const ICON_PALETTE = [
  '📡','🔀','📶','🛡️','🖥️','💻','📱','📲','📺','💡',
  '📷','💾','🖨️','🔲','🏠','🍎','🤖','🎮','🔌','🌐',
  '🫐','⚡','❓','🖧','🔐','🔑','🔒','⚙️','🧩','📦',
  '🐳','🔧','🌊','📊','📈','⚠️','🔔','✈️','☁️','🏷️',
  '🔊','🎬','🔋','🔵','🔴','🟡','🟢','💎','🧲','🖱️',
]

export function typeToIcon(type) {
  return DEVICE_TYPES.find(d => d.type === type)?.icon ?? '❓'
}

export function typeToColor(type) {
  return DEVICE_TYPES.find(d => d.type === type)?.color ?? '#475569'
}

/**
 * Suggest a device type based on open ports, manufacturer, hostname, and detected type.
 * Returns { type, confidence: 'high'|'medium'|'low' }
 */
export function suggestType({ open_ports = [], manufacturer = '', hostname = '', detected_type = '' }) {
  const ports   = open_ports.map(Number)
  const mfr     = (manufacturer || '').toLowerCase()
  const host    = (hostname || '').toLowerCase()
  const det     = (detected_type || '').toLowerCase()

  // Port-based strong signals
  if (ports.includes(8123))                  return { type: 'Home Assistant', confidence: 'high' }
  if (ports.includes(9000) || ports.includes(9001)) return { type: 'Virtual Machine', confidence: 'medium' }
  if (ports.includes(1883) || ports.includes(8883)) return { type: 'IoT Device', confidence: 'high' }
  if (ports.includes(554) || ports.includes(8554))  return { type: 'IP Camera', confidence: 'high' }
  if (ports.includes(1880))                  return { type: 'IoT Device', confidence: 'medium' }
  if (ports.includes(32400))                 return { type: 'Media Server', confidence: 'high' }
  if (ports.includes(8096) || ports.includes(8920)) return { type: 'Media Server', confidence: 'high' }
  if (ports.includes(51820) || ports.includes(1194)) return { type: 'VPN Server', confidence: 'medium' }
  if (ports.includes(53) && !ports.includes(80))    return { type: 'DNS Server', confidence: 'medium' }

  // Manufacturer / hostname signals
  if (mfr.includes('raspberry') || host.includes('raspberry') || host.includes('raspberrypi'))
    return { type: 'Raspberry Pi', confidence: 'high' }
  if (mfr.includes('synology') || host.includes('synology') || host.includes('diskstation'))
    return { type: 'NAS/Storage', confidence: 'high' }
  if (mfr.includes('qnap') || host.includes('qnap'))
    return { type: 'NAS/Storage', confidence: 'high' }
  if (mfr.includes('apple') || host.includes('iphone') || host.includes('macbook'))
    return { type: 'Apple Device', confidence: 'high' }
  if (mfr.includes('samsung') && (host.includes('phone') || ports.length < 3))
    return { type: 'Mobile/Phone', confidence: 'medium' }
  if (mfr.includes('espressif') || mfr.includes('esp') || host.includes('esp') || host.includes('tasmota') || host.includes('shelly'))
    return { type: 'IoT Device', confidence: 'high' }
  if (mfr.includes('mikrotik'))
    return { type: 'MikroTik', confidence: 'high' }
  if (mfr.includes('ubiquiti') && (ports.includes(22) || ports.includes(443)))
    return { type: 'Access Point', confidence: 'medium' }

  // Port combinations for common services
  if (ports.includes(22) && ports.includes(80) && ports.includes(443))
    return { type: 'Server', confidence: 'medium' }
  if ((ports.includes(80) || ports.includes(443)) && (ports.includes(22) || ports.includes(23)))
    return { type: 'Router', confidence: 'low' }
  if (ports.includes(3389))
    return { type: 'PC/Desktop', confidence: 'medium' }
  if (ports.includes(5000) || ports.includes(5001))
    return { type: 'NAS/Storage', confidence: 'medium' }

  // Fall back to detected_type from scanner
  if (det && det !== 'unknown') {
    const match = DEVICE_TYPES.find(d => d.type.toLowerCase() === det)
    if (match) return { type: match.type, confidence: 'medium' }
  }

  return { type: 'Unknown', confidence: 'low' }
}
