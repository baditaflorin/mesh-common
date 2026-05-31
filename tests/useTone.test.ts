// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createToneEngine, useTone } from "../src/useTone";

type OscRec = {
  type: string;
  freq: number;
  glide: number;
  started: number;
  stopped: number;
};

function mockAudio() {
  const oscs: OscRec[] = [];
  let closed = false;
  let resumes = 0;
  const ctx = {
    currentTime: 0,
    state: "suspended" as AudioContextState,
    destination: {},
    createOscillator() {
      const rec: OscRec = {
        type: "sine",
        freq: 0,
        glide: -1,
        started: -1,
        stopped: -1,
      };
      const node = {
        get type() {
          return rec.type;
        },
        set type(v: string) {
          rec.type = v;
        },
        frequency: {
          setValueAtTime: (v: number) => {
            rec.freq = v;
          },
          exponentialRampToValueAtTime: (v: number) => {
            rec.glide = v;
          },
        },
        connect: () => node,
        start: (t: number) => {
          rec.started = t;
        },
        stop: (t: number) => {
          rec.stopped = t;
        },
      };
      oscs.push(rec);
      return node as unknown as OscillatorNode;
    },
    createGain() {
      const node = {
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        connect: () => ctx.destination,
      };
      return node as unknown as GainNode;
    },
    resume() {
      resumes += 1;
      ctx.state = "running";
      return Promise.resolve();
    },
    close() {
      closed = true;
      return Promise.resolve();
    },
  };
  return {
    factory: () => ctx as unknown as AudioContext,
    oscs,
    isClosed: () => closed,
    resumeCount: () => resumes,
  };
}

describe("createToneEngine", () => {
  it("plays one oscillator tone and resumes a suspended context", () => {
    const m = mockAudio();
    const engine = createToneEngine({ factory: m.factory });
    engine.play({ freq: 440 });
    expect(m.oscs).toHaveLength(1);
    expect(m.oscs[0]!.freq).toBe(440);
    expect(m.oscs[0]!.started).toBeGreaterThanOrEqual(0);
    expect(m.oscs[0]!.stopped).toBeGreaterThan(m.oscs[0]!.started);
    expect(m.resumeCount()).toBe(1);
  });

  it("sequence schedules every note; beep is a square blip", () => {
    const m = mockAudio();
    const engine = createToneEngine({ factory: m.factory });
    engine.sequence([
      { freq: 880, at: 0 },
      { freq: 660, at: 0.18 },
    ]);
    expect(m.oscs).toHaveLength(2);
    engine.beep();
    expect(m.oscs).toHaveLength(3);
    expect(m.oscs[2]!.type).toBe("square");
  });

  it("glideTo schedules a pitch ramp (chirp)", () => {
    const m = mockAudio();
    const engine = createToneEngine({ factory: m.factory });
    engine.play({ freq: 880, glideTo: 440 });
    expect(m.oscs[0]!.freq).toBe(880);
    expect(m.oscs[0]!.glide).toBe(440);
  });

  it("is a no-op (never throws) when no AudioContext is available", () => {
    const engine = createToneEngine(); // jsdom has no window.AudioContext
    expect(() => engine.play({ freq: 440 })).not.toThrow();
    expect(engine.ctx).toBeNull();
  });
});

describe("useTone", () => {
  it("returns a stable engine and closes the context on unmount", () => {
    const m = mockAudio();
    const { result, rerender, unmount } = renderHook(() =>
      useTone({ factory: m.factory }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first); // stable across renders
    act(() => result.current.play({ freq: 523 }));
    expect(m.oscs).toHaveLength(1);
    unmount();
    expect(m.isClosed()).toBe(true);
  });
});
