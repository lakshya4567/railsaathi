import React, { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './components/Home'
import Trains from './components/Trains'
import Stations from './components/Stations'
import NationalMap from './components/NationalMap'
import JourneyAssistant from './components/JourneyAssistant'
import TrainDetailModal from './components/TrainDetailModal'
import StationDetailModal from './components/StationDetailModal'
import { TrainIcon } from './components/Icons'

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [theme, setTheme] = useState('light')
  const [selectedTrainNumber, setSelectedTrainNumber] = useState(null)
  const [selectedStationCode, setSelectedStationCode] = useState(null)
  const [mapInitialTrain, setMapInitialTrain] = useState(null)

  useEffect(() => {
    // Restore the passenger's preferred appearance; use light mode on first visit.
    const savedTheme = localStorage.getItem('railsaathi_theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  const handleViewMap = (trainNumber) => {
    setMapInitialTrain(trainNumber)
    setActiveTab('map')
  }

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        theme={theme}
        setTheme={setTheme}
      />

      <main className="app-main flex-1 w-full mx-auto">
        {activeTab === 'home' && (
          <Home
            setActiveTab={setActiveTab}
            onSelectTrain={(num) => setSelectedTrainNumber(num)}
            onSelectStation={(code) => setSelectedStationCode(code)}
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
            onSelectTrain={(num) => setSelectedTrainNumber(num)}
            onSelectStation={(code) => setSelectedStationCode(code)}
            onViewMap={handleViewMap}
          />
        )}
      </main>

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
