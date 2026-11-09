import React from 'react'
import { HomeIcon, TrainIcon, StationIcon, MapIcon, SparkIcon, SunIcon, MoonIcon } from './Icons'

const navItems = [
  { id: 'home', label: 'Overview', icon: HomeIcon },
  { id: 'trains', label: 'Trains', icon: TrainIcon },
  { id: 'stations', label: 'Stations', icon: StationIcon },
  { id: 'map', label: 'Network map', icon: MapIcon },
  { id: 'assistant', label: 'Journey AI', icon: SparkIcon },
]

export default function Navbar({ activeTab, setActiveTab, theme, setTheme }) {
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
