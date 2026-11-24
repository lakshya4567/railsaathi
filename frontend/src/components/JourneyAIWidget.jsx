import React, { useEffect, useRef, useState } from 'react'

const PAGE_ALIASES = [
  { words: ['home', 'homepage', 'main page'], tab: 'home', label: 'Home' },
  { words: ['train finder', 'trains', 'train list', 'train directory'], tab: 'trains', label: 'Train Finder' },
  { words: ['station directory', 'stations', 'station list'], tab: 'stations', label: 'Station Directory' },
  { words: ['map', 'route map', 'national map', 'network map'], tab: 'map', label: 'Network Map' },
  { words: ['journey ai', 'assistant', 'ai page'], tab: 'assistant', label: 'Journey AI' },
  { words: ['live tracking', 'train tracking'], tab: 'live-tracking', label: 'Live Tracking' },
]

function parseCommand(raw) {
  const text = raw.trim()
  const lower = text.toLowerCase()
  const route = lower.match(/(?:find|show|search)\s+(?:me\s+)?trains?\s+from\s+(.+?)\s+to\s+(.+?)(?:[?.!]|$)/i)
  if (route) return { type: 'route-search', from: route[1].trim(), to: route[2].trim() }

  const pnr = text.match(/\b(?:pnr\s*(?:status|check|finder)?\s*)?(\d{10})\b/i)
  if (pnr && /pnr|status|check/i.test(lower)) return { type: 'pnr', pnr: pnr[1] }

  if (/\b(pnr|reservation status)\b/i.test(text)) return { type: 'service', service: 'pnr', label: 'PNR Finder' }
  if (/\b(food|order food|e catering|ecatering)\b/i.test(text)) return { type: 'service', service: 'food', label: 'Food on Train' }
  if (/\b(fare|ticket price|seat availability|availability)\b/i.test(text)) return { type: 'service', service: 'fare', label: 'Fare & Seat Finder' }

  const trainSearch = lower.match(/(?:search|find|look up)\s+(?:for\s+)?train\s+(.+?)(?:[?.!]|$)/i)
  if (trainSearch) return { type: 'train-search', query: text.match(/(?:search|find|look up)\s+(?:for\s+)?train\s+(.+?)(?:[?.!]|$)/i)[1].trim() }

  const stationSearch = lower.match(/(?:search|find|look up)\s+(?:for\s+)?station\s+(.+?)(?:[?.!]|$)/i)
  if (stationSearch) return { type: 'station-search', query: text.match(/(?:search|find|look up)\s+(?:for\s+)?station\s+(.+?)(?:[?.!]|$)/i)[1].trim() }

  const page = PAGE_ALIASES.find((item) => item.words.some((word) => lower.includes(word)))
  if (page && /\b(open|go to|show|take me|navigate)\b/i.test(text)) return { type: 'navigate', ...page }
  return null
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function JourneyAIWidget({ activeTab, onNavigate, onOpenServices, lang = 'en' }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState([])
  const [notice, setNotice] = useState('')
  const runId = useRef(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => () => { runId.current += 1 }, [])

  const stop = () => {
    runId.current += 1
    setBusy(false)
    setSteps((current) => current.length ? [...current, { label: 'Stopped by you', state: 'stopped' }] : current)
  }

  const execute = async (commandText) => {
    if (busy) return
    const command = parseCommand(commandText)
    setNotice('')
    if (!command) {
      setNotice('I can navigate to RailSaathi pages, search trains or stations, prepare a route search, and open railway services. Try “Find trains from Raipur to Delhi”.')
      return
    }

    const id = ++runId.current
    setBusy(true)
    setSteps([])
    const step = async (label, action) => {
      if (runId.current !== id) throw new Error('stopped')
      setSteps((current) => [...current, { label, state: 'active' }])
      await wait(320)
      if (runId.current !== id) throw new Error('stopped')
      if (action) await action()
      setSteps((current) => current.map((item, index) => index === current.length - 1 ? { ...item, state: 'done' } : item))
    }

    try {
      if (command.type === 'navigate') {
        await step(`Opening ${command.label}`, () => onNavigate(command.tab))
      } else if (command.type === 'service') {
        await step(`Opening ${command.label}`, () => onOpenServices(command.service))
      } else if (command.type === 'pnr') {
        await step('Opening PNR Finder', () => onOpenServices('pnr', { pnr: command.pnr }))
        await step('Filling the PNR field', () => {})
        setNotice('Your PNR is filled. Review it, then press “Check PNR Status” yourself to submit the lookup.')
      } else if (command.type === 'route-search') {
        await step('Opening Train Finder', () => onNavigate('trains'))
        await step(`Filling source: ${command.from}`, () => {})
        await step(`Filling destination: ${command.to}`, () => {
          window.dispatchEvent(new CustomEvent('railsaathi:assistant-action', { detail: { type: 'route-search', from: command.from, to: command.to } }))
        })
        setNotice('The stations are being matched to RailSaathi station records. Review the selections, then press Find Trains.')
      } else if (command.type === 'train-search') {
        await step('Opening Train Finder', () => onNavigate('trains'))
        await step(`Searching trains: ${command.query}`, () => window.dispatchEvent(new CustomEvent('railsaathi:assistant-action', { detail: { type: 'train-search', query: command.query } })))
      } else if (command.type === 'station-search') {
        await step('Opening Station Directory', () => onNavigate('stations'))
        await step(`Searching stations: ${command.query}`, () => window.dispatchEvent(new CustomEvent('railsaathi:assistant-action', { detail: { type: 'station-search', query: command.query } })))
      }
    } catch (error) {
      if (error.message !== 'stopped') setNotice('That action could not be completed. Please try again.')
    } finally {
      if (runId.current === id) setBusy(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    const value = input.trim()
    if (!value) return
    setInput('')
    execute(value)
  }

  return (
    <div className="fixed bottom-5 right-5 z-[1000]">
      {open && (
        <section className="mb-3 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] shadow-2xl" aria-label="Journey AI Everywhere">
          <header className="flex items-center justify-between border-b border-[var(--c-slate-border)] px-4 py-3">
            <div>
              <div className="font-black text-[var(--c-text-main)]">Journey AI</div>
              <div className="text-[11px] text-[var(--c-text-muted)]">Website assistant · {activeTab.replace('-', ' ')}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-[var(--c-text-muted)] hover:bg-[var(--c-slate-surface)]" aria-label="Close Journey AI">✕</button>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-sm text-[var(--c-text-muted)]">Tell me where to go or what to search. You can watch each action as it happens.</p>
            <div className="flex flex-wrap gap-2">
              {['Open Train Finder', 'Open PNR Finder', 'Open Network Map'].map((suggestion) => (
                <button key={suggestion} type="button" disabled={busy} onClick={() => execute(suggestion)} className="rounded-full border border-[var(--c-slate-border)] px-3 py-1.5 text-xs text-[var(--c-text-main)] hover:border-amber-500/60 disabled:opacity-50">{suggestion}</button>
              ))}
            </div>
            {steps.length > 0 && (
              <div className="rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] p-3" aria-live="polite">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--c-text-muted)]">Visible actions</div>
                <ol className="space-y-2">
                  {steps.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className={item.state === 'done' ? 'text-emerald-400' : item.state === 'stopped' ? 'text-red-400' : 'text-amber-400'}>{item.state === 'done' ? '✓' : item.state === 'stopped' ? 'Ⅱ' : '●'}</span>
                      <span className={item.state === 'active' ? 'text-[var(--c-text-main)]' : 'text-[var(--c-text-muted)]'}>{item.label}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {notice && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">{notice}</p>}
            <form onSubmit={submit} className="flex gap-2">
              <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={240} placeholder="e.g. Find trains from Raipur to Delhi" className="min-w-0 flex-1 rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] px-3 py-2.5 text-sm text-[var(--c-text-main)] outline-none focus:border-amber-500" />
              {busy ? <button type="button" onClick={stop} className="rounded-xl bg-red-500 px-3 text-sm font-bold text-white">Stop</button> : <button type="submit" disabled={!input.trim()} className="rounded-xl bg-amber-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50">Go</button>}
            </form>
            <p className="text-[10px] text-[var(--c-text-muted)]">PNR lookups are never submitted automatically. Review personal details before continuing.</p>
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-xl hover:bg-amber-400" aria-expanded={open}>
        <span aria-hidden="true">✦</span><span>Journey AI</span>
      </button>
    </div>
  )
}
