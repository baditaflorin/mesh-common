import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const generator = join(
  process.cwd(),
  "scripts",
  "generate-privacy-section.mjs",
);
const start = "<!-- mesh:capabilities-block:start -->";
const end = "<!-- mesh:capabilities-block:end -->";

describe("generate-privacy-section", () => {
  it("emits a Prettier-stable capability block that passes a later --check", () => {
    const appDir = mkdtempSync(join(tmpdir(), "mesh-privacy-generator-"));
    const sourceDir = join(appDir, "src");
    const privacyFile = join(appDir, "docs", "privacy.md");

    try {
      mkdirSync(sourceDir, { recursive: true });
      mkdirSync(join(appDir, "docs"), { recursive: true });
      writeFileSync(
        join(sourceDir, "Feature.tsx"),
        'import { useNamedPeer } from "@baditaflorin/mesh-common";\nvoid useNamedPeer;\n',
        "utf8",
      );
      // This is the blank-line layout Prettier produces around Markdown
      // comments and lists. The generator must preserve it rather than
      // fighting the formatting gate on every CI run.
      writeFileSync(
        privacyFile,
        `# Privacy\n\n${start}\n\nplaceholder\n\n${end}\n`,
        "utf8",
      );

      execFileSync(process.execPath, [generator], {
        cwd: appDir,
        stdio: "pipe",
      });
      const generated = readFileSync(privacyFile, "utf8");
      expect(generated).toContain(
        `${start}\n\n- 🪪 **Display name** — the name you type is published to the room.\n\n${end}`,
      );
      expect(() =>
        execFileSync(process.execPath, [generator, "--check"], {
          cwd: appDir,
          stdio: "pipe",
        }),
      ).not.toThrow();
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
