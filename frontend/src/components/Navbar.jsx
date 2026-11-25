import React, { useState } from 'react'
import { HomeIcon, TrainIcon, StationIcon, MapIcon, SparkIcon, SunIcon, MoonIcon, TicketIcon, GlobeIcon, FoodIcon, SearchIcon, ClockIcon, CloseIcon } from './Icons'
import { makeT } from '../utils/i18n'
import { useRailSaathiAccount } from '../context/AccountContext'

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
  const { account, promptSignIn, signOut } = useRailSaathiAccount()
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
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
            <div className="relative">
              <button type="button" onClick={() => account ? setAccountMenuOpen((open) => !open) : promptSignIn()} className="inline-flex items-center gap-2 rounded-full border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] px-2 py-1.5 hover:border-amber-500/50 transition" aria-label={account ? 'Open account menu' : 'Sign in with Google'} aria-expanded={accountMenuOpen}>
                {account?.picture ? <img src={account.picture} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="h-8 w-8 rounded-full bg-[var(--c-slate-surface)] flex items-center justify-center text-xs font-bold text-amber-500">RS</span>}
                <span className="hidden xl:inline text-xs font-semibold text-[var(--c-text-main)]">{account?.name ? account.name.split(' ')[0] : 'Account'}</span>
              </button>
              {accountMenuOpen && account && (
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-[var(--c-slate-border)] bg-[var(--c-slate-dark)] p-3 shadow-2xl">
                  <div className="flex items-center gap-3 min-w-0">
                    {account.picture ? <img src={account.picture} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" /> : <span className="h-10 w-10 rounded-full bg-[var(--c-slate-surface)]" />}
                    <div className="min-w-0"><div className="truncate text-sm font-bold text-[var(--c-text-main)]">{account.name || 'RailSaathi account'}</div><div className="truncate text-xs text-[var(--c-text-muted)]">{account.email}</div></div>
                  </div>
                  <button type="button" onClick={() => { setAccountMenuOpen(false); navigate('assistant') }} className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[var(--c-text-main)] hover:bg-[var(--c-slate-surface)]">Journey AI settings</button>
                  <button type="button" onClick={() => { signOut(); setAccountMenuOpen(false) }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-400 hover:bg-[var(--c-slate-surface)]">Sign out</button>
                </div>
              )}
            </div>

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
