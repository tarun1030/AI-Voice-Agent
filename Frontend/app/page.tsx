'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'
import { stripMarkdown } from '@/lib/markdown-stripper'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'
import Header from '@/components/header'
import VoiceControlCard from '@/components/voice-control-card'
import AgentConfigCard from '@/components/agent-config-card'
import DocumentUploadCard from '@/components/document-upload-card'
import ConversationHistory from '@/components/conversation-history'
import SettingsModal from '@/components/settings-modal'

interface ApiKeys {
  geminiApiKey: string
  livekitUrl: string
  livekitApiKey: string
  livekitApiSecret: string
  deepgramApiKey: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  sources?: string[]
  chunks?: string[]
}

interface Document {
  id: string
  filename: string
  chunks: number
  createdAt: Date
}

type CallStatus = 'idle' | 'listening' | 'processing' | 'speaking'

const SILENCE_TIMEOUT = 5000

export default function Home() {
  const { toast } = useToast()
  const { speak, stop: stopSpeech } = useTextToSpeech()

  // ─── State ──────────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState(false)
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful AI assistant with access to documents.'
  )
  const [roomName, setRoomName] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentSpokenWordIndex, setCurrentSpokenWordIndex] = useState(-1)
  const [lastSpokenPlainText, setLastSpokenPlainText] = useState('')
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [silenceCountdown, setSilenceCountdown] = useState<number | undefined>(undefined)

  // Mic-pause: stops listening to user voice (does NOT affect TTS/agent speech)
  const [isMicPaused, setIsMicPaused] = useState(false)
  const isMicPausedRef = useRef(false)

  const [connectionStatus, setConnectionStatus] = useState<{
    gemini: boolean
    livekit: boolean
    deepgram: boolean
    missingKeys: string[]
  }>({ gemini: false, livekit: false, deepgram: false, missingKeys: [] })

  // ─── Refs ────────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isVoiceModeRef = useRef(false)
  const isProcessingRef = useRef(false)
  const callActiveRef = useRef(false)
  const silenceCountdownRef = useRef<NodeJS.Timeout | null>(null)

  // Keep isMicPausedRef in sync — async callbacks read the ref, not the state
  useEffect(() => {
    isMicPausedRef.current = isMicPaused
  }, [isMicPaused])

  // ─── Mic-pause handler ──────────────────────────────────────────────────────
  const handleMicPauseToggle = useCallback(() => {
    setIsMicPaused((prev) => {
      const next = !prev
      isMicPausedRef.current = next
      if (next) {
        // Stop listening when mic is paused
        stopListening()
        setCallStatus('idle')
      } else {
        // Resume listening when mic is unpaused
        if (callActiveRef.current && !isProcessingRef.current) {
          startListeningCycle()
        }
      }
      return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Speech recognition ─────────────────────────────────────────────────────
  const handleSilence = useCallback(async (transcript: string) => {
    if (!isVoiceModeRef.current || isProcessingRef.current) return
    if (!transcript.trim()) return
    if (isMicPausedRef.current) return

    if (silenceCountdownRef.current) {
      clearInterval(silenceCountdownRef.current)
      silenceCountdownRef.current = null
    }
    setSilenceCountdown(undefined)

    await processVoiceQuery(transcript)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const {
    isListening,
    transcript: currentTranscript,
    start: startListening,
    stop: stopListening,
    reset: resetTranscript,
  } = useSpeechRecognition({
    silenceTimeout: SILENCE_TIMEOUT,
    onSilence: handleSilence,
  })

  // ─── Silence countdown display ──────────────────────────────────────────────
  useEffect(() => {
    if (isListening && currentTranscript && callStatus === 'listening') {
      let count = Math.ceil(SILENCE_TIMEOUT / 1000)
      setSilenceCountdown(count)
      if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current)
      silenceCountdownRef.current = setInterval(() => {
        count -= 1
        setSilenceCountdown(count)
        if (count <= 0) {
          if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current)
          silenceCountdownRef.current = null
        }
      }, 1000)
    } else if (!isListening || !currentTranscript) {
      if (silenceCountdownRef.current) {
        clearInterval(silenceCountdownRef.current)
        silenceCountdownRef.current = null
      }
      setSilenceCountdown(undefined)
    }
  }, [isListening, !!currentTranscript, callStatus])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ─── Core voice loop ─────────────────────────────────────────────────────────
  const startListeningCycle = useCallback(() => {
    if (!callActiveRef.current || isProcessingRef.current) return
    if (isMicPausedRef.current) return
    resetTranscript()
    setCallStatus('listening')
    startListening()
  }, [startListening, resetTranscript])

  const processVoiceQuery = useCallback(
    async (userText: string) => {
      if (!callActiveRef.current || isProcessingRef.current) return
      if (!userText.trim()) return

      isProcessingRef.current = true
      stopListening()
      setCallStatus('processing')
      setIsLoading(true)

      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userText.trim(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMsg])

      try {
        const result = await api.queryAgent(userText.trim(), roomName)
        const responseText = result.response || 'No response received'

        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseText,
          timestamp: new Date(),
          sources: result.sources || [],
          chunks: result.chunks || [],
        }
        setMessages((prev) => [...prev, assistantMsg])
        setIsLoading(false)

        if (callActiveRef.current) {
          setCallStatus('speaking')
          const cleanText = stripMarkdown(responseText)
          setLastSpokenPlainText(cleanText)
          setCurrentSpokenWordIndex(-1)

          await speak(cleanText, (wordIndex) => {
            setCurrentSpokenWordIndex(wordIndex)
          })

          setCurrentSpokenWordIndex(-1)
          setLastSpokenPlainText('')
        }
      } catch (error) {
        console.error('Voice query error:', error)
        setIsLoading(false)
        toast({
          title: 'Error',
          description: 'Failed to get response from agent',
          variant: 'destructive',
        })
      } finally {
        isProcessingRef.current = false
        if (callActiveRef.current && !isMicPausedRef.current) {
          startListeningCycle()
        }
      }
    },
    [roomName, speak, stopListening, startListeningCycle, toast]
  )

  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode
  }, [isVoiceMode])

  useEffect(() => {
    if (isListening && callStatus !== 'listening') {
      setCallStatus('listening')
    }
  }, [isListening])

  // ─── Config handlers ─────────────────────────────────────────────────────────
  const fetchConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/config')
      const data = await res.json()
      const missing: string[] = data.missing_keys ?? []
      const missingSet = new Set(missing.map((k: string) => k.toLowerCase()))
      setConnectionStatus({
        gemini: !missingSet.has('gemini_api_key'),
        livekit:
          !missingSet.has('livekit_url') &&
          !missingSet.has('livekit_api_key') &&
          !missingSet.has('livekit_api_secret'),
        deepgram: !missingSet.has('deepgram_api_key'),
        missingKeys: missing,
      })
    } catch (err) {
      console.error('Failed to fetch config status:', err)
    }
  }, [])

  const handleSaveApiKeys = async (keys: ApiKeys) => {
    try {
      const payload: Record<string, string> = {}
      if (keys.geminiApiKey) payload.gemini_api_key = keys.geminiApiKey
      if (keys.livekitUrl) payload.livekit_url = keys.livekitUrl
      if (keys.livekitApiKey) payload.livekit_api_key = keys.livekitApiKey
      if (keys.livekitApiSecret) payload.livekit_api_secret = keys.livekitApiSecret
      if (keys.deepgramApiKey) payload.deepgram_api_key = keys.deepgramApiKey
      if (Object.keys(payload).length === 0) return

      const res = await fetch('http://localhost:8000/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.status === 'success') {
        toast({ title: 'Saved', description: 'Configuration updated successfully' })
      }
    } catch (err) {
      console.error('Failed to save config:', err)
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' })
    } finally {
      await fetchConnectionStatus()
    }
  }

  const loadDocuments = async () => {
    try {
      const result = await api.getDocuments()
      if (result.documents && Array.isArray(result.documents)) {
        setDocuments(
          result.documents.map((doc: any) => ({
            id: doc.id || doc.filename,
            filename: doc.filename,
            chunks: doc.chunks || 0,
            createdAt: new Date(doc.createdAt || Date.now()),
          }))
        )
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchConnectionStatus()
    loadDocuments()
  }, [])

  // ─── LiveKit / agent handlers ────────────────────────────────────────────────
  const handleConnect = async () => {
    if (!roomName || !participantName) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in room and participant names',
        variant: 'destructive',
      })
      return
    }
    if (isConnected) {
      try {
        await api.stopAgent(roomName)
        setIsConnected(false)
        toast({ title: 'Disconnected', description: 'Agent stopped successfully' })
      } catch {
        toast({ title: 'Error', description: 'Failed to disconnect agent', variant: 'destructive' })
      }
    } else {
      try {
        const tokenResult = await api.createToken(roomName, participantName)
        if (!tokenResult.token) throw new Error('Failed to get LiveKit token')
        await api.startAgent(roomName)
        setIsConnected(true)
        toast({ title: 'Connected', description: 'Agent started successfully' })
      } catch {
        toast({ title: 'Error', description: 'Failed to connect to agent', variant: 'destructive' })
      }
    }
  }

  const handleStartTalk = () => {
    callActiveRef.current = true
    isProcessingRef.current = false
    setIsVoiceMode(true)
    setIsMicPaused(false)
    isMicPausedRef.current = false
    setMessages([])
    setCurrentSpokenWordIndex(-1)
    setLastSpokenPlainText('')
    setCallStatus('listening')
    setTimeout(() => startListeningCycle(), 300)
  }

  const handleEndCall = () => {
    callActiveRef.current = false
    isProcessingRef.current = false
    stopListening()
    stopSpeech()
    resetTranscript()
    setIsVoiceMode(false)
    setIsMicPaused(false)
    isMicPausedRef.current = false
    setCallStatus('idle')
    setMessages([])
    setCurrentSpokenWordIndex(-1)
    setLastSpokenPlainText('')
    setSilenceCountdown(undefined)
    if (silenceCountdownRef.current) {
      clearInterval(silenceCountdownRef.current)
      silenceCountdownRef.current = null
    }
  }

  const handleSavePrompt = async () => {
    try {
      await api.updatePrompt(systemPrompt)
      toast({ title: 'Success', description: 'System prompt saved successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to save system prompt', variant: 'destructive' })
    }
  }

  const handleResetPrompt = () => {
    setSystemPrompt('You are a helpful AI assistant with access to documents.')
  }

  const handleDocumentDelete = async (id: string) => {
    try {
      await api.deleteDocument(id)
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      toast({ title: 'Success', description: 'Document deleted successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete document', variant: 'destructive' })
    }
  }

  const handleDocumentUpload = async (
    e: React.DragEvent | React.ChangeEvent<HTMLInputElement>
  ) => {
    const files =
      e instanceof DragEvent
        ? (e as any).dataTransfer?.files
        : (e.target as HTMLInputElement).files
    if (!files) return
    setIsUploading(true)
    try {
      for (const file of Array.from(files) as File[]) {
        const result = await api.uploadDocument(file)
        const newDoc: Document = {
          id: result.id || result.filename,
          filename: result.filename,
          chunks: result.chunks || 0,
          createdAt: new Date(),
        }
        setDocuments((prev) => [...prev, newDoc])
        toast({
          title: 'Success',
          description: `Uploaded ${result.filename} (${result.chunks} chunks)`,
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to upload document', variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black">
      <Header
        connectionStatus={connectionStatus}
        onSettingsClick={() => setShowSettings(true)}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveApiKeys}
        connectionStatus={connectionStatus}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <VoiceControlCard
              isConnected={isConnected}
              roomName={roomName}
              participantName={participantName}
              onRoomNameChange={setRoomName}
              onParticipantNameChange={setParticipantName}
              onConnect={handleConnect}
              onStartTalk={handleStartTalk}
            />
            <AgentConfigCard
              systemPrompt={systemPrompt}
              onPromptChange={setSystemPrompt}
              onSave={handleSavePrompt}
              onReset={handleResetPrompt}
            />
          </div>
          <div>
            <DocumentUploadCard
              documents={documents}
              onUpload={handleDocumentUpload}
              onDelete={handleDocumentDelete}
              isUploading={isUploading}
            />
          </div>
        </div>
      </div>

      <ConversationHistory
        messages={messages}
        isLoading={isLoading}
        isListening={isListening}
        isConnected={isConnected}
        isVoiceMode={isVoiceMode}
        currentTranscript={currentTranscript}
        currentSpokenWordIndex={currentSpokenWordIndex}
        lastSpokenPlainText={lastSpokenPlainText}
        isMicPaused={isMicPaused}
        onMicPauseToggle={handleMicPauseToggle}
        onSendMessage={() => {}}
        onMicClick={() => {}}
        onClose={handleEndCall}
        messagesEndRef={messagesEndRef}
        callStatus={callStatus}
        silenceCountdown={silenceCountdown}
      />
    </main>
  )
}