import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { searchTrains, getTrainMapData } from '../services/api'
import L from 'leaflet'

import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapIcon, InfoIcon, Dot } from './Icons'

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// Marker-only mode used by the journey assistant (reachable stations, a single station).
// overlay = { markers: [{ code, name, lat, lng, color, lines: [text], origin }], legend: [{ color, label }], note }
// No lines are drawn between markers: they are places, not a track.
function OverlayMap({ overlay }) {
  const pts = (overlay.markers || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
  const bounds = pts.length > 1 ? pts.map((m) => [m.lat, m.lng]) : null
  const view = bounds
    ? { bounds, boundsOptions: { padding: [30, 30] } }
    : { center: pts.length ? [pts[0].lat, pts[0].lng] : [20.5937, 78.9629], zoom: pts.length ? 9 : 5 }
  const popup = (m) => (
    <Popup>
      <div className="space-y-1 text-xs">
        <div className="font-bold text-amber-500 text-sm">{m.name} ({m.code})</div>
        {(m.lines || []).map((l, i) => <div key={i} className="text-[var(--c-text-muted)]">{l}</div>)}
      </div>
    </Popup>
  )
  return (
    <div className="space-y-3">
      <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-[var(--c-slate-border)] relative z-0 shadow-2xl">
        <MapContainer {...view} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pts.map((m) =>
            m.origin ? (
              <Marker key={`o-${m.code}`} position={[m.lat, m.lng]}>{popup(m)}</Marker>
            ) : (
              <CircleMarker
                key={m.code}
                center={[m.lat, m.lng]}
                radius={8}
                pathOptions={{ color: '#0f172a', weight: 1.5, fillColor: m.color || '#f59e0b', fillOpacity: 0.9 }}
              >
                {popup(m)}
              </CircleMarker>
            )
          )}
        </MapContainer>
      </div>
      {overlay.legend?.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-[var(--c-text-muted)]">
          {overlay.legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.label}
            </span>
          ))}
        </div>
      )}
      {overlay.note && <p className="text-xs text-[var(--c-text-muted)] px-1">{overlay.note}</p>}
    </div>
  )
}

// `embedded` (optional) renders just the map + route summary, for use inside the journey assistant.
// `overlay` (optional) renders markers only (see OverlayMap) instead of loading a train route.
export default function NationalMap({ initialTrainNumber, embedded = false, overlay = null }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedTrain, setSelectedTrain] = useState(null)
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initialTrainNumber) {
      loadTrainMap(initialTrainNumber)
    }
  }, [initialTrainNumber])

  const handleQueryChange = async (val) => {
    setQuery(val)
    if (val.trim().length < 2) {
      setSuggestions([])
      return
    }
    try {
      const data = await searchTrains(val.trim(), 1, 8)
      setSuggestions(data.results || [])
    } catch {
      setSuggestions([])
    }
  }

  const loadTrainMap = async (trainNumber) => {
    setLoading(true)
    setError(null)
    setSuggestions([])
    try {
      const data = await getTrainMapData(trainNumber)
      setMapData(data)
      setSelectedTrain(trainNumber)
      setQuery(data.trainName)
    } catch (err) {
      setError('Could not load map data for train.')
    } finally {
      setLoading(false)
    }
  }

  const stopsWithCoords = mapData?.route?.filter(
    (s) => s.coordinates && s.coordinates.latitude && s.coordinates.longitude
  ) || []

  const polylineCoords = stopsWithCoords.map((s) => [s.coordinates.latitude, s.coordinates.longitude])
  const defaultCenter = [20.5937, 78.9629]
  const center = stopsWithCoords.length > 0
    ? [stopsWithCoords[0].coordinates.latitude, stopsWithCoords[0].coordinates.longitude]
    : defaultCenter

  if (overlay) return <OverlayMap overlay={overlay} />

  return (
    <div className={`space-y-6 ${embedded ? '' : 'pb-16'} animate-fade-in`}>
      {!embedded && (
      <div className="bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl p-8 space-y-6 shadow-xl">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <span><MapIcon /></span>
            <span>Geospatial Telemetry Grid</span>
          </div>
          <h1 className="text-3xl font-black">National Route Map</h1>
          <p className="text-sm text-[var(--c-text-muted)] mt-1">
            Search any train to render its complete ordered route geometry across OpenStreetMap.
          </p>
        </div>

        <div className="relative max-w-2xl">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search train by number or name (e.g. 12951, Rajdhani)..."
            className="input bg-[var(--c-obsidian)] border-[var(--c-slate-border)] text-sm py-3 px-4 rounded-xl w-full"
          />

          {suggestions.length > 0 && (
            <div className="absolute z-[300] left-0 right-0 mt-2 bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-2xl shadow-2xl overflow-hidden">
              {suggestions.map((t) => (
                <div
                  key={t.trainNumber}
                  onClick={() => loadTrainMap(t.trainNumber)}
                  className="px-4 py-3 hover:bg-[var(--c-slate-surface)] cursor-pointer border-b border-[var(--c-slate-border)] flex justify-between items-center text-sm"
                >
                  <div>
                    <span className="font-bold text-amber-500 font-mono">{t.trainNumber}</span>
                    <span className="font-bold text-[var(--c-text-main)] ml-2">{t.trainName}</span>
                    <div className="text-xs text-[var(--c-text-muted)]">
                      {t.source?.name} → {t.destination?.name}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {t.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="network-map-note p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs flex items-center space-x-3">
          <InfoIcon className="text-base" />
          <span>
            <strong>Telemetry Note:</strong> Polylines connect scheduled sequence stops linearly and do not represent physical railway track curves.
          </span>
        </div>
      </div>
      )}

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm font-mono">{error}</div>}

      <div className={`bg-[var(--c-slate-dark)] border border-[var(--c-slate-border)] rounded-3xl ${embedded ? 'p-3' : 'p-6'} space-y-4 shadow-2xl`}>
        {mapData && (
          <div className="flex flex-wrap justify-between items-center bg-[var(--c-obsidian)] px-6 py-4 rounded-2xl border border-[var(--c-slate-border)] text-sm">
            <div>
              <span className="font-mono font-bold text-amber-500 text-base">{mapData.trainNumber}</span>
              <span className="font-bold text-[var(--c-text-main)] text-base ml-3">{mapData.trainName}</span>
            </div>
            <div className="text-[var(--c-text-muted)] text-xs sm:text-sm mt-1 sm:mt-0 font-medium">
              {mapData.source?.name} → {mapData.destination?.name} • <span className="text-amber-500 font-bold">{stopsWithCoords.length} mapped stops</span>
            </div>
          </div>
        )}

        <div className={`${embedded ? 'h-[380px]' : 'h-[600px]'} w-full rounded-2xl overflow-hidden border border-[var(--c-slate-border)] relative z-0 shadow-2xl`}>
          <MapContainer center={center} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {polylineCoords.length > 1 && (
              <Polyline positions={polylineCoords} color="#f59e0b" weight={4} opacity={0.85} />
            )}
            {stopsWithCoords.map((stop, idx) => {
              const isSource = idx === 0
              const isDest = idx === stopsWithCoords.length - 1
              return (
                <Marker
                  key={`${stop.stationCode}-${idx}`}
                  position={[stop.coordinates.latitude, stop.coordinates.longitude]}
                >
                  <Popup>
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-amber-500 text-sm">
                        {stop.sequence}. {stop.stationName} ({stop.stationCode})
                      </div>
                      <div className="text-[var(--c-text-main)] font-semibold">
                        <span className="inline-flex items-center gap-1.5">
                          <Dot className={isSource ? 'bg-emerald-500' : isDest ? 'bg-red-500' : 'bg-slate-400'} />
                          {isSource ? 'Origin Station' : isDest ? 'Destination Station' : 'Intermediate Stop'}
                        </span>
                      </div>
                      <div className="text-[var(--c-text-muted)]">Arrival: <span className="font-mono text-[var(--c-text-main)]">{stop.arrivalTime || 'Starts here'}</span></div>
                      <div className="text-[var(--c-text-muted)]">Departure: <span className="font-mono text-[var(--c-text-main)]">{stop.departureTime || 'Terminates here'}</span></div>
                      <div className="text-[var(--c-text-muted)]">Journey Day: <span className="text-[var(--c-text-main)] font-mono">{stop.journeyDay}</span></div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
        {embedded && (
          <p className="text-xs text-[var(--c-text-muted)] px-1">
            Lines join the scheduled stops in order and are not the exact track. Stops without stored coordinates are not drawn.
          </p>
        )}
      </div>
    </div>
  )
}
