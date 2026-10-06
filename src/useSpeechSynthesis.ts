import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechSynthesisStatus =
  "idle" | "speaking" | "paused" | "unsupported" | "error";
export type SpeakOptions = {
  lang?: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};
export type SpeechSynthesisApi = {
  supported: boolean;
  status: SpeechSynthesisStatus;
  error: Error | null;
  voices: SpeechSynthesisVoice[];
  speak: (text: string, options?: SpeakOptions) => boolean;
  pause: () => boolean;
  resume: () => boolean;
  cancel: () => boolean;
  refreshVoices: () => void;
};

/** Browser-native TTS with explicit controls and Safari-safe cancellation. */
export function useSpeechSynthesis(): SpeechSynthesisApi {
  const supported =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  const [status, setStatus] = useState<SpeechSynthesisStatus>(
    supported ? "idle" : "unsupported",
  );
  const [error, setError] = useState<Error | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  const refreshVoices = useCallback(() => {
    if (supported) setVoices(window.speechSynthesis.getVoices());
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return false;
    window.speechSynthesis.cancel();
    current.current = null;
    setStatus("idle");
    return true;
  }, [supported]);

  useEffect(() => {
    refreshVoices();
    if (!supported) return;
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        refreshVoices,
      );
      window.speechSynthesis.cancel();
    };
  }, [refreshVoices, supported]);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const normalized = text.trim();
      if (!supported || !normalized || normalized.length > 12_000) return false;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(normalized);
        utterance.lang = options.lang ?? "en";
        utterance.rate = Math.min(2, Math.max(0.5, options.rate ?? 1));
        utterance.pitch = Math.min(2, Math.max(0, options.pitch ?? 1));
        utterance.volume = Math.min(1, Math.max(0, options.volume ?? 1));
        if (options.voiceURI) {
          utterance.voice =
            window.speechSynthesis
              .getVoices()
              .find((voice) => voice.voiceURI === options.voiceURI) ?? null;
        }
        utterance.onend = () => {
          if (current.current === utterance) {
            current.current = null;
            setStatus("idle");
          }
        };
        utterance.onerror = () => {
          if (current.current === utterance) {
            current.current = null;
            setError(new Error("Speech synthesis failed."));
            setStatus("error");
          }
        };
        current.current = utterance;
        setError(null);
        setStatus("speaking");
        window.speechSynthesis.speak(utterance);
        return true;
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason
            : new Error("Speech synthesis failed."),
        );
        setStatus("error");
        return false;
      }
    },
    [supported],
  );

  const pause = useCallback(() => {
    if (!supported || !window.speechSynthesis.speaking) return false;
    window.speechSynthesis.pause();
    setStatus("paused");
    return true;
  }, [supported]);
  const resume = useCallback(() => {
    if (!supported || !window.speechSynthesis.paused) return false;
    window.speechSynthesis.resume();
    setStatus("speaking");
    return true;
  }, [supported]);

  return {
    supported,
    status,
    error,
    voices,
    speak,
    pause,
    resume,
    cancel,
    refreshVoices,
  };
}
