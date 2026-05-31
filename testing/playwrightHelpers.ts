import type { Browser, BrowserContext, Page } from "@playwright/test";

export type MeshPair = {
  context: BrowserContext;
  a: Page;
  b: Page;
  cleanup: () => Promise<void>;
};

/**
 * Open two pages in the SAME browser context, pointed at the same app path
 * with the same room ID. y-webrtc's BroadcastChannel fallback syncs them
 * directly inside the browser — no signaling server, no STUN, no internet.
 *
 * The signaling URL is overridden to an unreachable port so the WebSocket
 * connection fails fast and doesn't add latency to tests.
 *
 * Use this for Playwright multi-peer tests:
 *
 *   test('two peers sync', async ({ browser }) => {
 *     const { a, b, cleanup } = await openTwoPeers(browser, '/');
 *     await a.fill('input[name="item"]', 'salad');
 *     await a.getByRole('button', { name: 'add' }).click();
 *     await expect(b.getByText('salad')).toBeVisible();
 *     await cleanup();
 *   });
 */
export async function openTwoPeers(
  browser: Browser,
  url: string,
  options: {
    /** Storage prefix used by the app (matches MeshConfig.storagePrefix). */
    storagePrefix: string;
    /** Room ID both peers join. Default: `e2e-${random}`. */
    roomId?: string;
    /** Override the signaling URL. Default: unreachable port. */
    signalingUrl?: string;
  },
): Promise<MeshPair> {
  // `browser.newContext()` does NOT inherit baseURL from project config, so
  // callers must pass an absolute URL (typically the `baseURL` fixture).
  const context = await browser.newContext({ baseURL: url || undefined });
  const roomId =
    options.roomId ?? `e2e-${Math.random().toString(36).slice(2, 8)}`;
  const signalingUrl =
    options.signalingUrl ?? "ws://localhost:1/never-connects";

  await context.addInitScript(
    ({ prefix, room, sig }) => {
      try {
        localStorage.setItem(`${prefix}:room`, room);
        localStorage.setItem(`${prefix}:signalingUrl`, sig);
        // Ensure no stale TURN creds carry over between tests
        localStorage.removeItem(`${prefix}:iceServers`);
      } catch {
        // ignore in environments without localStorage
      }
    },
    { prefix: options.storagePrefix, room: roomId, sig: signalingUrl },
  );

  const a = await context.newPage();
  const b = await context.newPage();
  await Promise.all([a.goto(url), b.goto(url)]);

  return {
    context,
    a,
    b,
    cleanup: async () => {
      await context.close();
    },
  };
}

export type MeshGroup = {
  context: BrowserContext;
  /** All `n` peer pages, in open order. */
  peers: Page[];
  cleanup: () => Promise<void>;
};

/**
 * Like {@link openTwoPeers} but opens `n` pages in the SAME browser context, all
 * joined to one room via y-webrtc's BroadcastChannel fallback. Use this for
 * games that only make sense with 3+ peers — hidden-role assignment, quorum
 * voting, rotating turns, leaderboards — where two peers can't exercise the
 * advertised behavior.
 *
 *   const { peers, cleanup } = await openNPeers(browser, '/', { storagePrefix: 'mesh-mafia', count: 4 });
 *   await peers[0].getByRole('button', { name: 'Start game' }).click();
 *   // exactly one of the 4 peers should be assigned the hidden role:
 *   const roles = await Promise.all(peers.map(p => p.getByTestId('my-role').textContent()));
 *   expect(roles.filter(r => r === 'mafia')).toHaveLength(1);
 *   await cleanup();
 */
export async function openNPeers(
  browser: Browser,
  url: string,
  options: {
    /** Storage prefix used by the app (matches MeshConfig.storagePrefix). */
    storagePrefix: string;
    /** How many peers to open. Must be >= 1. */
    count: number;
    /** Room ID all peers join. Default: `e2e-${random}`. */
    roomId?: string;
    /** Override the signaling URL. Default: unreachable port. */
    signalingUrl?: string;
  },
): Promise<MeshGroup> {
  const count = Math.max(1, Math.floor(options.count));
  const context = await browser.newContext({ baseURL: url || undefined });
  const roomId =
    options.roomId ?? `e2e-${Math.random().toString(36).slice(2, 8)}`;
  const signalingUrl =
    options.signalingUrl ?? "ws://localhost:1/never-connects";

  await context.addInitScript(
    ({ prefix, room, sig }) => {
      try {
        localStorage.setItem(`${prefix}:room`, room);
        localStorage.setItem(`${prefix}:signalingUrl`, sig);
        localStorage.removeItem(`${prefix}:iceServers`);
      } catch {
        // ignore in environments without localStorage
      }
    },
    { prefix: options.storagePrefix, room: roomId, sig: signalingUrl },
  );

  const peers: Page[] = [];
  for (let i = 0; i < count; i++) peers.push(await context.newPage());
  await Promise.all(peers.map((p) => p.goto(url)));

  return {
    context,
    peers,
    cleanup: async () => {
      await context.close();
    },
  };
}

/**
 * Capture console errors on a page so tests can assert "no console errors".
 * Returns a `getErrors()` function and a `clear()` helper.
 */
export function captureConsoleErrors(page: Page): {
  getErrors: () => string[];
  clear: () => void;
} {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return {
    getErrors: () => [...errors],
    clear: () => {
      errors.length = 0;
    },
  };
}
