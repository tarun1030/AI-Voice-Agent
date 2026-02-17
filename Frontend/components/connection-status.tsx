'use client'

import { Settings, AlertCircle } from 'lucide-react'

interface ConnectionStatusProps {
  gemini: boolean
  livekit: boolean
  deepgram: boolean
  missingKeys?: string[]
  onSettingsClick: () => void
}

/** Human-readable label for each snake_case key name returned by the API */
const KEY_LABELS: Record<string, string> = {
  gemini_api_key: 'Gemini API Key',
  livekit_url: 'LiveKit URL',
  livekit_api_key: 'LiveKit API Key',
  livekit_api_secret: 'LiveKit API Secret',
  deepgram_api_key: 'Deepgram API Key',
}

export default function ConnectionStatus({
  gemini,
  livekit,
  deepgram,
  missingKeys = [],
  onSettingsClick,
}: ConnectionStatusProps) {
  const allConnected = gemini && livekit && deepgram
  const connectionCount = [gemini, livekit, deepgram].filter(Boolean).length

  return (
    <div className="flex items-center gap-2">

      {/* Settings button — tooltip lives in this wrapper, NOT inside the button */}
      <div className="relative group">
        <button
          onClick={onSettingsClick}
          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-200"
          title="Settings"
        >
          <Settings className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        </button>

        {/* Tooltip — drops downward so it's never clipped by the header */}
        <div
          className="absolute top-full right-0 mt-2 w-48 bg-black border border-white/20 rounded-lg px-3 py-2.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
        >
          <div className="mb-2 font-semibold text-white/80 uppercase tracking-wide text-[10px]">Services</div>

          <div className={`flex items-center gap-1.5 py-0.5 ${gemini ? 'text-green-400' : 'text-red-400'}`}>
            <span className="text-sm leading-none">{gemini ? '✓' : '✗'}</span>
            <span>Gemini</span>
          </div>
          <div className={`flex items-center gap-1.5 py-0.5 ${livekit ? 'text-green-400' : 'text-red-400'}`}>
            <span className="text-sm leading-none">{livekit ? '✓' : '✗'}</span>
            <span>LiveKit</span>
          </div>
          <div className={`flex items-center gap-1.5 py-0.5 ${deepgram ? 'text-green-400' : 'text-red-400'}`}>
            <span className="text-sm leading-none">{deepgram ? '✓' : '✗'}</span>
            <span>Deepgram</span>
          </div>

          {missingKeys.length > 0 && (
            <>
              <div className="mt-2 mb-1 font-semibold text-yellow-400 uppercase tracking-wide text-[10px]">Missing</div>
              {missingKeys.map((k) => (
                <div key={k} className="text-red-300 flex items-start gap-1 py-0.5">
                  <span className="mt-px">·</span>
                  <span>{KEY_LABELS[k] ?? k}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 ${
          allConnected
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}
      >
        {allConnected ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold">Connected</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-semibold">
              {missingKeys.length > 0
                ? `${missingKeys.length} key${missingKeys.length > 1 ? 's' : ''} missing`
                : `${connectionCount}/3 Services`}
            </span>
          </>
        )}
      </div>
    </div>
  )
}