import React from 'react'
import { SparkIcon, TrainIcon, StationIcon, MapIcon, WaveIcon, CrosshairIcon, ZigzagIcon } from './Icons'
import TrainRouteSearch from './TrainRouteSearch'

export default function Home({ setActiveTab, onSelectTrain, onSelectStation, onAskAI }) {
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

        <div className="home-route-search"><TrainRouteSearch /></div>
      </section>

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
