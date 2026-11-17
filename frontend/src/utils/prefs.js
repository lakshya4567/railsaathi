// prefs.js — small user preferences kept in this browser only (never sent anywhere except as
// the saved home station to the assistant, so "from home" works).

const KEY = 'railsaathi_prefs_v1'
export const DEFAULT_PREFS = { home_station: null, speak: false, autoSendVoice: true }

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS }
    const hs = raw.home_station
    return {
      home_station: hs && typeof hs.code === 'string' && /^[A-Za-z0-9-]{1,10}$/.test(hs.code)
        ? { code: hs.code.toUpperCase(), name: typeof hs.name === 'string' ? hs.name.slice(0, 80) : null } : null,
      speak: raw.speak === true,
      autoSendVoice: raw.autoSendVoice !== false,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* storage blocked: not persisted */ }
}
