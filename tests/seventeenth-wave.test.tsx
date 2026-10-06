// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defineInteractiveArtifact,
  parseInteractiveArtifact,
  useArtworkTarget,
  useMicrophone,
  useSpeechSynthesis,
  useVoiceTurn,
} from "../src";

const manifest = {
  version: 1 as const,
  id: "mural-witness",
  title: "The Witness",
  summary: "A mural that asks visitors to notice what changes around it.",
  persona: {
    name: "The Witness",
    voice: { language: "en-US", rate: 0.95 },
    tone: ["curious", "gentle"],
    systemContext: "Speak as a public artwork, never as a human authority.",
  },
  targets: [
    { kind: "qr" as const, value: "https://example.test/mural/witness" },
    { kind: "marker" as const, value: "tag-42" },
  ],
};

describe("seventeenth primitive wave", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("validates a public artifact manifest and rejects undeclared fields", () => {
    const artifact = defineInteractiveArtifact(manifest);
    expect(artifact.persona.voice.rate).toBe(0.95);
    expect(
      parseInteractiveArtifact({ ...manifest, apiKey: "not allowed" }).artifact,
    ).toBeNull();
  });

  it("acquires a microphone only after start and releases tracks on stop", async () => {
    const stop = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockResolvedValue({ getTracks: () => [{ stop }] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const { result } = renderHook(() => useMicrophone());
    expect(getUserMedia).not.toHaveBeenCalled();
    await act(async () => expect(await result.current.start()).toBe(true));
    expect(result.current.status).toBe("ready");
    act(() => result.current.stop());
    expect(stop).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("idle");
  });

  it("speaks through explicit native TTS controls without an external provider", () => {
    let active: { onend: ((event: Event) => void) | null } | null = null;
    const engine = {
      speaking: false,
      paused: false,
      getVoices: () => [],
      speak: vi.fn((utterance) => {
        active = utterance;
        engine.speaking = true;
      }),
      cancel: vi.fn(() => {
        engine.speaking = false;
      }),
      pause: vi.fn(() => {
        engine.paused = true;
      }),
      resume: vi.fn(() => {
        engine.paused = false;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    class FakeUtterance {
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      onend: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("speechSynthesis", engine);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    const { result } = renderHook(() => useSpeechSynthesis());
    act(() =>
      expect(result.current.speak("Hello, visitor.", { rate: 0.9 })).toBe(true),
    );
    expect(engine.speak).toHaveBeenCalledOnce();
    expect(result.current.status).toBe("speaking");
    act(() => active?.onend?.(new Event("end")));
    expect(result.current.status).toBe("idle");
  });

  it("serializes and aborts a bounded local voice conversation", async () => {
    const respond = vi.fn(async (input: string) => `I heard: ${input}`);
    const { result } = renderHook(() =>
      useVoiceTurn({ adapter: { respond }, maxTurns: 1 }),
    );
    await act(async () =>
      expect(await result.current.ask("What do you remember?")).toBe(true),
    );
    expect(result.current.status).toBe("complete");
    expect(result.current.response).toBe("I heard: What do you remember?");
    expect(result.current.turns.map((turn) => turn.role)).toEqual([
      "visitor",
      "artifact",
    ]);
    await act(async () =>
      expect(await result.current.ask("One more")).toBe(false),
    );
  });

  it("accepts only known QR or confident marker detections and expires tracking", async () => {
    let time = 1_000;
    const { result } = renderHook(() =>
      useArtworkTarget({
        targets: [
          {
            id: "mural-witness",
            label: "The Witness",
            targets: manifest.targets,
          },
        ],
        now: () => time,
        staleAfterMs: 100,
      }),
    );
    act(() => {
      expect(
        result.current.reportDetection({
          kind: "marker",
          value: "tag-42",
          confidence: 0.7,
        }),
      ).toBe(false);
      expect(
        result.current.reportDetection({
          kind: "qr",
          value: "https://example.test/mural/witness",
        }),
      ).toBe(true);
    });
    expect(result.current.artifact?.id).toBe("mural-witness");
    expect(result.current.tracking).toBe(true);
    time += 101;
    await waitFor(() => expect(result.current.tracking).toBe(false));
  });
});
