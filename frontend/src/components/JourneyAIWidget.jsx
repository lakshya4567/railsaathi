import React, { useEffect, useRef, useState } from 'react'
import AssistantBlocks from './AssistantBlocks'
import { streamAssistantMessage } from '../services/api'

const PAGE_ALIASES = [
  { words: ['home', 'homepage', 'main page'], tab: 'home', label: 'Home' },
  { words: ['train finder', 'trains page', 'train directory'], tab: 'trains', label: 'Train Finder' },
  { words: ['station directory', 'stations page'], tab: 'stations', label: 'Station Directory' },
  { words: ['network map', 'national map', 'map page'], tab: 'map', label: 'Network Map' },
  { words: ['journey ai page', 'full journey ai'], tab: 'assistant', label: 'Journey AI' },
  { words: ['live tracking', 'train tracking'], tab: 'live-tracking', label: 'Live Tracking' },
  { words: ['pnr finder', 'pnr status'], service: 'pnr', label: 'PNR Finder' },
  { words: ['food on train', 'food ordering'], service: 'food', label: 'Food on Train' },
  { words: ['fare finder', 'seat availability'], service: 'fare', label: 'Fare & Seat Finder' },
]

function navigationIntent(raw) {
  const text = raw.toLowerCase()
  if (!/\b(open|go to|take me to|navigate to|show me the)\b/.test(text)) return null
  return PAGE_ALIASES.find((page) => page.words.some((word) => text.includes(word))) || null
}

export default function JourneyAIWidget({
  activeTab, onNavigate, onOpenServices, onSelectTrain, onSelectStation, onViewMap, lang = 'en',
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState([])
  const [messages, setMessages] = useState([])
  const [notice, setNotice] = useState('')
  const contextRef = useRef(null)
  const requestId = useRef(0)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, steps, busy])
  useEffect(() => () => { requestId.current += 1 }, [])

  const stop = () => {
    requestId.current += 1
    setBusy(false)
    setSteps((current) => [...current, { text: 'Stopped. Any response arriving later will be ignored.', state: 'stopped' }])
  }

  const ask = async (raw) => {
    const question = raw.trim()
    if (!question || busy) return
    setInput('')
    setNotice('')
    const id = ++requestId.current
    const nav = navigationIntent(question)
    const routeSearch = question.match(/(?:find|show|search)\s+(?:me\s+)?trains?\s+from\s+(.+?)\s+to\s+(.+?)(?:[?.!]|$)/i)
    // Handle a train number in the same request as a page-navigation command.
    // Keep the number as text so leading zeroes (for example, 01208) are preserved.
    const mapTrainMatch = nav?.tab === 'map'
      ? question.match(/\b(?:train\s*)?(\d{5})\s*(?:train)?\b/i)
      : null
    setMessages((current) => [...current, { role: 'user', text: question }])
    setBusy(true)
    setSteps([])

    if (nav) {
      setSteps([{ text: `Opening ${nav.label}`, state: 'active' }])
      await new Promise((resolve) => setTimeout(resolve, 250))
      if (requestId.current !== id) return
      if (nav.service) onOpenServices(nav.service)
      else if (nav.tab === 'map' && mapTrainMatch) onViewMap(mapTrainMatch[1])
      else onNavigate(nav.tab)

      if (nav.tab === 'map' && mapTrainMatch) {
        setSteps([
          { text: 'Opened Network Map', state: 'done' },
          { text: `Searching the map for train ${mapTrainMatch[1]}`, state: 'done' },
        ])
        setMessages((current) => [...current, {
          role: 'assistant',
          text: `I've opened Network Map and loaded the route search for train ${mapTrainMatch[1]}.`,
          blocks: [],
        }])
      } else {
        setSteps([{ text: `Opened ${nav.label}`, state: 'done' }])
        setMessages((current) => [...current, { role: 'assistant', text: `I've opened ${nav.label} for you.`, blocks: [] }])
      }
      setBusy(false)
      return
    }

    if (routeSearch) {
      setSteps([{ text: 'Opening Train Finder and preparing your route fields', state: 'active' }])
      onNavigate('trains')
      await new Promise((resolve) => setTimeout(resolve, 350))
      if (requestId.current !== id) return
      window.dispatchEvent(new CustomEvent('railsaathi:assistant-action', {
        detail: { type: 'route-search', from: routeSearch[1].trim(), to: routeSearch[2].trim() }
      }))
      setSteps([{ text: 'Opened Train Finder and prepared the source and destination fields. Review the station matches before searching.', state: 'done' }])
    }

    const history = messages.slice(-10).map((item) => ({ role: item.role, text: item.text }))
    try {
      const result = await streamAssistantMessage(
        question,
        history,
        contextRef.current,
        { language: lang },
        (status) => {
          if (requestId.current === id) setSteps((current) => [...current, { text: status, state: 'done' }])
        }
      )
      if (requestId.current !== id) return
      contextRef.current = result.context
      setMessages((current) => [...current, {
        role: 'assistant',
        text: result.reply || 'I could not prepare an answer.',
        blocks: result.blocks || [],
        demo: !!result.demo,
      }])
      if (result.demo) setNotice('Some displayed information is a clearly labelled demonstration, not a live railway result.')
    } catch (error) {
      if (requestId.current === id) setMessages((current) => [...current, { role: 'assistant', text: error.message || 'Journey AI is unavailable right now.', blocks: [], error: true }])
    } finally {
      if (requestId.current === id) setBusy(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    ask(input)
  }

  const handleAskFollowup = (question) => ask(question)

  return (
    <div className="fixed bottom-5 right-5 z-[1000]">
      {open && (
        <section className="mb-3 flex max-h-[min(78vh,760px)] w-[min(94vw,440px)] flex-col overflow-hidden rounded-2xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] shadow-2xl" aria-label="Journey AI Everywhere">
          <header className="flex shrink-0 items-center justify-between border-b border-[var(--c-slate-border)] px-4 py-3">
            <div>
              <div className="font-black text-[var(--c-text-main)]">Journey AI</div>
              <div className="text-[11px] text-[var(--c-text-muted)]">Railway database · Website controls · {activeTab.replace('-', ' ')}</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-[var(--c-text-muted)] hover:bg-[var(--c-slate-surface)]" aria-label="Close Journey AI">✕</button>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3 p-1">
                <p className="text-sm text-[var(--c-text-muted)]">Ask railway questions in your own words. I can look up RailSaathi's train and station database, plan scheduled journeys, compare trains, show routes and navigate the website.</p>
                <div className="flex flex-wrap gap-2">
                  {['Find trains from Raipur to Delhi', 'Tell me about train 12860', 'Show the route of train 12860 on the map', 'Open Network Map'].map((suggestion) => (
                    <button key={suggestion} type="button" disabled={busy} onClick={() => ask(suggestion)} className="rounded-full border border-[var(--c-slate-border)] px-3 py-1.5 text-left text-xs text-[var(--c-text-main)] hover:border-amber-500/60 disabled:opacity-50">{suggestion}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className={message.role === 'user'
                  ? 'ml-8 rounded-xl bg-amber-500/10 px-3 py-2.5 text-sm text-[var(--c-text-main)]'
                  : `mr-2 rounded-xl ${message.error ? 'border border-red-500/30 bg-red-500/5' : 'bg-[var(--c-obsidian)]'} px-3 py-2.5 text-sm leading-relaxed text-[var(--c-text-main)]`}>
                  {message.text}
                  {message.demo && <div className="mt-2 text-[11px] font-bold text-amber-400">DEMO information</div>}
                </div>
                {message.role === 'assistant' && message.blocks?.length > 0 && (
                  <AssistantBlocks
                    blocks={message.blocks}
                    isLatest={index === messages.length - 1}
                    lang={lang}
                    onSelectTrain={onSelectTrain}
                    onSelectStation={onSelectStation}
                    onViewMap={onViewMap}
                    onAsk={handleAskFollowup}
                    onOpenServices={onOpenServices}
                  />
                )}
              </div>
            ))}
            {steps.length > 0 && (
              <div className="rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--c-text-muted)]">Journey AI activity</div>
                <ol className="space-y-1.5">
                  {steps.map((item, index) => (
                    <li key={index} className="flex gap-2 text-xs">
                      <span className={item.state === 'stopped' ? 'text-red-400' : 'text-emerald-400'}>{item.state === 'stopped' ? 'Ⅱ' : '✓'}</span>
                      <span className="text-[var(--c-text-muted)]">{item.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {busy && <div className="px-2 text-xs text-amber-400">Journey AI is working with your railway data…</div>}
            {notice && <p role="status" className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-300">{notice}</p>}
          </div>

          <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-[var(--c-slate-border)] p-3">
            <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Ask about trains, stations or journeys…" className="min-w-0 flex-1 rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] px-3 py-2.5 text-sm text-[var(--c-text-main)] outline-none focus:border-amber-500" />
            {busy
              ? <button type="button" onClick={stop} className="rounded-xl bg-red-500 px-3 text-sm font-bold text-white">Stop</button>
              : <button type="submit" disabled={!input.trim()} className="rounded-xl bg-amber-500 px-4 text-sm font-black text-slate-950 disabled:opacity-50">Send</button>}
          </form>
          <p className="px-3 pb-2 text-[10px] text-[var(--c-text-muted)]">Uses stored timetable data, not live train tracking. Review information before making travel decisions.</p>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="ml-auto flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500 px-4 py-3 font-black text-slate-950 shadow-xl hover:bg-amber-400" aria-expanded={open}>
        <span aria-hidden="true">✦</span><span>Journey AI</span>
      </button>
    </div>
  )
}
