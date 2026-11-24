import React, { useState, useEffect } from 'react'
import AssistantBlocks from './AssistantBlocks'
import {
  searchTrains, getTrainRoute, getPnrStatus, demoFare, demoSeats, demoLive,
} from '../services/api'
import { makeT } from '../utils/i18n'
import { tomorrowIso } from '../utils/ics'
import { TicketIcon, FoodIcon, ClockIcon, WarningIcon, CloseIcon, SearchIcon, ExternalLinkIcon } from './Icons'

const card = 'bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-2xl shadow-lg'
const field = 'input bg-[var(--c-slate-dark)] border-[var(--c-slate-border)] text-sm py-2.5 px-3.5 rounded-xl w-full'
const primary = 'px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed'
const label = 'block text-xs font-mono font-bold uppercase tracking-wider text-[var(--c-text-muted)] mb-1.5'
const CLASSES = ['2S', 'SL', '3E', '3A', 'CC', '2A', '1A']

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

function ErrorNote({ message }) {
  return message ? <p className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{message}</p> : null
}

function TrainPicker({ t, value, onPick, onClear }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  useEffect(() => {
    if (value || q.trim().length < 2) { setHits([]); return undefined }
    const id = setTimeout(async () => {
      try { setHits(((await searchTrains(q.trim(), 1, 6)).results) || []) } catch { setHits([]) }
    }, 250)
    return () => clearTimeout(id)
  }, [q, value])

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)]">
        <span className="text-sm"><span className="font-mono font-bold text-amber-500">{value.trainNumber}</span> <span className="font-bold text-[var(--c-text-main)] ml-1">{value.trainName}</span></span>
        <button type="button" onClick={onClear} aria-label="Clear" className="text-lg text-[var(--c-text-muted)] hover:text-amber-500"><CloseIcon /></button>
      </div>
    )
  }
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-text-muted)]"><SearchIcon /></span>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sv.trainSearch')} className={`${field} pl-9`} />
      {hits.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] shadow-2xl overflow-hidden">
          {hits.map((h) => (
            <button
              key={h.trainNumber}
              type="button"
              onClick={() => { onPick({ trainNumber: h.trainNumber, trainName: h.trainName }); setQ(''); setHits([]) }}
              className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-[var(--c-slate-surface)] border-b border-[var(--c-slate-border)] last:border-0"
            >
              <span className="font-mono font-bold text-amber-500">{h.trainNumber}</span> <span className="text-[var(--c-text-main)]">{h.trainName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Load a train's stored stops (for choosing stations). */
function useStops(train) {
  const [stops, setStops] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    setStops([]); setError('')
    if (!train) return undefined
    let alive = true
    getTrainRoute(train.trainNumber)
      .then((d) => {
        if (!alive) return
        const route = [...(d.completeOrderedRoute || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        setStops(route.map((s) => ({ code: s.stationCode, name: s.stationName, arr: s.arrivalTime, dep: s.departureTime })))
      })
      .catch(() => alive && setError('Could not load this train\'s stops.'))
    return () => { alive = false }
  }, [train])
  return { stops, error }
}

function StopSelect({ stops, value, onChange, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={field}>
      <option value="">—</option>
      {stops.map((s) => <option key={`${s.code}-${s.name}`} value={s.code}>{s.name} ({s.code}){s.arr ? ` · ${s.arr.slice(0, 5)}` : ''}</option>)}
    </select>
  )
}

/* ───────────── PNR ───────────── */
function PnrValue({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-[var(--c-text-muted)]">—</span>
  if (Array.isArray(value)) {
    return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded-xl border border-[var(--c-slate-border)] p-3"><PnrValue value={item} /></div>)}</div>
  }
  if (typeof value === 'object') {
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[minmax(120px,0.8fr)_2fr] gap-1 sm:gap-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[var(--c-text-muted)]">{key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ')}</dt>
            <dd className="min-w-0 break-words text-sm text-[var(--c-text-main)]"><PnrValue value={item} /></dd>
          </div>
        ))}
      </dl>
    )
  }
  return <span>{String(value)}</span>
}

function PnrTab({ initialPnr = '' }) {
  const [pnr, setPnr] = useState(initialPnr)
  useEffect(() => { if (initialPnr) setPnr(String(initialPnr).replace(/\\D/g, '').slice(0, 10)) }, [initialPnr])
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const validPnr = /^\d{10}$/.test(pnr)

  const checkPnr = async (event) => {
    event.preventDefault()
    if (!validPnr || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await getPnrStatus(pnr))
    } catch (err) {
      setError(err.message || 'Could not check this PNR.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${card} p-4 sm:p-5 space-y-4`}>
        <div>
          <h2 className="text-lg font-black text-[var(--c-text-main)]">Live PNR Status</h2>
          <p className="text-sm text-[var(--c-text-muted)] mt-1">Enter your 10-digit PNR to check the latest reservation and charting status.</p>
        </div>
        <form onSubmit={checkPnr} className="space-y-3">
          <div>
            <label className={label} htmlFor="status-pnr">10-digit PNR number</label>
            <input
              id="status-pnr" value={pnr}
              onChange={(event) => { setPnr(event.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); setResult(null) }}
              inputMode="numeric" autoComplete="off" maxLength={10}
              placeholder="Enter your PNR"
              className={`${field} sm:max-w-sm font-mono tracking-[0.18em] text-base`}
            />
          </div>
          <button type="submit" className={primary} disabled={!validPnr || busy}>
            {busy ? 'Checking PNR…' : 'Check PNR Status'}
          </button>
        </form>
        {pnr.length > 0 && !validPnr && <p className="text-xs text-amber-500">Enter all 10 digits to continue.</p>}
        <ErrorNote message={error} />
      </section>
      {result !== null && (
        <section className={`${card} p-4 sm:p-5 space-y-3`} aria-live="polite">
          <h3 className="font-bold text-lg text-[var(--c-text-main)]">PNR enquiry result</h3>
          <PnrValue value={result} />
        </section>
      )}
      <p className="text-xs text-[var(--c-text-muted)]">
        Privacy: RailSaathi sends your PNR to its backend and the PNR API provider to retrieve the result. RailSaathi does not save the PNR or response in its railway database.
      </p>
    </div>
  )
}

/* ───────────── Food ───────────── */
function FoodTab() {
  const [pnr, setPnr] = useState('')
  const [notice, setNotice] = useState('')
  const validPnr = /^\d{10}$/.test(pnr)
  const openIrctc = async () => {
    if (!validPnr) return
    // Open the tab directly in the click handler so popup blockers allow it.
    window.open('https://ecatering.irctc.co.in/', '_blank', 'noopener,noreferrer')
    try {
      await navigator.clipboard.writeText(pnr)
      setNotice('Your PNR has been copied. Switch to the IRCTC tab and paste it into the PNR field.')
    } catch {
      setNotice('IRCTC opened. Clipboard access was unavailable, so please type your PNR on the official page.')
    }
  }

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 sm:p-6 space-y-4`}>
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold tracking-widest text-amber-500">OFFICIAL RAILWAY FOOD ORDERING</span>
          <h2 className="text-xl sm:text-2xl font-black text-[var(--c-text-main)]">Order food for your train journey</h2>
          <p className="text-sm text-[var(--c-text-muted)]">Enter your 10-digit PNR here to prepare it, then continue to IRCTC eCatering to see restaurants and delivery stations available for your journey.</p>
        </div>

        <div className="space-y-2">
          <label className={label} htmlFor="food-pnr">10-digit PNR number</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="food-pnr"
              value={pnr}
              onChange={(e) => { setPnr(e.target.value.replace(/\D/g, '').slice(0, 10)); setNotice('') }}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder="Enter your PNR"
              className={`${field} sm:max-w-sm font-mono tracking-[0.18em] text-base`}
            />
            <button type="button" className={primary} disabled={!validPnr} onClick={openIrctc}>Copy PNR &amp; Open IRCTC <ExternalLinkIcon className="ml-1 inline" /></button>
          </div>
          {pnr.length > 0 && !validPnr && <p className="text-xs text-amber-500">Enter all 10 digits to copy your PNR.</p>}
          {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}
        </div>
        <p className="text-xs text-[var(--c-text-muted)]">Privacy: RailSaathi does not submit or save this PNR. Copy it and paste it yourself on the official IRCTC website.</p>
      </section>

      <section className={`${card} p-5 sm:p-6 space-y-4`}>
        <h3 className="font-bold text-lg text-[var(--c-text-main)]">How to order food</h3>
        <ol className="space-y-3 text-sm text-[var(--c-text-muted)] list-decimal pl-5">
          <li>Open the official IRCTC eCatering website using the button above, or use the official <strong className="text-[var(--c-text-main)]">Food on Track</strong> app.</li>
          <li>Enter your 10-digit PNR on the official service. It will show food options for eligible stations on your journey.</li>
          <li>Choose a delivery station, then browse the restaurants and food options available there.</li>
          <li>Select your food, check the order details and delivery station carefully, then choose an available payment option.</li>
          <li>Keep the order confirmation and delivery details handy. Be at your allotted seat or berth when the train reaches the selected station.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <a href="https://ecatering.irctc.co.in/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-amber-500 hover:underline">Official IRCTC eCatering website <ExternalLinkIcon className="ml-1 inline" /></a>
          <a href="https://ecatering.irctc.co.in/pages/app-for-ordering-food-in-train" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-amber-500 hover:underline">Food on Track app information <ExternalLinkIcon className="ml-1 inline" /></a>
        </div>
      </section>

      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm text-[var(--c-text-muted)]">
        <strong className="text-amber-500">Stay safe:</strong> IRCTC advises passengers to order through its official eCatering website, Food on Track app, or partners listed within its official service. Avoid unfamiliar food-ordering links and never share OTPs or payment details with anyone claiming to be a delivery agent.
      </div>
    </div>
  )
}

/* ───────────── Fare / seats / live ───────────── */
function FareSeatsTab({ t, lang, onAskAI }) {
  const [train, setTrain] = useState(null)
  const { stops, error: stopsError } = useStops(train)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [klass, setKlass] = useState('')
  const [date, setDate] = useState(tomorrowIso())
  const [blocks, setBlocks] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setFrom(''); setTo(''); setBlocks([]); setErr('') }, [train])
  const order = (code) => stops.findIndex((s) => s.code === code)
  const badOrder = from && to && order(from) >= order(to)

  const run = async (kind) => {
    setErr(''); setBusy(true)
    try {
      if (kind === 'fare') {
        const r = await demoFare(train.trainNumber, from, to, klass)
        setBlocks([{ type: 'demo_fare', ...r }])
      } else {
        const r = await demoSeats(train.trainNumber, date, klass)
        setBlocks([{ type: 'demo_seats', ...r }])
      }
    } catch (x) { setErr(x.message); setBlocks([]) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className={`${card} p-5 space-y-4`}>
        <div><label className={label}>{t('sv.pickTrain')}</label><TrainPicker t={t} value={train} onPick={setTrain} onClear={() => setTrain(null)} /></div>
        {train && (
          <>
            <ErrorNote message={stopsError} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={label}>{t('sv.from')}</label><StopSelect stops={stops} value={from} onChange={setFrom} disabled={!stops.length} /></div>
              <div><label className={label}>{t('sv.to')}</label><StopSelect stops={stops} value={to} onChange={setTo} disabled={!stops.length} /></div>
              <div>
                <label className={label}>{t('sv.class')}</label>
                <select value={klass} onChange={(e) => setKlass(e.target.value)} className={field}>
                  <option value="">{t('sv.any')}</option>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>{t('b.date')}</label>
                <input type="date" value={date} min={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} className={field} />
              </div>
            </div>
            {badOrder && <p className="text-xs text-amber-500">{t('sv.to')} must come after {t('sv.from')} on this train's route.</p>}
            <div className="flex gap-3 flex-wrap">
              <button className={primary} disabled={busy || !from || !to || badOrder} onClick={() => run('fare')}>{t('sv.fareGo')}</button>
              <button className={primary} disabled={busy || !date} onClick={() => run('seats')}>{t('sv.seatGo')}</button>
            </div>
          </>
        )}
      </div>
      <ErrorNote message={err} />
      {blocks.length > 0 && <AssistantBlocks lang={lang} isLatest blocks={blocks} onAsk={onAskAI} />}
    </div>
  )
}

function LiveTab({ t, lang, onAskAI }) {
  const [train, setTrain] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setBlocks([]); setErr('') }, [train])
  const go = async () => {
    setErr(''); setBusy(true)
    try { setBlocks([{ type: 'demo_live', ...(await demoLive(train.trainNumber)) }]) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <div className={`${card} p-5 space-y-4`}>
        <div><label className={label}>{t('sv.pickTrain')}</label><TrainPicker t={t} value={train} onPick={setTrain} onClear={() => setTrain(null)} /></div>
        <button className={primary} disabled={busy || !train} onClick={go}>{busy ? t('sv.loading') : t('sv.liveGo')}</button>
      </div>
      <ErrorNote message={err} />
      {blocks.length > 0 && <AssistantBlocks lang={lang} isLatest blocks={blocks} onAsk={onAskAI} />}
    </div>
  )
}

/* ───────────── page ───────────── */
export default function Services({ lang = 'en', initial = null, onAskAI }) {
  const t = makeT(lang)
  const [tab, setTab] = useState(initial?.tab || 'pnr')
  useEffect(() => { if (initial?.tab) setTab(initial.tab) }, [initial])
  const tabs = [
    { id: 'pnr', label: t('sv.pnr'), icon: TicketIcon },
    { id: 'food', label: t('sv.food'), icon: FoodIcon },
    { id: 'fare', label: t('sv.fare'), icon: TicketIcon },
    { id: 'live', label: t('sv.live'), icon: ClockIcon },
  ]
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-12 animate-fade-in">
      <div>
        <h1 className="text-3xl font-black">{t('sv.title')}</h1>
        <p className="text-sm text-[var(--c-text-muted)] mt-1">{t('sv.subtitle')}</p>
      </div>
      {tab !== 'food' && tab !== 'pnr' && (
        <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-500/30 text-amber-500 text-sm flex items-start gap-3">
          <WarningIcon className="text-lg mt-0.5" />
          <p><strong className="font-mono tracking-wider">{t('demo.banner')}</strong> {t('sv.demoAll')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
              tab === x.id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-[var(--c-slate-dark)] border-[var(--c-slate-border)] hover:border-amber-500/50'
            }`}
          >
            <x.icon /> {x.label}
          </button>
        ))}
      </div>
      {tab === 'pnr' && <PnrTab initialPnr={initial?.pnr || ''} />}
      {tab === 'food' && <FoodTab t={t} initial={initial} />}
      {tab === 'fare' && <FareSeatsTab t={t} lang={lang} onAskAI={onAskAI} />}
      {tab === 'live' && <LiveTab t={t} lang={lang} onAskAI={onAskAI} />}
    </div>
  )
}
