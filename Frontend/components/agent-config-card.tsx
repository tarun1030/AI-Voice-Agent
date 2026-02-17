'use client'

import { Save, RotateCcw } from 'lucide-react'
import { useState } from 'react'

interface AgentConfigCardProps {
  systemPrompt: string
  onPromptChange: (prompt: string) => void
  onSave: () => void
  onReset: () => void
}

export default function AgentConfigCard({
  systemPrompt,
  onPromptChange,
  onSave,
  onReset,
}: AgentConfigCardProps) {
  const [showSuccess, setShowSuccess] = useState(false)

  const handleSave = () => {
    onSave()
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  const charCount = systemPrompt.length
  const maxChars = 2000

  return (
    <div className="glass-morphism-card rounded-2xl p-6 border border-white/10 backdrop-blur-xl bg-white/5 hover:bg-white/[0.08] transition-colors duration-300 animate-float-up shadow-2xl [animation-delay:0.1s]">
      <h2 className="text-xl font-semibold text-white mb-6">Agent Configuration</h2>

      {/* Textarea */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-3">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => onPromptChange(e.target.value)}
          maxLength={maxChars}
          className="w-full h-40 bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all duration-200 resize-none"
          placeholder="Enter system prompt for the AI agent..."
        />
        <div className="text-xs text-gray-500 mt-2 text-right">
          {charCount} / {maxChars} characters
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-300 text-sm text-center animate-float-up">
          ✓ Prompt saved successfully
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 bg-white text-black rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 hover:bg-gray-100 flex items-center justify-center gap-2 shadow-lg"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
        <button
          onClick={onReset}
          className="flex-1 px-4 py-2.5 bg-white/10 text-white border border-white/20 rounded-lg font-semibold transition-all duration-200 transform hover:scale-105 hover:bg-white/20 flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
    </div>
  )
}
