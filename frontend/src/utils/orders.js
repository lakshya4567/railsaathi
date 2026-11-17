// orders.js — demo food-order history kept in this browser only (nothing is stored on the server).

const KEY = 'railsaathi_demo_orders_v1'
const MAX = 20
export const STAGE_SECONDS = 20 // the demo advances one stage every 20 seconds

export function loadOrders() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw)
      ? raw.filter((o) => o && typeof o.orderId === 'string' && /^DEMO-\d{8}$/.test(o.orderId) && Array.isArray(o.items)).slice(0, MAX)
      : []
  } catch { return [] }
}

export function saveOrders(orders) {
  try { localStorage.setItem(KEY, JSON.stringify(orders.slice(0, MAX))) } catch { /* not persisted */ }
}

export function addOrder(orders, order, placedAt = Date.now()) {
  const entry = {
    orderId: order.orderId, trainNumber: order.train.trainNumber, trainName: order.train.trainName,
    stationName: order.station.name, stationCode: order.station.code, scheduledArrival: order.scheduledArrivalAtStation,
    items: order.items, total: order.total, stages: order.stages, placedAt,
  }
  return [entry, ...orders.filter((o) => o.orderId !== entry.orderId)].slice(0, MAX)
}

/** Which simulated stage an order is in right now (0-based, capped at the last stage). */
export function stageIndex(order, now = Date.now()) {
  const n = Array.isArray(order.stages) ? order.stages.length : 1
  const elapsed = Math.max(0, now - (order.placedAt || now))
  return Math.min(n - 1, Math.floor(elapsed / (STAGE_SECONDS * 1000)))
}

export function cartTotal(menu, cart) {
  return menu.reduce((sum, m) => sum + (cart[m.id] || 0) * m.price, 0)
}

export function cartItems(cart) {
  return Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty }))
}
