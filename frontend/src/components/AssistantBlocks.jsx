import React, { useState, useEffect } from 'react'
import NationalMap from './NationalMap'
import {
  MapIcon, CalendarIcon, ShareIcon, WarningIcon, CheckIcon, SwapIcon, TicketIcon, Dot, ArrowRightIcon,
} from './Icons'
import { buildIcs, downloadFile, tomorrowIso } from '../utils/ics'
import { journeyText, shareOrCopy } from '../utils/share'
import { runsOn, directEvent, transferEvents, reachOverlay } from '../utils/journey'
import { makeT } from '../utils/i18n'

/**
 * AssistantBlocks — renders the structured results the backend assistant returns.
 *
 * Every block is built by the backend from real MongoDB records (or, for blocks marked DEMO,
 * from clearly simulated data). These components only display them and reuse the app's pieces:
 *   - TrainDetailModal / StationDetailModal (opened via onSelectTrain / onSelectStation)
 *   - NationalMap (embedded route map, or marker overlay) for maps
 */

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const card = 'w-full bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-2xl overflow-hidden shadow-lg'
const chip = 'px-2.5 py-1 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20'
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] hover:border-amber-500/50 text-xs font-bold transition shadow-sm'
const mono = 'font-mono text-amber-500 font-bold'
const th = 'p-2.5 text-xs uppercase tracking-wider font-mono text-[var(--c-text-muted)]'

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

function DemoBanner({ t, notice }) {
  return (
    <div className="px-4 py-2.5 bg-amber-400/10 border-b border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-500">
      <WarningIcon className="text-base mt-0.5" />
      <span>
        <strong className="font-mono tracking-wider">{t('demo.banner')}</strong> {notice ? notice.replace(/^DEMO:\s*/i, '') : t('demo.notice')}
      </span>
    </div>
  )
}

function TrainRow({ t, tr, onSelectTrain, extra }) {
  return (
    <button
      type="button"
      onClick={() => onSelectTrain && onSelectTrain(tr.trainNumber)}
      className="w-full text-left p-3 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] hover:border-amber-500/50 transition flex justify-between items-center gap-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={mono}>{tr.trainNumber}</span>
          <span className="font-bold text-sm text-[var(--c-text-main)]">{tr.trainName}</span>
          {tr.type ? <span className={chip}>{tr.type}</span> : null}
        </div>
        {tr.source ? (
          <p className="text-xs text-[var(--c-text-muted)] mt-1">{tr.source?.name} → {tr.destination?.name}</p>
        ) : null}
        {extra}
      </div>
      <span className="text-xs font-bold text-blue-400 whitespace-nowrap">{t('b.timetable')} <ArrowRightIcon className="ml-1 inline" /></span>
    </button>
  )
}

/** Calendar + share controls shared by journey cards. */
function JourneyActions({ t, date, setDate, onCalendar, shareText }) {
  const [msg, setMsg] = useState('')
  const share = async () => {
    const r = await shareOrCopy(shareText)
    setMsg(r === 'copied' ? t('b.copied') : r === 'shared' ? t('b.shared') : '')
    if (r === 'copied' || r === 'shared') setTimeout(() => setMsg(''), 2500)
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-2 text-xs text-[var(--c-text-muted)]">
        {t('b.date')}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="px-2 py-1 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs text-[var(--c-text-main)]"
        />
      </label>
      <button type="button" className={btn} onClick={onCalendar}><CalendarIcon /> {t('b.calendar')}</button>
      <button type="button" className={btn} onClick={share}><ShareIcon /> {t('b.share')}</button>
      {msg ? <span className="text-xs text-emerald-400">{msg}</span> : null}
    </div>
  )
}

/* ───────────── core blocks ───────────── */

function TrainCard({ t, block, onSelectTrain, onAsk }) {
  const tr = block.train
  return (
    <div className={card}>
      <Header right={tr.type ? <span className={chip}>{tr.type}</span> : null}>
        <span className={mono}>{tr.trainNumber}</span> <span className="ml-2">{tr.trainName}</span>
      </Header>
      <div className="p-4 space-y-4">
        <p className="text-sm text-[var(--c-text-muted)]">
          {tr.source?.name} ({tr.source?.code}) → {tr.destination?.name} ({tr.destination?.code})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label={t('b.distance')} value={tr.overallDistanceKm ? `${tr.overallDistanceKm} km` : null} />
          <Fact label={t('b.stops')} value={tr.stopCount} />
          <Fact label={t('b.departs')} value={tr.departsSource} />
          <Fact label={t('b.arrives')} value={tr.arrivesDestination} />
          <Fact label={t('b.duration')} value={tr.scheduledDuration} />
          <Fact label={t('b.runs')} value={tr.runningDaysText} />
        </div>
        <RunningDays days={tr.runningDays} />
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={btn} onClick={() => onSelectTrain(tr.trainNumber)}>{t('b.timetable')} <ArrowRightIcon className="ml-1 inline" /></button>
          <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${tr.trainNumber} on the map`)}><MapIcon /> {t('b.showRoute')}</button>
        </div>
      </div>
    </div>
  )
}

function TrainList({ t, block, onSelectTrain }) {
  const shown = block.trains.length
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.total ?? shown}</span>}>{block.title || t('nav.trains')}</Header>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {block.trains.map((tr) => <TrainRow key={tr.trainNumber} t={t} tr={tr} onSelectTrain={onSelectTrain} />)}
      </div>
      {block.total > shown && <Note>{shown} / {block.total}</Note>}
    </div>
  )
}

function StationCard({ t, block, onSelectStation }) {
  const s = block.station
  const alts = block.resolution?.otherMatches || []
  const [showMap, setShowMap] = useState(false)
  const overlay = s.coordinates
    ? { markers: [{ code: s.code, name: s.name, lat: Number(s.coordinates.latitude), lng: Number(s.coordinates.longitude), origin: true, lines: [s.state || ''] }] }
    : null
  return (
    <div className={card}>
      <Header right={<span className={chip}>{s.zone || '—'}</span>}>
        <span className={mono}>{s.code}</span> <span className="ml-2">{s.name}</span>
      </Header>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Fact label="State" value={s.state || '—'} />
          <Fact label="Zone" value={s.zone || '—'} />
          <Fact label={t('b.trainsHere')} value={s.trainCount} />
          <Fact
            label="Coordinates"
            value={s.coordinates ? `${Number(s.coordinates.latitude).toFixed(4)}, ${Number(s.coordinates.longitude).toFixed(4)}` : 'Not available'}
          />
        </div>
        {s.address ? <Fact label="Address" value={s.address} /> : null}
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={btn} onClick={() => onSelectStation(s.code)}>{t('b.trainsHere')} <ArrowRightIcon className="ml-1 inline" /></button>
          {overlay ? (
            <button type="button" className={btn} onClick={() => setShowMap((v) => !v)}>
              <MapIcon /> {showMap ? t('b.hideMap') : t('b.onMap')}
            </button>
          ) : null}
        </div>
        {showMap && overlay ? <NationalMap overlay={overlay} /> : null}
      </div>
      {alts.length > 0 && <Note>{alts.map((a) => `${a.name} (${a.code})`).join(', ')}</Note>}
    </div>
  )
}

function StationList({ t, block, onSelectStation }) {
  return (
    <div className={card}>
      <Header>{t('nav.stations')}</Header>
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
                {s.state || '—'}{s.zone ? ` · ${s.zone}` : ''}{s.trainCount != null ? ` · ${s.trainCount}` : ''}
              </p>
            </div>
            <span className="text-xs font-bold text-blue-400 whitespace-nowrap">{t('b.trainsHere')} <ArrowRightIcon className="ml-1 inline" /></span>
          </button>
        ))}
      </div>
    </div>
  )
}

function TrainRoute({ t, block, onViewMap }) {
  const tr = block.train
  const cov = block.coordinates
  const showHalt = block.stops.some((s) => s.haltMinutes !== null && s.haltMinutes !== undefined)
  return (
    <div className={card}>
      <Header right={<button type="button" className={btn} onClick={() => onViewMap(tr.trainNumber)}>{t('b.openMap')} <ArrowRightIcon className="ml-1 inline" /></button>}>
        {t('b.showRoute').split(' ')[0]} · <span className={mono}>{tr.trainNumber}</span> <span className="ml-1">{tr.trainName}</span>
      </Header>
      <div className="overflow-auto max-h-80">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--c-slate-dark)] border-b border-[var(--c-slate-border)] sticky top-0">
              <th className={th}>#</th>
              <th className={th}>{t('b.station')}</th>
              <th className={th}>{t('b.arr')}</th>
              <th className={th}>{t('b.dep')}</th>
              {showHalt && <th className={th}>{t('b.halt')}</th>}
              <th className={th}>{t('b.day')}</th>
              <th className={`${th} text-right`}>km</th>
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
        {block.stops.length} {t('b.stops')} · {t('b.mapped', { m: cov.mapped, n: cov.total })}
      </Note>
    </div>
  )
}

function MapRoute({ t, block, isLatest }) {
  const [open, setOpen] = useState(isLatest)
  useEffect(() => { if (!isLatest) setOpen(false) }, [isLatest]) // keep only the newest map open
  return (
    <div className={card}>
      <Header right={<button type="button" className={btn} onClick={() => setOpen((o) => !o)}>{open ? t('b.hideMap') : t('b.showMap')}</button>}>
        <MapIcon className="mr-1.5" /> {t('nav.map')} · <span className={mono}>{block.trainNumber}</span> <span className="ml-1">{block.trainName}</span>
      </Header>
      {open ? (
        <div className="p-3">
          <NationalMap initialTrainNumber={block.trainNumber} embedded />
        </div>
      ) : null}
      <Note>{t('b.mapped', { m: block.mappedStops, n: block.totalStops })}</Note>
    </div>
  )
}

function RunsWarning({ runs }) {
  if (runs !== false) return null
  return <span className="text-xs text-amber-500">Per the timetable this train does not run on that date.</span>
}

function JourneyResults({ t, block, onSelectTrain, onAsk }) {
  const fastest = block.shortestScheduled?.trainNumber
  const alts = (block.resolution || []).filter((r) => r.ambiguous)
  const [date, setDate] = useState(tomorrowIso())
  const addOne = (tr) => downloadFile(`train-${tr.trainNumber}-${date}.ics`, buildIcs([directEvent(block, tr, date)]))
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.directTrainsFound} {t('b.direct')}</span>}>
        {block.from.name} ({block.from.code}) → {block.to.name} ({block.to.code})
        {block.dayFilter ? <span className="ml-2 text-[var(--c-text-muted)] font-medium">· {block.dayFilter}</span> : null}
      </Header>
      <div className="px-3 pt-3">
        <JourneyActions
          t={t}
          date={date}
          setDate={setDate}
          onCalendar={() => block.trains[0] && addOne(block.trains[0])}
          shareText={journeyText(
            `${block.from.name} to ${block.to.name} (${date})`,
            block.trains.slice(0, 5).map((tr) => ({
              trainNumber: tr.trainNumber, trainName: tr.trainName, fromName: block.from.name, toName: block.to.name,
              dep: tr.journey.departureTime, arr: tr.journey.arrivalTime, duration: tr.journey.scheduledDuration,
            }))
          )}
        />
      </div>
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {block.trains.map((tr) => (
          <div key={tr.trainNumber} className="space-y-1.5">
            <TrainRow
              t={t}
              tr={tr}
              onSelectTrain={onSelectTrain}
              extra={
                <p className="text-xs mt-1.5 text-[var(--c-text-main)]">
                  <span className="font-mono font-bold">{tr.journey.departureTime || '?'}</span>
                  {tr.journey.departureDay > 1 ? <sup> {t('b.day')} {tr.journey.departureDay}</sup> : null}
                  {' → '}
                  <span className="font-mono font-bold">{tr.journey.arrivalTime || '?'}</span>
                  {tr.journey.arrivalDay > 1 ? <sup> {t('b.day')} {tr.journey.arrivalDay}</sup> : null}
                  {' · '}
                  <span className="font-semibold">{tr.journey.scheduledDuration || '—'}</span>
                  {tr.journey.distanceKm != null ? ` · ${tr.journey.distanceKm} km` : ''}
                  {' · '}{tr.journey.intermediateStops} {t('b.stops').toLowerCase()} {t('b.between')}
                  {tr.trainNumber === fastest ? (
                    <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">{t('b.shortest')}</span>
                  ) : null}
                </p>
              }
            />
            <div className="flex flex-wrap items-center gap-2 pl-1">
              <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${tr.trainNumber} on the map`)}><MapIcon /> {t('b.showRoute')}</button>
              <button type="button" className={btn} onClick={() => addOne(tr)}><CalendarIcon /> {t('b.calendar')}</button>
              <RunsWarning runs={runsOn(tr.runningDays, date, tr.journey.departureDay)} />
            </div>
          </div>
        ))}
      </div>
      <Note>
        {block.note}
        {block.trains.length < block.directTrainsFound ? ` ${block.trains.length}/${block.directTrainsFound}.` : ''}
        {alts.length ? ' Station names matched more than one station; the busiest match was used.' : ''}
      </Note>
    </div>
  )
}

function TransferResults({ t, block, onSelectTrain }) {
  const [date, setDate] = useState(tomorrowIso())
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.optionsFound}</span>}>
        <SwapIcon className="mr-1.5" /> {t('b.transfer')}: {block.from.name} → {block.to.name} · {block.dayUsed}
      </Header>
      <div className="p-3 space-y-3 max-h-[28rem] overflow-y-auto">
        {block.options.map((o, i) => (
          <div key={i} className="rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-bold text-[var(--c-text-main)]">
                <span className="font-mono">{o.departureTime}</span> → <span className="font-mono">{o.arrivalTime}</span>
                {o.arrivalDayOffset > 0 ? <sup> +{o.arrivalDayOffset}d</sup> : null}
              </span>
              <span className={chip}>{o.totalDuration}</span>
            </div>
            {o.legs.map((l, k) => (
              <React.Fragment key={k}>
                <button
                  type="button"
                  onClick={() => onSelectTrain(l.train.trainNumber)}
                  className="w-full text-left p-2.5 rounded-lg bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] hover:border-amber-500/50 transition text-xs"
                >
                  <span className={mono}>{l.train.trainNumber}</span>
                  <span className="font-bold text-[var(--c-text-main)] ml-2">{l.train.trainName}</span>
                  <div className="mt-1 text-[var(--c-text-muted)]">
                    {l.from.name} <span className="font-mono text-[var(--c-text-main)]">{l.departureTime}</span> → {l.to.name}{' '}
                    <span className="font-mono text-[var(--c-text-main)]">{l.arrivalTime}</span> · {l.duration}
                    {l.train.runningDaysText ? ` · ${l.train.runningDaysText}` : ''}
                  </div>
                </button>
                {k === 0 && (
                  <div className="text-xs text-amber-500 pl-1">
                    {t('b.changeAt')} <strong>{o.transfer.station.name}</strong> · {t('b.layover')} {o.transfer.layover}
                  </div>
                )}
              </React.Fragment>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                onClick={() => downloadFile(`journey-${block.from.code}-${block.to.code}-${date}.ics`, buildIcs(transferEvents(o, date)))}
              >
                <CalendarIcon /> {t('b.calendar')}
              </button>
            </div>
          </div>
        ))}
        <label className="inline-flex items-center gap-2 text-xs text-[var(--c-text-muted)]">
          {t('b.date')}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="px-2 py-1 rounded-lg bg-[var(--c-slate-surface)] border border-[var(--c-slate-border)] text-xs text-[var(--c-text-main)]"
          />
        </label>
      </div>
      <Note>{block.note}</Note>
    </div>
  )
}

function Reachability({ t, block, isLatest, onAsk }) {
  const [open, setOpen] = useState(isLatest)
  useEffect(() => { if (!isLatest) setOpen(false) }, [isLatest])
  const overlay = reachOverlay(block, t)
  return (
    <div className={card}>
      <Header
        right={
          <button type="button" className={btn} onClick={() => setOpen((o) => !o)}>
            <MapIcon /> {open ? t('b.hideMap') : t('b.showMap')}
          </button>
        }
      >
        {t('b.reach', { name: block.origin.name })} · {block.minHours > 0 ? `${block.minHours}–` : ''}{block.maxHours} h
      </Header>
      {open && overlay.markers.length > 0 ? <div className="p-3"><NationalMap overlay={overlay} /></div> : null}
      <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
        {block.stations.map((s) => (
          <button
            key={s.code}
            type="button"
            onClick={() => onAsk(`Show trains from ${block.origin.name} to ${s.name}`)}
            className="w-full text-left px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] hover:border-amber-500/50 transition flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-[var(--c-text-main)] truncate">{s.name}</span>
              <span className="font-mono text-amber-500">{s.code}</span>
            </span>
            <span className="text-[var(--c-text-muted)] whitespace-nowrap">{s.duration} · {s.viaTrain.trainNumber}</span>
          </button>
        ))}
      </div>
      <Note>
        {block.reachableCount} · {block.note}
        {block.withoutCoordinates ? ` ${block.withoutCoordinates} not drawn (no stored coordinates).` : ''}
      </Note>
    </div>
  )
}

function TrainComparison({ t, block, onSelectTrain }) {
  const best = (key, trn) =>
    (key === 'dur' && trn.trainNumber === block.shortestScheduled) ||
    (key === 'spd' && trn.trainNumber === block.highestAverageSpeed) ||
    (key === 'stp' && trn.trainNumber === block.fewestStops)
  const rows = [
    [t('b.duration'), (x) => x.scheduledDuration || '—', 'dur'],
    [t('b.distance'), (x) => (x.overallDistanceKm ? `${x.overallDistanceKm} km` : '—')],
    [t('b.speed'), (x) => (x.averageSpeedKmph ? `${x.averageSpeedKmph} km/h` : '—'), 'spd'],
    [t('b.stops'), (x) => x.stopCount, 'stp'],
    [t('b.longestHalt'), (x) => (x.longestHalt ? `${x.longestHalt.minutes} min · ${x.longestHalt.stationName}` : '—')],
    [t('b.departs'), (x) => x.departsSource || '—'],
    [t('b.arrives'), (x) => x.arrivesDestination || '—'],
    [t('b.runs'), (x) => x.runningDaysText || '—'],
  ]
  return (
    <div className={card}>
      <Header>{t('b.compare')}</Header>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[var(--c-slate-border)]">
              <th className={th} />
              {block.trains.map((x) => (
                <th key={x.trainNumber} className="p-2.5">
                  <button type="button" onClick={() => onSelectTrain(x.trainNumber)} className="text-left">
                    <div className={mono}>{x.trainNumber}</div>
                    <div className="font-bold text-[var(--c-text-main)]">{x.trainName}</div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--c-slate-border)]">
            {rows.map(([label, get, key]) => (
              <tr key={label}>
                <td className={th}>{label}</td>
                {block.trains.map((x) => (
                  <td key={x.trainNumber} className="p-2.5 text-[var(--c-text-main)]">
                    {get(x)}
                    {key && best(key, x) ? <span className="ml-1.5 inline-flex align-middle text-emerald-400"><CheckIcon /></span> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Note>{block.note}</Note>
    </div>
  )
}

function HaltList({ t, block }) {
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.totalLongHalts}</span>}>
        {t('b.halts')} · <span className={mono}>{block.train.trainNumber}</span> <span className="ml-1">{block.train.trainName}</span>
      </Header>
      <div className="p-3 space-y-1.5">
        {block.halts.map((h) => (
          <div key={`${h.stationCode}-${h.sequence}`} className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] flex items-center justify-between gap-3 text-xs">
            <span><span className="font-bold text-[var(--c-text-main)]">{h.stationName}</span> <span className="font-mono text-amber-500">{h.stationCode}</span></span>
            <span className="text-[var(--c-text-muted)] whitespace-nowrap">
              {h.arrivalTime} → {h.departureTime} · <strong className="text-[var(--c-text-main)]">{h.haltMinutes} min</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TripPlan({ t, block, onSelectTrain }) {
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.totalTravelSpan}</span>}>
        {t('b.trip')}: {block.stops.map((s) => s.name).join(' → ')}
      </Header>
      <div className="p-3 space-y-2">
        {block.legs.map((l, i) => (
          <div key={i} className="rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] p-3 text-xs space-y-1.5">
            {l.waitBeforeMinutes > 0 && <div className="text-amber-500">{t('b.wait')} {l.wait}</div>}
            <button type="button" onClick={() => onSelectTrain(l.train.trainNumber)} className="text-left w-full">
              <span className={mono}>{l.train.trainNumber}</span>
              <span className="font-bold text-[var(--c-text-main)] ml-2">{l.train.trainName}</span>
            </button>
            <div className="text-[var(--c-text-muted)]">
              {l.from.name} <span className="font-mono text-[var(--c-text-main)]">{l.departureTime}</span>
              <sup> {t('b.day')} {l.tripDay}</sup> → {l.to.name}{' '}
              <span className="font-mono text-[var(--c-text-main)]">{l.arrivalTime}</span>
              <sup> {t('b.day')} {l.arrivalTripDay}</sup> · {t('b.ride')} {l.ride}
            </div>
          </div>
        ))}
      </div>
      <Note>{block.note}</Note>
    </div>
  )
}

function StationTimetable({ t, block, onSelectTrain }) {
  return (
    <div className={card}>
      <Header right={<span className={chip}>{block.matching ?? block.trains.length} / {block.total}</span>}>
        {block.station.name} ({block.station.code}){block.afterTime ? ` · ${block.afterTime}+` : ''}
      </Header>
      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
        {block.trains.map((tr) => (
          <TrainRow
            key={tr.trainNumber}
            t={t}
            tr={tr}
            onSelectTrain={onSelectTrain}
            extra={
              <p className="text-xs mt-1.5 text-[var(--c-text-main)]">
                {t('b.arr')} <span className="font-mono font-bold">{tr.atStation.arrivalTime ? tr.atStation.arrivalTime.slice(0, 5) : 'starts here'}</span>
                {' · '}{t('b.dep')} <span className="font-mono font-bold">{tr.atStation.departureTime ? tr.atStation.departureTime.slice(0, 5) : 'ends here'}</span>
                {tr.atStation.journeyDay > 1 ? ` · ${t('b.day')} ${tr.atStation.journeyDay}` : ''}
              </p>
            }
          />
        ))}
      </div>
      <Note>Scheduled timetable times, not live running status.</Note>
    </div>
  )
}

function PositionEstimate({ t, block }) {
  return (
    <div className="w-full rounded-2xl border border-amber-500/30 bg-amber-400/10 overflow-hidden shadow-lg">
      <div className="px-4 py-3 text-xs font-bold text-amber-500 uppercase tracking-wider font-mono">{t('b.estimate')}</div>
      <div className="px-4 pb-4 space-y-3 text-sm text-[var(--c-text-main)]">
        <p className="font-semibold">
          <span className={mono}>{block.train.trainNumber}</span> {block.train.trainName} · {block.estimatedForIST} IST
          {block.assumedNoon ? ' (12:00 assumed)' : ''}
        </p>
        <p>{block.message}</p>
        {block.instances?.map((i) => (
          <div key={i.journeyStartDate} className="p-3 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] text-xs space-y-1">
            <div className="font-mono font-bold text-amber-500">{i.journeyStartDate}</div>
            {i.estimatedBetween ? (
              <>
                <div>Last scheduled stop: <b>{i.estimatedBetween.lastScheduledStop.name}</b> ({i.estimatedBetween.lastScheduledStop.scheduledDeparture})</div>
                <div>Next scheduled stop: <b>{i.estimatedBetween.nextScheduledStop.name}</b> ({i.estimatedBetween.nextScheduledStop.scheduledArrival})</div>
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

/* ───────────── DEMO blocks (simulated; always bannered) ───────────── */

function DemoCard({ t, block, title, children }) {
  return (
    <div className={`${card} border-amber-500/40`}>
      <DemoBanner t={t} notice={block.demoNotice} />
      <Header>{title}</Header>
      <div className="p-4 space-y-3 text-xs">{children}</div>
      {block.howItWorks && <Note>{block.howItWorks}</Note>}
    </div>
  )
}

function DemoPnr({ t, block, onAsk }) {
  const j = block.journey
  return (
    <DemoCard t={t} block={block} title={<>PNR <span className={mono}>{block.pnr}</span></>}>
      <p className="text-sm">
        <span className={mono}>{block.train.trainNumber}</span>{' '}
        <span className="font-bold text-[var(--c-text-main)]">{block.train.trainName}</span>
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Fact label={t('sv.boardingAt')} value={`${j.boarding.name} ${j.boarding.departureTime || ''}`} />
        <Fact label={t('sv.destination')} value={`${j.destination.name} ${j.destination.arrivalTime || ''}`} />
        <Fact label={t('b.date')} value={j.date} />
        <Fact label={t('sv.class')} value={j.class} />
      </div>
      <div className="space-y-1">
        {block.passengers.map((p) => (
          <div key={p.number} className="flex justify-between px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">
            <span className="font-bold text-[var(--c-text-main)]">{p.name}</span>
            <span className="font-mono text-amber-500">{p.currentStatus}</span>
          </div>
        ))}
      </div>
      <Fact label={t('sv.chart')} value={block.chartStatus} />
      <div className="flex gap-2 flex-wrap">
        <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${block.train.trainNumber}`)}><MapIcon /> {t('b.showRoute')}</button>
      </div>
    </DemoCard>
  )
}

function DemoFare({ t, block }) {
  return (
    <DemoCard t={t} block={block} title={<>{t('sv.fare')} · <span className={mono}>{block.train.trainNumber}</span></>}>
      <p>{block.from.name} → {block.to.name} · {block.distanceKm} km</p>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[var(--c-slate-border)]">
            <th className={th}>{t('sv.class')}</th><th className={th}>Base</th><th className={th}>Fees</th><th className={th}>Tax</th><th className={th}>{t('sv.total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--c-slate-border)]">
          {block.fares.map((f) => (
            <tr key={f.class}>
              <td className="p-2.5 font-mono font-bold text-amber-500">{f.class}</td>
              <td className="p-2.5">{f.baseFare}</td><td className="p-2.5">{f.reservationAndOther}</td><td className="p-2.5">{f.tax}</td>
              <td className="p-2.5 font-bold text-[var(--c-text-main)]">₹ {f.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DemoCard>
  )
}

function DemoSeats({ t, block }) {
  return (
    <DemoCard t={t} block={block} title={<>Seats · <span className={mono}>{block.train.trainNumber}</span> · {block.date} {block.weekday}</>}>
      {block.classes.length === 0 ? (
        <p className="text-amber-500">{block.message}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {block.classes.map((c) => (
            <div key={c.class} className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">
              <div className="font-mono font-bold text-amber-500">{c.class}</div>
              <div className="text-[var(--c-text-main)] font-semibold">{c.status}</div>
            </div>
          ))}
        </div>
      )}
    </DemoCard>
  )
}

function DemoLive({ t, block }) {
  const p = block.position
  return (
    <DemoCard t={t} block={block} title={<>{t('sv.live')} · <span className={mono}>{block.train.trainNumber}</span> {block.train.trainName}</>}>
      <p>{block.message}</p>
      <Fact label={t('sv.delay')} value={`${block.simulatedDelayMinutes} ${t('sv.minutes')}`} />
      {p ? (
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">Last scheduled stop <b className="text-[var(--c-text-main)]">{p.lastScheduledStop.name}</b></div>
          <div className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">
            Next stop <b className="text-[var(--c-text-main)]">{p.nextScheduledStop.name}</b>: scheduled {p.nextScheduledStop.scheduledArrival}, demo expectation {p.demoExpectedArrivalAtNext}
          </div>
        </div>
      ) : null}
    </DemoCard>
  )
}

function DemoFoodMenu({ t, block, onOpenServices }) {
  return (
    <DemoCard t={t} block={block} title={<>{t('sv.menu')} · {block.station.name} ({block.station.code})</>}>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {block.items.map((i) => (
          <div key={i.id} className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><Dot className={i.veg ? 'bg-emerald-500' : 'bg-red-500'} /><span className="font-semibold text-[var(--c-text-main)]">{i.name}</span></span>
            <span className="font-mono text-amber-500">₹ {i.price}</span>
          </div>
        ))}
      </div>
      {onOpenServices ? (
        <button type="button" className={btn} onClick={() => onOpenServices('food', { station: block.station.code })}>{t('sv.food')} <ArrowRightIcon className="ml-1 inline" /></button>
      ) : null}
    </DemoCard>
  )
}

/* ───────────── ticket photo result ───────────── */

function TicketExtraction({ t, block, onAsk }) {
  const tk = block.ticket
  const ex = tk.extracted
  const m = tk.match
  const rows = [
    ['Train number', ex.trainNumber], ['Train name', ex.trainName], ['From', ex.fromStation], ['To', ex.toStation],
    [t('b.date'), ex.journeyDate], [t('sv.class'), ex.travelClass],
  ]
  return (
    <div className={`${card} border-blue-500/30`}>
      <Header right={<span className={chip}>{t('b.confidence')}: {tk.confidence}</span>}>
        <TicketIcon className="mr-1.5" /> {t('b.ticket')}
      </Header>
      <div className="p-4 space-y-3 text-xs">
        {!tk.isRailwayTicket ? (
          <p className="text-amber-500">{tk.message || t('b.notTicket')}</p>
        ) : (
          <>
            <p className="text-amber-500">{t('b.ticketCheck')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rows.map(([k, v]) => <Fact key={k} label={k} value={v || '—'} />)}
            </div>
            {ex.unclearFields?.length > 0 && <p className="text-[var(--c-text-muted)]">Unclear: {ex.unclearFields.join(', ')}</p>}
            <div className="space-y-1.5">
              <div className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">
                {m.train ? (
                  <><span className="text-emerald-400 font-bold">{t('b.matched')}: </span><span className={mono}>{m.train.trainNumber}</span> {m.train.trainName}</>
                ) : (
                  <span className="text-[var(--c-text-muted)]">{t('b.noMatch')}{tk.message ? `. ${tk.message}` : ''}</span>
                )}
              </div>
              {(m.from || m.to) && (
                <div className="px-3 py-2 rounded-lg bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] text-[var(--c-text-muted)]">
                  {m.from?.name || '?'} → {m.to?.name || '?'}
                  {tk.routeConsistent === true && <span className="text-emerald-400 ml-2">{t('b.consistent')}</span>}
                  {tk.routeConsistent === false && <span className="text-amber-500 ml-2">{t('b.inconsistent')}</span>}
                </div>
              )}
            </div>
            {m.train && (
              <div className="flex gap-2 flex-wrap">
                <button type="button" className={btn} onClick={() => onAsk(`Tell me about train ${m.train.trainNumber}`)}>{t('b.showTrain')}</button>
                <button type="button" className={btn} onClick={() => onAsk(`Show the route of train ${m.train.trainNumber} on the map`)}><MapIcon /> {t('b.showRoute')}</button>
              </div>
            )}
          </>
        )}
      </div>
      <Note>{tk.notice}</Note>
    </div>
  )
}

/* ───────────── dispatcher ───────────── */

export default function AssistantBlocks({ blocks, isLatest, lang = 'en', onSelectTrain, onSelectStation, onViewMap, onAsk, onOpenServices }) {
  if (!blocks || blocks.length === 0) return null
  const t = makeT(lang)
  const noop = () => {}
  return (
    <div className="w-full space-y-3 mt-2">
      {blocks.map((b, i) => {
        const key = `${b.type}-${i}`
        switch (b.type) {
          case 'train_card': return <TrainCard key={key} t={t} block={b} onSelectTrain={onSelectTrain || noop} onAsk={onAsk || noop} />
          case 'train_list': return <TrainList key={key} t={t} block={b} onSelectTrain={onSelectTrain} />
          case 'station_card': return <StationCard key={key} t={t} block={b} onSelectStation={onSelectStation || noop} />
          case 'station_list': return <StationList key={key} t={t} block={b} onSelectStation={onSelectStation || noop} />
          case 'train_route': return <TrainRoute key={key} t={t} block={b} onViewMap={onViewMap || noop} />
          case 'map_route': return <MapRoute key={key} t={t} block={b} isLatest={isLatest} />
          case 'journey_results': return <JourneyResults key={key} t={t} block={b} onSelectTrain={onSelectTrain} onAsk={onAsk || noop} />
          case 'transfer_results': return <TransferResults key={key} t={t} block={b} onSelectTrain={onSelectTrain || noop} />
          case 'reachability': return <Reachability key={key} t={t} block={b} isLatest={isLatest} onAsk={onAsk || noop} />
          case 'train_comparison': return <TrainComparison key={key} t={t} block={b} onSelectTrain={onSelectTrain || noop} />
          case 'halt_list': return <HaltList key={key} t={t} block={b} />
          case 'trip_plan': return <TripPlan key={key} t={t} block={b} onSelectTrain={onSelectTrain || noop} />
          case 'station_timetable': return <StationTimetable key={key} t={t} block={b} onSelectTrain={onSelectTrain} />
          case 'position_estimate': return <PositionEstimate key={key} t={t} block={b} />
          case 'demo_pnr': return <DemoPnr key={key} t={t} block={b} onAsk={onAsk || noop} />
          case 'demo_fare': return <DemoFare key={key} t={t} block={b} />
          case 'demo_seats': return <DemoSeats key={key} t={t} block={b} />
          case 'demo_live': return <DemoLive key={key} t={t} block={b} />
          case 'demo_food_menu': return <DemoFoodMenu key={key} t={t} block={b} onOpenServices={onOpenServices} />
          case 'ticket_extraction': return <TicketExtraction key={key} t={t} block={b} onAsk={onAsk || noop} />
          default: return null // unknown block types are ignored, never guessed at
        }
      })}
    </div>
  )
}
