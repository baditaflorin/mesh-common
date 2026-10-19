#!/usr/bin/env node
// list-public-exports.mjs — print every name a TypeScript entry module exports,
// one per line, sorted. Used by check-docs-updated.sh.
//
//   node scripts/list-public-exports.mjs [--rev <git-rev>] [entry]
//
// `entry` defaults to src/index.ts. With --rev, every file is read from that
// git revision (`git show <rev>:<path>`); without it, from the working tree.
//
// The file is parsed with the TypeScript compiler API, so multi-line
// `export { … }`, `export type { … }`, aliases (`a as b` lists `b`, the name
// consumers import), declarations and `export * from` re-exports (followed
// recursively) are all seen. Exits 2 when a file or re-exported module
// cannot be read.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

function parseArgs(argv) {
  let rev = null;
  let entry = "src/index.ts";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--rev") {
      rev = argv[++i];
      if (!rev) throw new Error("--rev needs a git revision");
    } else if (argv[i].startsWith("--")) {
      throw new Error(`unknown option: ${argv[i]}`);
    } else {
      entry = argv[i];
    }
  }
  return { rev, entry: path.posix.normalize(entry) };
}

function makeReader(rev) {
  if (rev === null) {
    return {
      exists: (file) => fs.existsSync(file) && fs.statSync(file).isFile(),
      read: (file) => fs.readFileSync(file, "utf8"),
    };
  }
  // One `git ls-tree` up front, so probing module candidates does not spawn
  // a git process per guess.
  const files = new Set(
    execFileSync("git", ["ls-tree", "-r", "--name-only", rev], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean),
  );
  return {
    exists: (file) => files.has(file),
    read: (file) =>
      execFileSync("git", ["show", `${rev}:${file}`], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      }),
  };
}

function resolveModule(fromFile, specifier, reader) {
  if (!specifier.startsWith(".")) {
    throw new Error(
      `${fromFile}: cannot follow \`export * from "${specifier}"\` (not a relative module)`,
    );
  }
  const base = path.posix.join(path.posix.dirname(fromFile), specifier);
  const stem = base.replace(/\.(m|c)?jsx?$/, "");
  const candidates = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.d.ts`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
  ];
  const found = candidates.find((candidate) => reader.exists(candidate));
  if (!found) {
    throw new Error(`${fromFile}: cannot resolve module "${specifier}"`);
  }
  return found;
}

function bindingNames(name, out) {
  if (ts.isIdentifier(name)) {
    out.push(name.text);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) bindingNames(element.name, out);
  }
}

function hasModifier(node, kind) {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some(
    (modifier) => modifier.kind === kind,
  );
}

function collectExports(file, reader, names, visiting) {
  if (visiting.has(file)) return;
  visiting.add(file);
  const source = ts.createSourceFile(
    file,
    reader.read(file),
    ts.ScriptTarget.Latest,
    false,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (clause === undefined) {
        // `export * from "./x"` re-exports every named export except default.
        const specifier = statement.moduleSpecifier;
        if (!specifier || !ts.isStringLiteral(specifier)) continue;
        const target = resolveModule(file, specifier.text, reader);
        const inner = new Set();
        collectExports(target, reader, inner, visiting);
        inner.delete("default");
        for (const name of inner) names.add(name);
      } else if (ts.isNamespaceExport(clause)) {
        names.add(clause.name.text);
      } else {
        for (const element of clause.elements) names.add(element.name.text);
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      names.add("default");
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      names.add("default");
    } else if (ts.isVariableStatement(statement)) {
      const declared = [];
      for (const declaration of statement.declarationList.declarations) {
        bindingNames(declaration.name, declared);
      }
      for (const name of declared) names.add(name);
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement) ||
        ts.isImportEqualsDeclaration(statement)) &&
      statement.name &&
      ts.isIdentifier(statement.name)
    ) {
      names.add(statement.name.text);
    }
  }
  visiting.delete(file);
}

try {
  const { rev, entry } = parseArgs(process.argv.slice(2));
  const reader = makeReader(rev);
  if (!reader.exists(entry)) {
    throw new Error(`${rev === null ? "" : `${rev}:`}${entry} does not exist`);
  }
  const names = new Set();
  collectExports(entry, reader, names, new Set());
  const sorted = [...names].sort();
  if (sorted.length > 0) process.stdout.write(`${sorted.join("\n")}\n`);
} catch (error) {
  console.error(
    `[list-public-exports] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}
