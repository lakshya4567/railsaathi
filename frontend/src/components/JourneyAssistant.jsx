import React, { useState, useRef, useEffect } from 'react'
import AssistantBlocks from './AssistantBlocks'
import { streamAssistantMessage, getAssistantStatus, readTicket, searchStations } from '../services/api'
import { makeT } from '../utils/i18n'
import { loadPrefs, savePrefs } from '../utils/prefs'
import { prepareImage } from '../utils/image'
import { MicIcon, ImageIcon, SettingsIcon, SpeakerIcon, CloseIcon, SearchIcon, CheckIcon, SendIcon } from './Icons'

const MAX_HISTORY = 10 // recent messages sent along with each question
const STORE_KEY = 'railsaathi_assistant_v2'
const MAX_STORED = 30

// The conversation survives switching tabs (e.g. to the map) for this browser session.
function loadSaved() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null')
    if (raw && Array.isArray(raw.messages) && raw.messages.length > 0) return raw
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return null
}

const GREETING_MSG = { role: 'assistant', greeting: true, blocks: [] }
const SpeechRecognitionImpl = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/** Reveals text quickly, like typing, then calls onDone. */
function TypedText({ text, animate, onDone }) {
  const [shown, setShown] = useState(animate ? 0 : text.length)
  useEffect(() => {
    if (!animate) { setShown(text.length); return undefined }
    const step = Math.max(2, Math.ceil(text.length / 50))
    const id = setInterval(() => {
      setShown((n) => {
        const next = Math.min(text.length, n + step)
        if (next >= text.length) { clearInterval(id); setTimeout(() => onDone && onDone(), 0) }
        return next
      })
    }, 18)
    return () => clearInterval(id)
  }, [text, animate]) // eslint-disable-line react-hooks/exhaustive-deps
  return <>{text.slice(0, shown)}</>
}

export default function JourneyAssistant({
  lang = 'en', initialQuestion = null, onInitialQuestionUsed, onSelectTrain, onSelectStation, onViewMap, onOpenServices,
}) {
  const t = makeT(lang)
  const [saved] = useState(loadSaved) // read storage once
  const [messages, setMessages] = useState(saved?.messages || [GREETING_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState([])
  const [status, setStatus] = useState(null)
  const [prefs, setPrefs] = useState(loadPrefs)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [stationQuery, setStationQuery] = useState('')
  const [stationHits, setStationHits] = useState([])
  const [notice, setNotice] = useState('')
  const contextRef = useRef(saved?.context || null) // small conversation state returned by the server
  const endRef = useRef(null)
  const fileRef = useRef(null)
  const recRef = useRef(null)
  const askRef = useRef(null)

  useEffect(() => { getAssistantStatus().then(setStatus).catch(() => setStatus(null)) }, [])

  useEffect(() => {
    try {
      const slim = messages.slice(-MAX_STORED).map(({ preview, animate, ...rest }) => rest) // never persist photos
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ messages: slim, context: contextRef.current }))
    } catch { /* storage full or blocked: conversation just won't persist */ }
  }, [messages])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, loading, steps])
  useEffect(() => { savePrefs(prefs) }, [prefs])
  useEffect(() => () => { window.speechSynthesis?.cancel(); recRef.current?.abort?.() }, [])

  const speak = (text) => {
    if (!prefs.speak || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    window.speechSynthesis.speak(u)
  }

  const ask = async (text) => {
    const question = (text ?? '').trim()
    if (!question || loading) return
    window.speechSynthesis?.cancel()
    setNotice('')
    setSettingsOpen(false)
    const history = messages
      .filter((m) => !m.error && !m.greeting && m.content)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, text: m.content }))

    setMessages((prev) => [...prev.map((m) => (m.suggestions ? { ...m, suggestions: [] } : m)), { role: 'user', content: question, blocks: [] }])
    setInput('')
    setLoading(true)
    setSteps([])
    try {
      const data = await streamAssistantMessage(
        question, history, contextRef.current,
        { language: lang, preferences: { home_station: prefs.home_station } },
        (s) => setSteps((prev) => [...prev, s])
      )
      contextRef.current = data.context
      setMessages((prev) => [...prev, {
        role: 'assistant', content: data.reply, blocks: data.blocks || [], suggestions: data.suggestions || [], demo: !!data.demo, animate: true,
      }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.message, blocks: [], error: true }])
    } finally {
      setLoading(false)
      setSteps([])
    }
  }
  askRef.current = ask

  // A question sent from the Home page search ("Ask AI").
  useEffect(() => {
    if (initialQuestion) {
      onInitialQuestionUsed && onInitialQuestionUsed()
      askRef.current(initialQuestion)
    }
  }, [initialQuestion]) // eslint-disable-line react-hooks/exhaustive-deps

  const finishTyping = (idx) => {
    setMessages((prev) => {
      const m = prev[idx]
      if (!m || !m.animate) return prev
      speak(m.content)
      return prev.map((x, i) => (i === idx ? { ...x, animate: false } : x))
    })
  }

  const handleSend = (e) => { e.preventDefault(); ask(input) }

  const newChat = () => {
    window.speechSynthesis?.cancel()
    contextRef.current = null
    setMessages([GREETING_MSG])
  }

  // Voice input (browser speech recognition; availability depends on the browser).
  const toggleListening = () => {
    if (!SpeechRecognitionImpl) { setNotice(t('ai.voiceUnsupported')); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SpeechRecognitionImpl()
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const txt = Array.from(e.results).map((r) => r[0].transcript).join('')
      setInput(txt)
      if (e.results[e.results.length - 1].isFinal && prefs.autoSendVoice) askRef.current(txt)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  // Ticket photo: shrink in the browser, send once, show what was read for the user to confirm.
  const onPickFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file || loading) return
    setNotice('')
    setSettingsOpen(false)
    setLoading(true)
    setSteps([t('ai.readingTicket')])
    try {
      const img = await prepareImage(file)
      setMessages((prev) => [...prev, { role: 'user', content: t('ai.attach'), preview: img.previewUrl, blocks: [] }])
      const ticket = await readTicket(img.base64, img.mime)
      setMessages((prev) => [...prev, {
        role: 'assistant', content: t('ai.ticketDone'), blocks: [{ type: 'ticket_extraction', ticket }], suggestions: [],
      }])
    } catch (err) {
      const msg = err.status || err.code ? err.message : t('ai.ticketBig')
      setMessages((prev) => [...prev, { role: 'assistant', content: msg, blocks: [], error: true }])
    } finally {
      setLoading(false)
      setSteps([])
    }
  }

  // Home station search inside the settings panel.
  useEffect(() => {
    if (stationQuery.trim().length < 2) { setStationHits([]); return undefined }
    const id = setTimeout(async () => {
      try { setStationHits(((await searchStations(stationQuery.trim(), 1, 5)).results) || []) } catch { setStationHits([]) }
    }, 250)
    return () => clearTimeout(id)
  }, [stationQuery])

  const lastIdx = messages.length - 1
  const onlyGreeting = messages.length === 1
  const iconBtn = 'shrink-0 w-10 h-10 sm:w-11 sm:h-11 inline-flex items-center justify-center rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] hover:border-amber-500/50 text-lg transition disabled:opacity-50'

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
      {status && !status.configured && (
        <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-500/25 text-amber-500 text-sm">
          <strong>{t('ai.setup')}</strong> Add <code>GEMINI_API_KEY</code> to <code>backend/.env</code> and restart the backend.
        </div>
      )}

      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl flex flex-col h-[calc(100vh-8.5rem)] min-h-[520px] overflow-hidden shadow-2xl">
        {/* Chat Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[var(--c-obsidian)]">
          {messages.map((m, idx) => (
            <div key={idx} className="space-y-1">
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-amber-500 text-slate-950 font-bold rounded-br-none'
                      : m.error
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400 rounded-bl-none'
                        : 'bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-[var(--c-text-main)] rounded-bl-none'
                  }`}
                >
                  {m.preview ? <img src={m.preview} alt="" className="max-h-40 rounded-lg mb-2" /> : null}
                  {m.demo ? (
                    <span className="mr-2 px-2 py-0.5 rounded bg-amber-400/15 text-amber-500 border border-amber-500/30 text-xs font-mono font-bold align-middle">
                      {t('ai.demoBadge')}
                    </span>
                  ) : null}
                  {m.greeting ? t('ai.greeting') : <TypedText text={m.content || ''} animate={!!m.animate} onDone={() => finishTyping(idx)} />}
                </div>
              </div>

              {!m.animate && m.blocks?.length > 0 && (
                <AssistantBlocks
                  blocks={m.blocks}
                  lang={lang}
                  isLatest={idx === lastIdx}
                  onSelectTrain={onSelectTrain}
                  onSelectStation={onSelectStation}
                  onViewMap={onViewMap}
                  onOpenServices={onOpenServices}
                  onAsk={ask}
                />
              )}

              {!m.animate && idx === lastIdx && m.suggestions?.length > 0 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {m.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="px-3.5 py-1.5 rounded-full bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {onlyGreeting && !loading && (
            <div className="flex flex-wrap gap-2 pt-1">
              {['ai.sug1', 'ai.sug2', 'ai.sug3', 'ai.sug4'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => ask(t(k))}
                  className="px-3.5 py-1.5 rounded-full bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div data-testid="assistant-loading" className="bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-[var(--c-text-muted)] rounded-2xl rounded-bl-none px-5 py-3.5 text-sm shadow-lg font-mono space-y-1">
                {steps.length === 0 ? <div className="italic">{t('ai.checking')}</div> : steps.map((s, i) => (
                  <div key={i} className={i === steps.length - 1 ? 'text-[var(--c-text-main)]' : 'opacity-60'}>
                    {i === steps.length - 1 ? <span className="mr-1.5">›</span> : <CheckIcon className="mr-1.5 text-emerald-400" />}{s}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="px-5 py-4 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)] space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <strong className="text-[var(--c-text-main)]">{t('ai.settings')}</strong>
              <button type="button" onClick={() => setSettingsOpen(false)} className="text-lg" aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-[var(--c-text-muted)]">{t('ai.homeStation')}</label>
              {prefs.home_station ? (
                <div className="flex items-center gap-3 text-[var(--c-text-main)]">
                  <span className="font-mono text-amber-500 font-bold">{prefs.home_station.code}</span> {prefs.home_station.name}
                  <button type="button" className="text-xs font-bold text-blue-400" onClick={() => setPrefs({ ...prefs, home_station: null })}>{t('ai.clearHome')}</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"><SearchIcon /></span>
                    <input
                      value={stationQuery}
                      onChange={(e) => setStationQuery(e.target.value)}
                      placeholder={t('ai.homeHint')}
                      className="input bg-[var(--c-slate-dark)] border-[var(--c-slate-border)] text-sm py-2 pl-9 pr-3 rounded-xl w-full"
                    />
                  </div>
                  {stationHits.length > 0 && (
                    <div className="rounded-xl border border-[var(--c-slate-border)] overflow-hidden">
                      {stationHits.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          onClick={() => { setPrefs({ ...prefs, home_station: { code: s.code, name: s.name } }); setStationQuery(''); setStationHits([]) }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--c-slate-surface)] border-b border-[var(--c-slate-border)] last:border-0"
                        >
                          <span className="font-mono text-amber-500 font-bold">{s.code}</span> <span className="text-[var(--c-text-main)]">{s.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--c-text-main)]">
              <input type="checkbox" checked={prefs.speak} onChange={(e) => { if (!e.target.checked) window.speechSynthesis?.cancel(); setPrefs({ ...prefs, speak: e.target.checked }) }} />
              <SpeakerIcon /> {t('ai.speak')}
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--c-text-main)]">
              <input type="checkbox" checked={prefs.autoSendVoice} onChange={(e) => setPrefs({ ...prefs, autoSendVoice: e.target.checked })} />
              <MicIcon /> {t('ai.autoSend')}
            </label>
          </div>
        )}

        {notice && <div className="px-5 py-2 bg-amber-400/10 text-amber-500 text-xs border-t border-amber-500/20">{notice}</div>}

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)] flex gap-2 sm:gap-2.5 items-center">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickFile} />
          <button type="button" className={iconBtn} title={t('ai.attach')} aria-label={t('ai.attach')} disabled={loading} onClick={() => fileRef.current?.click()}><ImageIcon /></button>
          <button
            type="button"
            className={`${iconBtn} ${listening ? 'border-red-500 text-red-400' : ''}`}
            title={listening ? t('ai.listening') : t('ai.mic')}
            aria-label={t('ai.mic')}
            disabled={loading}
            onClick={toggleListening}
          >
            <MicIcon />
          </button>
          <input
            type="text"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? t('ai.listening') : t('ai.placeholder')}
            className="input bg-[var(--c-slate-dark)] border-[var(--c-slate-border)] text-sm py-3 px-3 sm:px-4 rounded-xl flex-1 min-w-0"
          />
          <button
            type="submit"
            aria-label={t('ai.send')}
            disabled={loading || !input.trim()}
            className="shrink-0 px-4 sm:px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SendIcon className="sm:hidden text-xl" />
            <span className="hidden sm:inline">{t('ai.send')}</span>
          </button>
        </form>
        <div className="px-5 py-2 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)] flex justify-between items-center gap-3 text-xs text-[var(--c-text-muted)]">
          <span>{t('ai.footnote')}</span>
          <span className="flex items-center gap-4 shrink-0">
            <button type="button" onClick={() => setSettingsOpen((o) => !o)} className="inline-flex items-center gap-1.5 font-bold hover:text-amber-500 transition">
              <SettingsIcon /> {t('ai.settings')}
            </button>
            {!onlyGreeting && (
              <button type="button" onClick={newChat} className="font-bold hover:text-amber-500 transition">{t('ai.newChat')}</button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
