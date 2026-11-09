/**
 * api.js — Frontend API client for RailSaathi backend.
 */

const API_BASE = '/api';

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

export async function sendAssistantMessage(message, history, context) {
  let res;
  try {
    res = await fetch(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, context }),
    });
  } catch {
    throw new Error('Could not reach the server. Check that the backend is running.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const d = data && data.detail;
    const err = new Error(
      d && typeof d === 'object' && d.message
        ? d.message
        : res.status === 422
          ? 'That message could not be processed. Please rephrase it.'
          : 'The assistant is unavailable right now. Please try again.'
    );
    err.code = d && typeof d === 'object' ? d.code : undefined;
    throw err;
  }
  return data;
}
