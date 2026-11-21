/**
 * api.js — Frontend API client for RailSaathi backend.
 */

// Backend address.
//  - Local development: leave VITE_API_URL unset. Requests go to '/api' and the Vite dev server
//    proxies them to the backend (see vite.config.js).
//  - Deployed (e.g. Vercel + Render): set VITE_API_URL to the backend origin,
//    for example https://your-service.onrender.com (no trailing slash needed).
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function searchGlobal(q) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

export async function getTrains(page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/trains?page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error('Failed to load trains');
  return res.json();
}

export async function searchTrains(q, page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/trains/search?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error('Train search failed');
  return res.json();
}

export async function getTrainDetail(trainNumber) {
  const res = await fetch(`${API_BASE}/trains/${trainNumber}`);
  if (!res.ok) throw new Error('Train not found');
  return res.json();
}

export async function searchTrainsBetweenStations(fromStation, toStation, page = 1, pageSize = 100) {
  const params = new URLSearchParams({
    from_station: fromStation,
    to_station: toStation,
    page: String(page),
    page_size: String(pageSize),
  })
  const res = await fetch(`${API_BASE}/trains/route-search?${params.toString()}`)
  if (!res.ok) {
    let message = 'Could not search trains for this route'
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch { /* use fallback message */ }
    throw new Error(message)
  }
  return res.json()
}

export async function getTrainRoute(trainNumber) {
  const res = await fetch(`${API_BASE}/trains/${trainNumber}/route`);
  if (!res.ok) throw new Error('Train route not found');
  return res.json();
}

export async function getTrainMapData(trainNumber) {
  const res = await fetch(`${API_BASE}/trains/${trainNumber}/map`);
  if (!res.ok) throw new Error('Train map data not found');
  return res.json();
}

export async function getTrainPosition(trainNumber, date, time = null) {
  let url = `${API_BASE}/trains/${trainNumber}/position?date=${date}`;
  if (time) url += `&time=${time}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not calculate position');
  return res.json();
}

export async function getStations(page = 1, pageSize = 50, state = '', zone = '') {
  let url = `${API_BASE}/stations?page=${page}&page_size=${pageSize}`;
  if (state) url += `&state=${encodeURIComponent(state)}`;
  if (zone) url += `&zone=${encodeURIComponent(zone)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load stations');
  return res.json();
}

export async function searchStations(q, page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/stations/search?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error('Station search failed');
  return res.json();
}

export async function getStationDetail(code) {
  const res = await fetch(`${API_BASE}/stations/${code.toUpperCase()}`);
  if (!res.ok) throw new Error('Station not found');
  return res.json();
}

export async function getStationTrains(code, page = 1, pageSize = 20) {
  const res = await fetch(`${API_BASE}/stations/${code.toUpperCase()}/trains?page=${page}&page_size=${pageSize}`);
  if (!res.ok) throw new Error('Failed to load trains for station');
  return res.json();
}

// ── AI journey assistant ────────────────────────────────────────────────────
// All AI calls go through the backend; no API key ever exists in the browser.

export async function getAssistantStatus() {
  const res = await fetch(`${API_BASE}/assistant/status`);
  if (!res.ok) throw new Error('Assistant status unavailable');
  return res.json();
}

async function readError(res) {
  let data = null
  try { data = await res.json() } catch { /* non-JSON error body */ }
  const d = data && data.detail
  const err = new Error(
    d && typeof d === 'object' && d.message
      ? d.message
      : typeof d === 'string'
        ? d
        : res.status === 422
          ? 'That could not be processed. Please check it and try again.'
          : 'The service is unavailable right now. Please try again.'
  )
  err.code = d && typeof d === 'object' ? d.code : undefined
  err.status = res.status
  return err
}

const NETWORK_MSG = 'Could not reach the server. Check that the backend is running.'

function chatBody(message, history, context, extras = {}) {
  return JSON.stringify({
    message, history, context,
    language: extras.language === 'hi' ? 'hi' : 'en',
    preferences: extras.preferences || null,
  })
}

export async function sendAssistantMessage(message, history, context, extras = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody(message, history, context, extras),
    })
  } catch { throw new Error(NETWORK_MSG) }
  if (!res.ok) throw await readError(res)
  return res.json()
}

// Split a buffer of server-sent events into complete events; returns the unfinished rest.
export function parseSseChunk(buffer) {
  const events = []
  const parts = buffer.split('\n\n')
  const rest = parts.pop()
  for (const block of parts) {
    let name = 'message'
    const data = []
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue // keep-alive comment
      if (line.startsWith('event:')) name = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    }
    if (data.length) {
      try { events.push({ name, data: JSON.parse(data.join('\n')) }) } catch { /* ignore a malformed event */ }
    }
  }
  return { events, rest }
}

/**
 * Ask with live progress. `onStatus(text)` is called for each step ("Looking up train ...").
 * Falls back to the normal request if streaming is unavailable.
 */
export async function streamAssistantMessage(message, history, context, extras = {}, onStatus = () => {}) {
  let res
  try {
    res = await fetch(`${API_BASE}/assistant/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody(message, history, context, extras),
    })
  } catch { throw new Error(NETWORK_MSG) }
  if (!res.ok) {
    if (res.status === 404 || res.status === 405) return sendAssistantMessage(message, history, context, extras)
    throw await readError(res)
  }
  if (!res.body || !res.body.getReader) return sendAssistantMessage(message, history, context, extras)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSseChunk(buffer)
      buffer = parsed.rest
      for (const ev of parsed.events) {
        if (ev.name === 'status') onStatus(ev.data.text)
        else if (ev.name === 'result') result = ev.data
        else if (ev.name === 'error') {
          const err = new Error(ev.data.message || 'The assistant could not answer.')
          err.code = ev.data.code
          throw err
        }
      }
    }
  } catch (err) {
    if (err.code) throw err
    throw new Error('The connection was interrupted. Please try again.')
  }
  if (!result) throw new Error('The assistant did not return an answer. Please try again.')
  return result
}

export async function readTicket(imageBase64, mimeType) {
  let res
  try {
    res = await fetch(`${API_BASE}/assistant/ticket`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, mime_type: mimeType }),
    })
  } catch { throw new Error(NETWORK_MSG) }
  if (!res.ok) throw await readError(res)
  return (await res.json()).ticket
}

// ── DEMO services (simulated; see backend services/demo_tools.py) ────────────
async function demoGet(path) {
  let res
  try { res = await fetch(`${API_BASE}/demo${path}`) } catch { throw new Error(NETWORK_MSG) }
  if (!res.ok) throw await readError(res)
  return res.json()
}
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()

export const demoPnr = (pnr) => demoGet(`/pnr/${encodeURIComponent(pnr)}`)
export const demoFoodMenu = (station) => demoGet(`/food/menu?${qs({ station })}`)
export const demoFare = (train, from_station, to_station, travel_class) => demoGet(`/fare?${qs({ train, from_station, to_station, travel_class })}`)
export const demoSeats = (train, date, travel_class) => demoGet(`/seats?${qs({ train, date, travel_class })}`)
export const demoLive = (train) => demoGet(`/live/${encodeURIComponent(train)}`)
export async function demoFoodOrder(train_number, station, items) {
  let res
  try {
    res = await fetch(`${API_BASE}/demo/food/order`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ train_number, station, items }),
    })
  } catch { throw new Error(NETWORK_MSG) }
  if (!res.ok) throw await readError(res)
  return res.json()
}
