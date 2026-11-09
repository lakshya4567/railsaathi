import React, { useState, useRef, useEffect } from 'react'
import AssistantBlocks from './AssistantBlocks'
import { sendAssistantMessage, getAssistantStatus } from '../services/api'

const GREETING =
  "Hello! I'm your RailSaathi journey assistant. Ask me about train routes, timetables or railway stations across India. I look everything up in the railway database."

const SUGGESTIONS = [
  'Tell me about train 12951',
  'Trains from Raipur to Nagpur',
  'Tell me about Raipur Junction',
]

const MAX_HISTORY = 10 // recent messages sent along with each question
const STORE_KEY = 'railsaathi_assistant_v1'
const MAX_STORED = 30

// The conversation survives switching tabs (e.g. to the map) for this browser session.
function loadSaved() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null')
    if (raw && Array.isArray(raw.messages) && raw.messages.length > 0) return raw
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return null
}

export default function JourneyAssistant({ onSelectTrain, onSelectStation, onViewMap }) {
  const [saved] = useState(loadSaved) // read storage once
  const [messages, setMessages] = useState(saved?.messages || [{ role: 'assistant', content: GREETING, blocks: [] }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const contextRef = useRef(saved?.context || null) // small conversation state returned by the server
  const endRef = useRef(null)

  useEffect(() => {
    getAssistantStatus().then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORE_KEY,
        JSON.stringify({ messages: messages.slice(-MAX_STORED), context: contextRef.current })
      )
    } catch { /* storage full or blocked: conversation just won't persist */ }
  }, [messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const ask = async (text) => {
    const question = (text ?? '').trim()
    if (!question || loading) return

    // Plain-text history only (cards are not re-sent); skip errors and the greeting.
    const history = messages
      .filter((m, i) => !m.error && i > 0)
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, text: m.content }))

    setMessages((prev) => [...prev, { role: 'user', content: question, blocks: [] }])
    setInput('')
    setLoading(true)
    try {
      const data = await sendAssistantMessage(question, history, contextRef.current)
      contextRef.current = data.context
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, blocks: data.blocks || [] }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.message, blocks: [], error: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    ask(input)
  }

  const newChat = () => {
    contextRef.current = null
    setMessages([{ role: 'assistant', content: GREETING, blocks: [] }])
  }

  const lastIdx = messages.length - 1
  const onlyGreeting = messages.length === 1

  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
      {status && !status.configured && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs">
          <strong>Setup needed:</strong> the AI service is not configured on the server yet. Add <code>GEMINI_API_KEY</code> to{' '}
          <code>backend/.env</code> and restart the backend. Until then the assistant cannot answer.
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
                  {m.content}
                </div>
              </div>
              {m.blocks?.length > 0 && (
                <AssistantBlocks
                  blocks={m.blocks}
                  isLatest={idx === lastIdx}
                  onSelectTrain={onSelectTrain}
                  onSelectStation={onSelectStation}
                  onViewMap={onViewMap}
                  onAsk={ask}
                />
              )}
            </div>
          ))}

          {onlyGreeting && !loading && (
            <div className="flex flex-wrap gap-2 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-[var(--c-text-muted)] rounded-2xl rounded-bl-none px-5 py-3.5 text-sm italic shadow-lg font-mono">
                Checking the railway database…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)] flex gap-3">
          <input
            type="text"
            value={input}
            maxLength={500}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about trains, routes, or stations..."
            className="input bg-[var(--c-slate-dark)] border-[var(--c-slate-border)] text-sm py-3 px-4 rounded-xl flex-1"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send message
          </button>
        </form>
        <div className="px-5 py-2 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)] flex justify-between items-center text-xs text-[var(--c-text-muted)]">
          <span>Answers come from the timetable database. Positions are timetable estimates, not live tracking.</span>
          {!onlyGreeting && (
            <button type="button" onClick={newChat} className="font-bold hover:text-amber-500 transition">
              New chat
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
