import React, { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './components/Home'
import Trains from './components/Trains'
import Stations from './components/Stations'
import NationalMap from './components/NationalMap'
import JourneyAssistant from './components/JourneyAssistant'
import JourneyAIWidget from './components/JourneyAIWidget'
import Services from './components/Services'
import LiveTracking from './components/LiveTracking'
import TrainDetailModal from './components/TrainDetailModal'
import StationDetailModal from './components/StationDetailModal'
import { TrainIcon } from './components/Icons'
import { getInitialLang, saveLang } from './utils/i18n'

// Dark is the default appearance. A passenger's saved choice (via the theme button) still wins.
const DEFAULT_THEME = 'dark'
function getInitialTheme() {
  try {
    const saved = localStorage.getItem('railsaathi_theme')
    return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME // storage blocked (private mode, etc.)
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [theme, setTheme] = useState(getInitialTheme)
  const [selectedTrainNumber, setSelectedTrainNumber] = useState(null)
  const [selectedStationCode, setSelectedStationCode] = useState(null)
  const [mapInitialTrain, setMapInitialTrain] = useState(null)
  const [lang, setLangState] = useState(getInitialLang)
  const [assistantQuestion, setAssistantQuestion] = useState(null)
  const [servicesInitial, setServicesInitial] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setLang = (l) => { setLangState(l); saveLang(l); document.documentElement.setAttribute('lang', l) }

  // Send a typed question (e.g. from the Home search) to the Journey AI tab.
  const handleAskAI = (text) => { setAssistantQuestion(text); setActiveTab('assistant') }
  const handleOpenServices = (tab, params) => { setServicesInitial({ tab, ...(params || {}) }); setActiveTab('services') }

  const handleViewMap = (trainNumber) => {
    setMapInitialTrain(trainNumber)
    setActiveTab('map')
  }

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenServices={handleOpenServices}
        theme={theme}
        setTheme={setTheme}
        lang={lang}
        setLang={setLang}
      />

      <main className="app-main flex-1 w-full mx-auto">
        {activeTab === 'home' && (
          <Home
            setActiveTab={setActiveTab}
            onSelectTrain={(num) => setSelectedTrainNumber(num)}
            onSelectStation={(code) => setSelectedStationCode(code)}
            onAskAI={handleAskAI}
          />
        )}
        {activeTab === 'trains' && (
          <Trains onSelectTrain={(num) => setSelectedTrainNumber(num)} />
        )}
        {activeTab === 'stations' && (
          <Stations onSelectStation={(code) => setSelectedStationCode(code)} />
        )}
        {activeTab === 'map' && (
          <NationalMap initialTrainNumber={mapInitialTrain} />
        )}
        {activeTab === 'assistant' && (
          <JourneyAssistant
            lang={lang}
            initialQuestion={assistantQuestion}
            onInitialQuestionUsed={() => setAssistantQuestion(null)}
            onSelectTrain={(num) => setSelectedTrainNumber(num)}
            onSelectStation={(code) => setSelectedStationCode(code)}
            onViewMap={handleViewMap}
            onOpenServices={handleOpenServices}
          />
        )}
        {activeTab === 'services' && (
          <Services lang={lang} initial={servicesInitial} onAskAI={handleAskAI} />
        )}
        {activeTab === 'live-tracking' && <LiveTracking />}
      </main>

      <JourneyAIWidget
        activeTab={activeTab}
        onNavigate={setActiveTab}
        onOpenServices={handleOpenServices}
        onSelectTrain={setSelectedTrainNumber}
        onSelectStation={setSelectedStationCode}
        onViewMap={handleViewMap}
        lang={lang}
      />

      {/* Modals */}
      {selectedTrainNumber && (
        <TrainDetailModal
          trainNumber={selectedTrainNumber}
          onClose={() => setSelectedTrainNumber(null)}
          onViewMap={handleViewMap}
        />
      )}

      {selectedStationCode && (
        <StationDetailModal
          stationCode={selectedStationCode}
          onClose={() => setSelectedStationCode(null)}
          onSelectTrain={(num) => setSelectedTrainNumber(num)}
        />
      )}

      {/* Footer */}
      <footer className="app-footer py-6 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <TrainIcon className="text-base" />
            <span className="font-bold text-slate-300">RailSaathi · Your railway companion</span>
          </div>
          <p>© 2026 RailSaathi. Designed for journeys across India.</p>
        </div>
      </footer>
    </div>
  )
}
