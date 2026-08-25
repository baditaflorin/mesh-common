import { describe, expect, it } from "vitest";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { openNPeers, openTwoPeers } from "../testing/playwrightHelpers";

type InitScriptCall = { arg: unknown };

class FakePage {
  readonly initScripts: InitScriptCall[] = [];
  readonly navigations: string[] = [];

  async addInitScript(_script: unknown, arg?: unknown): Promise<void> {
    this.initScripts.push({ arg });
  }

  async goto(url: string): Promise<void> {
    this.navigations.push(url);
  }
}

class FakeContext {
  readonly initScripts: InitScriptCall[] = [];
  readonly pages: FakePage[] = [];
  closed = false;

  async addInitScript(_script: unknown, arg?: unknown): Promise<void> {
    this.initScripts.push({ arg });
  }

  async newPage(): Promise<Page> {
    const page = new FakePage();
    this.pages.push(page);
    return page as unknown as Page;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeBrowser {
  readonly context = new FakeContext();

  async newContext(): Promise<BrowserContext> {
    return this.context as unknown as BrowserContext;
  }
}

function pageDevice(page: FakePage): { key: string; id: string } {
  return page.initScripts[0]?.arg as { key: string; id: string };
}

describe("Playwright peer helpers", () => {
  it("gives same-context pair pages distinct simulated device identities", async () => {
    const fake = new FakeBrowser();
    const pair = await openTwoPeers(fake as unknown as Browser, "http://app.test", {
      storagePrefix: "mesh-test",
      roomId: "room-a",
    });

    expect(fake.context.pages).toHaveLength(2);
    const [first, second] = fake.context.pages.map(pageDevice);
    expect(first.key).toBe("mesh-test:deviceId:v1");
    expect(second.key).toBe("mesh-test:deviceId:v1");
    expect(first.id).not.toBe(second.id);
    expect(fake.context.pages.every((page) => page.navigations[0] === "http://app.test")).toBe(
      true,
    );

    await pair.cleanup();
    expect(fake.context.closed).toBe(true);
  });

  it("accepts explicit same-device and group identities when a test needs them", async () => {
    const fake = new FakeBrowser();
    await openNPeers(fake as unknown as Browser, "http://app.test", {
      storagePrefix: "mesh-test",
      count: 3,
      deviceIds: ["phone-a", "phone-a", "phone-b"],
    });

    expect(fake.context.pages.map(pageDevice)).toEqual([
      { key: "mesh-test:deviceId:v1", id: "phone-a" },
      { key: "mesh-test:deviceId:v1", id: "phone-a" },
      { key: "mesh-test:deviceId:v1", id: "phone-b" },
    ]);
  });
});
