// share.js — plain-text journey summaries and a share/copy helper.

export function legLine(l) {
  return `${l.trainNumber} ${l.trainName || ''}: ${l.fromName} ${l.dep} -> ${l.toName} ${l.arr}${l.duration ? ` (${l.duration})` : ''}`.replace(/\s+/g, ' ')
}

export function journeyText(title, legs, footer = 'Scheduled timetable times, not live status. Shared from RailSaathi.') {
  return [title, ...legs.map(legLine), footer].join('\n')
}

export async function shareOrCopy(text, title = 'Train journey') {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled' // user closed the share sheet
  }
  return 'failed'
}
