import React, { useState } from 'react'
import { HomeIcon, TrainIcon, StationIcon, MapIcon, SparkIcon, SunIcon, MoonIcon, TicketIcon, GlobeIcon, FoodIcon, SearchIcon, ClockIcon, CloseIcon } from './Icons'
import { makeT } from '../utils/i18n'

const NAV = [
  { id: 'home', key: 'nav.home', icon: HomeIcon },
  { id: 'trains', key: 'nav.trains', icon: TrainIcon },
  { id: 'stations', key: 'nav.stations', icon: StationIcon },
  { id: 'map', key: 'nav.map', icon: MapIcon },
  { id: 'live-tracking', label: 'Live Tracking', icon: TrainIcon },
  { id: 'assistant', key: 'nav.assistant', icon: SparkIcon },
]

const SERVICE_LINKS = [
  { id: 'pnr', label: 'PNR Finder', icon: SearchIcon },
  { id: 'food', label: 'Food on Train', icon: FoodIcon },
  { id: 'fare', label: 'Fare & Seat Finder', icon: TicketIcon },
  { id: 'live', label: 'Train Status', icon: ClockIcon },
]

export default function Navbar({ activeTab, setActiveTab, onOpenServices = () => {}, theme, setTheme, lang = 'en', setLang = () => {} }) {
  const t = makeT(lang)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navItems = NAV.map((n) => ({ ...n, label: n.key ? t(n.key) : n.label }))
  const navigate = (id) => { setActiveTab(id); setSidebarOpen(false) }
  const openService = (id) => { onOpenServices(id); setSidebarOpen(false) }
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('railsaathi_theme', next)
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-area">
            <button className="all-features-trigger" type="button" onClick={() => setSidebarOpen(true)} aria-expanded={sidebarOpen} aria-controls="features-sidebar">
              <span className="all-features-bars"><i /><i /><i /></span>
              
            </button>
            <button className="brand-lockup" onClick={() => navigate('home')} aria-label="RailSaathi overview">
              <span className="brand-mark"><span>R</span><i /></span>
              <span className="brand-copy"><strong>Railsaathi<span>.</span></strong><small>INDIA, CONNECTED BY RAIL</small></span>
            </button>
          </div>

          <nav className="desktop-nav" aria-label="Main navigation">
            {navItems.map(item => (
              <button key={item.id} onClick={() => navigate(item.id)} className={`nav-link ${activeTab === item.id ? 'active' : ''}`} aria-current={activeTab === item.id ? 'page' : undefined}>
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
        <nav className="mobile-nav" aria-label="Main navigation">
          {navItems.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`mobile-nav-link ${activeTab === item.id ? 'active' : ''}`}><span><item.icon /></span>{item.label}</button>)}
        </nav>
      </header>

      {sidebarOpen && (
        <div className="features-sidebar-layer">
          <button className="features-sidebar-backdrop" type="button" aria-label="Close features menu" onClick={() => setSidebarOpen(false)} />
          <aside className="features-sidebar" id="features-sidebar" aria-label="All RailSaathi features">
            <div className="features-sidebar-head">
              <div><span className="features-sidebar-kicker">RAILSAATHI MENU</span><h2>All Features</h2></div>
              <button type="button" className="features-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><CloseIcon /></button>
            </div>
            <div className="features-sidebar-section">
              <span className="features-sidebar-label">EXPLORE</span>
              {navItems.map(item => (
                <button type="button" key={item.id} onClick={() => navigate(item.id)} className={`features-sidebar-link ${activeTab === item.id ? 'active' : ''}`}>
                  <item.icon /> <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="features-sidebar-section">
              <span className="features-sidebar-label">RAILWAY SERVICES</span>
              {SERVICE_LINKS.map(item => (
                <button type="button" key={item.id} onClick={() => openService(item.id)} className={`features-sidebar-link ${activeTab === 'services' ? 'active' : ''}`}>
                  <item.icon /> <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="features-sidebar-foot">Your railway companion, across India.</div>
          </aside>
        </div>
      )}
    </>
  )
}
