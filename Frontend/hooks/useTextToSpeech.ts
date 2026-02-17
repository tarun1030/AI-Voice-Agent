import { useRef, useCallback } from 'react';

type OnWordCallback = (wordIndex: number, word: string) => void;
type OnEndCallback = () => void;

function buildWordOffsets(text: string): { start: number; end: number }[] {
  const offsets: { start: number; end: number }[] = [];
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    offsets.push({ start: match.index, end: match.index + match[0].length });
  }
  return offsets;
}

function findWordIndex(offsets: { start: number; end: number }[], charIndex: number): number {
  for (let i = 0; i < offsets.length; i++) {
    if (charIndex <= offsets[i].end) return i;
  }
  return offsets.length - 1;
}

export const useTextToSpeech = () => {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onWordCallbackRef = useRef<OnWordCallback | null>(null);
  const onEndCallbackRef = useRef<OnEndCallback | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackIndexRef = useRef(0);
  const boundaryFiredRef = useRef(false);

  const clearFallback = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    clearFallback();
    onWordCallbackRef.current = null;
    onEndCallbackRef.current = null;
  }, [clearFallback]);

  const speak = useCallback(
    (text: string, onWord?: OnWordCallback, onEnd?: OnEndCallback): Promise<void> => {
      return new Promise((resolve) => {
        if (!('speechSynthesis' in window)) {
          resolve();
          return;
        }

        window.speechSynthesis.cancel();
        clearFallback();
        boundaryFiredRef.current = false;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        const offsets = buildWordOffsets(text);
        const words = text.split(/\s+/).filter((w) => w.length > 0);
        fallbackIndexRef.current = 0;
        onWordCallbackRef.current = onWord || null;
        onEndCallbackRef.current = onEnd || null;

        utterance.onstart = () => {
          // Fallback ticker (~110 wpm at rate 0.9) — cancelled if real boundary events fire
          const msPerWord = Math.round((60 / 110) * 1000);
          fallbackIntervalRef.current = setInterval(() => {
            if (boundaryFiredRef.current) {
              clearFallback();
              return;
            }
            const idx = fallbackIndexRef.current;
            if (idx < words.length) {
              onWordCallbackRef.current?.(idx, words[idx]);
              fallbackIndexRef.current++;
            } else {
              clearFallback();
            }
          }, msPerWord);
        };

        utterance.onboundary = (event) => {
          if (event.name !== 'word') return;
          if (!boundaryFiredRef.current) {
            boundaryFiredRef.current = true;
            clearFallback();
          }
          // charIndex maps directly to exact word — no counter drift
          const idx = findWordIndex(offsets, event.charIndex);
          if (idx >= 0 && idx < words.length) {
            onWordCallbackRef.current?.(idx, words[idx]);
          }
        };

        utterance.onend = () => {
          clearFallback();
          onWordCallbackRef.current = null;
          onEndCallbackRef.current?.();
          onEndCallbackRef.current = null;
          resolve();
        };

        utterance.onerror = (e) => {
          clearFallback();
          if (e.error !== 'interrupted' && e.error !== 'canceled') {
            console.error('TTS error:', e.error);
          }
          onWordCallbackRef.current = null;
          onEndCallbackRef.current?.();
          onEndCallbackRef.current = null;
          resolve();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [clearFallback],
  );

  const isSpeaking = useCallback(() => {
    return window.speechSynthesis?.speaking ?? false;
  }, []);

  return { speak, stop, isSpeaking };
};