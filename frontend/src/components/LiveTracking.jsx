import React from 'react'

const TRACKING_URL = 'https://railtrackers.in/live-train-map'

export default function LiveTracking() {
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
            <span><strong>RailTrackers</strong><small>External website preview</small></span>
          </div>
          <span className="live-tracking-trial">TRIAL EMBED</span>
        </div>
        <div className="live-tracking-frame-wrap">
          <iframe
            src={TRACKING_URL}
            title="RailTrackers live train map"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className="live-tracking-frame-footer">
          <span>Tracking content is provided by RailTrackers.</span>
          <a href={TRACKING_URL} target="_blank" rel="noreferrer">Visit RailTrackers ↗</a>
        </div>
      </div>

      <p className="live-tracking-notice">
        Trial integration. The external website controls what can be displayed here.
        If the frame is blocked, use “Open source” to view it directly. Provider identity
        and attribution are intentionally retained; obtain permission before public release.
      </p>
    </section>
  )
}
