// journey.js — small pure helpers for journey cards (calendar events, running-day checks, map buckets).
import { addDays, legEvent } from './ics'

const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] // Date.getUTCDay() order

const parseHm = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const dayStart = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }

/**
 * Does the timetable say this train runs when you leave the origin on `isoDate`?
 * Running days apply to the day the train STARTS its run, so go back (departureDay - 1) days.
 * Returns true / false, or null when running days are not stored.
 */
export function runsOn(runningDays, isoDate, departureDay = 1) {
  if (!runningDays || typeof runningDays !== 'object') return null
  const startIso = addDays(isoDate, -(Math.max(1, departureDay) - 1))
  return Boolean(runningDays[DAY_KEYS[new Date(dayStart(startIso)).getUTCDay()]])
}

/** Calendar event for one direct journey row (journey_results block). */
export function directEvent(block, train, isoDate) {
  const j = train.journey
  return legEvent({
    date: isoDate, dep: j.departureTime, arr: j.arrivalTime, arrivalDayOffset: Math.max(0, (j.arrivalDay || 1) - (j.departureDay || 1)),
    trainNumber: train.trainNumber, trainName: train.trainName, fromName: block.from.name, toName: block.to.name,
  })
}

/** Two calendar events for a one-change option: second leg date follows the layover. */
export function transferEvents(option, isoDate) {
  const [a, b] = option.legs
  const depMin = parseHm(a.departureTime)
  const leg1Arr = depMin + a.durationMinutes
  const leg2Dep = leg1Arr + option.transfer.layoverMinutes
  const leg2Date = addDays(isoDate, Math.floor(leg2Dep / 1440))
  const note = `Change at ${option.transfer.station.name} (${option.transfer.layover} layover).`
  return [
    legEvent({ date: isoDate, dep: a.departureTime, arr: a.arrivalTime, arrivalDayOffset: Math.floor(leg1Arr / 1440),
      trainNumber: a.train.trainNumber, trainName: a.train.trainName, fromName: a.from.name, toName: a.to.name, note }),
    legEvent({ date: leg2Date, dep: b.departureTime, arr: b.arrivalTime, arrivalDayOffset: Math.floor((leg2Dep + b.durationMinutes) / 1440) - Math.floor(leg2Dep / 1440),
      trainNumber: b.train.trainNumber, trainName: b.train.trainName, fromName: b.from.name, toName: b.to.name, note }),
  ]
}

/** Colour buckets for the reachability map: thirds of the time window. */
export function reachColor(minutes, maxHours) {
  const third = (maxHours * 60) / 3
  return minutes <= third ? '#10b981' : minutes <= 2 * third ? '#f59e0b' : '#ef4444'
}

export function reachLegend(maxHours, t) {
  const h = (n) => Math.round(n * 10) / 10
  return [
    { color: '#10b981', label: t('b.within', { h: h(maxHours / 3) }) },
    { color: '#f59e0b', label: t('b.within', { h: h((2 * maxHours) / 3) }) },
    { color: '#ef4444', label: t('b.within', { h: h(maxHours) }) },
  ]
}

export function reachOverlay(block, t) {
  const o = block.origin
  const markers = []
  if (o.coordinates) {
    markers.push({ code: o.code, name: o.name, lat: o.coordinates.latitude, lng: o.coordinates.longitude, origin: true, lines: [o.state || ''] })
  }
  for (const s of block.stations) {
    if (!s.coordinates) continue
    markers.push({
      code: s.code, name: s.name, lat: s.coordinates.latitude, lng: s.coordinates.longitude,
      color: reachColor(s.durationMinutes, block.maxHours),
      lines: [`${s.duration} · ${s.viaTrain.trainNumber} ${s.viaTrain.trainName}`, s.state || ''].filter(Boolean),
    })
  }
  return { markers, legend: reachLegend(block.maxHours, t), note: block.note }
}
