import React, { useState, useEffect, useRef } from 'react'
import AssistantBlocks from './AssistantBlocks'
import {
  searchTrains, getTrainRoute, demoPnr, demoFoodMenu, demoFoodOrder, demoFare, demoSeats, demoLive,
} from '../services/api'
import { makeT } from '../utils/i18n'
import { tomorrowIso } from '../utils/ics'
import { loadOrders, saveOrders, addOrder, stageIndex, cartTotal, cartItems } from '../utils/orders'
import { TicketIcon, FoodIcon, ClockIcon, WarningIcon, PlusIcon, MinusIcon, CheckIcon, CloseIcon, SearchIcon, Dot } from './Icons'

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
function PnrTab({ t, lang, onAskAI }) {
  const [pnr, setPnr] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async (e) => {
    e.preventDefault()
    setErr(''); setRes(null); setBusy(true)
    try { setRes(await demoPnr(pnr.trim())) } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      <form onSubmit={go} className={`${card} p-5 space-y-3`}>
        <label className={label}>{t('sv.pnrLabel')}</label>
        <div className="flex gap-3 flex-wrap">
          <input value={pnr} onChange={(e) => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" placeholder="1234567890" className={`${field} max-w-xs font-mono tracking-widest`} />
          <button className={primary} disabled={busy || pnr.length !== 10}>{busy ? t('sv.loading') : t('sv.pnrGo')}</button>
        </div>
      </form>
      <ErrorNote message={err} />
      {res && <AssistantBlocks lang={lang} isLatest blocks={[{ type: 'demo_pnr', ...res }]} onAsk={onAskAI} />}
    </div>
  )
}

/* ───────────── Food ───────────── */
function OrderCard({ t, order, now }) {
  const idx = stageIndex(order, now)
  return (
    <div className={`${card} border-amber-500/40 overflow-hidden`}>
      <div className="px-4 py-2.5 bg-amber-400/10 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-500">
        <WarningIcon className="text-base" /> <strong className="font-mono tracking-wider">{t('demo.banner')}</strong> {t('demo.notice')}
      </div>
      <div className="p-4 space-y-3 text-xs">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="font-mono font-bold text-amber-500">{order.orderId}</span>
          <span className="text-[var(--c-text-muted)]">{order.trainNumber} {order.trainName} · {order.stationName}{order.scheduledArrival ? ` · ${order.scheduledArrival}` : ''}</span>
        </div>
        <ol className="space-y-1.5">
          {order.stages.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 ${i <= idx ? 'text-[var(--c-text-main)]' : 'text-[var(--c-text-dim)]'}`}>
              {i < idx ? <span className="text-emerald-400"><CheckIcon /></span> : i === idx ? <span className="text-amber-500"><ClockIcon /></span> : <Dot className="bg-slate-600" />}
              {s}
            </li>
          ))}
        </ol>
        <div className="text-[var(--c-text-muted)]">
          {order.items.map((i) => `${i.qty} × ${i.name}`).join(', ')} · <strong className="text-[var(--c-text-main)]">₹ {order.total}</strong>
        </div>
      </div>
    </div>
  )
}

function FoodTab({ t, initial }) {
  const [train, setTrain] = useState(null)
  const { stops, error: stopsError } = useStops(train)
  const [station, setStation] = useState('')
  const [menu, setMenu] = useState(null)
  const [cart, setCart] = useState({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [orders, setOrders] = useState(loadOrders)
  const [now, setNow] = useState(Date.now())
  const wanted = useRef(initial?.station || null)

  useEffect(() => { saveOrders(orders) }, [orders])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(id) }, [])
  useEffect(() => {  // preselect the station chosen in chat if this train stops there
    if (wanted.current && stops.some((s) => s.code === wanted.current)) { setStation(wanted.current); wanted.current = null }
  }, [stops])
  useEffect(() => {
    setMenu(null); setCart({}); setErr('')
    if (!station) return undefined
    let alive = true
    demoFoodMenu(station).then((m) => alive && setMenu(m)).catch((x) => alive && setErr(x.message))
    return () => { alive = false }
  }, [station])

  const items = cartItems(cart)
  const total = menu ? cartTotal(menu.items, cart) : 0
  const change = (id, d) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(5, (c[id] || 0) + d)) }))
  const place = async () => {
    setErr(''); setBusy(true)
    try {
      const order = await demoFoodOrder(train.trainNumber, station, items)
      setOrders((o) => addOrder(o, order))
      setCart({})
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div className={`${card} p-5 space-y-4`}>
        <div>
          <label className={label}>{t('sv.pickTrain')}</label>
          <TrainPicker t={t} value={train} onPick={setTrain} onClear={() => { setTrain(null); setStation('') }} />
          {initial?.station && !train && <p className="text-xs text-[var(--c-text-muted)] mt-2">{initial.station}</p>}
        </div>
        {train && (
          <div>
            <label className={label}>{t('sv.boarding')}</label>
            <StopSelect stops={stops} value={station} onChange={setStation} disabled={!stops.length} />
            <ErrorNote message={stopsError} />
          </div>
        )}
      </div>
      <ErrorNote message={err} />

      {menu && (
        <div className="grid lg:grid-cols-[1fr_20rem] gap-5">
          <div className={`${card} p-5 space-y-3`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-[var(--c-text-main)]">{t('sv.menu')} · {menu.vendor.name}</h3>
              <span className="text-xs font-mono text-amber-500">{menu.vendor.ratingDemo} / 5 ({t('demo.banner')})</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {menu.items.map((m) => (
                <div key={m.id} className="px-3 py-2.5 rounded-xl bg-[var(--c-obsidian)] border border-[var(--c-slate-border)] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text-main)]"><Dot className={m.veg ? 'bg-emerald-500' : 'bg-red-500'} /> {m.name}</div>
                    <div className="text-xs text-[var(--c-text-muted)] mt-0.5">{m.category} · ₹ {m.price} · {m.veg ? t('sv.veg') : t('sv.nonveg')}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" aria-label="Less" className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[var(--c-slate-border)] hover:border-amber-500/50 disabled:opacity-40" disabled={!cart[m.id]} onClick={() => change(m.id, -1)}><MinusIcon /></button>
                    <span className="w-5 text-center text-sm font-mono">{cart[m.id] || 0}</span>
                    <button type="button" aria-label="More" className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[var(--c-slate-border)] hover:border-amber-500/50 disabled:opacity-40" disabled={(cart[m.id] || 0) >= 5 || items.length >= 10 && !cart[m.id]} onClick={() => change(m.id, 1)}><PlusIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-5 space-y-3 h-fit`}>
            <h3 className="font-bold text-[var(--c-text-main)]">{t('sv.cart')}</h3>
            {items.length === 0 ? <p className="text-sm text-[var(--c-text-muted)]">{t('sv.empty')}</p> : (
              <ul className="space-y-1.5 text-sm">
                {items.map((i) => { const m = menu.items.find((x) => x.id === i.id); return (
                  <li key={i.id} className="flex justify-between gap-2"><span>{i.qty} × {m.name}</span><span className="font-mono">₹ {i.qty * m.price}</span></li>
                ) })}
              </ul>
            )}
            <div className="flex justify-between font-bold text-[var(--c-text-main)] border-t border-[var(--c-slate-border)] pt-2"><span>{t('sv.total')}</span><span className="font-mono">₹ {total}</span></div>
            <button type="button" className={`${primary} w-full`} disabled={busy || items.length === 0} onClick={place}>{busy ? t('sv.loading') : t('sv.place')}</button>
            <p className="text-xs text-[var(--c-text-muted)]">{menu.howItWorks}</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-[var(--c-text-main)]">{t('sv.history')}</h3>
          {orders.length > 0 && <button type="button" className="text-xs font-bold text-blue-400" onClick={() => setOrders([])}>{t('sv.clear')}</button>}
        </div>
        {orders.length === 0 ? <p className="text-sm text-[var(--c-text-muted)]">{t('sv.noHistory')}</p> : orders.map((o) => <OrderCard key={o.orderId} t={t} order={o} now={now} />)}
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
      <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-500/30 text-amber-500 text-sm flex items-start gap-3">
        <WarningIcon className="text-lg mt-0.5" />
        <p><strong className="font-mono tracking-wider">{t('demo.banner')}</strong> {t('sv.demoAll')}</p>
      </div>
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
      {tab === 'pnr' && <PnrTab t={t} lang={lang} onAskAI={onAskAI} />}
      {tab === 'food' && <FoodTab t={t} initial={initial} />}
      {tab === 'fare' && <FareSeatsTab t={t} lang={lang} onAskAI={onAskAI} />}
      {tab === 'live' && <LiveTab t={t} lang={lang} onAskAI={onAskAI} />}
    </div>
  )
}
