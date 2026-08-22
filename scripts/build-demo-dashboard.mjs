#!/usr/bin/env node
/**
 * build-demo-dashboard.mjs — render docs/demos/index.html for the recorded
 * fleet. Reads `docs/demos/<app>/{demo.gif,preview.png,status,record.log}`
 * and emits a single grid page. Optionally enriches with TRL + display name
 * from services-registry/services.json if present.
 *
 * Usage (from mesh-common/):
 *   node scripts/build-demo-dashboard.mjs
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { assertCategoryDiversity, taxonomyFor } from "../scenarios/taxonomy.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DEMOS_DIR = path.join(ROOT, "docs", "demos");
const REGISTRY_PATH_1 = path.resolve(ROOT, "..", "services-registry", "services.json");
const REGISTRY_PATH_2 = path.resolve(ROOT, "..", "..", "services-registry", "services.json");
const REGISTRY_PATH = existsSync(REGISTRY_PATH_1) ? REGISTRY_PATH_1 : REGISTRY_PATH_2;
const OUT_PATH = path.join(DEMOS_DIR, "index.html");
const TAXONOMY_OUT_PATH = path.join(DEMOS_DIR, "taxonomy.json");
const SCENARIOS_DIR = path.join(ROOT, "scenarios");
const checkOnly = process.argv.includes("--check-recordings");

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

const registryById = new Map();
if (existsSync(REGISTRY_PATH)) {
  try {
    const data = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
    for (const svc of data) if (svc?.id) registryById.set(svc.id, svc);
  } catch (e) {
    console.warn("registry parse failed:", e.message);
  }
}

const entries = (await readdir(DEMOS_DIR, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

assertCategoryDiversity(entries);

// A scenario advertises a service in the recorded fleet. Do not let a new
// service silently reach the catalog with a fallback image or no proof that
// the two-peer flow ran. `_helpers.mjs` is intentionally shared support code,
// not a service scenario.
const scenarioFiles = existsSync(SCENARIOS_DIR)
  ? (await readdir(SCENARIOS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.startsWith("_") && entry.name !== "taxonomy.mjs")
      .map((entry) => entry.name.slice(0, -4))
      .sort()
  : [];
const missingRecordings = [];
for (const app of scenarioFiles) {
  const appDir = path.join(DEMOS_DIR, app);
  const status = existsSync(path.join(appDir, "status"))
    ? (await readFile(path.join(appDir, "status"), "utf8")).trim()
    : "MISSING";
  const hasGif = existsSync(path.join(appDir, "demo.gif")) && (await stat(path.join(appDir, "demo.gif"))).size > 0;
  const hasPng = existsSync(path.join(appDir, "preview.png")) && (await stat(path.join(appDir, "preview.png"))).size > 0;
  if (status !== "OK" || !hasGif || !hasPng) {
    missingRecordings.push(`${app} (status=${status}, gif=${hasGif}, preview=${hasPng})`);
  }
}
if (missingRecordings.length > 0) {
  throw new Error(`recording gate failed:\n${missingRecordings.join("\n")}`);
}
if (checkOnly) {
  console.log(`recording gate passed: ${scenarioFiles.length} app scenarios have OK status, GIF, and preview`);
  process.exit(0);
}

const cards = [];
const taxonomy = {};
let okCount = 0;
let failCount = 0;

for (const app of entries) {
  const appDir = path.join(DEMOS_DIR, app);
  const statusPath = path.join(appDir, "status");
  const gifPath = path.join(appDir, "demo.gif");
  const pngPath = path.join(appDir, "preview.png");
  const logPath = path.join(appDir, "record.log");
  const status = existsSync(statusPath) ? (await readFile(statusPath, "utf8")).trim() : "MISSING";
  const hasGif = existsSync(gifPath) && (await stat(gifPath)).size > 0;
  const hasPng = existsSync(pngPath) && (await stat(pngPath)).size > 0;
  const reg = registryById.get(app);
  const name = reg?.name || app;
  const trl = reg?.trl ?? "";
  const pagesUrl = reg?.url || `https://baditaflorin.github.io/${app}/`;
  const classification = taxonomyFor(app);
  taxonomy[app] = classification;
  const ok = status === "OK" && hasGif;
  if (ok) okCount++;
  else failCount++;

  // Extract a short error hint if the record failed
  let errHint = "";
  if (!ok && existsSync(logPath)) {
    try {
      const log = await readFile(logPath, "utf8");
      const tail = log.trim().split("\n").slice(-5).join("\n");
      errHint = tail.slice(-280);
    } catch {}
  }

  cards.push(`
    <article
      class="card ${ok ? "ok" : "fail"}"
      data-name="${escapeHtml(name).toLowerCase()}"
      data-slug="${escapeHtml(app).toLowerCase()}"
      data-status="${ok ? "ok" : "fail"}"
      data-trl="${escapeHtml(trl)}"
      data-category="${escapeHtml(classification.category)}"
      data-subcategory="${escapeHtml(classification.subcategory)}"
      data-usecases="${escapeHtml(classification.useCases.join("|"))}"
    >
      <div class="media">
        ${hasGif
          ? `<img class="gif" src="${escapeHtml(app)}/demo.gif" alt="${escapeHtml(name)} demo" loading="lazy" />`
          : hasPng
          ? `<img class="gif" src="${escapeHtml(app)}/preview.png" alt="${escapeHtml(name)} preview" loading="lazy" />`
          : `<div class="empty">no recording</div>`}
      </div>
      <div class="card-body">
        <div class="card-meta"><span class="status status-${ok ? "ok" : "fail"}" aria-label="Recording status: ${escapeHtml(status)}">${escapeHtml(status)}</span>${trl !== "" ? `<span class="trl trl-${trl}">TRL ${escapeHtml(trl)}</span>` : ""}</div>
        <a class="title" href="${escapeHtml(pagesUrl)}" target="_blank" rel="noreferrer" aria-label="Open ${escapeHtml(name)} demo">${escapeHtml(name)} <span aria-hidden="true">↗</span></a>
        <p class="card-taxonomy">${escapeHtml(classification.category)} <span>·</span> ${escapeHtml(classification.subcategory)}</p>
        <div class="usecase-list">${classification.useCases.map((useCase) => `<span>${escapeHtml(useCase)}</span>`).join("")}</div>${errHint ? `<details class="errhint"><summary>log tail</summary><pre>${escapeHtml(errHint)}</pre></details>` : ""}
        <code class="slug">${escapeHtml(app)}</code>
      </div>
    </article>
  `);
}

const generatedAt = new Date().toISOString();
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Mesh fleet demos — ${entries.length} apps</title>
  <style>
    :root { color-scheme: dark; --ink: #edf2ff; --muted: #9eabc4; --line: rgba(181, 194, 230, .16); --panel: rgba(20, 29, 50, .78); --panel-strong: #17203a; --violet: #a78bfa; --cyan: #67e8f9; --green: #6ee7b7; }
    * { box-sizing: border-box; }
    html { background: #090d1a; }
    body { min-width: 320px; margin: 0; color: var(--ink); background: radial-gradient(circle at 15% -8%, #3d2e72 0, transparent 28rem), radial-gradient(circle at 92% 8%, #0d5364 0, transparent 30rem), #090d1a; font: 15px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    a { color: inherit; text-decoration: none; }
    button, input, select { font: inherit; }
    .page { width: min(1480px, calc(100% - 48px)); margin: 0 auto; }
    header.page { padding: clamp(2.5rem, 6vw, 5rem) 0 1rem; }
    .hero { max-width: 850px; }
    .eyebrow { margin: 0 0 .7rem; color: var(--cyan); font-size: .76rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    header.page h1 { max-width: 12ch; margin: 0; font-size: clamp(2.65rem, 7vw, 5.75rem); line-height: .96; letter-spacing: -.07em; }
    header.page .sub { max-width: 50rem; margin: 1.2rem 0 0; color: var(--muted); font-size: clamp(1rem, 2.2vw, 1.18rem); }
    .rootless-banner { max-width: 900px; margin-top: 1.6rem; padding: .85rem 1rem; border: 1px solid var(--line); border-radius: .85rem; color: #c7d2eb; background: rgba(9, 13, 26, .36); font-size: .88rem; line-height: 1.55; }
    .rootless-banner a { color: var(--cyan); text-decoration: underline; text-underline-offset: 3px; }
    .discover { margin-top: clamp(1.6rem, 4vw, 3rem); padding: clamp(1rem, 3vw, 1.6rem); border: 1px solid var(--line); border-radius: 1.4rem; background: linear-gradient(145deg, rgba(26, 36, 65, .9), rgba(14, 20, 38, .9)); box-shadow: 0 24px 70px #02050e66; }
    .discover-header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
    .discover h2 { margin: 0; font-size: 1.15rem; letter-spacing: -.02em; }
    .discover-help { margin: 0; color: var(--muted); font-size: .86rem; }
    .catalog-controls { display: grid; grid-template-columns: minmax(14rem, 1.25fr) repeat(2, minmax(10rem, .7fr)); gap: .85rem; }
    .catalog-search { display: grid; gap: .4rem; color: var(--muted); font-size: .78rem; font-weight: 700; letter-spacing: .03em; }
    .catalog-search input, .catalog-search select { width: 100%; min-height: 2.85rem; border: 1px solid var(--line); border-radius: .8rem; outline: none; color: var(--ink); background: rgba(7, 11, 24, .62); padding: .65rem .8rem; transition: border-color .2s ease, box-shadow .2s ease; }
    .catalog-search input::placeholder { color: #77849f; }
    .catalog-search input:focus, .catalog-search select:focus { border-color: var(--cyan); box-shadow: 0 0 0 3px #67e8f925; }
    .filter-row, .usecase-row { display: flex; grid-column: 1 / -1; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .filter-label { margin-right: .2rem; color: var(--muted); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .filter { appearance: none; cursor: pointer; border: 1px solid var(--line); border-radius: 999px; color: #cbd5ea; background: rgba(7, 11, 24, .5); padding: .45rem .7rem; font-size: .8rem; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
    .filter:hover { transform: translateY(-1px); border-color: #c4b5fd99; }
    .filter span { margin-left: .2rem; color: var(--muted); font-variant-numeric: tabular-nums; }
    .filter.is-active { border-color: transparent; color: #130d2a; background: linear-gradient(100deg, var(--cyan), #c4b5fd); font-weight: 800; }
    .filter.is-active span { color: #322256; }
    .usecase-details { grid-column: 1 / -1; border-top: 1px solid var(--line); padding-top: .9rem; }.usecase-details summary { display: flex; justify-content: space-between; cursor: pointer; color: #dbe6fb; font-size: .86rem; font-weight: 700; list-style: none; }.usecase-details summary::-webkit-details-marker { display: none; }.usecase-details summary::before { content: "+"; margin-right: .45rem; color: var(--cyan); }.usecase-details[open] summary::before { content: "–"; }.usecase-details summary span { color: var(--muted); font-size: .74rem; font-weight: 600; }.usecase-tools { display: flex; align-items: center; gap: .55rem; margin-top: .75rem; }.usecase-search { flex: 1; min-width: 13rem; }.usecase-search input { width: 100%; min-height: 2.45rem; border: 1px solid var(--line); border-radius: .7rem; outline: none; color: var(--ink); background: rgba(7, 11, 24, .62); padding: .55rem .7rem; }.usecase-search input:focus { border-color: var(--cyan); box-shadow: 0 0 0 3px #67e8f925; }.usecase-search input::placeholder { color: #77849f; }.usecase-expand { flex: 0 0 auto; }.usecase-row { margin-top: .75rem; }.usecase-chip { padding: .38rem .65rem; font-size: .76rem; }.usecase-empty { margin: .2rem 0; color: var(--muted); font-size: .8rem; }.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .catalog-results { grid-column: 1 / -1; margin: .3rem 0 0; color: #dbe6fb; font-size: .9rem; }
    main { width: min(1480px, calc(100% - 48px)); margin: 0 auto; padding: 1.5rem 0 4.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.1rem; }
    .card { overflow: hidden; border: 1px solid var(--line); border-radius: 1.15rem; background: linear-gradient(180deg, var(--panel-strong), #10182d); box-shadow: 0 12px 35px #02050e44; transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
    .card:hover { transform: translateY(-4px); border-color: #a78bfa8c; box-shadow: 0 20px 48px #02050e7a; }
    .card[hidden] { display: none; }
    .card.fail { border-color: #f8717188; }
    .media { aspect-ratio: 1.18 / 1; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #090d1a; }
    .media .gif { width: 100%; height: 100%; object-fit: cover; display: block; }
    .media .empty { padding: 2rem; color: var(--muted); font-style: italic; }
    .card-body { display: grid; gap: .65rem; padding: 1rem 1rem .95rem; }
    .card-meta { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
    .status, .trl { display: inline-flex; width: fit-content; align-items: center; border-radius: 999px; padding: .24rem .48rem; font-size: .68rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
    .status-ok { color: #a7f3d0; background: #065f4655; }.status-fail { color: #fecaca; background: #7f1d1d88; }.trl { color: #d9e2f7; background: #33415588; }.trl-1, .trl-2 { color: #fecaca; background: #7f1d1d88; }.trl-3, .trl-4 { color: #fde68a; background: #78350f88; }.trl-5, .trl-6 { color: #bae6fd; background: #0c4a6e88; }.trl-7, .trl-8, .trl-9 { color: #bbf7d0; background: #14532d88; }
    .card .title { font-size: 1.1rem; font-weight: 780; letter-spacing: -.025em; }.card .title span { color: var(--cyan); }.card .title:hover { color: var(--cyan); }.card-taxonomy { margin: 0; color: #b9c6dd; font-size: .82rem; }.card-taxonomy span { color: var(--violet); padding: 0 .18rem; }.usecase-list { display: flex; flex-wrap: wrap; gap: .35rem; }.usecase-list span { border-radius: .45rem; color: #aebbd2; background: #263552; padding: .18rem .4rem; font-size: .68rem; }.slug { margin-top: .15rem; color: #71809b; font-size: .7rem; }.errhint summary { cursor: pointer; color: #fecaca; font-size: .75rem; }.errhint pre { max-height: 120px; overflow: auto; border-radius: .5rem; background: #090d1a; padding: .6rem; white-space: pre-wrap; font-size: .7rem; }
    footer.page { padding: 0 0 2.5rem; color: #70809d; font-size: .8rem; }
    :focus-visible { outline: 3px solid var(--cyan); outline-offset: 3px; }
    @media (max-width: 760px) { .page, main { width: min(100% - 28px, 1480px); } .catalog-controls { grid-template-columns: 1fr 1fr; } .catalog-search:first-child { grid-column: 1 / -1; } main { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); } }
    @media (max-width: 520px) { header.page { padding-top: 2.5rem; } .catalog-controls { grid-template-columns: 1fr; } .catalog-search:first-child { grid-column: auto; } .discover-header { align-items: flex-start; flex-direction: column; gap: .35rem; } .filter-row, .usecase-row { align-items: flex-start; } .filter-label { width: 100%; } .usecase-tools { align-items: stretch; flex-direction: column; } .usecase-search { min-width: 0; } .usecase-expand { width: 100%; } main { grid-template-columns: 1fr; gap: .9rem; } .card:hover { transform: none; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; } }
  </style>
</head>
<body>
  <header class="page">
    <div class="hero">
      <p class="eyebrow">Browser-local collaboration</p>
      <h1>Find the right shared moment.</h1>
      <p class="sub">${entries.length} recorded apps for games, facilitation, creative play, and real-world coordination. Every card is a real two-peer recording.</p>
    </div>
    <div class="rootless-banner">
      Built with <a href="https://baditaflorin.github.io/rootless-computing/" target="_blank" rel="noreferrer">Rootless Computing</a>: no origin server, local-first data, and direct WebRTC/Yjs coordination through <a href="https://baditaflorin.github.io/mesh-common/" target="_blank" rel="noreferrer">mesh-common</a>.
    </div>
    <section class="discover" aria-label="Browse the demo catalog">
      <div class="discover-header"><h2>Explore the catalog</h2><p class="discover-help">Filter by purpose, then open a live app.</p></div>
      <div class="catalog-controls" role="search">
        <label class="catalog-search"><span>Search</span><input id="demo-search" type="search" placeholder="Search apps, e.g. ‘bingo’ or ‘retro’" autocomplete="off" /></label>
        <label class="catalog-search"><span>Category</span><select id="demo-category"><option value="">All categories</option></select></label>
        <label class="catalog-search"><span>Subcategory</span><select id="demo-subcategory"><option value="">All subcategories</option></select></label>
        <div class="filter-row" aria-label="Recording state"><span class="filter-label">Recording</span><button type="button" class="filter is-active" data-filter="all" aria-pressed="true">All <span>${entries.length}</span></button><button type="button" class="filter" data-filter="ok" aria-pressed="false">Working <span>${okCount}</span></button><button type="button" class="filter" data-filter="fail" aria-pressed="false">Needs attention <span>${failCount}</span></button><button id="demo-reset" class="filter" type="button">Reset</button></div>
        <details class="usecase-details"><summary>Filter by use case <span id="demo-usecase-summary">Optional · multi-select</span></summary><div class="usecase-tools"><label class="usecase-search"><span class="sr-only">Search use cases</span><input id="demo-usecase-search" type="search" placeholder="Search use cases" autocomplete="off" /></label><button id="demo-usecase-expand" class="filter usecase-expand" type="button" hidden></button></div><div id="demo-usecase-chips" class="usecase-row" aria-label="Filter by one or more use cases"></div></details>
        <p id="demo-results" class="catalog-results" role="status" aria-live="polite">Showing all ${entries.length} demos</p>
      </div>
    </section>
  </header>
  <main>
    ${cards.join("\n")}
  </main>
  <footer class="page">
    Each card shows a ~15s side-by-side recording of two BroadcastChannel-meshed peers. Source: mesh-common/scripts/record-demo.sh.
  </footer>
  <script>
    (() => {
      const search = document.querySelector("#demo-search");
      const buttons = [...document.querySelectorAll(".filter[data-filter]")];
      const cards = [...document.querySelectorAll(".card")];
      const results = document.querySelector("#demo-results");
      const category = document.querySelector("#demo-category");
      const subcategory = document.querySelector("#demo-subcategory");
      const usecaseChips = document.querySelector("#demo-usecase-chips");
      const usecaseSearch = document.querySelector("#demo-usecase-search");
      const usecaseExpand = document.querySelector("#demo-usecase-expand");
      const usecaseSummary = document.querySelector("#demo-usecase-summary");
      const reset = document.querySelector("#demo-reset");
      let filter = "all";
      let showAllUseCases = false;
      const selectedUseCases = new Set();
      const USE_CASE_SUGGESTION_LIMIT = 8;

      const subcategoriesByCategory = new Map();
      for (const card of cards) {
        const values = subcategoriesByCategory.get(card.dataset.category) ?? new Set();
        values.add(card.dataset.subcategory);
        subcategoriesByCategory.set(card.dataset.category, values);
      }

      for (const value of [...subcategoriesByCategory.keys()].sort()) {
        const count = cards.filter((card) => card.dataset.category === value).length;
        category.add(new Option(value + " · " + count, value));
      }

      const populateSubcategories = () => {
        const previouslySelected = subcategory.value;
        const values = category.value
          ? subcategoriesByCategory.get(category.value) ?? new Set()
          : new Set(cards.map((card) => card.dataset.subcategory));

        subcategory.replaceChildren(new Option("All subcategories", ""));
        for (const value of [...values].sort()) {
          const count = cards.filter((card) => (!category.value || card.dataset.category === category.value) && card.dataset.subcategory === value).length;
          subcategory.add(new Option(value + " · " + count, value));
        }
        if (values.has(previouslySelected)) subcategory.value = previouslySelected;
      };

      const taxonomyCards = () => cards.filter((card) =>
        (!category.value || card.dataset.category === category.value)
        && (!subcategory.value || card.dataset.subcategory === subcategory.value),
      );

      const rankedUseCases = () => {
        const counts = new Map();
        for (const card of taxonomyCards()) {
          for (const value of card.dataset.usecases.split("|")) counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return [...counts.entries()]
          .sort(([leftValue, leftCount], [rightValue, rightCount]) => rightCount - leftCount || leftValue.localeCompare(rightValue))
          .map(([value]) => value);
      };

      const renderUseCases = () => {
        const values = rankedUseCases();
        const query = usecaseSearch.value.trim().toLowerCase();
        const matching = query ? values.filter((value) => value.toLowerCase().includes(query)) : values;
        const selected = values.filter((value) => selectedUseCases.has(value));
        const suggested = showAllUseCases || query ? matching : matching.slice(0, USE_CASE_SUGGESTION_LIMIT);
        const visible = [...new Set([...selected, ...suggested])];
        usecaseChips.replaceChildren();

        if (visible.length === 0) {
          const empty = document.createElement("p");
          empty.className = "usecase-empty";
          empty.textContent = query ? "No use cases match that search." : "No use cases are available for this selection.";
          usecaseChips.append(empty);
        }

        for (const value of visible) {
          const button = document.createElement("button");
          const active = selectedUseCases.has(value);
          button.type = "button";
          button.className = "filter usecase-chip";
          button.dataset.usecase = value;
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
          button.textContent = value;
          button.addEventListener("click", () => {
            if (active) selectedUseCases.delete(value); else selectedUseCases.add(value);
            renderUseCases();
            apply();
          });
          usecaseChips.append(button);
        }

        usecaseExpand.hidden = Boolean(query) || matching.length <= USE_CASE_SUGGESTION_LIMIT;
        usecaseExpand.textContent = showAllUseCases ? "Show fewer" : "Show all " + matching.length;
        const selection = selectedUseCases.size ? selectedUseCases.size + " selected" : Math.min(matching.length, USE_CASE_SUGGESTION_LIMIT) + " suggestions";
        usecaseSummary.textContent = selection + " · " + values.length + " available";
      };

      populateSubcategories();
      renderUseCases();

      const apply = () => {
        const query = search.value.trim().toLowerCase();
        let shown = 0;
        for (const card of cards) {
          const matchesFilter = filter === "all" || card.dataset.status === filter;
          const haystack = card.dataset.name + " " + card.dataset.slug;
          const matchesTaxonomy = (!category.value || card.dataset.category === category.value)
            && (!subcategory.value || card.dataset.subcategory === subcategory.value)
            && (selectedUseCases.size === 0 || [...selectedUseCases].every((useCase) => card.dataset.usecases.split("|").includes(useCase)));
          const visible = matchesFilter && matchesTaxonomy && haystack.includes(query);
          card.hidden = !visible;
          if (visible) shown++;
        }
        results.textContent = shown === 1 ? "Showing 1 demo" : "Showing " + shown + " demos";
      };

      search.addEventListener("input", apply);
      category.addEventListener("change", () => {
        selectedUseCases.clear();
        usecaseSearch.value = "";
        showAllUseCases = false;
        populateSubcategories();
        renderUseCases();
        apply();
      });
      subcategory.addEventListener("change", () => {
        selectedUseCases.clear();
        usecaseSearch.value = "";
        showAllUseCases = false;
        renderUseCases();
        apply();
      });
      usecaseSearch.addEventListener("input", () => {
        showAllUseCases = false;
        renderUseCases();
      });
      usecaseExpand.addEventListener("click", () => {
        showAllUseCases = !showAllUseCases;
        renderUseCases();
      });
      buttons.forEach((button) => button.addEventListener("click", () => {
        filter = button.dataset.filter;
        buttons.forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
        apply();
      }));
      reset.addEventListener("click", () => {
        search.value = "";
        category.value = "";
        populateSubcategories();
        subcategory.value = "";
        filter = "all";
        selectedUseCases.clear();
        usecaseSearch.value = "";
        showAllUseCases = false;
        renderUseCases();
        buttons.forEach((button) => {
          const active = button.dataset.filter === "all";
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
        apply();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && document.activeElement === search && search.value) {
          search.value = "";
          apply();
        }
      });
    })();
  </script>
</body>
</html>
`;

await writeFile(OUT_PATH, html);
await writeFile(TAXONOMY_OUT_PATH, `${JSON.stringify(taxonomy, null, 2)}\n`);
console.log(`wrote ${OUT_PATH}`);
console.log(`  total apps: ${entries.length}`);
console.log(`  OK:         ${okCount}`);
console.log(`  failed:     ${failCount}`);
