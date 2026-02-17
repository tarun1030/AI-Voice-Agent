'use client'

import {
  Loader2,
  Square,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bot,
  User,
  FileText,
  Radio,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
  chunks?: string[]
}

interface ConversationHistoryProps {
  messages: Message[]
  isLoading: boolean
  isListening: boolean
  isConnected: boolean
  isVoiceMode?: boolean
  currentTranscript?: string
  currentSpokenWordIndex?: number
  /** Exact plain-text string passed to TTS — ensures word-highlight indices align */
  lastSpokenPlainText?: string
  /** Whether mic input is paused (stop listening to user voice) */
  isMicPaused: boolean
  onMicPauseToggle: () => void
  onSendMessage: () => void
  onMicClick: () => void
  onClose: () => void
  messagesEndRef: React.RefObject<HTMLDivElement>
  callStatus?: 'listening' | 'processing' | 'speaking' | 'idle'
  silenceCountdown?: number
}

// ─── HighlightedMarkdown ──────────────────────────────────────────────────────
function HighlightedMarkdown({
  content,
  highlightedWordIndex,
  plainText,
}: {
  content: string
  highlightedWordIndex: number
  plainText?: string
}) {
  const isSpeaking = highlightedWordIndex >= 0 && !!plainText

  if (!isSpeaking) {
    return (
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 text-gray-100 leading-relaxed text-sm">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1 text-sm text-gray-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1 text-sm text-gray-200">{children}</ol>
          ),
          li: ({ children }) => <li className="text-gray-200 text-sm">{children}</li>,
          code: ({ children }) => (
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300">
              {children}
            </code>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-white mb-2 mt-1">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-white mb-1.5 mt-1">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-gray-200 mb-1">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-white/20 pl-3 text-gray-400 italic text-sm my-2">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    )
  }

  const words = plainText!.split(/\s+/).filter(Boolean)

  return (
    <p className="text-sm leading-relaxed text-gray-100">
      {words.map((word, i) => (
        <span
          key={i}
          className={`transition-colors duration-75 ${
            i === highlightedWordIndex
              ? 'bg-amber-400/35 text-amber-100 font-medium px-0.5 rounded'
              : i < highlightedWordIndex
              ? 'text-white/50'
              : 'text-gray-100'
          }`}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  )
}

// ─── Chunk panel badge (click to open/close) ─────────────────────────────────
function ChunkBadge({ source, chunk }: { source: string; chunk?: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<'above' | 'below'>('above')
  const badgeRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        badgeRef.current && !badgeRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleClick = () => {
    if (!chunk) return
    if (!open && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect()
      setPos(rect.top < 260 ? 'below' : 'above')
    }
    setOpen((v) => !v)
  }

  return (
    <span ref={badgeRef} className="relative inline-block">
      <button
        onClick={handleClick}
        className={`text-[10px] border text-amber-300/80 px-2 py-0.5 rounded-md transition-all duration-150 select-none ${
          chunk
            ? open
              ? 'bg-amber-500/25 border-amber-500/50 text-amber-200 cursor-pointer'
              : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 cursor-pointer'
            : 'bg-amber-500/10 border-amber-500/20 cursor-default'
        }`}
      >
        {source}
        {chunk && (
          <span className={`ml-1 opacity-50 text-[9px] inline-block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            ▾
          </span>
        )}
      </button>

      {/* Panel — opens above or below based on screen position */}
      {open && chunk && (
        <div
          ref={panelRef}
          className={`absolute z-50 w-80 rounded-xl border border-amber-500/25 bg-[#0e0e16] shadow-2xl shadow-black/70 overflow-hidden ${
            pos === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-0`}
          style={{ backdropFilter: 'blur(16px)' }}
        >
          {/* Caret */}
          <div
            className={`absolute left-4 w-2 h-2 rotate-45 border border-amber-500/20 bg-[#0e0e16] ${
              pos === 'above'
                ? 'bottom-[-5px] border-t-0 border-l-0'
                : 'top-[-5px] border-b-0 border-r-0'
            }`}
          />

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.07] bg-white/[0.02]">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide truncate">
                {source}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 text-xs leading-none"
            >
              ✕
            </button>
          </div>

          {/* Chunk content with styled scrollbar */}
          <div className="max-h-52 overflow-y-auto p-3 chunk-scroll">
            <p className="text-[11px] text-gray-300 leading-relaxed font-mono whitespace-pre-wrap break-words">
              {chunk}
            </p>
          </div>
        </div>
      )}
    </span>
  )
}

// ─── Animated waveform ────────────────────────────────────────────────────────
function VoiceWave({ active, color = 'emerald' }: { active: boolean; color?: 'emerald' | 'red' }) {
  const heights = [2, 4, 7, 5, 9, 6, 8, 4, 6, 3, 7, 5, 4, 6, 3]
  const activeColor = color === 'red' ? 'bg-red-400' : 'bg-emerald-400'
  const dimColor = color === 'red' ? 'bg-red-900/40' : 'bg-emerald-900/40'

  return (
    <div className="flex items-center gap-[2px] h-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-[2px] rounded-full transition-all duration-300 ${active ? activeColor : dimColor}`}
          style={{
            height: active ? `${h * 2 + 2}px` : '3px',
            animation: active
              ? `waveBar ${0.6 + (i % 5) * 0.12}s ease-in-out infinite alternate`
              : 'none',
            animationDelay: `${i * 0.04}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.3); opacity: 0.6; }
          to   { transform: scaleY(1);   opacity: 1; }
        }

        /* ── Styled scrollbars ── */
        .main-scroll::-webkit-scrollbar,
        .chunk-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .main-scroll::-webkit-scrollbar-track,
        .chunk-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .main-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.10);
          border-radius: 99px;
        }
        .main-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }
        .chunk-scroll::-webkit-scrollbar-thumb {
          background: rgba(245,158,11,0.18);
          border-radius: 99px;
        }
        .chunk-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(245,158,11,0.32);
        }
        /* Firefox */
        .main-scroll  { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.10) transparent; }
        .chunk-scroll { scrollbar-width: thin; scrollbar-color: rgba(245,158,11,0.20) transparent; }
      `}</style>
    </div>
  )
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({
  isLoading,
  isSpeaking,
  isListening,
  isMicPaused,
}: {
  isLoading: boolean
  isSpeaking: boolean
  isListening: boolean
  isMicPaused: boolean
}) {
  if (isMicPaused)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
        <MicOff className="w-3 h-3" /> Mic Paused
      </span>
    )
  if (isLoading)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-violet-500/15 text-violet-400 border border-violet-500/25">
        <Loader2 className="w-3 h-3 animate-spin" /> Processing
      </span>
    )
  if (isSpeaking)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
        Speaking
      </span>
    )
  if (isListening)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
        Listening
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/5 text-gray-500 border border-white/10">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" />
      Idle
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ConversationHistory({
  messages,
  isLoading,
  isListening,
  isConnected,
  isVoiceMode = false,
  currentTranscript = '',
  currentSpokenWordIndex = -1,
  lastSpokenPlainText = '',
  isMicPaused,
  onMicPauseToggle,
  onSendMessage,
  onMicClick,
  onClose,
  messagesEndRef,
  callStatus = 'idle',
  silenceCountdown,
}: ConversationHistoryProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setIsSpeaking(window.speechSynthesis?.speaking ?? false)
    }, 80)
    return () => clearInterval(id)
  }, [])

  const handleStopSpeech = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  if (!isVoiceMode) return null

  const hasContent = messages.length > 0 || !!currentTranscript

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0f] animate-in fade-in duration-200">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="w-4 h-4 text-emerald-400" />
            {isConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] animate-pulse" />
            )}
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Live Agent Call</p>
            <p className="text-gray-500 text-[11px] leading-tight">
              {isConnected ? 'Connected' : 'Disconnected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMicPauseToggle}
            title={isMicPaused ? 'Resume mic — start listening again' : 'Pause mic — stop listening to your voice'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${
              isMicPaused
                ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25'
                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {isMicPaused ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMicPaused ? 'Resume Mic' : 'Pause Mic'}</span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 hover:text-red-300 transition-all duration-200 text-xs font-medium"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 space-y-4 scroll-smooth main-scroll">

          {!hasContent && (
            <div className="flex flex-col items-center justify-center h-full gap-5 text-center select-none">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white/20" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-white/70 font-medium text-sm mb-1">Ready to listen</p>
                <p className="text-gray-600 text-xs max-w-[200px] leading-relaxed">
                  Start speaking — I'll respond after 5 seconds of silence
                </p>
              </div>
            </div>
          )}

          {messages.map((message, idx) => {
            const isLatestAssistant = message.role === 'assistant' && idx === messages.length - 1
            const isHighlighting = isLatestAssistant && isSpeaking
            const isUser = message.role === 'user'

            return (
              <div
                key={message.id}
                className={`flex gap-3 animate-in slide-in-from-bottom-2 duration-300 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                    isUser
                      ? 'bg-blue-500/15 border border-blue-500/25'
                      : 'bg-emerald-500/15 border border-emerald-500/25'
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                <div
                  className={`flex flex-col gap-1 max-w-[78%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="text-[10px] text-gray-600 font-medium px-0.5">
                    {isUser ? 'You' : 'Agent'}
                  </span>

                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isUser
                        ? 'bg-blue-500/[0.15] border border-blue-500/20 text-gray-100 rounded-tr-sm'
                        : 'bg-white/[0.05] border border-white/[0.08] rounded-tl-sm'
                    }`}
                  >
                    {!isUser ? (
                      <HighlightedMarkdown
                        content={message.content}
                        highlightedWordIndex={isHighlighting ? currentSpokenWordIndex : -1}
                        plainText={isHighlighting ? lastSpokenPlainText : undefined}
                      />
                    ) : (
                      <p>{message.content}</p>
                    )}

                    {/* Sources with chunk tooltips */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-white/[0.08]">
                        <div className="flex items-center gap-1.5 mb-2">
                          <FileText className="w-3 h-3 text-amber-400" />
                          <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide">
                            Sources
                          </span>
                          {message.chunks && message.chunks.length > 0 && (
                            <span className="text-[10px] text-amber-400/40 ml-0.5">
                              · hover to preview
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {message.sources.map((src, i) => (
                            <ChunkBadge
                              key={i}
                              source={src}
                              chunk={message.chunks?.[i]}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-gray-700 px-0.5">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )
          })}

          {isListening && currentTranscript && (
            <div className="flex gap-3 flex-row-reverse animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex flex-col gap-1 items-end max-w-[78%]">
                <span className="text-[10px] text-gray-600 font-medium px-0.5">You</span>
                <div className="px-4 py-3 rounded-2xl rounded-tr-sm bg-blue-500/[0.08] border border-blue-500/[0.15] border-dashed">
                  <p className="text-sm text-blue-200/80 italic leading-relaxed">
                    {currentTranscript}
                  </p>
                  {silenceCountdown !== undefined && silenceCountdown <= 3 && silenceCountdown > 0 && (
                    <p className="text-[10px] text-blue-400/50 mt-1.5">
                      Sending in {silenceCountdown}s…
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex flex-col gap-1 items-start">
                <span className="text-[10px] text-gray-600 font-medium px-0.5">Agent</span>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/[0.07] flex items-center gap-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-emerald-400/70 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">Thinking…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Right panel (desktop) ────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col gap-0 w-60 border-l border-white/[0.06] bg-white/[0.01]">

          {/* Agent section */}
          <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 border-b border-white/[0.06]">
            <div
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isSpeaking
                  ? 'bg-emerald-500/20 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/[0.04] border border-white/10'
              }`}
            >
              <Bot
                className={`w-6 h-6 transition-colors duration-300 ${
                  isSpeaking ? 'text-emerald-400' : 'text-gray-500'
                }`}
              />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0a0a0f] animate-pulse" />
              )}
            </div>
            <div className="text-center">
              <p className="text-white/80 text-xs font-semibold">AI Agent</p>
              <p className={`text-[10px] mt-0.5 transition-colors duration-300 ${
                isSpeaking ? 'text-emerald-400' : 'text-gray-600'
              }`}>
                {isSpeaking ? 'Speaking' : 'Standby'}
              </p>
            </div>
            <VoiceWave active={isSpeaking} color="emerald" />
          </div>

          {/* You section */}
          <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-6 border-b border-white/[0.06]">
            <div
              className={`relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                isMicPaused
                  ? 'bg-yellow-500/10 border border-yellow-500/20'
                  : isListening
                  ? 'bg-red-500/20 border border-red-500/30 shadow-lg shadow-red-500/10'
                  : 'bg-white/[0.04] border border-white/10'
              }`}
            >
              {isMicPaused ? (
                <MicOff className="w-6 h-6 text-yellow-500/70" />
              ) : isListening ? (
                <Mic className="w-6 h-6 text-red-400" />
              ) : (
                <MicOff className="w-6 h-6 text-gray-600" />
              )}
              {isListening && !isMicPaused && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-400 border-2 border-[#0a0a0f] animate-pulse" />
              )}
            </div>
            <div className="text-center">
              <p className="text-white/80 text-xs font-semibold">You</p>
              <p className={`text-[10px] mt-0.5 transition-colors duration-300 ${
                isMicPaused ? 'text-yellow-500' : isListening ? 'text-red-400' : 'text-gray-600'
              }`}>
                {isMicPaused ? 'Mic Paused' : isListening ? 'Listening' : 'Waiting'}
              </p>
            </div>
            <VoiceWave active={isListening && !isMicPaused} color="red" />
          </div>

          {/* Status + controls */}
          <div className="flex flex-col items-center gap-4 px-6 pt-6">
            <StatusPill
              isLoading={isLoading}
              isSpeaking={isSpeaking}
              isListening={isListening}
              isMicPaused={isMicPaused}
            />

            <button
              onClick={onMicPauseToggle}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border transition-all duration-200 ${
                isMicPaused
                  ? 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400 hover:bg-yellow-500/25'
                  : 'bg-white/[0.04] border-white/10 text-gray-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {isMicPaused ? (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Resume Mic
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  Pause Mic
                </>
              )}
            </button>

            {isSpeaking && (
              <button
                onClick={handleStopSpeech}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all duration-200"
              >
                <Square className="w-3.5 h-3.5" />
                Stop Speaking
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom bar (mobile) ──────────────────────────────────────────────── */}
      <div className="lg:hidden border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <StatusPill
            isLoading={isLoading}
            isSpeaking={isSpeaking}
            isListening={isListening}
            isMicPaused={isMicPaused}
          />

          <div className="flex items-center gap-2">
            {isSpeaking && (
              <button
                onClick={handleStopSpeech}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/25 rounded-lg text-orange-400 text-xs font-medium"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
            )}

            <button
              onClick={onMicPauseToggle}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                isMicPaused
                  ? 'bg-yellow-500/15 border-yellow-500/25 text-yellow-400'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              {isMicPaused ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {isMicPaused ? 'Resume' : 'Pause'}
            </button>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/15 border border-red-500/25 rounded-lg text-red-400 text-xs font-medium"
            >
              <PhoneOff className="w-3 h-3" />
              End
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}