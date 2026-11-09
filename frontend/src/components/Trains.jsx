import React, { useState, useEffect } from 'react'
import { getTrains, searchTrains } from '../services/api'
import { TrainIcon } from './Icons'

export default function Trains({ onSelectTrain }) {
  const [trains, setTrains] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTrainsList = async (pg = 1, query = '') => {
    setLoading(true)
    setError(null)
    try {
      let data
      if (query.trim()) {
        data = await searchTrains(query.trim(), pg, pageSize)
      } else {
        data = await getTrains(pg, pageSize)
      }
      setTrains(data.results)
      setTotal(data.total)
    } catch (err) {
      setError('Failed to load trains. Please check connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrainsList(page, searchQuery)
  }, [page])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchTrainsList(1, searchQuery)
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6 pb-16 animate-fade-in">
      {/* Header bar */}
      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <span><TrainIcon /></span>
            <span>Master Timetable Database</span>
          </div>
          <h1 className="text-3xl font-black">Train Schedules & Routes</h1>
          <p className="text-sm text-[var(--c-text-muted)] mt-1">
            Displaying <span className="text-amber-500 font-bold">{total}</span> verified passenger train services across India
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-3 w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search train number or name..."
            className="input w-full md:w-80 bg-[var(--c-obsidian)] border-[var(--c-slate-border)] text-sm py-3 px-4 rounded-xl"
          />
          <button type="submit" className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md whitespace-nowrap">
            Search
          </button>
        </form>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-mono">{error}</div>}

      {loading ? (
        <div className="text-center py-24 text-[var(--c-text-muted)] font-mono font-semibold">Loading train records...</div>
      ) : trains.length === 0 ? (
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] text-center py-24 text-[var(--c-text-muted)] rounded-3xl">No trains found matching query.</div>
      ) : (
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--c-obsidian)] border-b border-[var(--c-slate-border)] text-[var(--c-text-muted)] text-xs uppercase tracking-wider font-mono">
                  <th className="p-4.5">Train No.</th>
                  <th className="p-4.5">Train Name</th>
                  <th className="p-4.5">Type</th>
                  <th className="p-4.5">Source</th>
                  <th className="p-4.5">Destination</th>
                  <th className="p-4.5 text-right">Distance</th>
                  <th className="p-4.5 text-center">Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-slate-border)] text-sm">
                {trains.map((t) => (
                  <tr key={t.trainNumber} className="hover:bg-[var(--c-slate-surface)]/50 transition">
                    <td className="p-4.5 font-mono font-bold text-amber-500">{t.trainNumber}</td>
                    <td className="p-4.5 font-bold">{t.trainName}</td>
                    <td className="p-4.5">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t.type || 'EXPR'}
                      </span>
                    </td>
                    <td className="p-4.5 text-[var(--c-text-muted)]">
                      {t.source?.name} <span className="font-mono text-xs text-[var(--c-text-dim)]">({t.source?.code})</span>
                    </td>
                    <td className="p-4.5 text-[var(--c-text-muted)]">
                      {t.destination?.name} <span className="font-mono text-xs text-[var(--c-text-dim)]">({t.destination?.code})</span>
                    </td>
                    <td className="p-4.5 text-right font-mono text-[var(--c-text-muted)] font-semibold">
                      {t.overallDistanceKm ? `${t.overallDistanceKm} km` : '—'}
                    </td>
                    <td className="p-4.5 text-center">
                      <button
                        onClick={() => onSelectTrain(t.trainNumber)}
                        className="px-3.5 py-1.5 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition shadow-sm"
                      >
                        Timetable →
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
              Page <span className="text-[var(--c-text-main)] font-bold">{page}</span> of <span className="text-[var(--c-text-main)] font-bold">{totalPages || 1}</span> (Total {total} trains)
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
