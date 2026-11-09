import React, { useState, useEffect } from 'react'
import NationalMap from './NationalMap'
import { MapIcon } from './Icons'

/**
 * AssistantBlocks — renders the structured results the backend assistant returns.
 *
 * Every block is built by the backend from real MongoDB records. These components only
 * display them, and reuse the app's existing pieces:
 *   - TrainDetailModal / StationDetailModal (opened via onSelectTrain / onSelectStation)
 *   - NationalMap (embedded) for route maps
 * Styling uses the same tokens/classes as Trains.jsx, Stations.jsx and the modals.
 */

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const card = 'w-full bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-2xl overflow-hidden shadow-lg'
const chip = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20'
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition shadow-sm'
const mono = 'font-mono text-amber-500 font-bold'

function Header({ children, right }) {
  return (
    <div className="px-4 py-3 bg-[var(--c-obsidian)] border-b border-[var(--c-slate-border)] flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm font-bold text-[var(--c-text-main)]">{children}</div>
      {right}
    </div>
  )
}

function Note({ children }) {
  return (
    <p className="px-4 py-2.5 text-xs text-[var(--c-text-muted)] border-t border-[var(--c-slate-border)] bg-[var(--c-obsidian)]/60">
      {children}
    </p>
  )
}

function RunningDays({ days }) {
  if (!days) return null
  return (
    <div className="flex gap-1.5 flex-wrap">
      {DAYS.map((d) => (
        <span
          key={d}
          className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
            days[d] ? 'bg-amber-500 text-slate-950' : 'bg-[var(--c-slate-surface)] text-[var(--c-text-dim)]'
          }`}
        >
          {d}
        </span>
      ))}
    </div>
  )
}

function Fact({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="text-xs">
      <div className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--c-text-muted)]">{label}</div>
      <div className="font-semibold text-[var(--c-text-main)] mt-0.5">{value}</div>
    </div>
  )
}

function TrainRow({ t, onSelectTrain, extra }) {
  return (
    <button
      type="button"
      onClick={() => onSelectTrain && onSelectTrain(t.trainNumber)}
      className="w-full text-left p-3 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] hover:border-amber-500/50 transition flex justify-between items-center gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={mono}>{t.trainNumber}</span>
          <span className="font-bold text-sm text-[var(--c-text-main)]">{t.trainName}</span>
          {t.type ? <span className={chip}>{t.type}</span> : null}
        </div>
        <p className="text-xs text-[var(--c-text-muted)] mt-1">
          {t.source?.name} → {t.destination?.name}
        </p>
        {extra}
      </div>
      <span className="text-xs font-bold text-blue-400 whitespace-nowrap">Timetable →</span>
    </button>
  )
}

/* ───────────── individual blocks ───────────── */

function TrainCard({ block, onSelectTrain, onAsk }) {
  const t = block.train
  return (
    <div className={card}>
      <Header right={t.type ? <span className={chip}>{t.type}</span> : null}>
        <span className={mono}>{t.trainNumber}</span> <span className="ml-2">{t.trainName}</span>
      </Header>
      <div className="p-4 space-y-4">
        <p className="text-sm text-[var(--c-text-muted)]">
          {t.source?.name} ({t.source?.code}) → {t.destination?.name} ({t.destination?.code})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label="Distance" value={t.overallDistanceKm ? `${t.overallDistanceKm} km` : null} />
          <Fact label="Stops" value={t.stopCount} />
          <Fact label="Departs source" value={t.departsSource} />
          <Fact label="Arrives" value={t.arrivesDestination} />
          <Fact label="Scheduled duration" value={t.scheduledDuration} />
          <Fact label="Runs" value={t.runningDaysText} />
        </div>
        <RunningDays days={t.runningDays} />
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={btn} onClick={() => onSelectTrain(t.trainNumber)}>Full timetable →</button>
          <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${t.trainNumber} on the map`)}><MapIcon /> Show route</button>
        </div>
      </div>
    </div>
  )
}

function TrainList({ block, onSelectTrain }) {
  const shown = block.trains.length
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.total ?? shown} found</span>}>{block.title || 'Trains'}</Header>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {block.trains.map((t) => <TrainRow key={t.trainNumber} t={t} onSelectTrain={onSelectTrain} />)}
      </div>
      {block.total > shown && <Note>Showing {shown} of {block.total}. Ask me to narrow it down (for example by name or time).</Note>}
    </div>
  )
}

function StationCard({ block, onSelectStation }) {
  const s = block.station
  const alts = block.resolution?.otherMatches || []
  return (
    <div className={card}>
      <Header right={<span className={chip}>{s.zone || 'Zone N/A'}</span>}>
        <span className={mono}>{s.code}</span> <span className="ml-2">{s.name}</span>
      </Header>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label="State" value={s.state || 'Not stated'} />
          <Fact label="Zone" value={s.zone || 'Not stated'} />
          <Fact label="Trains stopping" value={s.trainCount} />
          <Fact
            label="Coordinates"
            value={s.coordinates ? `${Number(s.coordinates.latitude).toFixed(4)}, ${Number(s.coordinates.longitude).toFixed(4)}` : 'Not available'}
          />
        </div>
        {s.address ? <Fact label="Address" value={s.address} /> : null}
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={btn} onClick={() => onSelectStation(s.code)}>Trains here →</button>
        </div>
      </div>
      {alts.length > 0 && (
        <Note>Other stations matched your search: {alts.map((a) => `${a.name} (${a.code})`).join(', ')}.</Note>
      )}
    </div>
  )
}

function StationList({ block, onSelectStation }) {
  return (
    <div className={card}>
      <Header>Matching stations</Header>
      <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {block.stations.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => onSelectStation(s.code)}
            className="w-full text-left p-3 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] hover:border-amber-500/50 transition flex justify-between items-center gap-3"
          >
            <div>
              <span className={mono}>{s.code}</span>
              <span className="font-bold text-sm text-[var(--c-text-main)] ml-2">{s.name}</span>
              <p className="text-xs text-[var(--c-text-muted)] mt-1">
                {s.state || 'State not stated'}{s.zone ? ` · ${s.zone}` : ''}{s.trainCount != null ? ` · ${s.trainCount} trains` : ''}
              </p>
            </div>
            <span className="text-xs font-bold text-blue-400 whitespace-nowrap">Trains here →</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TrainRoute({ block, onViewMap }) {
  const t = block.train
  const cov = block.coordinates
  const showHalt = block.stops.some((s) => s.haltMinutes !== null && s.haltMinutes !== undefined)
  return (
    <div className={card}>
      <Header
        right={<button type="button" className={btn} onClick={() => onViewMap(t.trainNumber)}>Open on network map →</button>}
      >
        Route · <span className={mono}>{t.trainNumber}</span> <span className="ml-1">{t.trainName}</span>
      </Header>
      <div className="overflow-auto max-h-80">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--c-slate-dark)] border-b border-[var(--c-slate-border)] text-[var(--c-text-muted)] text-xs uppercase tracking-wider font-mono sticky top-0">
              <th className="p-2.5">#</th>
              <th className="p-2.5">Station</th>
              <th className="p-2.5">Arr</th>
              <th className="p-2.5">Dep</th>
              {showHalt && <th className="p-2.5">Halt</th>}
              <th className="p-2.5">Day</th>
              <th className="p-2.5 text-right">km</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--c-slate-border)]">
            {block.stops.map((s, i) => (
              <tr key={`${s.stationCode}-${i}`}>
                <td className="p-2.5 font-mono text-[var(--c-text-dim)]">{s.sequence}</td>
                <td className="p-2.5">
                  <span className="font-bold text-[var(--c-text-main)]">{s.stationName}</span>{' '}
                  <span className="font-mono text-amber-500">{s.stationCode}</span>
                </td>
                <td className="p-2.5 font-mono text-[var(--c-text-muted)]">{s.arrivalTime ? s.arrivalTime.slice(0, 5) : 'Starts'}</td>
                <td className="p-2.5 font-mono text-[var(--c-text-muted)]">{s.departureTime ? s.departureTime.slice(0, 5) : 'Ends'}</td>
                {showHalt && (
                  <td className="p-2.5 font-mono text-[var(--c-text-muted)]">
                    {s.haltMinutes !== null && s.haltMinutes !== undefined ? `${s.haltMinutes} min` : '—'}
                  </td>
                )}
                <td className="p-2.5 text-[var(--c-text-muted)]">{s.journeyDay}</td>
                <td className="p-2.5 text-right font-mono text-[var(--c-text-muted)]">{s.distance ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>
        {block.stops.length} stops, scheduled timetable times. Stations with a stored location: {cov.mapped} of {cov.total}.
      </Note>
    </div>
  )
}

function MapRoute({ block, isLatest }) {
  const [open, setOpen] = useState(isLatest)
  useEffect(() => { if (!isLatest) setOpen(false) }, [isLatest])  // keep only the newest map open
  return (
    <div className={card}>
      <Header
        right={<button type="button" className={btn} onClick={() => setOpen((o) => !o)}>{open ? 'Hide map' : 'Show map'}</button>}
      >
        <MapIcon className="mr-1.5" /> Map · <span className={mono}>{block.trainNumber}</span> <span className="ml-1">{block.trainName}</span>
      </Header>
      {open ? (
        <div className="p-3">
          <NationalMap initialTrainNumber={block.trainNumber} embedded />
        </div>
      ) : null}
      <Note>
        {block.mappedStops} of {block.totalStops} stops have stored coordinates and appear on the map.
      </Note>
    </div>
  )
}

function JourneyResults({ block, onSelectTrain, onAsk }) {
  const fastest = block.shortestScheduled?.trainNumber
  const alts = (block.resolution || []).flatMap((r) => (r.ambiguous ? [r] : []))
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.directTrainsFound} direct</span>}>
        {block.from.name} ({block.from.code}) → {block.to.name} ({block.to.code})
        {block.dayFilter ? <span className="ml-2 text-[var(--c-text-muted)] font-medium">· leaving {block.dayFilter}</span> : null}
      </Header>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {block.trains.map((t) => (
          <div key={t.trainNumber} className="space-y-1.5">
            <TrainRow
              t={t}
              onSelectTrain={onSelectTrain}
              extra={
                <p className="text-xs mt-1.5 text-[var(--c-text-main)]">
                  <span className="font-mono font-bold">{t.journey.departureTime || '?'}</span>
                  {t.journey.departureDay > 1 ? <sup> day {t.journey.departureDay}</sup> : null}
                  {' → '}
                  <span className="font-mono font-bold">{t.journey.arrivalTime || '?'}</span>
                  {t.journey.arrivalDay > 1 ? <sup> day {t.journey.arrivalDay}</sup> : null}
                  {' · '}
                  <span className="font-semibold">{t.journey.scheduledDuration || 'duration not available'}</span>
                  {t.journey.distanceKm != null ? ` · ${t.journey.distanceKm} km` : ''}
                  {' · '}{t.journey.intermediateStops} stops between
                  {t.trainNumber === fastest ? <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">Shortest scheduled</span> : null}
                </p>
              }
            />
            <div className="flex gap-2 pl-1">
              <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${t.trainNumber} on the map`)}><MapIcon /> Route</button>
            </div>
          </div>
        ))}
      </div>
      <Note>
        {block.note || 'Direct trains only. Times come from the timetable, not live running status.'}
        {block.trains.length < block.directTrainsFound ? ` Showing ${block.trains.length} of ${block.directTrainsFound}.` : ''}
        {alts.length ? ' Station names matched more than one station; the busiest match was used.' : ''}
      </Note>
    </div>
  )
}

function StationTimetable({ block, onSelectTrain }) {
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.matching ?? block.trains.length} of {block.total}</span>}>
        Trains at {block.station.name} ({block.station.code}){block.afterTime ? ` after ${block.afterTime}` : ''}
      </Header>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {block.trains.map((t) => (
          <TrainRow
            key={t.trainNumber}
            t={t}
            onSelectTrain={onSelectTrain}
            extra={
              <p className="text-xs mt-1.5 text-[var(--c-text-main)]">
                Arr <span className="font-mono font-bold">{t.atStation.arrivalTime ? t.atStation.arrivalTime.slice(0, 5) : 'starts here'}</span>
                {' · '}Dep <span className="font-mono font-bold">{t.atStation.departureTime ? t.atStation.departureTime.slice(0, 5) : 'ends here'}</span>
                {t.atStation.journeyDay > 1 ? ` · day ${t.atStation.journeyDay}` : ''}
              </p>
            }
          />
        ))}
      </div>
      <Note>Scheduled timetable times, not live running status.</Note>
    </div>
  )
}

function PositionEstimate({ block }) {
  return (
    <div className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 overflow-hidden shadow-lg">
      <div className="px-4 py-3 text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">
        Timetable estimate · not live tracking
      </div>
      <div className="px-4 pb-4 space-y-3 text-sm text-[var(--c-text-main)]">
        <p className="font-semibold">
          <span className={mono}>{block.train.trainNumber}</span> {block.train.trainName} · estimated for {block.estimatedForIST} IST
          {block.assumedNoon ? ' (12:00 assumed because no time was given)' : ''}
        </p>
        <p>{block.message}</p>
        {block.instances?.map((i) => (
          <div key={i.journeyStartDate} className="p-3 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] text-xs space-y-1">
            <div className="font-mono font-bold text-amber-500">Run that started {i.journeyStartDate}</div>
            {i.estimatedBetween ? (
              <>
                <div>
                  Last scheduled stop: <b>{i.estimatedBetween.lastScheduledStop.name}</b> (departs {i.estimatedBetween.lastScheduledStop.scheduledDeparture})
                </div>
                <div>
                  Next scheduled stop: <b>{i.estimatedBetween.nextScheduledStop.name}</b> (due {i.estimatedBetween.nextScheduledStop.scheduledArrival})
                </div>
              </>
            ) : (
              <div className="text-[var(--c-text-muted)]">{i.message}</div>
            )}
          </div>
        ))}
        <p className="text-xs text-[var(--c-text-muted)] italic">{block.disclaimer}</p>
      </div>
    </div>
  )
}

/* ───────────── dispatcher ───────────── */

export default function AssistantBlocks({ blocks, isLatest, onSelectTrain, onSelectStation, onViewMap, onAsk }) {
  if (!blocks || blocks.length === 0) return null
  return (
    <div className="w-full space-y-3 mt-2">
      {blocks.map((b, i) => {
        const key = `${b.type}-${i}`
        switch (b.type) {
          case 'train_card': return <TrainCard key={key} block={b} onSelectTrain={onSelectTrain} onAsk={onAsk} />
          case 'train_list': return <TrainList key={key} block={b} onSelectTrain={onSelectTrain} />
          case 'station_card': return <StationCard key={key} block={b} onSelectStation={onSelectStation} />
          case 'station_list': return <StationList key={key} block={b} onSelectStation={onSelectStation} />
          case 'train_route': return <TrainRoute key={key} block={b} onViewMap={onViewMap} />
          case 'map_route': return <MapRoute key={key} block={b} isLatest={isLatest} />
          case 'journey_results': return <JourneyResults key={key} block={b} onSelectTrain={onSelectTrain} onAsk={onAsk} />
          case 'station_timetable': return <StationTimetable key={key} block={b} onSelectTrain={onSelectTrain} />
          case 'position_estimate': return <PositionEstimate key={key} block={b} />
          default: return null   // unknown block types are ignored, never guessed at
        }
      })}
    </div>
  )
}
