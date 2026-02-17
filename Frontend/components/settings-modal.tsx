'use client'

import { X, Eye, EyeOff, Check, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ApiKeys {
  geminiApiKey: string
  livekitUrl: string
  livekitApiKey: string
  livekitApiSecret: string
  deepgramApiKey: string
}

const EMPTY_KEYS: ApiKeys = {
  geminiApiKey: '',
  livekitUrl: '',
  livekitApiKey: '',
  livekitApiSecret: '',
  deepgramApiKey: '',
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the entered keys; may be async (POST to backend) */
  onSave: (keys: ApiKeys) => Promise<void> | void
  connectionStatus: {
    gemini: boolean
    livekit: boolean
    deepgram: boolean
    missingKeys?: string[]
  }
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  connectionStatus,
}: SettingsModalProps) {
  const [keys, setKeys] = useState<ApiKeys>(EMPTY_KEYS)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reset to empty fields every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setKeys(EMPTY_KEYS)
      setShowPasswords({})
      setSaved(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleChange = (field: keyof ApiKeys, value: string) => {
    setKeys(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(keys)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const fields: { key: keyof ApiKeys; label: string; placeholder: string; service: keyof typeof connectionStatus }[] = [
    { key: 'geminiApiKey',      label: 'Gemini API Key',       placeholder: 'your_gemini_api_key_here',   service: 'gemini' },
    { key: 'livekitUrl',        label: 'LiveKit URL',           placeholder: 'wss://your.livekit.cloud',   service: 'livekit' },
    { key: 'livekitApiKey',     label: 'LiveKit API Key',       placeholder: 'your_livekit_api_key',       service: 'livekit' },
    { key: 'livekitApiSecret',  label: 'LiveKit API Secret',    placeholder: 'your_livekit_api_secret',    service: 'livekit' },
    { key: 'deepgramApiKey',    label: 'Deepgram API Key',      placeholder: 'your_deepgram_api_key',      service: 'deepgram' },
  ]

  // Map field key -> snake_case API key name so we can check missingKeys per field
  const fieldToApiKey: Record<string, string> = {
    geminiApiKey:     'gemini_api_key',
    livekitUrl:       'livekit_url',
    livekitApiKey:    'livekit_api_key',
    livekitApiSecret: 'livekit_api_secret',
    deepgramApiKey:   'deepgram_api_key',
  }

  const missingSet = new Set(connectionStatus.missingKeys ?? [])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl max-w-2xl w-full shadow-2xl animate-float-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">Settings &amp; Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          {fields.map((field) => {
            const isPassword = field.key.includes('Secret') || field.key.includes('Key')
            const showPassword = showPasswords[field.key]
            const apiKeyName = fieldToApiKey[field.key]
            const isMissing = missingSet.has(apiKeyName)
            const serviceConnected = connectionStatus[field.service] === true

            return (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">{field.label}</label>
                  <div className="flex items-center gap-2">
                    {isMissing ? (
                      <div className="text-red-400 text-xs">Missing</div>
                    ) : serviceConnected ? (
                      <div className="flex items-center gap-1 text-green-400 text-xs">
                        <Check className="w-3.5 h-3.5" />
                        Configured
                      </div>
                    ) : (
                      <div className="text-yellow-400 text-xs">Not Configured</div>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={isPassword && !showPassword ? 'password' : 'text'}
                    value={keys[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={`w-full bg-white/[0.05] border rounded-lg px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200 ${
                      isMissing ? 'border-red-500/40' : 'border-white/10'
                    }`}
                  />
                  {isPassword && (
                    <button
                      onClick={() => togglePasswordVisibility(field.key)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-black transition-all duration-200 transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 ${
              saved ? 'bg-green-500 hover:bg-green-600' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : saved ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                Saved
              </span>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}