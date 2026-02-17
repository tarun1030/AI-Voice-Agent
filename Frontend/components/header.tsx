'use client'

import ConnectionStatus from './connection-status'

interface HeaderProps {
  connectionStatus: {
    gemini: boolean
    livekit: boolean
    deepgram: boolean
    missingKeys?: string[]
  }
  onSettingsClick: () => void
}

export default function Header({ connectionStatus, onSettingsClick }: HeaderProps) {
  return (
    <header className="bg-gradient-to-b from-black to-transparent border-b border-white/10 sticky top-0 z-10 backdrop-blur-sm animate-float-up">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div className="space-y-3 flex-1">
            <h1 className="text-5xl md:text-6xl font-bold text-white text-balance leading-tight tracking-tight">
              Voice AI Agent
            </h1>
            <p className="text-lg md:text-xl text-gray-400 font-light text-balance">
              Real-time voice conversation with RAG-powered knowledge
            </p>
          </div>
          <div>
            <ConnectionStatus
              gemini={connectionStatus.gemini}
              livekit={connectionStatus.livekit}
              deepgram={connectionStatus.deepgram}
              missingKeys={connectionStatus.missingKeys}
              onSettingsClick={onSettingsClick}
            />
          </div>
        </div>
      </div>
    </header>
  )
}