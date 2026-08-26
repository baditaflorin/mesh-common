#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const CONFIG_PATHS = ["src/config.ts", "src/shared/config.ts"];

function propertyName(property, sourceFile) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return property.name.text;
  }
  return property.name.getText(sourceFile);
}

function ownProperties(object, name, sourceFile) {
  return object.properties.filter(
    (property) =>
      ts.isPropertyAssignment(property) &&
      propertyName(property, sourceFile) === name,
  );
}

function variableNameFor(object) {
  let parent = object.parent;
  while (ts.isAsExpression(parent) || ts.isSatisfiesExpression(parent)) {
    parent = parent.parent;
  }
  if (!ts.isVariableDeclaration(parent) || !ts.isIdentifier(parent.name)) {
    return null;
  }
  return parent.name.text;
}

function isCreateMeshConfigArgument(object) {
  const call = object.parent;
  return (
    ts.isCallExpression(call) &&
    call.arguments.length > 0 &&
    call.arguments[0] === object &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === "createMeshConfig"
  );
}

/**
 * Plans one intentionally narrow config change without changing any bytes.
 * The caller chooses whether to write `nextText` after inspecting the plan.
 */
export function planBreadcrumbConfig(sourceText, fileName = "config.ts") {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const candidates = [];

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const variableName = variableNameFor(node);
      if (
        isCreateMeshConfigArgument(node) ||
        variableName === "config" ||
        variableName === "appConfig"
      ) {
        const appNames = ownProperties(node, "appName", sourceFile);
        if (appNames.length === 1) {
          candidates.push({
            object: node,
            appName: appNames[0],
            breadcrumbs: ownProperties(node, "breadcrumbs", sourceFile),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (candidates.length !== 1) {
    return {
      status: "skip",
      reason:
        candidates.length === 0
          ? "no eligible config object with one own appName property"
          : `found ${candidates.length} eligible config objects`,
    };
  }

  const candidate = candidates[0];
  if (candidate.breadcrumbs.length > 0) {
    return { status: "already", reason: "breadcrumbs is already configured" };
  }

  const appNameEnd = candidate.appName.end;
  if (sourceText.slice(appNameEnd, appNameEnd + 1) !== ",") {
    return {
      status: "skip",
      reason: "appName must have a trailing comma for an exact one-line edit",
    };
  }

  const lineStart =
    sourceText.lastIndexOf("\n", candidate.appName.getStart(sourceFile)) + 1;
  const indent = sourceText
    .slice(lineStart, candidate.appName.getStart(sourceFile))
    .match(/^\s*/)?.[0];
  if (!indent) {
    return {
      status: "skip",
      reason: "could not determine appName indentation",
    };
  }

  const newline = sourceText.includes("\r\n") ? "\r\n" : "\n";
  const insertAt = appNameEnd + 1;
  return {
    status: "add",
    nextText: `${sourceText.slice(0, insertAt)}${newline}${indent}breadcrumbs: false,${sourceText.slice(insertAt)}`,
  };
}

export function findConfigPath(appDirectory) {
  const matches = CONFIG_PATHS.filter((candidate) =>
    fs.existsSync(path.join(appDirectory, candidate)),
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? "no supported config path (expected src/config.ts or src/shared/config.ts)"
        : `ambiguous config paths: ${matches.join(", ")}`,
    );
  }
  return path.join(appDirectory, matches[0]);
}

export function migrateBreadcrumbConfig(
  appDirectory,
  { write = false, check = false } = {},
) {
  const configPath = findConfigPath(appDirectory);
  const sourceText = fs.readFileSync(configPath, "utf8");
  const plan = planBreadcrumbConfig(sourceText, configPath);

  if (plan.status === "add") {
    if (check) {
      throw new Error(`${configPath}: breadcrumbs is missing`);
    }
    if (write) fs.writeFileSync(configPath, plan.nextText);
  } else if (plan.status === "skip") {
    throw new Error(`${configPath}: ${plan.reason}`);
  }

  return { configPath, ...plan };
}

function main(args) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  const appDirectory = args.find((arg) => !arg.startsWith("--"));
  if (!appDirectory || (write && check)) {
    throw new Error(
      "usage: node scripts/add-breadcrumbs-config.mjs [--write|--check] <app-directory>",
    );
  }

  const result = migrateBreadcrumbConfig(path.resolve(appDirectory), {
    write,
    check,
  });
  const verb =
    result.status === "add" ? (write ? "added" : "would add") : "kept";
  console.log(`${verb} breadcrumbs config: ${result.configPath}`);
}

function isCliInvocation() {
  const invokedPath = process.argv[1];
  if (!invokedPath) return false;

  try {
    return fs.realpathSync(invokedPath) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isCliInvocation()) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
