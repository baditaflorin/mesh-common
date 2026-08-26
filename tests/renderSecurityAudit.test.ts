import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type AuditEntry = {
  id: string;
  claim: string;
  result: "pass" | "fail";
  method: string;
};

function renderAudit({
  ranUi,
  entries,
}: {
  ranUi: boolean;
  entries: AuditEntry[];
}): string {
  const dir = mkdtempSync(join(tmpdir(), "mesh-render-security-audit-"));
  const sharedLog = join(dir, "shared.jsonl");
  const uiLog = join(dir, "ui.jsonl");
  const outDir = join(dir, "out");

  try {
    writeFileSync(sharedLog, JSON.stringify(entries[0]) + "\n", "utf8");
    writeFileSync(
      uiLog,
      entries
        .slice(1)
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n",
      "utf8",
    );
    execFileSync(
      process.execPath,
      ["scripts/render-security-audit.mjs", sharedLog, outDir, uiLog],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APP_NAME: "mesh-scoreboard",
          RAN_UI: ranUi ? "1" : "0",
        },
        stdio: "pipe",
      },
    );
    return readFileSync(join(outDir, "security-audit.md"), "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("render-security-audit", () => {
  it("describes an app-specific UI audit without inventing a moderator flow", () => {
    const markdown = renderAudit({
      ranUi: true,
      entries: [
        {
          id: "L1.SIGN.roundtrip",
          claim: "A signature verifies",
          result: "pass",
          method: "sign then verify",
        },
        {
          id: "UI.SCOREBOARD.resetNeedsConfirmation",
          claim: "One click cannot reset a shared board",
          result: "pass",
          method: "Press reset once and observe the peer ledger",
        },
      ],
    });

    expect(markdown).toContain("app-specific UI safety checks");
    expect(markdown).toContain("app's own safety contract");
    expect(markdown).toContain("UI.SCOREBOARD.resetNeedsConfirmation");
    expect(markdown).not.toContain("moderator badge");
  });

  it("describes a skipped UI pass without assuming a product feature", () => {
    const markdown = renderAudit({
      ranUi: false,
      entries: [
        {
          id: "L1.SIGN.roundtrip",
          claim: "A signature verifies",
          result: "pass",
          method: "sign then verify",
        },
      ],
    });

    expect(markdown).toContain("no app-specific UI audit");
    expect(markdown).not.toContain("moderator badge");
  });
});
