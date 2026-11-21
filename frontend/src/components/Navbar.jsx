import React from 'react'
import { HomeIcon, TrainIcon, StationIcon, MapIcon, SparkIcon, SunIcon, MoonIcon, TicketIcon, GlobeIcon } from './Icons'
import { makeT } from '../utils/i18n'

const NAV = [
  { id: 'home', key: 'nav.home', icon: HomeIcon },
  { id: 'trains', key: 'nav.trains', icon: TrainIcon },
  { id: 'stations', key: 'nav.stations', icon: StationIcon },
  { id: 'map', key: 'nav.map', icon: MapIcon },
  { id: 'live-tracking', label: 'Live Tracking', icon: TrainIcon },
  { id: 'assistant', key: 'nav.assistant', icon: SparkIcon },
  { id: 'services', key: 'nav.services', icon: TicketIcon },
]

export default function Navbar({ activeTab, setActiveTab, theme, setTheme, lang = 'en', setLang = () => {} }) {
  const t = makeT(lang)
  const navItems = NAV.map((n) => ({ ...n, label: t(n.key) }))
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('railsaathi_theme', next)
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="brand-lockup" onClick={() => setActiveTab('home')} aria-label="RailSaathi overview">
          <span className="brand-mark"><span>R</span><i /></span>
          <span className="brand-copy"><strong>railsaathi<span>.</span></strong><small>INDIA, CONNECTED BY RAIL</small></span>
        </button>

        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`nav-link ${activeTab === item.id ? 'active' : ''}`} aria-current={activeTab === item.id ? 'page' : undefined}>
              <span className="nav-icon"><item.icon /></span>{item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <span className="network-status"><i /> NETWORK DIRECTORY</span>
          <button onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')} className="theme-toggle" aria-label={lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'} title={lang === 'hi' ? 'English' : 'हिंदी'}>
            <span><GlobeIcon /></span><span className="theme-label">{t('nav.lang')}</span>
          </button>
          <button onClick={toggleTheme} className="theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
            <span>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</span><span className="theme-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(item => <button key={item.id} onClick={() => setActiveTab(item.id)} className={`mobile-nav-link ${activeTab === item.id ? 'active' : ''}`}><span><item.icon /></span>{item.label}</button>)}
      </nav>
    </header>
  )
}
