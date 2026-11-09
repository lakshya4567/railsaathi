import React, { useState, useEffect } from 'react'
import { getStations, searchStations } from '../services/api'
import { StationIcon } from './Icons'

export default function Stations({ onSelectStation }) {
  const [stations, setStations] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadStations = async (pg = 1, q = '') => {
    setLoading(true)
    setError(null)
    try {
      let data
      if (q.trim()) {
        data = await searchStations(q.trim(), pg, pageSize)
      } else {
        data = await getStations(pg, pageSize)
      }
      setStations(data.results)
      setTotal(data.total)
    } catch (err) {
      setError('Failed to load stations.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStations(page, query)
  }, [page])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadStations(1, query)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <span><StationIcon /></span>
            <span>Station Network Registry</span>
          </div>
          <h1 className="text-3xl font-black">Station Directory</h1>
          <p className="text-sm text-[var(--c-text-muted)] mt-1">
            Displaying <span className="text-amber-500 font-bold">{total}</span> verified station nodes across India
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 w-full md:w-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search station code or name..."
            className="input w-full md:w-80 bg-[var(--c-obsidian)] border-[var(--c-slate-border)] text-sm py-3 px-4 rounded-xl"
          />
          <button type="submit" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md whitespace-nowrap">
            Search
          </button>
        </form>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-mono">{error}</div>}

      {loading ? (
        <div className="text-center py-24 text-[var(--c-text-muted)] font-mono font-semibold">Loading station records...</div>
      ) : stations.length === 0 ? (
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] text-center py-24 text-[var(--c-text-muted)] rounded-3xl">No stations found matching query.</div>
      ) : (
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--c-obsidian)] border-b border-[var(--c-slate-border)] text-[var(--c-text-muted)] text-xs uppercase tracking-wider font-mono">
                  <th className="p-4.5">Station Code</th>
                  <th className="p-4.5">Station Name</th>
                  <th className="p-4.5">State</th>
                  <th className="p-4.5">Zone</th>
                  <th className="p-4.5">Coordinates</th>
                  <th className="p-4.5 text-center">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-slate-border)] text-sm">
                {stations.map((s) => (
                  <tr key={s.code} className="hover:bg-[var(--c-slate-surface)]/50 transition">
                    <td className="p-4.5 font-mono font-bold text-amber-500">{s.code}</td>
                    <td className="p-4.5 font-bold">{s.name}</td>
                    <td className="p-4.5 text-[var(--c-text-muted)]">{s.state || '—'}</td>
                    <td className="p-4.5">
                      {s.zone ? (
                        <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[var(--c-obsidian)] text-[var(--c-text-main)] border border-[var(--c-slate-border)]">
                          {s.zone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-4.5 font-mono text-xs text-[var(--c-text-muted)]">
                      {s.coordinates && s.coordinates.latitude ? (
                        `${s.coordinates.latitude.toFixed(4)}, ${s.coordinates.longitude.toFixed(4)}`
                      ) : (
                        <span className="text-amber-500">N/A</span>
                      )}
                    </td>
                    <td className="p-4.5 text-center">
                      <button
                        onClick={() => onSelectStation(s.code)}
                        className="px-3.5 py-1.5 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition shadow-sm"
                      >
                        Trains Here →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center p-6 bg-[var(--c-obsidian)] border-t border-[var(--c-slate-border)]">
            <span className="text-xs text-[var(--c-text-muted)] font-mono">
              Page <span className="text-[var(--c-text-main)] font-bold">{page}</span> of <span className="text-[var(--c-text-main)] font-bold">{totalPages || 1}</span> (Total {total} stations)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1 || loading}
                className="px-4 py-2 rounded-xl bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs font-bold hover:bg-[var(--c-slate-border)] transition disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="px-4 py-2 rounded-xl bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs font-bold hover:bg-[var(--c-slate-border)] transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
