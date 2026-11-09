import React, { useState } from 'react'
import { searchGlobal } from '../services/api'
import { SparkIcon, SearchIcon, EnterIcon, TrainIcon, StationIcon, MapIcon, WaveIcon, CrosshairIcon, ZigzagIcon, ArrowUpRightIcon } from './Icons'

export default function Home({ setActiveTab, onSelectTrain, onSelectStation }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null)
    try { setResults(await searchGlobal(query.trim())) }
    catch { setError('We could not complete that search. Check your connection and try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR JOURNEY STARTS HERE</div>
          <h1>India is a little<br /><em>closer by train.</em></h1>
          <p>Explore trains, discover stations and understand the routes that connect the country.</p>
          <div className="hero-trust"><span><SparkIcon /></span> One railway network. Countless journeys.</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-track track-back" /><div className="hero-track track-front" />
          <div className="hero-train"><div className="train-window-row"><i/><i/><i/><i/></div><div className="train-nose"/><div className="train-base"/><b/><b/><b/></div>
          <div className="hero-station-label label-left"><span>01</span> DISCOVER</div>
          <div className="hero-station-label label-right"><span>02</span> CONNECT</div>
        </div>

        <div className="journey-search-card">
          <div className="search-card-heading"><div><span className="mini-eyebrow">FIND YOUR WAY</span><h2>What are you looking for?</h2></div><span className="search-spark"><SparkIcon /></span></div>
          <form onSubmit={handleSearch} className="main-search-form">
            <label className="search-input-wrap"><span className="search-symbol"><SearchIcon /></span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Train name, train number or station code" aria-label="Search trains and stations"/><kbd><EnterIcon /></kbd></label>
            <button type="submit" disabled={loading || !query.trim()}>{loading ? 'Searching…' : 'Search'} <span>→</span></button>
          </form>
          <div className="search-hints"><span>TRY SEARCHING</span><button type="button" onClick={() => setQuery('12951')}>12951</button><button type="button" onClick={() => setQuery('New Delhi')}>New Delhi</button><button type="button" onClick={() => setQuery('Mumbai')}>Mumbai</button></div>
          {error && <p className="search-error">{error}</p>}
        </div>
      </section>

      {results && <section className="search-results-panel">
        <div className="section-heading"><div><span className="mini-eyebrow">YOUR SEARCH</span><h2>Results for “{results.query}”</h2></div><button className="text-action" onClick={() => setResults(null)}>Clear results ×</button></div>
        <div className="results-grid">
          <div className="results-group"><h3>TRAINS <span>{results.trains.total}</span></h3>{results.trains.results.length ? results.trains.results.map(t => <button className="result-row" key={t.trainNumber} onClick={() => onSelectTrain(t.trainNumber)}><span className="result-code">{t.trainNumber}</span><span className="result-main"><b>{t.trainName}</b><small>{t.source?.name} → {t.destination?.name}</small></span><span className="result-arrow"><ArrowUpRightIcon /></span></button>) : <p className="empty-note">No matching trains found.</p>}</div>
          <div className="results-group"><h3>STATIONS <span>{results.stations.total}</span></h3>{results.stations.results.length ? results.stations.results.map(s => <button className="result-row" key={s.code} onClick={() => onSelectStation(s.code)}><span className="result-code">{s.code}</span><span className="result-main"><b>{s.name}</b><small>{s.state || 'India'}{s.zone ? ` · ${s.zone} zone` : ''}</small></span><span className="result-arrow"><ArrowUpRightIcon /></span></button>) : <p className="empty-note">No matching stations found.</p>}</div>
        </div>
      </section>}

      <section className="explore-section">
        <div className="section-heading"><div><span className="mini-eyebrow">THE RAILSAATHI EXPERIENCE</span><h2>Everything for the journey.</h2></div><span className="section-aside">BUILT AROUND THE WAY INDIA TRAVELS</span></div>
        <div className="feature-grid">
          <button className="feature-card feature-trains" onClick={() => setActiveTab('trains')}><span className="feature-index">01 / EXPLORE</span><span className="feature-icon"><TrainIcon /></span><h3>Find your train.</h3><p>Browse train services, discover routes and explore complete stop-by-stop timetables.</p><span className="feature-link">Explore trains <b>→</b></span><span className="feature-decoration rail-decoration"><WaveIcon strokeWidth={0.8} /></span></button>
          <button className="feature-card feature-stations" onClick={() => setActiveTab('stations')}><span className="feature-index">02 / DISCOVER</span><span className="feature-icon"><StationIcon /></span><h3>Know your station.</h3><p>Look up railway stations, codes, locations and the trains that connect there.</p><span className="feature-link">Browse stations <b>→</b></span><span className="feature-decoration station-decoration"><CrosshairIcon strokeWidth={0.8} /></span></button>
          <button className="feature-card feature-map" onClick={() => setActiveTab('map')}><span className="feature-index">03 / VISUALISE</span><span className="feature-icon"><MapIcon /></span><h3>See the network.</h3><p>Follow routes across the country and see how railway journeys fit together.</p><span className="feature-link">Open route map <b>→</b></span><span className="feature-decoration map-decoration"><ZigzagIcon strokeWidth={0.8} /></span></button>
        </div>
      </section>

      <section className="assistant-banner"><div className="assistant-orb"><SparkIcon /></div><div className="assistant-banner-copy"><span className="mini-eyebrow">A LITTLE HELP ALONG THE WAY</span><h2>Questions about your journey?</h2><p>Meet your RailSaathi journey assistant. Ask about trains, routes and stations in simple language.</p></div><button onClick={() => setActiveTab('assistant')}>Meet your assistant <span>→</span></button></section>
      <div className="home-bottom-note"><span>RAILSAATHI</span><span>MADE FOR THE MANY WAYS INDIA MOVES.</span></div>
    </div>
  )
}
