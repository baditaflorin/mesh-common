import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const installer = fileURLToPath(
  new URL("../scripts/install-ux-foundation-probe.sh", import.meta.url),
);
const temporaryApps: string[] = [];

afterEach(() => {
  for (const app of temporaryApps.splice(0)) {
    rmSync(app, { force: true, recursive: true });
  }
});

describe("install-ux-foundation-probe", () => {
  it("refreshes dialog-aware smoke, mesh, UX, performance, and leak probes", () => {
    const app = mkdtempSync(join(tmpdir(), "mesh-test-harness-"));
    temporaryApps.push(app);
    writeFileSync(
      join(app, "package.json"),
      `${JSON.stringify({ name: "mesh-harness-test", scripts: {} }, null, 2)}\n`,
    );

    execFileSync("bash", [installer, app], { encoding: "utf8" });

    const e2e = join(app, "tests", "e2e");
    const smoke = readFileSync(join(e2e, "smoke.spec.ts"), "utf8");
    const mesh = readFileSync(join(e2e, "mesh.spec.ts"), "utf8");
    const ux = readFileSync(join(e2e, "mesh-shell-foundation.spec.ts"), "utf8");
    const perf = readFileSync(join(e2e, "perf-budget.spec.ts"), "utf8");
    const leak = readFileSync(join(e2e, "memory-leak.spec.ts"), "utf8");
    const pkg = JSON.parse(readFileSync(join(app, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(smoke).toContain('getByRole("dialog", { name: "Settings" })');
    expect(smoke).toContain("closeInitiallyOpenSettings");
    expect(smoke).toContain("product metadata available in Settings");
    expect(smoke).not.toContain(".mesh-self-ref, .self-ref");
    expect(mesh).toContain("closeInitiallyOpenSettings");
    expect(mesh).toContain("[data-mesh-app-shell]");
    expect(mesh).not.toContain(".mesh-self-ref, .self-ref");
    expect(ux).toContain("MeshShell provides the UX foundation");
    expect(ux).toContain(
      'const settingsFab = shell.locator(".mesh-settings-fab");',
    );
    expect(ux).toContain("await expect(settingsFab).toBeVisible();");
    expect(ux).toContain("await expect(settingsFab).toBeEnabled();");
    expect(ux).not.toContain(
      'page.getByRole("button", { name: "Open settings" }).click()',
    );
    expect(perf).toContain("closeInitiallyOpenSettings");
    expect(leak).toContain("closeInitiallyOpenSettings");
    expect(leak).toContain("element.click()");
    expect(leak).toContain("timeout: 500");
    expect(leak).not.toContain("btn.click({ trial: false, timeout: 2000 })");
    expect(pkg.scripts["test:leak"]).toBe(
      "MESH_RUN_LEAK_TEST=1 playwright test tests/e2e/memory-leak.spec.ts",
    );
  });
});
