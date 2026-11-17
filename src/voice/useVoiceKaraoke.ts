import { useState, useCallback, useEffect, useRef } from 'react';

export function useVoiceKaraoke() {
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSpeakingId(null);
    setActiveWordIndex(-1);
  }, []);

  const speak = useCallback(
    (id: string, text: string, langCode: string, rate = 0.92, onComplete?: () => void) => {
      stop();
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length === 0) return;

      setSpeakingId(id);
      setActiveWordIndex(0);

      let idx = 0;
      const intervalMs = Math.max(170, Math.round((text.length * 56) / words.length / rate));
      timerRef.current = window.setInterval(() => {
        idx += 1;
        if (idx < words.length) {
          setActiveWordIndex(idx);
        } else {
          stop();
          onComplete?.();
        }
      }, intervalMs);

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = rate;

        utterance.onboundary = (event) => {
          if (event.name === 'word') {
            const spokenPrefix = text.slice(0, event.charIndex).trim();
            const wordPos = spokenPrefix ? spokenPrefix.split(/\s+/).length : 0;
            if (wordPos < words.length) {
              idx = wordPos;
              setActiveWordIndex(wordPos);
            }
          }
        };

        utterance.onend = () => {
          stop();
          onComplete?.();
        };

        utterance.onerror = () => {
          // Karaoke visual reading timer continues cleanly if OS TTS lacks a voice pack
        };

        window.speechSynthesis.speak(utterance);
      }
    },
    [stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { speakingId, activeWordIndex, speak, stop };
}
