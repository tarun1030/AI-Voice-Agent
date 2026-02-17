'use client'

import { Wifi, WifiOff, Phone } from 'lucide-react'

interface VoiceControlCardProps {
  isConnected: boolean
  roomName: string
  participantName: string
  onRoomNameChange: (name: string) => void
  onParticipantNameChange: (name: string) => void
  onConnect: () => void
  onStartTalk?: () => void
}

export default function VoiceControlCard({
  isConnected,
  roomName,
  participantName,
  onRoomNameChange,
  onParticipantNameChange,
  onConnect,
  onStartTalk,
}: VoiceControlCardProps) {
  const statusColors = {
    connected: 'bg-emerald-500',
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500',
  }

  const connectionStatus = isConnected ? 'connected' : 'disconnected'
  const statusText = isConnected ? 'Connected' : 'Disconnected'

  return (
    <div className="glass-morphism-card rounded-2xl p-6 border border-white/10 backdrop-blur-xl bg-white/5 hover:bg-white/[0.08] transition-colors duration-300 animate-float-up shadow-2xl">
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Voice Control</h2>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${statusColors[connectionStatus]} animate-pulse`}></div>
          <span className="text-sm text-gray-400">{statusText}</span>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Room Name</label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => onRoomNameChange(e.target.value)}
            placeholder="Enter room name"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Participant Name</label>
          <input
            type="text"
            value={participantName}
            onChange={(e) => onParticipantNameChange(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Status Message */}
      <div className={`flex flex-col items-center mb-6 p-4 rounded-lg transition-all duration-300 ${
        isConnected
          ? 'bg-emerald-500/10 border border-emerald-500/30'
          : 'bg-white/[0.03] border border-white/10'
      }`}>
        <p className={`text-center text-sm font-medium ${
          isConnected ? 'text-emerald-400' : 'text-gray-400'
        }`}>
          {isConnected ? 'Ready to talk with the agent' : 'Connect to start voice conversation'}
        </p>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3">
        <button
          onClick={onConnect}
          className={`w-full px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 ${
            isConnected
              ? 'bg-white text-black hover:bg-gray-100'
              : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
          }`}
        >
          {isConnected ? (
            <span className="flex items-center justify-center gap-2">
              <WifiOff className="w-4 h-4" />
              Disconnect
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Wifi className="w-4 h-4" />
              Connect
            </span>
          )}
        </button>

        {isConnected && (
          <button
            onClick={onStartTalk}
            className="w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 hover:bg-red-600 flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
          >
            <Phone className="w-5 h-5" />
            Talk to Agent
          </button>
        )}
      </div>
    </div>
  )
}
