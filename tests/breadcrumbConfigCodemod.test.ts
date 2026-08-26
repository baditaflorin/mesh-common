import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  migrateBreadcrumbConfig,
  planBreadcrumbConfig,
} from "../scripts/add-breadcrumbs-config.mjs";

const createConfig = `import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-queue",
  description: "A shared queue",
});
`;

describe("add-breadcrumbs-config", () => {
  it("makes one exact insertion in a canonical createMeshConfig source", () => {
    const plan = planBreadcrumbConfig(createConfig);
    expect(plan.status).toBe("add");
    expect(plan.nextText).toBe(
      createConfig.replace(
        '  appName: "mesh-queue",',
        '  appName: "mesh-queue",\n  breadcrumbs: false,',
      ),
    );
  });

  it("supports the legacy createMeshConfig variable before a spread export", () => {
    const plan =
      planBreadcrumbConfig(`const legacyRoomConfig = createMeshConfig({
  appName: "mesh-milestone-map",
  description: "Shared milestones",
});

export const config = { ...legacyRoomConfig, displayName: "Pathline" };
`);
    expect(plan.status).toBe("add");
    expect(plan.nextText).toContain(
      'appName: "mesh-milestone-map",\n  breadcrumbs: false,',
    );
  });

  it("supports a direct appConfig literal without changing its imports", () => {
    const plan = planBreadcrumbConfig(`export const appConfig = {
  appName: "mesh-brain-write",
  storagePrefix: "mesh-brain-write",
  description: "Shared writing",
};
`);
    expect(plan.status).toBe("add");
    expect(plan.nextText).toContain(
      'appName: "mesh-brain-write",\n  breadcrumbs: false,',
    );
  });

  it("is idempotent and preserves an app's intentional breadcrumb setting", () => {
    const plan = planBreadcrumbConfig(`export const config = createMeshConfig({
  appName: "mesh-queue",
  breadcrumbs: { items: [{ label: "Queue" }] },
  description: "A shared queue",
});
`);
    expect(plan).toMatchObject({ status: "already" });
  });

  it("refuses ambiguous config sources instead of guessing", () => {
    const plan = planBreadcrumbConfig(`const one = createMeshConfig({
  appName: "mesh-one",
});
const two = createMeshConfig({
  appName: "mesh-two",
});
`);
    expect(plan).toMatchObject({ status: "skip" });
  });

  it("writes only the chosen config file and makes a second run idempotent", () => {
    const appDirectory = mkdtempSync(
      path.join(os.tmpdir(), "mesh-breadcrumbs-"),
    );
    const configDirectory = path.join(appDirectory, "src");
    mkdirSync(configDirectory);
    const configPath = path.join(configDirectory, "config.ts");
    writeFileSync(configPath, createConfig);

    try {
      expect(
        migrateBreadcrumbConfig(appDirectory, { write: true }).status,
      ).toBe("add");
      expect(readFileSync(configPath, "utf8")).toContain("breadcrumbs: false");
      expect(
        migrateBreadcrumbConfig(appDirectory, { check: true }).status,
      ).toBe("already");
    } finally {
      rmSync(appDirectory, { force: true, recursive: true });
    }
  });
});
