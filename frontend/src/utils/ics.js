// ics.js — build a calendar file (.ics) for scheduled train journeys. Pure functions, no dependencies.
// Times are the printed timetable in India time (IST, UTC+05:30, no daylight saving).

const pad = (n) => String(n).padStart(2, '0')

function escapeText(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// RFC 5545 says lines should be at most 75 octets; fold longer ones.
function fold(line) {
  const out = []
  let rest = line
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74) }
  out.push(rest)
  return out.join('\r\n')
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

const stamp = (isoDate, hhmm) => `${isoDate.replace(/-/g, '')}T${hhmm.slice(0, 2)}${hhmm.slice(3, 5)}00`

/**
 * One scheduled leg. `date` is the calendar date of departure (YYYY-MM-DD); dep/arr are 'HH:MM';
 * arrivalDayOffset is how many calendar days after departure the train arrives.
 */
export function legEvent({ date, dep, arr, arrivalDayOffset = 0, trainNumber, trainName, fromName, toName, note }) {
  let offset = arrivalDayOffset
  if (offset === 0 && arr < dep) offset = 1 // arrives after midnight
  return {
    uid: `${trainNumber}-${date}-${dep}@railsaathi`,
    start: stamp(date, dep),
    end: stamp(addDays(date, offset), arr),
    summary: `Train ${trainNumber} ${trainName || ''}: ${fromName} to ${toName}`.replace(/\s+/g, ' ').trim(),
    location: fromName,
    description:
      `Scheduled times from the railway timetable (India time). Check running days and any changes before you travel.` +
      (note ? `\n${note}` : ''),
  }
}

export function buildIcs(events, now = new Date()) {
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RailSaathi//Journey//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Kolkata', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0530', 'TZOFFSETTO:+0530', 'TZNAME:IST', 'END:STANDARD', 'END:VTIMEZONE',
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Asia/Kolkata:${e.start}`, `DTEND;TZID=Asia/Kolkata:${e.end}`,
      `SUMMARY:${escapeText(e.summary)}`, `LOCATION:${escapeText(e.location)}`, `DESCRIPTION:${escapeText(e.description)}`,
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadFile(filename, text, mime = 'text/calendar;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function tomorrowIso(now = new Date()) {
  const d = new Date(now.getTime() + 24 * 3600 * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
