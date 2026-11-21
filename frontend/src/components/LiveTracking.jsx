import React, { useRef } from 'react'

const TRACKING_URL = 'https://railradar.in/railradar'

export default function LiveTracking() {
  const frameRef = useRef(null)

  const handleFullscreen = () => {
    const frame = frameRef.current
    if (frame?.requestFullscreen) frame.requestFullscreen()
    else if (frame?.webkitRequestFullscreen) frame.webkitRequestFullscreen()
  }

  return (
    <section className="live-tracking-page">
      <div className="live-tracking-heading">
        <div>
          <div className="live-tracking-eyebrow"><span /> EXTERNAL TRACKING PREVIEW</div>
          <h1>Live Train Tracking</h1>
          <p>Explore train movements and railway routes across India.</p>
        </div>
        <a className="live-tracking-open" href={TRACKING_URL} target="_blank" rel="noreferrer">
          Open source <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="live-tracking-frame-card">
        <div className="live-tracking-frame-topbar">
          <div className="live-tracking-provider">
            <span className="live-tracking-provider-mark">R</span>
            <span><strong>RailRadar</strong><small>External website preview</small></span>
          </div>
          <button className="live-tracking-fullscreen" type="button" onClick={handleFullscreen}>
            <span aria-hidden="true">⛶</span> Full screen
          </button>
        </div>
        <div className="live-tracking-frame-wrap">
          <iframe
            ref={frameRef}
            src={TRACKING_URL}
            title="RailRadar live train map"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen"
            allowFullScreen
          />
        </div>
        <div className="live-tracking-frame-footer">
          <span>Tracking content is provided by RailRadar.</span>
          <a href={TRACKING_URL} target="_blank" rel="noreferrer">Visit RailRadar ↗</a>
        </div>
      </div>

      <p className="live-tracking-notice">
        Tracking content is provided by RailRadar. Use the full-screen button to expand the map
        while keeping the RailSaathi page URL. Provider identity and attribution are retained.
      </p>
    </section>
  )
}
