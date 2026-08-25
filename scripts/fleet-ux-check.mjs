#!/usr/bin/env node
/**
 * Catalog-driven UX foundation verifier for the mesh application fleet.
 *
 * The catalog is the source of truth, not a `mesh-*` glob: the latter can
 * include non-app support directories and omit valid catalog services that
 * have not been checked out locally yet.
 *
 * By default this script only reads the catalog and app sources. It never
 * clones, installs, edits, commits, or pushes. Passing `--run` explicitly
 * runs the selected existing npm scripts inside each selected app; build and
 * browser test commands may create their normal app-owned output artifacts.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_CATALOG = path.join(ROOT, "docs", "demos", "catalog.json");
const DEFAULT_WORKSPACE = path.resolve(ROOT, "..");
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_JOBS = 4;
const MAX_JOBS = 8;
const DEFAULT_PORT_BASE = 4600;
const REQUIRED_SCRIPTS = ["typecheck", "test:unit", "smoke", "test:e2e"];
const STAGE_ORDER = ["typecheck", "unit", "smoke", "e2e"];
const STAGES = {
  typecheck: ["run", "typecheck"],
  unit: ["run", "test:unit"],
  smoke: ["run", "smoke"],
  e2e: ["run", "test:e2e"],
};

const HELP = `
Usage:
  node scripts/fleet-ux-check.mjs [options]

Read-only catalog and static checks (the default) select deterministic batches
of 20 catalog apps. The workspace must contain mesh-common and its app repos
as siblings, for example /workspace/mesh-common and /workspace/mesh-queue.

Options:
  --catalog <path>       Catalog JSON; defaults to docs/demos/catalog.json.
  --workspace <path>     Parent directory containing sibling mesh-* repos.
  --batch <n|all>        One-indexed batch to inspect; defaults to 1.
  --batch-size <n>       Apps per deterministic batch; defaults to 20.
  --list                 Print one static result per selected catalog app.
  --json                 Emit the report as JSON (cannot be combined with --run).
  --require-direct-foundation
                         Fail static checks unless App.tsx directly renders
                         MeshThemeProvider, MeshAppProvider, and MeshAppFrame.
                         This audits an explicit migration; legacy MeshShell
                         apps receive the baseline foundation at runtime.
  --run <stages>         Explicitly run comma-separated existing npm stages:
                         typecheck,unit,smoke,e2e, or all.
  --jobs <n>             Bounded worker count for --run (1-${MAX_JOBS}; default ${DEFAULT_JOBS}).
  --port-base <n>        PLAYWRIGHT_PORT base for e2e; each catalog app gets
                         a unique base + catalog index port (default ${DEFAULT_PORT_BASE}).
  --help                 Show this help text.

Examples:
  # Inspect the first deterministic batch without changing any app.
  node scripts/fleet-ux-check.mjs --list

  # Inspect all 201 catalog IDs as JSON, even when some repos are not local.
  node scripts/fleet-ux-check.mjs --batch all --list --json

  # Run the recommended full app gate for batch 3. smoke includes unit tests
  # and a typechecked production build; e2e runs the two-peer browser checks.
  node scripts/fleet-ux-check.mjs --batch 3 --run smoke,e2e --jobs 4
`.trim();

function fail(message, code = 64) {
  console.error(`fleet-ux-check: ${message}`);
  process.exit(code);
}

function parsePositiveInteger(
  raw,
  flag,
  { max = Number.MAX_SAFE_INTEGER } = {},
) {
  if (!/^[1-9]\d*$/.test(raw ?? "")) {
    fail(`${flag} must be a positive integer; received ${JSON.stringify(raw)}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > max) {
    fail(`${flag} must be at most ${max}; received ${raw}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    catalogPath: DEFAULT_CATALOG,
    workspace: DEFAULT_WORKSPACE,
    batch: "1",
    batchSize: DEFAULT_BATCH_SIZE,
    list: false,
    json: false,
    requireDirectFoundation: false,
    stages: [],
    jobs: DEFAULT_JOBS,
    portBase: DEFAULT_PORT_BASE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`${arg} needs a value`);
      index += 1;
      return value;
    };
    switch (arg) {
      case "--help":
      case "-h":
        console.log(HELP);
        process.exit(0);
        break;
      case "--catalog":
        options.catalogPath = path.resolve(next());
        break;
      case "--workspace":
        options.workspace = path.resolve(next());
        break;
      case "--batch":
        options.batch = next();
        break;
      case "--batch-size":
        options.batchSize = parsePositiveInteger(next(), "--batch-size");
        break;
      case "--list":
        options.list = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--require-direct-foundation":
        options.requireDirectFoundation = true;
        break;
      case "--run": {
        const requested = next()
          .split(",")
          .map((stage) => stage.trim())
          .filter(Boolean);
        if (requested.length === 0) fail("--run needs at least one stage");
        if (requested.includes("all")) {
          if (requested.length !== 1)
            fail("--run all cannot be combined with other stages");
          options.stages = [...STAGE_ORDER];
          break;
        }
        const unknown = requested.filter(
          (stage) => !STAGE_ORDER.includes(stage),
        );
        if (unknown.length > 0) {
          fail(`unknown --run stage(s): ${unknown.join(", ")}`);
        }
        options.stages = STAGE_ORDER.filter((stage) =>
          requested.includes(stage),
        );
        break;
      }
      case "--jobs":
        options.jobs = parsePositiveInteger(next(), "--jobs", {
          max: MAX_JOBS,
        });
        break;
      case "--port-base":
        options.portBase = parsePositiveInteger(next(), "--port-base", {
          max: 65535,
        });
        break;
      default:
        fail(`unknown option ${JSON.stringify(arg)}; use --help for usage`);
    }
  }

  if (options.batch !== "all") {
    options.batch = parsePositiveInteger(options.batch, "--batch");
  }
  if (options.json && options.stages.length > 0) {
    fail(
      "--json cannot be combined with --run because command output is streamed",
    );
  }
  return options;
}

function loadCatalog(catalogPath) {
  if (!existsSync(catalogPath)) fail(`catalog not found: ${catalogPath}`);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(catalogPath, "utf8"));
  } catch (error) {
    fail(`could not parse ${catalogPath}: ${error.message}`);
  }
  const rawEntries = Array.isArray(parsed) ? parsed : parsed?.demos;
  if (!Array.isArray(rawEntries)) {
    fail(`${catalogPath} must be an array or an object with a demos array`);
  }

  const seen = new Set();
  return rawEntries.map((entry, index) => {
    const id = entry?.id;
    if (typeof id !== "string" || !/^mesh-[a-z0-9][a-z0-9-]*$/.test(id)) {
      fail(
        `catalog entry ${index} has an invalid app id: ${JSON.stringify(id)}`,
      );
    }
    if (seen.has(id)) fail(`catalog contains duplicate id ${id}`);
    seen.add(id);
    return { id, catalogIndex: index, sourceUrl: entry.sourceUrl ?? null };
  });
}

function selectBatch(entries, batch, batchSize) {
  const totalBatches = Math.ceil(entries.length / batchSize);
  if (batch === "all") {
    return { entries, totalBatches, batchLabel: `all ${totalBatches} batches` };
  }
  if (batch > totalBatches) {
    fail(
      `--batch ${batch} is outside 1-${totalBatches} for ${entries.length} catalog apps`,
    );
  }
  const start = (batch - 1) * batchSize;
  return {
    entries: entries.slice(start, start + batchSize),
    totalBatches,
    batchLabel: `${batch}/${totalBatches}`,
  };
}

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function dependencyFor(packageJson) {
  return (
    packageJson.dependencies?.["@baditaflorin/mesh-common"] ??
    packageJson.devDependencies?.["@baditaflorin/mesh-common"] ??
    null
  );
}

function renderCount(source, component) {
  return new RegExp(`<${component}(?:\\s|>)`).test(source);
}

function inspectApp(entry, workspace, options) {
  const appDir = path.resolve(workspace, entry.id);
  const relative = path.relative(workspace, appDir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`catalog id resolved outside workspace: ${entry.id}`);
  }
  const packagePath = path.join(appDir, "package.json");
  const appPath = path.join(appDir, "src", "App.tsx");
  const featurePath = path.join(appDir, "src", "Feature.tsx");
  const errors = [];
  const warnings = [];

  let packageJson = null;
  if (!existsSync(appDir)) {
    errors.push("missing local repository");
  } else if (!existsSync(packagePath)) {
    errors.push("missing package.json");
  } else {
    try {
      packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    } catch (error) {
      errors.push(`invalid package.json: ${error.message}`);
    }
  }

  const source = existsSync(appPath) ? readText(appPath) : null;
  if (existsSync(appDir) && !source) errors.push("missing src/App.tsx");

  const scripts = packageJson?.scripts ?? {};
  const missingScripts = REQUIRED_SCRIPTS.filter(
    (name) => typeof scripts[name] !== "string",
  );
  if (packageJson && missingScripts.length > 0) {
    errors.push(`missing required npm script(s): ${missingScripts.join(", ")}`);
  }
  if (packageJson && packageJson.name !== entry.id) {
    warnings.push(
      `package name is ${JSON.stringify(packageJson.name)}, expected ${entry.id}`,
    );
  }

  const commonDependency = packageJson ? dependencyFor(packageJson) : null;
  if (packageJson && !commonDependency) {
    errors.push("missing @baditaflorin/mesh-common dependency");
  } else if (commonDependency && commonDependency !== "file:../mesh-common") {
    warnings.push(
      `mesh-common dependency is ${JSON.stringify(commonDependency)}, not local sibling link`,
    );
  }

  const meshShell = source ? renderCount(source, "MeshShell") : false;
  if (source && !meshShell) errors.push("App.tsx does not render MeshShell");

  const roomAtApp = source ? /\buseYRoom\s*\(/.test(source) : false;
  const foundation = {
    theme: source ? renderCount(source, "MeshThemeProvider") : false,
    provider: source ? renderCount(source, "MeshAppProvider") : false,
    frame: source ? renderCount(source, "MeshAppFrame") : false,
  };
  const fullFoundation = Object.values(foundation).every(Boolean);
  if (options.requireDirectFoundation && source && !fullFoundation) {
    const missing = Object.entries(foundation)
      .filter(([, present]) => !present)
      .map(([name]) => name)
      .join(", ");
    errors.push(`missing UX foundation component(s): ${missing}`);
  }

  const featureSource = readText(featurePath);
  const featureHasMain = featureSource
    ? /<main(?:\s|>)/.test(featureSource)
    : false;
  if (foundation.frame && featureHasMain) {
    warnings.push(
      "MeshAppFrame plus Feature <main> can create nested main landmarks",
    );
  }

  return {
    ...entry,
    path: appDir,
    exists: existsSync(appDir),
    packageName: packageJson?.name ?? null,
    commonDependency,
    missingScripts,
    meshShell,
    roomCohort: !source
      ? "unavailable"
      : roomAtApp
        ? "app-room"
        : "feature-room",
    foundation: { ...foundation, complete: fullFoundation },
    featureHasMain,
    errors,
    warnings,
    commandResults: [],
  };
}

function runNpmStage(app, stage, port) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = STAGES[stage];
  const env = {
    ...process.env,
    ...(stage === "e2e" ? { PLAYWRIGHT_PORT: String(port) } : {}),
  };
  const startedAt = Date.now();
  const label = `[${app.id}] ${stage}${stage === "e2e" ? ` (PLAYWRIGHT_PORT=${port})` : ""}`;
  console.log(`\n==> ${label}`);

  return new Promise((resolve) => {
    const child = spawn(npm, args, {
      cwd: app.path,
      env,
      shell: false,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      resolve({
        stage,
        ok: false,
        code: null,
        error: error.message,
        durationMs: Date.now() - startedAt,
        port: stage === "e2e" ? port : null,
      });
    });
    child.on("close", (code, signal) => {
      resolve({
        stage,
        ok: code === 0,
        code,
        signal: signal ?? null,
        durationMs: Date.now() - startedAt,
        port: stage === "e2e" ? port : null,
      });
    });
  });
}

async function runAppStages(app, stages, port) {
  for (const stage of stages) {
    const result = await runNpmStage(app, stage, port);
    app.commandResults.push(result);
    if (!result.ok) break;
  }
}

async function runBounded(apps, stages, jobs, portBase) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(jobs, apps.length) },
    async () => {
      while (next < apps.length) {
        const index = next;
        next += 1;
        const app = apps[index];
        await runAppStages(app, stages, portBase + app.catalogIndex);
      }
    },
  );
  await Promise.all(workers);
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function reportFor(options, allEntries, selection, apps) {
  const staticFailures = apps.filter((app) => app.errors.length > 0);
  const commandFailures = apps.filter((app) =>
    app.commandResults.some((result) => !result.ok),
  );
  return {
    catalogPath: options.catalogPath,
    workspace: options.workspace,
    catalogApps: allEntries.length,
    batchSize: options.batchSize,
    batch: selection.batchLabel,
    selectedApps: apps.length,
    stages: options.stages,
    summary: {
      present: countBy(apps, (app) => app.exists),
      missingLocalRepository: countBy(apps, (app) => !app.exists),
      meshShell: countBy(apps, (app) => app.meshShell),
      appRoomCohort: countBy(apps, (app) => app.roomCohort === "app-room"),
      featureRoomCohort: countBy(
        apps,
        (app) => app.roomCohort === "feature-room",
      ),
      unavailableRoomCohort: countBy(
        apps,
        (app) => app.roomCohort === "unavailable",
      ),
      directFoundation: countBy(apps, (app) => app.foundation.complete),
      featureMainLandmark: countBy(apps, (app) => app.featureHasMain),
      staticFailures: staticFailures.length,
      commandFailures: commandFailures.length,
    },
    apps: apps.map((app) => ({
      id: app.id,
      catalogIndex: app.catalogIndex,
      sourceUrl: app.sourceUrl,
      path: app.path,
      exists: app.exists,
      packageName: app.packageName,
      commonDependency: app.commonDependency,
      missingScripts: app.missingScripts,
      meshShell: app.meshShell,
      roomCohort: app.roomCohort,
      foundation: app.foundation,
      featureHasMain: app.featureHasMain,
      errors: app.errors,
      warnings: app.warnings,
      commandResults: app.commandResults,
    })),
  };
}

function printTextReport(report, apps, { list }) {
  console.log(
    `Catalog: ${report.catalogApps} apps · batch ${report.batch} · selected ${report.selectedApps}`,
  );
  console.log(`Workspace: ${report.workspace}`);
  if (report.stages.length > 0)
    console.log(`Stages: ${report.stages.join(", ")}`);

  if (list) {
    for (const app of apps) {
      const state = app.errors.length > 0 ? "FAIL" : "OK";
      const foundation = app.foundation.complete ? "foundation" : "legacy";
      console.log(
        `${String(app.catalogIndex + 1).padStart(3, "0")} ${state.padEnd(4)} ${app.id.padEnd(31)} ${app.roomCohort.padEnd(12)} ${foundation.padEnd(10)} ${app.path}`,
      );
      for (const error of app.errors) console.log(`    error: ${error}`);
      for (const warning of app.warnings)
        console.log(`    warning: ${warning}`);
    }
  } else {
    for (const app of apps.filter(
      (item) =>
        item.errors.length > 0 ||
        item.commandResults.some((result) => !result.ok),
    )) {
      console.log(`FAIL ${app.id}`);
      for (const error of app.errors) console.log(`  static: ${error}`);
      for (const result of app.commandResults.filter((item) => !item.ok)) {
        console.log(
          `  ${result.stage}: exit ${result.code ?? "spawn error"}${result.error ? ` (${result.error})` : ""}`,
        );
      }
    }
  }

  const summary = report.summary;
  console.log("\nSummary:");
  console.log(
    `  present local repos: ${summary.present}/${report.selectedApps}`,
  );
  console.log(
    `  MeshShell rendered: ${summary.meshShell}/${report.selectedApps}`,
  );
  console.log(
    `  room cohorts: ${summary.appRoomCohort} app-room · ${summary.featureRoomCohort} feature-room · ${summary.unavailableRoomCohort} unavailable`,
  );
  console.log(
    `  direct source foundation: ${summary.directFoundation}/${report.selectedApps}`,
  );
  console.log(
    `  Feature <main> roots: ${summary.featureMainLandmark}/${report.selectedApps}`,
  );
  console.log(`  static failures: ${summary.staticFailures}`);
  if (report.stages.length > 0)
    console.log(`  command failures: ${summary.commandFailures}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = loadCatalog(options.catalogPath);
  const selection = selectBatch(entries, options.batch, options.batchSize);
  const lastPort = options.portBase + entries.length - 1;
  if (lastPort > 65535) {
    fail(
      `--port-base ${options.portBase} leaves no unique ports through catalog index ${entries.length - 1}`,
    );
  }

  const apps = selection.entries.map((entry) =>
    inspectApp(entry, options.workspace, options),
  );
  const runnable = apps.filter((app) => app.errors.length === 0);

  if (options.stages.length > 0) {
    console.log(
      "--run is explicit: selected npm commands may create normal build/test artifacts; this runner never installs, clones, edits source, commits, or pushes.",
    );
    const skipped = apps.length - runnable.length;
    if (skipped > 0)
      console.log(`Skipping ${skipped} app(s) with static failures.`);
    await runBounded(runnable, options.stages, options.jobs, options.portBase);
  }

  const report = reportFor(options, entries, selection, apps);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printTextReport(report, apps, { list: options.list });

  // `--list` is an inventory command: it must remain useful before every app
  // has been cloned locally. Validation and explicit command modes are strict.
  const strict = !options.list || options.stages.length > 0;
  if (
    strict &&
    (report.summary.staticFailures > 0 || report.summary.commandFailures > 0)
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => fail(error?.stack ?? String(error), 1));
