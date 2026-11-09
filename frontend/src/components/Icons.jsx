import React from 'react'

/**
 * Icons.jsx — small inline-SVG icon set (no emoji, no icon font).
 * Icons inherit the surrounding text colour and size (1em), so they can be dropped in
 * wherever a glyph used to be. Pass className / style / strokeWidth to adjust.
 */
function make(children, defaultStroke = 1.8) {
  return function Icon({ className, style, strokeWidth = defaultStroke }) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={className}
        style={{ display: 'inline-block', verticalAlign: '-0.125em', flexShrink: 0, ...style }}
      >
        {children}
      </svg>
    )
  }
}

export const HomeIcon = make(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-5.5h4V20" /></>)

export const TrainIcon = make(<>
  <rect x="5" y="3" width="14" height="14" rx="3" />
  <path d="M5 11h14" />
  <circle cx="9" cy="14" r=".6" fill="currentColor" />
  <circle cx="15" cy="14" r=".6" fill="currentColor" />
  <path d="M8.5 17 6.5 21M15.5 17l2 4" />
</>)

export const StationIcon = make(<><path d="M3 21h18" /><path d="M5 21V9.5L12 4l7 5.5V21" /><path d="M9.5 21v-6h5v6" /><path d="M10 10.5h4" /></>)

export const MapIcon = make(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>)

export const CrosshairIcon = make(<><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>)

export const SparkIcon = make(<><path d="M11 3.5 13 9l5.5 2L13 13l-2 5.5L9 13l-5.5-2L9 9Z" /><path d="M19 15.5l.8 2.2 2.2.8-2.2.8L19 21.5l-.8-2.2-2.2-.8 2.2-.8Z" /></>)

export const SearchIcon = make(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></>)

export const EnterIcon = make(<><path d="M20 5v6a3 3 0 0 1-3 3H5" /><path d="m9 10-4 4 4 4" /></>)

export const SunIcon = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>)

export const MoonIcon = make(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />)

export const CloseIcon = make(<path d="M6 6l12 12M18 6 6 18" />, 2)

export const InfoIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r=".7" fill="currentColor" /></>)

export const ArrowUpRightIcon = make(<><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>)

export const WaveIcon = make(<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0 1 1.5 2 1.5" />, 1.2)

export const ZigzagIcon = make(<path d="M3 18 9 6l6 12 6-12" />, 1.2)

/** Small filled status dot (replaces coloured circle emoji). Colour via a Tailwind bg-* class. */
export function Dot({ className = 'bg-slate-400' }) {
  return <span aria-hidden="true" className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${className}`} />
}
