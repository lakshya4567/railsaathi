import React, { useState, useEffect } from 'react'
import { getStationDetail, getStationTrains } from '../services/api'
import { CloseIcon } from './Icons'

export default function StationDetailModal({ stationCode, onClose, onSelectTrain }) {
  const [station, setStation] = useState(null)
  const [trains, setTrains] = useState([])
  const [totalTrains, setTotalTrains] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [stData, trData] = await Promise.all([
          getStationDetail(stationCode),
          getStationTrains(stationCode, 1, 50),
        ])
        setStation(stData)
        setTrains(trData.results)
        setTotalTrains(trData.total)
      } catch (err) {
        setError('Failed to load station details.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [stationCode])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] p-8 rounded-3xl text-center shadow-2xl">
          <p className="text-[var(--c-text-muted)] font-mono font-semibold">Loading station telemetry...</p>
        </div>
      </div>
    )
  }

  if (error || !station) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] p-8 rounded-3xl text-center space-y-4 max-w-md w-full shadow-2xl">
          <p className="text-red-400 font-bold">{error || 'Station not found'}</p>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs font-bold w-full">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-[var(--c-obsidian)] border-b border-[var(--c-slate-border)] p-6 sm:p-8 flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="font-mono bg-amber-500 text-slate-950 px-3 py-1 rounded-xl font-black text-sm shadow">
                {station.code}
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[var(--c-slate-surface)] text-[var(--c-text-main)] border border-[var(--c-slate-border)]">
                {station.zone || 'Zone N/A'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--c-text-main)]">{station.name}</h2>
            <p className="text-sm text-[var(--c-text-muted)] font-medium">
              State: <span className="text-amber-500 font-bold">{station.state || 'N/A'}</span> • {station.address || station.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[var(--c-slate-surface)] hover:bg-[var(--c-slate-border)] text-[var(--c-text-muted)] hover:text-[var(--c-text-main)] flex items-center justify-center font-bold text-lg transition"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-[var(--c-text-main)]">Trains Stopping at {station.name}</h3>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">{totalTrains} trains recorded</span>
            </div>

            {trains.length === 0 ? (
              <p className="text-[var(--c-text-muted)] text-sm italic p-6 bg-[var(--c-obsidian)] rounded-2xl border border-[var(--c-slate-border)]">
                No trains recorded stopping at this station.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-2">
                {trains.map((t) => (
                  <div
                    key={t.trainNumber}
                    onClick={() => {
                      onClose()
                      onSelectTrain(t.trainNumber)
                    }}
                    className="p-4 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] hover:border-amber-500/50 cursor-pointer transition flex justify-between items-center group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-amber-500">{t.trainNumber}</span>
                        <span className="font-bold text-[var(--c-text-main)] group-hover:text-amber-400 transition-colors">{t.trainName}</span>
                      </div>
                      <p className="text-xs text-[var(--c-text-muted)] mt-1">
                        {t.source?.name} → {t.destination?.name}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                      Timetable →
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
