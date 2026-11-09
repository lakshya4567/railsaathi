import React, { useState, useEffect } from 'react'
import { getTrainDetail, getTrainPosition } from '../services/api'
import { CloseIcon, MapIcon } from './Icons'

export default function TrainDetailModal({ trainNumber, onClose, onViewMap }) {
  const [train, setTrain] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('timetable')

  const [estDate, setEstDate] = useState(new Date().toISOString().split('T')[0])
  const [estTime, setEstTime] = useState('')
  const [positionResult, setPositionResult] = useState(null)
  const [posLoading, setPosLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getTrainDetail(trainNumber)
        setTrain(data)
      } catch (err) {
        setError('Failed to load train details.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [trainNumber])

  const handleEstimatePosition = async (e) => {
    e.preventDefault()
    setPosLoading(true)
    setPositionResult(null)
    try {
      const res = await getTrainPosition(trainNumber, estDate, estTime || null)
      setPositionResult(res)
    } catch (err) {
      setPositionResult({ status: 'error', message: 'Could not calculate position estimate.' })
    } finally {
      setPosLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] p-8 rounded-3xl text-center shadow-2xl">
          <p className="text-[var(--c-text-muted)] font-mono font-semibold">Loading train telemetry...</p>
        </div>
      </div>
    )
  }

  if (error || !train) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
        <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] p-8 rounded-3xl text-center space-y-4 max-w-md w-full shadow-2xl">
          <p className="text-red-400 font-bold">{error || 'Train not found'}</p>
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs font-bold w-full">
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[400] flex items-center justify-center p-4">
      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-[var(--c-obsidian)] border-b border-[var(--c-slate-border)] p-6 sm:p-8 flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <span className="font-mono bg-amber-500 text-slate-950 px-3 py-1 rounded-xl font-black text-sm shadow">
                {train.trainNumber}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {train.type || 'EXPR'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--c-text-main)]">{train.trainName}</h2>
            <p className="text-sm text-[var(--c-text-muted)] font-medium">
              {train.source?.name} ({train.source?.code}) → {train.destination?.name} ({train.destination?.code}) • <span className="text-amber-500 font-bold">{train.overallDistanceKm} km</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-[var(--c-slate-surface)] hover:bg-[var(--c-slate-border)] text-[var(--c-text-muted)] hover:text-[var(--c-text-main)] flex items-center justify-center font-bold text-lg transition"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Subnav */}
        <div className="flex border-b border-[var(--c-slate-border)] bg-[var(--c-obsidian)]/60 px-6 sm:px-8 gap-4">
          <button
            onClick={() => setActiveTab('timetable')}
            className={`py-4 px-2 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
              activeTab === 'timetable'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text-main)]'
            }`}
          >
            Timetable & Route ({train.completeOrderedRoute?.length || 0} Stops)
          </button>
          <button
            onClick={() => setActiveTab('position')}
            className={`py-4 px-2 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
              activeTab === 'position'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-[var(--c-text-muted)] hover:text-[var(--c-text-main)]'
            }`}
          >
            Scheduled Position Estimator
          </button>
          <div className="ml-auto flex items-center">
            <button
              onClick={() => {
                onClose()
                onViewMap(train.trainNumber)
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md"
            >
              <MapIcon className="mr-1.5" /> Map Route
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'timetable' ? (
            <div className="space-y-6">
              <div className="bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] p-4 rounded-2xl flex flex-wrap gap-6 items-center">
                <span className="text-xs font-mono font-bold uppercase text-[var(--c-text-muted)] tracking-wider">Running Days:</span>
                <div className="flex gap-2">
                  {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => {
                    const active = train.runningDays?.[d]
                    return (
                      <span
                        key={d}
                        className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                          active ? 'bg-amber-500 text-slate-950 shadow' : 'bg-[var(--c-slate-surface)] text-[var(--c-text-dim)]'
                        }`}
                      >
                        {d}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-[var(--c-slate-dark)] border-b border-[var(--c-slate-border)] text-[var(--c-text-muted)] text-xs uppercase tracking-wider font-mono">
                      <th className="p-4">#</th>
                      <th className="p-4">Station Name</th>
                      <th className="p-4">Code</th>
                      <th className="p-4">Arrival</th>
                      <th className="p-4">Departure</th>
                      <th className="p-4">Day</th>
                      <th className="p-4 text-right">Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-slate-border)]">
                    {train.completeOrderedRoute?.map((stop) => (
                      <tr key={stop.sequence} className="hover:bg-[var(--c-slate-surface)]/50 transition">
                        <td className="p-4 font-mono text-[var(--c-text-dim)] font-semibold">{stop.sequence}</td>
                        <td className="p-4 font-bold text-[var(--c-text-main)]">{stop.stationName}</td>
                        <td className="p-4 font-mono font-bold text-amber-500">{stop.stationCode}</td>
                        <td className="p-4 font-mono text-[var(--c-text-muted)]">{stop.arrivalTime || 'Starts'}</td>
                        <td className="p-4 font-mono text-[var(--c-text-muted)]">{stop.departureTime || 'Terminates'}</td>
                        <td className="p-4 text-[var(--c-text-muted)] font-medium">Day {stop.journeyDay}</td>
                        <td className="p-4 text-right font-mono text-[var(--c-text-muted)]">
                          {stop.distance !== undefined ? `${stop.distance} km` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs space-y-1">
                <strong className="block text-sm font-bold">Scheduled Position Estimation Note</strong>
                <p>
                  Calculates an <strong>ESTIMATED</strong> position based solely on scheduled timetable timings. Not live GPS tracking.
                </p>
              </div>

              <form onSubmit={handleEstimatePosition} className="bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] p-6 rounded-2xl grid sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-[var(--c-text-muted)] mb-2">Journey Date</label>
                  <input
                    type="date"
                    value={estDate}
                    onChange={(e) => setEstDate(e.target.value)}
                    className="w-full bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-xl px-4 py-3 text-sm text-[var(--c-text-main)] font-medium focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-[var(--c-text-muted)] mb-2">Query Time (UTC, Optional)</label>
                  <input
                    type="time"
                    step="1"
                    value={estTime}
                    onChange={(e) => setEstTime(e.target.value)}
                    className="w-full bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-xl px-4 py-3 text-sm text-[var(--c-text-main)] font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <button type="submit" disabled={posLoading} className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition shadow-md">
                    {posLoading ? 'Calculating...' : 'Estimate Position'}
                  </button>
                </div>
              </form>

              {positionResult && (
                <div className="bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] p-6 rounded-2xl space-y-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    positionResult.status === 'between_stops' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    positionResult.status === 'not_started' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    Status: {positionResult.status.replace('_', ' ')}
                  </span>

                  <p className="text-lg font-bold text-[var(--c-text-main)]">{positionResult.message}</p>

                  {positionResult.estimated_segment && (
                    <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/50 space-y-2 text-sm">
                      <div className="font-bold text-amber-500 font-mono text-xs uppercase tracking-wider">Current Segment Estimate:</div>
                      <div className="grid sm:grid-cols-2 gap-2 text-[var(--c-text-muted)]">
                        <div>Departed: <span className="font-bold text-[var(--c-text-main)]">{positionResult.estimated_segment.from_stop.stationName}</span> at <span className="font-mono text-amber-500">{positionResult.estimated_segment.departed_at}</span></div>
                        <div>Arrives: <span className="font-bold text-[var(--c-text-main)]">{positionResult.estimated_segment.to_stop.stationName}</span> at <span className="font-mono text-amber-500">{positionResult.estimated_segment.arrives_at}</span></div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[var(--c-text-dim)] italic pt-2 border-t border-[var(--c-slate-border)]">
                    {positionResult.disclaimer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
