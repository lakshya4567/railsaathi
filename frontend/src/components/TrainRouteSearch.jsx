import React, { useEffect, useState } from 'react'
import { searchStations, searchTrainsBetweenStations } from '../services/api'
import { SwapIcon, ArrowRightIcon } from './Icons'

function StationPicker({ label, value, selected, onChange, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (selected || query.length < 2) {
      setSuggestions([])
      return
    }
    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchStations(query, 1, 7)
        if (active) setSuggestions(data.results || [])
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [value, selected])

  return (
    <div className="relative min-w-0">
      <label className="block text-xs font-bold uppercase tracking-wider text-[var(--c-text-muted)] mb-2">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] px-4 py-3.5 text-sm text-[var(--c-text-main)] outline-none focus:border-amber-500"
      />
      {selected && (
        <div className="mt-1 text-xs text-emerald-500 font-semibold">Selected: {selected.name} · {selected.code}</div>
      )}
      {!selected && suggestions.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] shadow-2xl">
          {suggestions.map((station) => (
            <button
              type="button"
              key={station.code}
              onClick={() => { onSelect(station); setSuggestions([]) }}
              className="w-full px-4 py-3 text-left hover:bg-[var(--c-slate-surface)] border-b last:border-b-0 border-[var(--c-slate-border)]"
            >
              <span className="block text-sm font-bold text-[var(--c-text-main)]">{station.name}</span>
              <span className="text-xs font-mono text-amber-500">{station.code}{station.state ? ` · ${station.state}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      {!selected && loading && <p className="mt-1 text-xs text-[var(--c-text-dim)]">Finding stations…</p>}
    </div>
  )
}

export default function TrainRouteSearch() {
  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [fromStation, setFromStation] = useState(null)
  const [toStation, setToStation] = useState(null)
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleAssistantAction = async (event) => {
      const action = event.detail
      if (action?.type !== 'route-search') return
      setError('')
      setResults([])
      setSearched(false)
      const resolveStation = async (query) => {
        const data = await searchStations(query, 1, 8)
        const hits = data.results || []
        const normalized = query.toLowerCase().replace(/\\s+/g, ' ').trim()
        return hits.find((station) => station.code?.toLowerCase() === normalized || station.name?.toLowerCase() === normalized)
          || hits[0]
          || null
      }
      try {
        const [from, to] = await Promise.all([resolveStation(action.from), resolveStation(action.to)])
        if (!from || !to) {
          setError('Journey AI could not match one or both station names. Please choose them from the station suggestions.')
          return
        }
        setFromStation(from)
        setToStation(to)
        setFromText(`${from.name} (${from.code})`)
        setToText(`${to.name} (${to.code})`)
      } catch {
        setError('Could not look up the requested stations. Please try again.')
      }
    }
    window.addEventListener('railsaathi:assistant-action', handleAssistantAction)
    return () => window.removeEventListener('railsaathi:assistant-action', handleAssistantAction)
  }, [])

  const handleSearch = async (event) => {
    event.preventDefault()
    if (!fromStation || !toStation) {
      setError('Select both stations from the suggestions before searching.')
      return
    }
    if (fromStation.code === toStation.code) {
      setError('Choose two different stations.')
      return
    }
    setLoading(true)
    setError('')
    setSearched(true)
    setResults([])
    try {
      const data = await searchTrainsBetweenStations(fromStation.code, toStation.code)
      setResults(data.results || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Could not search this route. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const swapStations = () => {
    setFromText(toText)
    setToText(fromText)
    setFromStation(toStation)
    setToStation(fromStation)
    setResults([])
    setSearched(false)
    setError('')
  }

  return (
    <section className="mb-7 rounded-3xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] p-5 sm:p-7 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-1">Plan your route</div>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--c-text-main)]">Find trains between stations</h2>
          <p className="text-sm text-[var(--c-text-muted)] mt-1">Search trains that stop at both stations in the correct journey order.</p>
        </div>
        <span className="self-start sm:self-auto rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-500">Powered by RailSaathi database</span>
      </div>

      <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
        <StationPicker label="From station" value={fromText} selected={fromStation}
          onChange={(value) => { setFromText(value); setFromStation(null); setSearched(false) }}
          onSelect={(station) => { setFromStation(station); setFromText(`${station.name} (${station.code})`); setSearched(false) }}
          placeholder="Search station name or code" />
        <button type="button" onClick={swapStations} title="Swap stations"
          className="h-12 w-12 justify-self-center rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] text-[var(--c-text-muted)] hover:text-amber-500 text-xl"><SwapIcon /></button>
        <StationPicker label="To station" value={toText} selected={toStation}
          onChange={(value) => { setToText(value); setToStation(null); setSearched(false) }}
          onSelect={(station) => { setToStation(station); setToText(`${station.name} (${station.code})`); setSearched(false) }}
          placeholder="Search destination station" />
        <button type="submit" disabled={loading}
          className="h-12 rounded-xl bg-amber-500 px-6 text-sm font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-60">
          {loading ? 'Searching…' : 'Find Trains'}
        </button>
      </form>

      {error && <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

      {searched && !loading && !error && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-bold text-[var(--c-text-main)]">{total} train{total === 1 ? '' : 's'} found</h3>
            <span className="text-xs text-[var(--c-text-muted)]">{fromStation?.code} <ArrowRightIcon className="inline mx-1" /> {toStation?.code}</span>
          </div>
          {results.length === 0 ? (
            <div className="rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] p-5 text-sm text-[var(--c-text-muted)]">
              No trains were found that stop at both stations in this order.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((train) => (
                <article key={train.trainNumber} className="rounded-2xl border border-[var(--c-slate-border)] bg-[var(--c-obsidian)] p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono font-bold text-amber-500">{train.trainNumber} · {train.type || 'TRAIN'}</div>
                      <h4 className="mt-1 font-extrabold text-[var(--c-text-main)]">{train.trainName}</h4>
                      <p className="mt-1 text-xs text-[var(--c-text-muted)]">{train.source?.name || 'Origin'} <ArrowRightIcon className="inline mx-1" /> {train.destination?.name || 'Destination'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:min-w-[280px]">
                      <div>
                        <div className="text-xs text-[var(--c-text-muted)]">Departs</div>
                        <div className="font-mono font-bold text-[var(--c-text-main)]">{train.fromStop?.departureTime || '—'}</div>
                        <div className="text-xs text-[var(--c-text-dim)]">Day {train.fromStop?.journeyDay ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--c-text-muted)]">Arrives</div>
                        <div className="font-mono font-bold text-[var(--c-text-main)]">{train.toStop?.arrivalTime || '—'}</div>
                        <div className="text-xs text-[var(--c-text-dim)]">Day {train.toStop?.journeyDay ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              {total > results.length && <p className="text-xs text-[var(--c-text-muted)]">Showing the first {results.length} matching trains.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
