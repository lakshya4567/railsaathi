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

export const TicketIcon = make(<><path d="M3 8.5V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a2.5 2.5 0 0 0 0 5V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a2.5 2.5 0 0 0 0-5Z" /><path d="M14 5v12" strokeDasharray="2 2.5" /></>)

export const FoodIcon = make(<><path d="M6 3v7a2 2 0 0 0 2 2v9" /><path d="M10 3v7a2 2 0 0 1-2 2" /><path d="M8 3v5" /><path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17" /></>)

export const MicIcon = make(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>)

export const SpeakerIcon = make(<><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>)

export const ImageIcon = make(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 9" /></>)

export const CalendarIcon = make(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /></>)

export const ShareIcon = make(<><circle cx="6" cy="12" r="2.3" /><circle cx="17.5" cy="6" r="2.3" /><circle cx="17.5" cy="18" r="2.3" /><path d="m8 11 7.5-4M8 13l7.5 4" /></>)

export const SettingsIcon = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 14a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>, 1.5)

export const SwapIcon = make(<><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></>)

export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />, 2.2)

export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)

export const PlusIcon = make(<path d="M12 5v14M5 12h14" />, 2)

export const MinusIcon = make(<path d="M5 12h14" />, 2)

export const StopIcon = make(<rect x="6" y="6" width="12" height="12" rx="2" />)

export const GlobeIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3Z" /></>)

export const SendIcon = make(<><path d="M21 3 10.5 13.5" /><path d="m21 3-6.5 18-4-7.5L3 9.5 21 3Z" /></>)

export const WarningIcon = make(<><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r=".7" fill="currentColor" /></>)

/** Small filled status dot (replaces coloured circle emoji). Colour via a Tailwind bg-* class. */
export function Dot({ className = 'bg-slate-400' }) {
  return <span aria-hidden="true" className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${className}`} />
}

export const MaximizeIcon = make(<><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" /><path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" /></>);

export const ArrowRightIcon = make(<><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>);
export const ExternalLinkIcon = make(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>);
export const ChevronRightIcon = make(<path d="m9 18 6-6-6-6" />);
