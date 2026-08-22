import { useCallback, useEffect, useRef, useState } from "react";
type Recognition = EventTarget & { continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; };
type RecognitionCtor = new () => Recognition;
export type SpeechRecognitionApi = { supported: boolean; listening: boolean; transcript: string; error: Error | null; start: () => boolean; stop: () => void; clear: () => void };
/** Local browser speech recognition. It starts only from the caller's gesture and sends no transcript to the mesh. */
export function useSpeechRecognition(options: { lang?: string; continuous?: boolean } = {}): SpeechRecognitionApi {
  const Ctor = typeof window === "undefined" ? undefined : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);
  const [listening, setListening] = useState(false), [transcript, setTranscript] = useState(""), [error, setError] = useState<Error | null>(null); const ref = useRef<Recognition | null>(null);
  const stop = useCallback(() => { ref.current?.stop(); }, []);
  const start = useCallback(() => { if (!Ctor || listening) return false; const recognition = new Ctor(); recognition.lang = options.lang ?? "en-US"; recognition.continuous = options.continuous ?? false; recognition.interimResults = false; recognition.onresult = (event) => setTranscript(Array.from(event.results).map((result) => result[0]?.transcript ?? "").join(" ").trim()); recognition.onerror = (event) => { setError(new Error(event.error)); setListening(false); }; recognition.onend = () => setListening(false); ref.current = recognition; try { recognition.start(); setError(null); setListening(true); return true; } catch (reason) { setError(reason instanceof Error ? reason : new Error("Speech recognition could not start.")); return false; } }, [Ctor, listening, options.continuous, options.lang]);
  useEffect(() => stop, [stop]); return { supported: Boolean(Ctor), listening, transcript, error, start, stop, clear: () => setTranscript("") };
}
