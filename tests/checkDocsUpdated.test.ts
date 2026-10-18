import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const lister = path.join(repoRoot, "scripts/list-public-exports.mjs");
const gate = path.join(repoRoot, "scripts/check-docs-updated.sh");
const temporaryRepos: string[] = [];

afterEach(() => {
  for (const directory of temporaryRepos.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function fixture(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(tmpdir(), "mesh-docs-gate-"));
  temporaryRepos.push(directory);
  writeFiles(directory, files);
  return directory;
}

function writeFiles(directory: string, files: Record<string, string>): void {
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    writeFileSync(path.join(directory, name), body);
  }
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=mesh-test",
      "-c",
      "user.email=mesh-test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd, encoding: "utf8" },
  ).trim();
}

function commitAll(cwd: string, message: string): string {
  git(cwd, "add", "--all");
  git(cwd, "commit", "--quiet", "-m", message);
  return git(cwd, "rev-parse", "HEAD");
}

function listExports(cwd: string, ...args: string[]): string[] {
  return execFileSync(process.execPath, [lister, ...args], {
    cwd,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

function runGate(cwd: string, ...args: string[]) {
  const result = spawnSync("bash", [gate, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const baseRepo = {
  "src/index.ts": 'export { alpha } from "./a";\n',
  "src/a.ts": "export const alpha = 1;\nexport const beta = 2;\n",
  "README.md": "# fixture\n\n- `alpha`\n",
  "CHANGELOG.md": "# Changelog\n",
};

function gitFixture(): { cwd: string; base: string } {
  const cwd = fixture(baseRepo);
  git(cwd, "init", "--quiet");
  return { cwd, base: commitAll(cwd, "base") };
}

describe("list-public-exports", () => {
  it("lists multi-line, type-only, aliased, declared and star re-exported names", () => {
    const cwd = fixture({
      "src/index.ts": `export {
  alpha,
  beta as gamma,
} from "./a";
export type {
  AlphaType,
} from "./a";
export * from "./ui";
export * as ns from "./a";
export const { d1, d2: renamed } = { d1: 1, d2: 2 };
export function fn() {}
export class Klass {}
export interface Iface {}
export type Alias = string;
export enum En { A }
export default 1;
`,
      "src/a.ts":
        "export const alpha = 1;\nexport const beta = 2;\nexport type AlphaType = number;\n",
      "src/ui/index.ts":
        'export { Button } from "./Button";\nexport default 5;\n',
      "src/ui/Button.tsx": "export function Button() {\n  return null;\n}\n",
    });

    expect(listExports(cwd)).toEqual(
      [
        "Alias",
        "AlphaType",
        "Button",
        "En",
        "Iface",
        "Klass",
        "alpha",
        "d1",
        "default",
        "fn",
        "gamma",
        "ns",
        "renamed",
      ].sort(),
    );
  });

  it("reads every file from a git revision with --rev", () => {
    const { cwd, base } = gitFixture();
    writeFiles(cwd, { "src/index.ts": 'export { alpha, beta } from "./a";\n' });

    expect(listExports(cwd, "--rev", base)).toEqual(["alpha"]);
    expect(listExports(cwd)).toEqual(["alpha", "beta"]);
  });

  it("matches the type checker's export list for mesh-common's own src/index.ts", () => {
    const config = ts.getParsedCommandLineOfConfigFile(
      path.join(repoRoot, "tsconfig.json"),
      {},
      { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
    );
    const entry = path.join(repoRoot, "src/index.ts");
    const program = ts.createProgram([entry], config?.options ?? {});
    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(entry)!);
    const expected = checker
      .getExportsOfModule(moduleSymbol!)
      .map((symbol) => symbol.name)
      .sort();

    expect(expected.length).toBeGreaterThan(500);
    expect(listExports(repoRoot)).toEqual(expected);
  }, 60_000);
});

describe("check-docs-updated", () => {
  it("fails a range that adds an export without README and CHANGELOG updates", () => {
    const { cwd, base } = gitFixture();
    writeFiles(cwd, {
      "src/index.ts": 'export {\n  alpha,\n  beta,\n} from "./a";\n',
    });
    const tip = commitAll(cwd, "add beta");

    const { status, output } = runGate(cwd, "--range", `${base}..${tip}`);
    expect(status).toBe(1);
    expect(output).toContain("+ beta");
    expect(output).toContain("README.md does not mention: beta");
    expect(output).toContain("CHANGELOG.md was not modified");
  });

  it("passes a range that documents the new export", () => {
    const { cwd, base } = gitFixture();
    writeFiles(cwd, {
      "src/index.ts": 'export type {\n  Beta,\n} from "./a";\nexport { alpha } from "./a";\n',
      "src/a.ts": "export const alpha = 1;\nexport type Beta = number;\n",
      "README.md": "# fixture\n\n- `alpha`\n- `Beta`\n",
      "CHANGELOG.md": "# Changelog\n\n- Added `Beta`.\n",
    });
    const tip = commitAll(cwd, "add Beta");

    const { status, output } = runGate(cwd, "--range", `${base}..${tip}`);
    expect(output).toContain("+ Beta");
    expect(status).toBe(0);
  });

  it("ignores underscore-prefixed exports", () => {
    const { cwd, base } = gitFixture();
    writeFiles(cwd, {
      "src/index.ts": 'export { alpha } from "./a";\nexport const _internal = 1;\n',
    });
    const tip = commitAll(cwd, "add internal helper");

    const { status, output } = runGate(cwd, "--range", `${base}..${tip}`);
    expect(output).toContain("no new public exports");
    expect(status).toBe(0);
  });

  it("checks staged and unstaged working-tree changes against HEAD by default", () => {
    const { cwd } = gitFixture();
    writeFiles(cwd, { "src/index.ts": 'export { alpha, beta } from "./a";\n' });

    const { status, output } = runGate(cwd);
    expect(output).toContain("+ beta");
    expect(status).toBe(1);
  });

  it("exits 2 on an unknown revision instead of treating every export as new", () => {
    const { cwd, base } = gitFixture();

    const { status, output } = runGate(cwd, "--range", `no-such-ref..${base}`);
    expect(output).toContain("unknown revision: no-such-ref");
    expect(status).toBe(2);
  });
});
