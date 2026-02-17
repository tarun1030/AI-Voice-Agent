import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechRecognitionOptions {
  silenceTimeout?: number; // ms of silence before auto-send (default 5000)
  onSilence?: (transcript: string) => void;
}

export const useSpeechRecognition = (options: UseSpeechRecognitionOptions = {}) => {
  const { silenceTimeout = 5000, onSilence } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSilent, setIsSilent] = useState(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const onSilenceRef = useRef(onSilence);
  const shouldRestartRef = useRef(false);

  useEffect(() => {
    onSilenceRef.current = onSilence;
  }, [onSilence]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    setIsSilent(false);
    if (isListeningRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        if (isListeningRef.current && accumulatedTranscriptRef.current.trim()) {
          setIsSilent(true);
          const finalTranscript = accumulatedTranscriptRef.current.trim();
          onSilenceRef.current?.(finalTranscript);
        }
      }, silenceTimeout);
    }
  }, [silenceTimeout, clearSilenceTimer]);

  const setupRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + ' ' + final).trim();
        setTranscript(accumulatedTranscriptRef.current);
        resetSilenceTimer();
      } else if (interim) {
        setTranscript((accumulatedTranscriptRef.current + ' ' + interim).trim());
        resetSilenceTimer();
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      resetSilenceTimer();
    };

    recognition.onend = () => {
      // Auto-restart if we should still be listening
      if (shouldRestartRef.current && isListeningRef.current) {
        try {
          recognition.start();
        } catch (_) {}
      } else {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // No speech is fine — just restart if still listening
        if (shouldRestartRef.current && isListeningRef.current) {
          try {
            recognition.start();
          } catch (_) {}
        }
        return;
      }
      if (event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognitionRef.current = recognition;
  }, [resetSilenceTimer]);

  useEffect(() => {
    setupRecognition();
    return () => {
      clearSilenceTimer();
      recognitionRef.current?.stop();
    };
  }, [setupRecognition, clearSilenceTimer]);

  const start = useCallback(() => {
    accumulatedTranscriptRef.current = '';
    setTranscript('');
    setIsSilent(false);
    shouldRestartRef.current = true;
    isListeningRef.current = true;

    if (!recognitionRef.current) setupRecognition();

    try {
      recognitionRef.current?.start();
    } catch (_) {}
  }, [setupRecognition]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    isListeningRef.current = false;
    clearSilenceTimer();
    setIsListening(false);
    setIsSilent(false);
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
  }, [clearSilenceTimer]);

  const reset = useCallback(() => {
    accumulatedTranscriptRef.current = '';
    setTranscript('');
    setIsSilent(false);
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  return { isListening, transcript, isSilent, start, stop, reset };
};